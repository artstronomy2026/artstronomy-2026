import { ensureInstrumentFonts, fitCanvasText } from '../observatory/canvas-type.js';
import * as THREE from 'three';
import { floorDestination } from './tap-navigation.js';
import { initialPixelRatio, createRenderBudget, createFrameGate } from '../performance/render-budget.js';
import { isHandheld } from '../immersive/device-look.js';
import { createDeviceLook } from '../immersive/device-look.js';
import { EYE_HEIGHT, SEAT_HEIGHT, ROOM, WINGS, walkingPath, exhibitLayout, visitPosition, constrainPosition, wrapExhibit } from './gallery-layout.js';
import {buildMuseum} from './museum-architecture.js';
import {deviceQuality} from '../environments/quality.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import { createCSSGalleryRenderer } from './css-gallery-renderer.js';
import { createVRView } from '../immersive/vr-view.js';

// Lazy-loaded scene. All navigation, textures, sensors and XR sessions are owned
// here and released on exit. No hosted gallery service or tracking SDK is used.
export function createGallery({ host, overlay, creators, onSelect, onStatus, onMotion, onXR, onError, onInspect = () => {}, onEnd = () => {}, onPosition=()=>{}, onReady=()=>{}, onMetrics=()=>{}, onTour=()=>{}, onVR=()=>{} }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { renderer = createCSSGalleryRenderer(); }
  const quality=deviceQuality(isHandheld());
  const pixelRatio=initialPixelRatio({dpr:window.devicePixelRatio||1,width:host.clientWidth,height:host.clientHeight,mobile:isHandheld()});
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050d16, 1);
  if (!renderer.isCSSFallback) { renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1; }
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.classList.add('virtual-gallery__surface');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '3D exhibition. Tap the floor or artwork to walk there. Drag to look. W A S D or arrow keys to move. Enter opens the artwork ahead.');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 1, .06, 220);
  camera.rotation.order = 'YXZ';
  const root = new THREE.Group(), shell = new THREE.Group(), exhibits = new THREE.Group();
  scene.add(root); root.add(shell, exhibits);
  scene.add(new THREE.HemisphereLight(0xf1f1df, 0x476955, 2.6));
  const sun = new THREE.DirectionalLight(0xffefcf, 2); sun.position.set(2, 7, 4); scene.add(sun);
  const resources = new Set(), textures = new Map(), listeners = [];
  let disposed = false, yaw = 0, pitch = 0, current = 0, lastTime = 0;
  let inspectPoint = null, pinned = false, lastInspect = 0, lastInspection = null, atEnd = false;
  let target = null, pointer = null, motion = false, eyeHeight=EYE_HEIGHT;
  let route=[],tour=false,tourPause=0,inputBlocked=false,reportedReady=false,lastPosition=0,lastMetrics=0;
  let xrSession = null, xrPending = false, xrAnchor = null, trackingLost = false;
  const position = new THREE.Vector3(0, EYE_HEIGHT, 5);
  const keys = new Set(), held = new Set();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layout = exhibitLayout(creators);
  const listen = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); listeners.push(() => el.removeEventListener(type, fn, opts)); };
  const own = obj => { resources.add(obj); return obj; };
  const loader = new THREE.TextureLoader();
  function textTexture(lines, { width = 1024, height = 256, bg = '#10212c', color = '#f4f1df' } = {}) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    const draw = () => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      lines.forEach(({ text, size, y, muted }) => {
        fitCanvasText(ctx, text, width - 72, size);
        ctx.fillStyle = muted ? '#a8b2c0' : color;
        ctx.fillText(text, 36, y);
      });
    };
    draw();
    const texture = own(new THREE.CanvasTexture(c)); texture.colorSpace = THREE.SRGBColorSpace;
    ensureInstrumentFonts().then(()=>{if(!disposed){draw();texture.needsUpdate=true;}});
    return own(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  }

  function textureFor(src) {
    if (textures.has(src)) return textures.get(src);
    const texture = loader.load(src, t => { if (disposed) { t.dispose(); return; } }, undefined,
      () => { if (!disposed) onStatus('Some artwork could not load. Creator details are still available.'); });
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.set(src, texture); own(texture); return texture;
  }
  const museum=buildMuseum({shell,exhibits,layout,own,textureFor,textTexture,quality,fallback:renderer.isCSSFallback});
  const {objects,artMeshes}=museum;
  let composer=null,bloom=null,reflector=null,environment=null;
  if(!renderer.isCSSFallback){
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.06);scene.environment=environment.texture;scene.environmentIntensity=.5;room.dispose();pmrem.dispose();
    // Two shadowed hero spots in the atrium. Other bays use batched practicals.
    for(const x of [-4,4]){const spot=new THREE.SpotLight('#ffe6bd',55,22,.65,.7,1.5);spot.position.set(x,8,1);spot.target.position.set(x,0,-3);spot.castShadow=true;spot.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);spot.shadow.bias=-.001;scene.add(spot,spot.target);own(spot.shadow);}
    if(quality.reflections){
      reflector=new Reflector(own(new THREE.PlaneGeometry(13,11.6)),{color:0x19251f,textureWidth:512,textureHeight:512,multisample:0,clipBias:.003});reflector.rotation.x=-Math.PI/2;reflector.position.set(0,.005,-.2);shell.add(reflector);own(reflector);reflector.userData.skipCSS=true;
      // Reflection layer contains the architecture and artworks, not captions,
      // light pools, holograms or another recursive reflection.
      museum.artMeshes.forEach(o=>o.layers.enable(1));museum.jupiter.root.traverse(o=>o.layers.enable(1));shell.traverse(o=>{if(o.isInstancedMesh)o.layers.enable(1);});scene.traverse(o=>{if(o.isLight)o.layers.enable(1);});reflector.getReflectionCamera(camera).layers.set(1);
    }
    composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    if(quality.bloom){bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.12,.35,1.5);composer.addPass(bloom);}
    const output=new OutputPass();composer.addPass(output);own(output);
    renderer.info.autoReset=false;
  }
  const raycaster = new THREE.Raycaster();
  let reflectionBeforeVR = false;
  const vr = renderer.isCSSFallback ? null : createVRView({ renderer, scene, camera,
    buttons: [
      { label: 'Previous creator', action: () => visit(current - 1) },
      { label: 'Next creator', action: () => visit(current + 1) },
      { label: 'Return to atrium', action: () => home() },
      { label: 'Exit VR', action: () => vr.end()?.catch(() => {}) },
    ],
    caption: () => `${current + 1} / ${layout.length} · ${creators[current].name}`,
    beforeStart: () => {
      disableMotion(); clearInput(); tour = false; onTour(false); inspect(null);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      reflectionBeforeVR = Boolean(reflector?.visible); if (reflector) reflector.visible = false;
    },
    onChange: onVR,
    afterEnd: () => {
      if (reflector) reflector.visible = reflectionBeforeVR;
      lastTime = 0; frameGate.reset(); budget.reset(); resize();
      onStatus('Back in the normal gallery. Touch, mouse and keyboard controls are ready.');
    },
  });
  function hitAt(x,y) {
    camera.updateMatrixWorld();root.updateMatrixWorld(true);
    const bounds=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1),camera);
    // Artworks in another wing must not reveal metadata through solid walls.
    if(xrSession)return raycaster.intersectObjects(objects)[0];
    const hit=raycaster.intersectObjects([shell,exhibits],true).find(hit=>hit.object.isMesh&&!hit.object.material.transparent);
    return Number.isInteger(hit?.object.userData.index)?hit:undefined;
  }
  function inspect(hit) {
    if(!hit){if(lastInspection!==null){onInspect(null);museum.highlight(-1);lastInspection=null;}return;}
    const index=hit.object.userData.index,art=artMeshes[index];current=index;museum.highlight(index);
    const p=art.localToWorld(new THREE.Vector3(1.3,.3,0)).project(camera);
    const x=(p.x*.5+.5)*host.clientWidth,y=(-p.y*.5+.5)*host.clientHeight;
    if(!lastInspection||lastInspection.index!==index||Math.abs(lastInspection.x-x)>3||Math.abs(lastInspection.y-y)>3){lastInspection={index,x,y};onInspect(lastInspection);}
  }
  function pick(x,y,walk=false){
    if(inputBlocked||vr?.active)return;
    const hit=hitAt(x,y);
    if(walk&&!xrSession){
      if(hit){visit(hit.object.userData.index);return;}
      // hitAt sets the camera ray even when no artwork is hit. Only accept
      // a forward floor intersection inside the actual room, never sky/walls.
      const safe=floorDestination(raycaster.ray);
      if(safe){
        pinned=false;inspectPoint=null;inspect(null);
        travelTo({...safe,y:eyeHeight,yaw,pitch});
        onStatus('Walking to the selected spot. Tap another spot to change direction.');
      }
      return;
    }
    pinned=Boolean(hit);if(hit){current=hit.object.userData.index;onSelect(current,true);}inspect(hit);
  }
  const sensors = createDeviceLook({
    read:()=>({yaw,pitch}), apply:value=>{yaw=value.yaw;pitch=THREE.MathUtils.clamp(value.pitch,-1.2,1.2);pinned=false;inspectPoint=null;},
    blocked:()=>inputBlocked||!!xrSession||!!vr?.active||!!target||!!pointer,
    onState:state=>{motion=state==='active'||state==='starting';onMotion(state);}
  });
  function disableMotion() { sensors.stop(); }
  function startMotion(gesture=false) { if(!xrSession&&!vr?.active)return sensors.start(gesture); }
  function toggleMotion() { if(motion)disableMotion();else return startMotion(true); }
  function nextLeg(){
    const destination=route.shift();if(!destination){target=null;sensors.reset();return;}
    const distance=Math.hypot(destination.x-position.x,destination.z-position.z);
    target={pitch:0,...destination,y:eyeHeight,duration:Math.max(300,distance/4.2*1000),start:performance.now(),from:position.clone(),to:new THREE.Vector3(destination.x,eyeHeight,destination.z),fromYaw:yaw,fromPitch:pitch};
  }
  function travelTo(destination){
    if(reducedMotion.matches){position.set(destination.x,eyeHeight,destination.z);yaw=destination.yaw;pitch=destination.pitch||0;target=null;route=[];return;}
    route=walkingPath(position,{pitch:0,...destination,y:eyeHeight});nextLeg();
  }
  function visit(index, notify = true) {
    pinned=false;inspectPoint=null;inspect(null);
    current = wrapExhibit(index, layout.length);
    const destination = visitPosition(layout[current],eyeHeight);
    if (vr?.active) {
      position.set(destination.x, eyeHeight, destination.z); yaw = destination.yaw; pitch = 0;
      vr.teleport(destination);
    } else if (xrSession) xrAnchor = destination;
    else {
      travelTo(destination);

    }
    if (notify) onSelect(current, false);
  }
  function home() { pinned=false;inspect(null); if (vr?.active) {position.set(0,eyeHeight,5);yaw=0;pitch=0;vr.teleport({x:0,y:eyeHeight,z:5,yaw:0});} else if (xrSession) xrAnchor = { x: 0, y: eyeHeight, z: 5, yaw: 0 }; else { disableMotion(false); travelTo({ x: 0, y: eyeHeight, z: 5, yaw: 0 }); } onStatus('At the gallery entrance. Drag to look; select an exhibit to visit.'); }
  const touches = new Set();
  listen(canvas, 'pointerdown', event => {
    if(inputBlocked||vr?.active)return;
    tour=false;onTour(false);
    if(event.pointerType==='touch'){
      touches.add(event.pointerId);
      // Multiple touches do not walk or zoom, and cannot become an accidental tap.
      if(touches.size>1){pointer=null;return;}
    }
    if(event.button!==0||xrSession)return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,distance:0,touch:event.pointerType==='touch'};
    canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});
  });
  listen(canvas, 'pointermove', event => {
    if(inputBlocked||touches.size>1)return;
    inspectPoint={x:event.clientX,y:event.clientY};
    if(!pointer||event.pointerId!==pointer.id)return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    pointer.distance+=Math.hypot(dx,dy);pointer.x=event.clientX;pointer.y=event.clientY;
    if(pointer.distance>8){pinned=false;inspectPoint=null;target=null;route=[];yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-1.2,1.2);}
  });
  listen(canvas, 'pointerup', event => {
    touches.delete(event.pointerId);
    if(pointer?.id===event.pointerId){
      if(pointer.distance<=8)pick(event.clientX,event.clientY,pointer.touch||isHandheld());
      pointer=null;sensors.reset();
    }
  });
  const cancelPointer=event=>{touches.delete(event.pointerId);if(pointer?.id===event.pointerId)pointer=null;};
  listen(canvas,'pointercancel',cancelPointer);
  listen(canvas,'lostpointercapture',cancelPointer);
  listen(canvas,'pointerleave',()=>{inspectPoint=null;});
  const navigationKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  listen(canvas, 'keydown', event => {
    if(event.key==='Escape'&&document.pointerLockElement===canvas){event.stopPropagation();document.exitPointerLock?.();return;}
    if(inputBlocked||vr?.active)return;
    tour=false;onTour(false);
    const key = event.key.toLowerCase();
    if (navigationKeys.has(key)) { event.preventDefault(); keys.add(key); target = null;route=[]; }
    if (event.key === 'Enter') { const rect = canvas.getBoundingClientRect(); pick(rect.left + rect.width / 2, rect.top + rect.height / 2); }
  });
  listen(document,'mousemove',event=>{if(document.pointerLockElement===canvas&&!inputBlocked&&!xrSession&&!vr?.active){yaw-=event.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-event.movementY*.002,-1.2,1.2);}});
  listen(window, 'keyup', event => keys.delete(event.key.toLowerCase()));
  const clearInput = () => { keys.clear(); held.clear(); touches.clear();target=null;route=[];pointer = null; };
  listen(window, 'blur', clearInput); listen(canvas, 'blur', clearInput);
  listen(document, 'visibilitychange', () => { clearInput(); lastTime = 0; });
  listen(canvas, 'webglcontextlost', event => { event.preventDefault(); onError('The 3D view paused. Close and reopen the gallery, or browse the creator list below.'); });
  const resize = () => { if (disposed || renderer.xr.isPresenting) return; const w = Math.max(host.clientWidth, 1), h = Math.max(host.clientHeight, 1); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);composer?.setSize(w,h);if(bloom)bloom.setSize(w*renderer.getPixelRatio()*.5,h*renderer.getPixelRatio()*.5); };
  const frameGate=createFrameGate(),budget=createRenderBudget(pixelRatio,ratio=>{if(!renderer.xr.isPresenting){renderer.setPixelRatio(ratio);composer?.setPixelRatio(ratio);resize();}});
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function anchorFromPose(pose, destination) {
    const p = pose.transform.position, q = pose.transform.orientation;
    const heading = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w), 'YXZ').y;
    root.rotation.set(0, heading - destination.yaw, 0);
    const offset = new THREE.Vector3(destination.x, destination.y, destination.z).applyQuaternion(root.quaternion);
    root.position.set(p.x - offset.x, p.y - offset.y, p.z - offset.z);
  }
  async function startAR() {
    if (disposed || xrPending || xrSession || vr?.active) return;
    xrPending = true; disableMotion(false); clearInput();
    let session;
    try {
      // Handheld AR uses a DOM overlay so Exit and the exhibit controls
      // remain reachable on a handheld screen.
      session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['dom-overlay'], optionalFeatures: ['local-floor'], domOverlay: { root: overlay } });
      if (disposed) { await session.end(); return; }
      xrSession = session; shell.visible = false; root.visible = false;
      renderer.setClearColor(0x000000, 0); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
      xrAnchor = visitPosition(layout[current],eyeHeight);
      session.addEventListener('end', () => {
        xrSession = null; xrAnchor = null;
        if (disposed) return;
        root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.visible = true; shell.visible = true;
        renderer.setClearColor(0x050d16, 1); onXR(false); visit(current, false); resize();
        onStatus('Back in the virtual gallery.');
      }, { once: true });
      await renderer.xr.setSession(session);
      if (disposed) { await session.end(); return; }
      onXR(true); onStatus('Move your phone around the exhibit. Stay aware of your surroundings. Use navigation help to visit another creator.');
    } catch {
      if (session) await session.end().catch(() => {});
      if (!disposed) { onXR(false); shell.visible = true; root.visible = true; renderer.setClearColor(0x050d16, 1); visit(current, false); onStatus('Walk-in AR could not start on this device. The touch gallery and phone-look option remain available.'); }
    } finally { xrPending = false; }
  }
  renderer.setAnimationLoop((time, frame) => {
    if (disposed || document.hidden) {frameGate.reset();budget.reset();lastTime=0;return;}
    if(!renderer.xr.isPresenting){if(!frameGate.due(time,quality.fps))return;if(!renderer.isCSSFallback)budget.sample(time*quality.fps/60);}
    const dt = Math.min((time - (lastTime || time)) / 1000, .05); lastTime = time;
    if (vr?.active) {
      vr.update(frame, time);
    } else if (renderer.xr.isPresenting && frame) {
      const pose = frame.getViewerPose(renderer.xr.getReferenceSpace());
      root.visible = Boolean(pose);
      if (!pose && !trackingLost) { trackingLost = true; onStatus('Tracking paused. Slowly move your phone in a well-lit area.'); }
      if (pose && trackingLost) { trackingLost = false; onStatus('Tracking restored. Move your phone to explore the exhibit.'); }
      if (pose && xrAnchor) { anchorFromPose(pose, xrAnchor); xrAnchor = null; }
    } else {
      const pressed = (...names) => names.some(k => keys.has(k) || held.has(k));
      let forward = Number(pressed('w', 'arrowup')) - Number(pressed('s', 'arrowdown'));
      let side = Number(pressed('d', 'arrowright')) - Number(pressed('a', 'arrowleft'));
      if (forward || side) {
        pinned=false;inspectPoint=null;target = null; const length = Math.hypot(forward, side); forward /= length; side /= length;
        const safe = constrainPosition(position.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * dt * 4.2,
          position.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * dt * 4.2);
        position.x = safe.x; position.z = safe.z;
      }
      if (target) {
        const t=reducedMotion.matches?1:Math.min(1,(time-target.start)/target.duration),ease=t*t*(3-2*t);
        position.lerpVectors(target.from,target.to,ease);
        const delta=Math.atan2(Math.sin(target.yaw-target.fromYaw),Math.cos(target.yaw-target.fromYaw));
        yaw=target.fromYaw+delta*ease;pitch=target.fromPitch+(target.pitch-target.fromPitch)*ease;
        if(t===1){nextLeg();if(!target&&tour)tourPause=time+4500;}
      }
      camera.position.copy(position); camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }
    if(!xrSession)museum.update(dt,time,reducedMotion.matches);
    if(tour&&!target&&time>tourPause&&!xrSession&&!vr?.active&&!inputBlocked){visit(current+1);tourPause=Infinity;}
    if(!xrSession&&!vr?.active){const end=position.z < -21.2;if(end!==atEnd){atEnd=end;onEnd(end);}}
    if(time-lastInspect>100&&!xrSession&&!vr?.active&&!target){lastInspect=time;
      const bounds=canvas.getBoundingClientRect();
      const point=inspectPoint||{x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
      if(pinned){const art=artMeshes[current];inspect({object:art});}else inspect(hitAt(point.x,point.y));
    }
    if(!renderer.isCSSFallback)renderer.info.reset();
    if(composer&&!renderer.xr.isPresenting)composer.render();else renderer.render(scene,camera);
    if(!reportedReady){reportedReady=true;onReady();}
    if(time-lastPosition>180&&!xrSession){lastPosition=time;onPosition({x:position.x,z:position.z,yaw});}
    if(!renderer.isCSSFallback&&time-lastMetrics>1500){lastMetrics=time;const calls=renderer.info.render.calls;
      // Reflection is the first optional pass removed when over budget.
      if(calls>quality.maxDrawCalls&&reflector?.visible){reflector.visible=false;}
      else if(calls>quality.maxDrawCalls&&bloom?.enabled){bloom.enabled=false;}
      onMetrics({tier:quality.name,calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures});
    }
  });
  onStatus(renderer.isCSSFallback?'Compatibility view · tap floor or artwork to walk; drag to look.':'Tap floor or artwork to walk · drag to look · hover for creator details.');
  return {
    supportsAR: !renderer.isCSSFallback,
    supportsVR: !renderer.isCSSFallback,
    startVR: () => {if(!inputBlocked&&!xrSession&&!xrPending)return vr?.start({x:position.x,y:eyeHeight,z:position.z,yaw});},
    endVR: () => vr?.end(),
    setBlocked(value){inputBlocked=value;if(value){clearInput();sensors.stop();}},
    setEyeHeight(seated){eyeHeight=seated?SEAT_HEIGHT:EYE_HEIGHT;position.y=eyeHeight;if(target){target.y=eyeHeight;target.to.y=eyeHeight;}},
    visitWing(id){tour=false;onTour(false);const wing=WINGS.find(w=>w.id===id);if(wing)travelTo({...wing.anchor,y:eyeHeight,yaw:id==='identity'?Math.PI/2:id==='interaction'?-Math.PI/2:0});},
    startTour(){if(xrSession||vr?.active||reducedMotion.matches)return false;tour=true;onTour(true);tourPause=Infinity;visit(0);return true;},
    stopTour(){tour=false;onTour(false);target=null;route=[];},
    lockPointer(){if(!isHandheld()){const request=canvas.requestPointerLock?.();request?.catch?.(()=>onStatus('Mouse look unavailable. Drag to look is still ready.'));}},
    visit, home, toggleMotion, startMotion, stopMotion:()=>sensors.stop(), startAR,
    lookUp:()=>{disableMotion(false);target=null;pinned=false;inspectPoint=null;yaw=Math.atan2(position.x,position.z+17);pitch=Math.atan2(13-EYE_HEIGHT,Math.hypot(position.x,position.z+17));},
    inspectCurrent:()=>{pinned=true;inspect({object:artMeshes[current]});},
    endAR: () => xrSession?.end(),
    move: (key, down) => { if (down) { held.add(key); target = null; } else held.delete(key); },
    step: key => { if (xrSession) return; target = null; const f = key === 'w' ? 1 : key === 's' ? -1 : 0, s = key === 'd' ? 1 : key === 'a' ? -1 : 0; const safe = constrainPosition(position.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * .7, position.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * .7); position.x = safe.x; position.z = safe.z; },
    dispose() {
      disposed = true; sensors.dispose(); vr?.dispose();
      listeners.forEach(remove => remove()); observer.disconnect(); renderer.setAnimationLoop(null);
      xrSession?.end().catch(() => {}); resources.forEach(resource => resource.dispose());
      if(document.pointerLockElement===canvas)document.exitPointerLock?.();bloom?.dispose();composer?.dispose();environment?.dispose();renderer.dispose(); canvas.remove();
    },
  };
}
