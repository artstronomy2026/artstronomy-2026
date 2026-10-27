import * as T from 'three';
import { initialPixelRatio, createRenderBudget, createFrameGate } from '../performance/render-budget.js';
import { isHandheld } from '../immersive/device-look.js';
import { createDeviceLook } from '../immersive/device-look.js';
import {deviceQuality} from '../environments/quality.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildHubScene } from './hub-scene.js';
import { makeHubScreens } from './hub-screens.js';
import { HUB_SCREENS, clampLook } from './hub-config.js';
import { createVRView } from '../immersive/vr-view.js';

export function createHub({host,onSelect,onHover,onReady,onFallback,monitorElement,initialCinematic,onMotion=()=>{},onVR=()=>{}}) {
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); }
  catch { onFallback('3D is unavailable in this browser. The image view and all four destinations are still available.');return {dispose(){},home(){},focus(){},setCinematic(){},launch(id){onSelect(id);}}; }
  const quality=deviceQuality(isHandheld());
  const pixelRatio=initialPixelRatio({dpr:devicePixelRatio||1,width:host.clientWidth,height:host.clientHeight,mobile:isHandheld()});
  renderer.setPixelRatio(pixelRatio);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  host.appendChild(renderer.domElement);const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Spaceship cockpit. Drag to look around, use arrow keys to look, or use the four destination buttons.');
  const textures=[];let disposed=false,active=true;
  const loadTexture=(url,repeat=false)=>{const t=new T.TextureLoader().load(url,()=>{if(disposed)t.dispose();},undefined,()=>{});t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(2,2);}textures.push(t);return t;};
  const metalMap=loadTexture('/assets/hub/cockpit-metal-albedo.webp',true),planetMap=loadTexture('/assets/hub/gas-giant-albedo.webp');
  const screens=makeHubScreens();const world=buildHubScene({screenMaterials:screens.items.map(s=>s.material),nameplateMaterial:screens.nameplateMaterial,metalMap,planetMap,quality});
  const {scene}=world,camera=new T.PerspectiveCamera(57,1,.08,240);
  const eye=new T.Vector3(0,2.75,6.35),seatTarget=new T.Vector3(0,2.85,-5);
  camera.position.copy(eye);camera.lookAt(seatTarget);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
  const composer=new EffectComposer(renderer);const renderPass=new RenderPass(scene,camera),bloom=new UnrealBloomPass(new T.Vector2(1,1),.17,.35,1.25),output=new OutputPass();composer.addPass(renderPass);if(quality.bloom)composer.addPass(bloom);composer.addPass(output);
  const feedTarget=quality.name==='high'?new T.WebGLRenderTarget(512,256,{depthBuffer:true}):null;
  if(feedTarget){world.feed.material.map=feedTarget.texture;world.feed.visible=true;}
  let lastFeed=-1000,controlDrag=null,lastMetrics=0,feedEnabled=!!feedTarget;
  renderer.info.autoReset=false;
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),look={yaw:0,pitch:0},current={yaw:0,pitch:0};
  let cinematic=null,monitorLayoutDirty=true;
  const frameGate=createFrameGate();
  const portal=new T.Group();portal.position.set(0,3.1,-7);portal.visible=false;scene.add(portal);
  const portalGeometry=new T.TorusGeometry(1,.055,20,128),portalMaterial=new T.MeshBasicMaterial({color:0x9cebdd});
  const ring=new T.Mesh(portalGeometry,portalMaterial);portal.add(ring);
  const outer=new T.Mesh(portalGeometry,new T.MeshBasicMaterial({color:0xf9d879}));outer.scale.setScalar(1.1);portal.add(outer);
  let drag=null,hover=-1,lastTime=0,lastScreen=0,travel=null,portrait=false,ready=false;
  // Hub yaw convention is opposite to Three's Euler yaw.
  const sensors=createDeviceLook({read:()=>({yaw:-look.yaw,pitch:look.pitch}),apply:value=>Object.assign(look,clampLook(-value.yaw,value.pitch)),blocked:()=>!!cinematic||!!drag||!!vr?.active,onState:onMotion});
  const seatedPose=()=>({x:eye.x,y:eye.y,z:eye.z,yaw:-current.yaw});
  const vr=createVRView({renderer,scene,camera,
    buttons:[{label:'Recenter seat',action:()=>vr.teleport({...seatedPose(),yaw:0})},{label:'Exit VR',action:()=>vr.end()?.catch(()=>{})}],
    caption:()=> 'Spaceship · seated headset view',
    beforeStart:()=>{sensors.stop();drag=null;controlDrag=null;setHover(null);},
    onChange:onVR,afterEnd:()=>{lastTime=0;frameGate.reset();budget.reset();resize();},
  });
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),listeners=[];
  const listen=(el,event,fn,opts)=>{el.addEventListener(event,fn,opts);listeners.push(()=>el.removeEventListener(event,fn,opts));};
  function resize(){if(renderer.xr.isPresenting)return;monitorLayoutDirty=true;const {width,height}=host.getBoundingClientRect();if(!width||!height)return;portrait=width/height<.95;camera.aspect=width/height;camera.fov=portrait?72:57;camera.updateProjectionMatrix();renderer.setSize(width,height);composer.setSize(width,height);bloom.setSize(width*renderer.getPixelRatio()*.6,height*renderer.getPixelRatio()*.6);}
  const budget=createRenderBudget(pixelRatio,ratio=>{if(!renderer.xr.isPresenting){renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);resize();}});
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function pick(event){const b=canvas.getBoundingClientRect();pointer.set((event.clientX-b.left)/b.width*2-1,-(event.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(world.screens)[0]?.object.userData.id;}
  function setHover(id){const next=HUB_SCREENS.findIndex(s=>s.id===id);if(next===hover)return;if(hover>=0)screens.draw(hover,lastTime,false);hover=next;if(hover>=0)screens.draw(hover,lastTime,true);onHover(id||null);canvas.style.cursor=hover>=0?'pointer':'grab';}
  function launch(id){if(cinematic||vr.active)return;onSelect(id);}
  function monitorPose(id){const index=Math.max(0,HUB_SCREENS.findIndex(s=>s.id===id)),mesh=world.screens[index];scene.updateMatrixWorld(true);const aim=mesh.getWorldPosition(new T.Vector3());const q=mesh.getWorldQuaternion(new T.Quaternion());
    const distance=Math.max(1.48/(2*Math.tan(T.MathUtils.degToRad(camera.fov)/2)*.78),2.34/(2*Math.tan(T.MathUtils.degToRad(camera.fov)/2)*camera.aspect*.9));
    return {aim,position:aim.clone().add(new T.Vector3(0,0,distance).applyQuaternion(q))};
  }
  function setCinematic(value){
    frameGate.reset();budget.reset();monitorLayoutDirty=true;portal.visible=false;screens.items.forEach(s=>s.material.color.set(0xffffff));
    if(!value){cinematic=null;home();return;}
    cinematic={...value,started:performance.now(),from:camera.position.clone(),fromQ:camera.quaternion.clone()};
    if(value.kind==='return'){const pose=monitorPose(value.monitor||'website');camera.position.copy(pose.position);camera.lookAt(pose.aim);cinematic.from.copy(camera.position);cinematic.fromQ.copy(camera.quaternion);}
    if(value.kind==='airlock'&&value.reverse){camera.position.set(0,3.1,-22.7);camera.lookAt(0,3.1,-30);cinematic.from.copy(camera.position);cinematic.fromQ.copy(camera.quaternion);world.dock.open(1);}
    if(value.kind==='arrival'&&value.from!=='gallery'){camera.position.set(0,3.1,-4.5);camera.lookAt(seatTarget);cinematic.from.copy(camera.position);cinematic.fromQ.copy(camera.quaternion);}
    if(value.kind==='approach'||value.kind==='dock'||value.kind==='airlock'){world.dock.root.position.set(0,3.1,-24);world.dock.root.scale.setScalar(1.5);}
    if(value.kind==='portal'){portal.visible=true;if(value.to==='website')screens.items.forEach(s=>s.material.color.set(0x000000));}
  }
  function focus(id){const index=HUB_SCREENS.findIndex(s=>s.id===id);if(index<0)return;const target=new T.Vector3();world.screens[index].getWorldPosition(target);look.yaw=Math.atan2(target.x-eye.x,eye.z-target.z);look.pitch=Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z));setHover(id);}
  function home(){world.dock.open(0);world.dock.root.position.set(12,4,-50);sensors.reset();look.yaw=0;look.pitch=0;travel=null;camera.position.copy(eye);}
  listen(canvas,'pointerdown',e=>{if(cinematic||vr.active)return;pick(e);const control=raycaster.intersectObjects(world.details.controls)[0]?.object;if(control){controlDrag={index:control.userData.control,x:e.clientX};canvas.setPointerCapture(e.pointerId);return;}drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
  listen(canvas,'pointermove',e=>{if(cinematic||vr.active)return;if(controlDrag){world.details.adjust(controlDrag.index,(e.clientX-controlDrag.x)*.015);controlDrag.x=e.clientX;return;}if(drag){const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;Object.assign(look,clampLook(look.yaw-dx*.0022,look.pitch+dy*.0018));drag.lastX=e.clientX;drag.lastY=e.clientY;if(drag.moved)setHover(null);}else setHover(pick(e));});
  listen(canvas,'pointerup',e=>{if(controlDrag){controlDrag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);return;}if(!drag)return;const moved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!moved){const id=pick(e);if(id)launch(id);}});
  listen(canvas,'pointercancel',()=>{drag=null;controlDrag=null;});listen(canvas,'pointerleave',()=>{if(!drag)setHover(null);});
  listen(canvas,'keydown',e=>{if(cinematic||vr.active)return;const arrows={ArrowLeft:[-.09,0],ArrowRight:[.09,0],ArrowUp:[0,.07],ArrowDown:[0,-.07]};if(arrows[e.key]){e.preventDefault();Object.assign(look,clampLook(look.yaw+arrows[e.key][0],look.pitch+arrows[e.key][1]));}if(e.key==='Home'){e.preventDefault();home();}if(e.key==='Enter'&&hover>=0){e.preventDefault();launch(HUB_SCREENS[hover].id);}});
  listen(canvas,'webglcontextlost',e=>{e.preventDefault();active=false;renderer.setAnimationLoop(null);onFallback('The 3D view was interrupted. You can still open any destination below.');});
  function tick(time,xrFrame){if(disposed||!active||document.hidden)return;
    const monitorSettled=cinematic?.kind==='monitor'&&time-cinematic.started>=(cinematic.duration||0);
    if(!vr.active&&!frameGate.due(time,monitorSettled?15:quality.fps))return;
    if(!vr.active&&!monitorSettled)budget.sample(time*quality.fps/60);
    const dt=Math.min((time-lastTime)/1000||.016,.05);lastTime=time;
    if(vr.active){vr.update(xrFrame,time);}else if(cinematic){
      const t=cinematic.duration?Math.min(1,(time-cinematic.started)/cinematic.duration):1,e=t*t*(3-2*t);
      let destination=eye.clone(),aim=seatTarget.clone();
      if(cinematic.kind==='monitor'){const pose=monitorPose(cinematic.monitor||'scanner');destination=pose.position;aim=pose.aim;}
      if(cinematic.kind==='depart'){destination.set(0,2.85,5.7);aim.set(0,3.1,-30);}
      if(cinematic.kind==='warp'){destination.set(0,3.1,-7);aim.set(0,3.1,-30);}
      if(cinematic.kind==='approach'){destination.set(0,3.1,-17);aim.set(0,3.1,-26);}
      if(cinematic.kind==='dock'){destination.set(0,3.1,-20);aim.set(0,3.1,-26);}
      if(cinematic.kind==='airlock'){destination.set(0,3.1,cinematic.reverse?-17:-23);aim.set(0,3.1,-32);world.dock.open(cinematic.reverse?1-e:e);}
      if(cinematic.kind==='undock'){destination.set(0,3.1,2);aim.set(0,3.1,-30);}
      if(cinematic.kind==='portal'){portal.visible=true;portal.scale.setScalar(.05+Math.min(1,t*2.3)*2.15);portal.rotation.z=time*.00015;outer.rotation.z=-time*.0004;destination.set(0,3.1,-8);aim.set(0,3.1,-30);}
      camera.position.lerpVectors(cinematic.from,destination,e);
      const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(camera.position,aim,camera.up));camera.quaternion.slerpQuaternions(cinematic.fromQ,q,e);
    }else{const blend=reduced.matches?1:1-Math.exp(-dt*9);current.yaw+=(look.yaw-current.yaw)*blend;current.pitch+=(look.pitch-current.pitch)*blend;camera.position.copy(eye);camera.lookAt(eye.x+Math.sin(current.yaw)*10,eye.y+Math.sin(current.pitch)*10+.1,eye.z-Math.cos(current.yaw)*10);}
    if(monitorElement&&cinematic?.kind==='monitor'&&(!monitorSettled||monitorLayoutDirty)){
      camera.updateMatrixWorld();const mesh=world.screens[2];const points=[[-1.17,-.74],[1.17,-.74],[-1.17,.74],[1.17,.74]].map(([x,y])=>mesh.localToWorld(new T.Vector3(x,y,0)).project(camera));
      const w=host.clientWidth,h=host.clientHeight,left=(Math.min(...points.map(p=>p.x))*.5+.5)*w,top=(-Math.max(...points.map(p=>p.y))*.5+.5)*h;
      const width=(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*w*.5,height=(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))*h*.5;
      monitorLayoutDirty=false;Object.assign(monitorElement.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
    }
    if(!reduced.matches){world.planets.forEach((p,i)=>{p.rotation.y+=dt*(.025+i*.006);});if(!monitorSettled&&time-lastScreen>180){screens.draw(2,time,hover===2);lastScreen=time;}}
    world.update(time,dt,reduced.matches);
    renderer.info.reset();
    if(!vr.active&&feedEnabled&&!monitorSettled&&!cinematic&&time-lastFeed>250){lastFeed=time;renderer.setRenderTarget(feedTarget);renderer.render(world.previewScene,world.previewCamera);renderer.setRenderTarget(null);}
    world.indicatorMaterials.forEach((mat,i)=>mat.emissiveIntensity=i===hover?2:.4);
    if(vr.active)renderer.render(scene,camera);else composer.render();
    if(time-lastMetrics>1500){lastMetrics=time;
      // Preserve architecture and working destinations; shed optional passes first.
      if(renderer.info.render.calls>quality.maxDrawCalls){
        if(feedEnabled)feedEnabled=false;
        else if(bloom.enabled)bloom.enabled=false;
      }
    }
    if(!ready){ready=true;onReady();}
  }
  if(initialCinematic)setCinematic(initialCinematic);
  listen(document,'visibilitychange',()=>{lastTime=0;budget.reset();frameGate.reset();});renderer.setAnimationLoop(tick);
  return {supportsVR:true,startVR:()=>{if(!cinematic)return vr.start(seatedPose());},endVR:()=>vr.end(),launch,focus,home,setCinematic,adjustConsole:(index,delta)=>world.details.adjust(index,delta),startMotion:gesture=>{if(!vr.active)return sensors.start(gesture);},stopMotion:()=>sensors.stop(),dispose(){disposed=true;sensors.dispose();vr.dispose();renderer.setAnimationLoop(null);observer.disconnect();listeners.forEach(off=>off());screens.dispose();world.dispose();portalGeometry.dispose();portalMaterial.dispose();outer.material.dispose();textures.forEach(t=>t.dispose());feedTarget?.dispose();env.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();canvas.remove();}};
}
