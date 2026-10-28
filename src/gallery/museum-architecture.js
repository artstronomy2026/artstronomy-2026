import * as T from 'three';
import {batchStatic} from '../performance/batch-static.js';
import {createMaterialKit,hologramMaterial} from '../environments/materials.js';
import {createJovianSystem} from '../environments/jovian-system.js';
import {WINGS} from './gallery-layout.js';

export function buildMuseum({shell,exhibits,layout,own,textureFor,textTexture,quality,fallback=false}){
 const kit=createMaterialKit(own),solids=new T.Group();shell.add(solids);
 const boxGeo=own(new T.BoxGeometry(1,1,1)),planeGeo=own(new T.PlaneGeometry(1,1));
 const box=(w,h,d,x,y,z,mat=kit.plaster)=>{const mesh=new T.Mesh(boxGeo,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.userData.staticSolid=true;mesh.receiveShadow=true;mesh.castShadow=true;solids.add(mesh);return mesh;};
 const plane=(parent,w,h,x,y,z,mat)=>{const mesh=new T.Mesh(planeGeo,mat);mesh.scale.set(w,h,1);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 // The atrium and all three wings are real connected floor slabs.
 for(const wing of WINGS){const w=wing.x1-wing.x0,d=wing.z1-wing.z0,cx=(wing.x0+wing.x1)/2,cz=(wing.z0+wing.z1)/2;
  box(w,.22,d,cx,-.13,cz,kit.stone);
  if(wing.id==='atrium')continue;
  if(wing.id==='animation'){
   for(const side of [-1,1]){box(.22,3.8,d,side*5.5,1.9,cz);box(.035,.06,d,side*5.33,.08,cz,kit.bronze);}
   box(11,7,.25,0,3.5,-24,kit.plaster);
   for(let z=-9;z>=-22;z-=3.8){box(11,.15,.24,0,6.2,z,kit.titanium);for(const side of [-1,1])box(.15,6.2,.22,side*5.4,3.1,z,kit.bronze);}
  }else{
   for(const side of [-1,1]){box(w,3.8,.22,cx,1.9,side*5.5);box(w,.06,.035,cx,.08,side*5.33,kit.bronze);}
   box(.22,7,11,wing.id==='identity'?wing.x0:wing.x1,3.5,0,kit.plaster);
   for(let x=wing.x0+1;x<wing.x1;x+=3.7){box(.24,.15,11,x,6.2,0,kit.titanium);for(const side of [-1,1])box(.22,6.2,.15,x,3.1,side*5.4,kit.bronze);}
  }
  // Clerestory glass floats above solid art walls; no painting obstructs the view.
  const ceiling=plane(shell,w,d,cx,6.3,cz,kit.glass);ceiling.rotation.x=-Math.PI/2;ceiling.userData.skipCSS=true;
 }
 // Double-height atrium, oculus, bronze reveals, and a visible mezzanine crown.
 const ringGeo=own(new T.TorusGeometry(6.8,.16,10,64));const ring=new T.Mesh(ringGeo,kit.bronze);ring.rotation.x=Math.PI/2;ring.position.set(0,8.8,-.2);shell.add(ring);
 const oculus=plane(shell,13.4,13.4,0,8.82,-.2,kit.glass);oculus.rotation.x=-Math.PI/2;oculus.userData.skipCSS=true;
 for(const side of [-1,1]){
  box(.32,9,.32,side*7.1,4.4,6.4,kit.titanium);box(.32,9,.32,side*7.1,4.4,-6.4,kit.titanium);
  box(15,.22,1.4,0,4.5,side*6.4,kit.stone);box(15,.04,.04,0,5.5,side*5.72,kit.bronze);
  const rail=plane(shell,14.8,1,0,5,side*5.72,kit.glass);rail.userData.skipCSS=true;
  box(15,.15,.18,0,8.7,side*7,kit.ceramic);
 }
 // Broad curved observatory wall at the entry; Jupiter fills the oculus above it.
 const curved=new T.Mesh(own(new T.CylinderGeometry(9,9,8.4,32,1,true,-.98,1.96)),kit.glass);curved.position.set(0,4.2,-1.8);shell.add(curved);curved.userData.skipCSS=true;
 for(let i=-3;i<=3;i++){const a=i*.28;box(.09,8.6,.14,Math.sin(a)*9,4.3,-1.8+Math.cos(a)*9,kit.bronze);}
 const jupiter=createJovianSystem({parent:shell,own,texture:textureFor('/assets/hub/gas-giant-albedo.webp'),quality,position:[-12,32,-28],radius:21});
 const dome=plane(shell,180,180,0,75,-15,own(new T.MeshBasicMaterial({color:'#020911',side:T.DoubleSide})));dome.rotation.x=Math.PI/2;dome.userData.cssPixelsPerUnit=2;
 // A holographic table sits outside the central walking line; floor map remains
 // available in the accessible DOM map so the decorative object is never required.
 box(1.6,.16,2.1,-6.1,.9,1.8,kit.carbon);box(.5,.9,.5,-6.1,.4,1.8,kit.titanium);
 const holo=hologramMaterial(own);const hologram=new T.Mesh(own(new T.IcosahedronGeometry(.28,1)),holo);hologram.position.set(-6.1,1.65,1.8);shell.add(hologram);
 const mapPoints=[];
 for(const wing of WINGS){const corners=[[wing.x0,wing.z0],[wing.x1,wing.z0],[wing.x1,wing.z1],[wing.x0,wing.z1]];
  for(let i=0;i<4;i++)for(const [x,z] of [corners[i],corners[(i+1)%4]])mapPoints.push((x-6)*.023,0,(z+8.5)*.043);
 }
 const mapGeometry=own(new T.BufferGeometry());mapGeometry.setAttribute('position',new T.Float32BufferAttribute(mapPoints,3));
 const floorMap=new T.LineSegments(mapGeometry,own(new T.LineBasicMaterial({color:'#56c6b5',transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending})));floorMap.position.set(-6.1,1.08,1.8);shell.add(floorMap);
 const signs=[];
 for(const wing of WINGS.filter(w=>w.id!=='atrium')){
  const mat=textTexture([{text:wing.label.toUpperCase(),size:44,y:72},{text:'ARTSTRONOMY  /  '+String(layout.filter(e=>e.wing===wing.id).length)+' CREATIVE WORLDS',size:24,y:126}],{width:1024,height:160,bg:'#161f30',color:'#ffd400'});
  const sign=plane(shell,4.3,.67,wing.id==='identity'?-7.05:wing.id==='interaction'?7.05:0,4.35,wing.id==='animation'?-7.05:0,mat);
  if(wing.id!=='animation')sign.rotation.y=wing.id==='identity'?Math.PI/2:-Math.PI/2;signs.push(sign);
 }
 const welcome=own(new T.MeshBasicMaterial({color:'#161f30',side:T.DoubleSide}));
 const arrival=new T.Group();arrival.position.set(0,3.2,6.6);arrival.rotation.y=Math.PI;shell.add(arrival);
 plane(arrival,5.8,1.65,0,0,0,welcome);
 // The supplied vector artwork is centered and retains its native proportions.
 plane(arrival,4.3,4.3*316/1318,0,0,.012,own(new T.MeshBasicMaterial({map:textureFor('/assets/artstronomy-wordmark.svg'),transparent:true,toneMapped:false})));
 const exit=textTexture([{text:'YOUR NEXT ORBIT',size:60,y:80},{text:'CONTINUE TO THE EXHIBITION WEBSITE',size:28,y:139}],{width:1024,height:180});plane(shell,5,1.05,0,2.4,-23.85,exit);
 const poolData=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,d=Math.hypot((x-31.5)/32,(y-31.5)/32);poolData[i]=poolData[i+1]=poolData[i+2]=255;poolData[i+3]=Math.pow(Math.max(0,1-d),2)*255;}
 const poolTexture=own(new T.DataTexture(poolData,64,64));poolTexture.needsUpdate=true;
 const poolMaterials=Object.fromEntries(WINGS.map(w=>[w.id,own(new T.MeshBasicMaterial({map:poolTexture,color:w.color,transparent:true,opacity:.23,depthWrite:false}))]));
 const objects=[],artMeshes=[],captions=[];
 const frameGeometry=boxGeo;
 for(const exhibit of layout){
  const group=new T.Group();group.position.set(exhibit.x,0,exhibit.z);group.rotation.y=exhibit.yaw;exhibits.add(group);
  const addFrame=(w,h,d,x,y,z,mat)=>{const m=new T.Mesh(frameGeometry,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.userData.staticSolid=true;group.add(m);return m;};
  addFrame(2.8,2.12,.16,0,2.15,-.09,kit.carbon);
  for(const side of [-1,1]){addFrame(.045,2.16,.1,side*1.4,2.15,.01,kit.bronze);addFrame(2.8,.045,.1,0,2.15+side*1.06,.01,kit.bronze);}
  const art=plane(group,2.64,1.76,0,2.15,.025,own(new T.MeshBasicMaterial({map:textureFor(exhibit.image),toneMapped:false})));art.userData.index=exhibit.index;artMeshes[exhibit.index]=art;objects.push(art);
  const label=plane(group,2.65,.48,0,.78,.05,textTexture([{text:String(exhibit.index+1).padStart(2,'0')+' / '+exhibit.category.toUpperCase(),size:23,y:34},{text:exhibit.name,size:34,y:81},{text:'CATEGORY ARTWORK · PROJECT TO BE ANNOUNCED',size:18,y:118}],{width:768,height:140,bg:'#161f30',color:'#e8e2ce'}));
  label.userData.index=exhibit.index;captions[exhibit.index]=label;objects.push(label);
  addFrame(2.5,.04,.08,0,3.4,.12,kit.warm);
  // Instanced bronze track fixtures + physical light pools avoid 22 costly lights.
  addFrame(.12,.16,.34,0,3.57,.3,kit.titanium);
  const pool=plane(group,2.65,2.8,0,.012,1.55,poolMaterials[exhibit.wing]);pool.rotation.x=-Math.PI/2;pool.userData.skipCSS=true;pool.userData.staticSolid=true;
 }
 // Batch artwork surrounds and fixtures; preserve individually pickable planes.
 if(!fallback){batchStatic(solids,m=>m.userData.staticSolid,own);batchStatic(exhibits,m=>m.userData.staticSolid,own);}
 return {kit,objects,artMeshes,captions,jupiter,update(dt,time,reduced){if(!reduced){jupiter.update(dt);hologram.rotation.y+=dt*.12;}holo.uniforms.time.value=reduced?0:time*.001;},highlight(index){captions.forEach((label,i)=>label.material.color.setScalar(index===i?1:.78));},signs};
}
