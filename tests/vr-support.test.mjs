import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { watchVRSupport, createGazeDwell } from '../src/immersive/vr-support.js';
import { createVRView } from '../src/immersive/vr-view.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

test('headset detection handles absence, rejection, hot-plug and cleanup without requesting a session', async () => {
  const values = [];
  const offMissing = watchVRSupport(value => values.push(value), {});
  await settle(); assert.deepEqual(values, [false]); offMissing();
  const xr = new EventTarget(); let supported = false, reject = false;
  xr.isSessionSupported = async mode => { assert.equal(mode, 'immersive-vr'); if (reject) throw Error(); return supported; };
  xr.requestSession = () => assert.fail('Detection must never start VR');
  const off = watchVRSupport(value => values.push(value), xr);
  await settle(); supported = true; xr.dispatchEvent(new Event('devicechange')); await settle();
  assert.equal(values.at(-1), true);
  reject = true; xr.dispatchEvent(new Event('devicechange')); await settle(); assert.equal(values.at(-1), false);
  const count = values.length; off(); xr.dispatchEvent(new Event('devicechange')); await settle(); assert.equal(values.length, count);
});

test('stale capability results cannot override a newly connected headset', async () => {
  const xr = new EventTarget(), checks = [], values = [];
  xr.isSessionSupported = () => new Promise(resolve => checks.push(resolve));
  const off = watchVRSupport(v => values.push(v), xr);
  xr.dispatchEvent(new Event('devicechange')); checks[1](true); await settle(); checks[0](false); await settle();
  assert.deepEqual(values, [true]); off();
});

test('gaze needs a continuous deliberate hold, fires once and rearms after looking away', () => {
  const gaze = createGazeDwell(1600), a = {}, b = {};
  for (let time = 0; time < 1600; time += 100) assert.equal(gaze.update(a, time).activate, false);
  assert.equal(gaze.update(a, 1600).activate, true);
  assert.equal(gaze.update(a, 1700).activate, false);
  gaze.update(b, 1800); assert.equal(gaze.update(a, 1900).progress, 0);
  assert.equal(gaze.update(a, 4000).activate, false, 'paused frames cannot complete a dwell');
  gaze.update(null, 4100); assert.equal(gaze.update(a, 4200).progress, 0);
});

function fixture({ fail = false, deferred = false } = {}) {
  const ctx = { clearRect(){}, fillRect(){}, strokeRect(){}, fillText(){}, measureText: text => ({width:text.length*15}) };
  const oldDocument = globalThis.document, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.document = { createElement: () => ({getContext: () => ctx}) };
  let requested, resolveSession, count = 0;
  const session = new EventTarget(); session.visibilityState = 'visible';
  session.end = async () => { session.dispatchEvent(new Event('end')); };
  const xr = {requestSession: mode => {count++;requested=mode;return deferred ? new Promise(resolve => resolveSession = resolve) : Promise.resolve(session);}};
  Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{xr}});
  const renderer = {xr:{isPresenting:false,setReferenceSpaceType(type){assert.equal(type,'local');},async setSession(){if(fail)throw Error('GPU rejected');this.isPresenting=true;},getReferenceSpace:()=>({})}};
  session.addEventListener('end', () => {renderer.xr.isPresenting=false;});
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(65, 1.7, .1, 100);
  camera.position.set(2, 1.65, 5); camera.rotation.y=.3;
  const original = {position:camera.position.clone(),quaternion:camera.quaternion.clone()};
  const changes=[];let ended=0, clicks=0;
  const view=createVRView({renderer,scene,camera,buttons:[{label:'Next',action:()=>clicks++}],caption:()=> 'Creator',onChange:v=>changes.push(v),afterEnd:()=>ended++});
  const restore=()=>{globalThis.document=oldDocument;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;};
  return {view,scene,camera,session,original,changes,get ended(){return ended;},get clicks(){return clicks;},get requested(){return requested;},get count(){return count;},resolve:()=>resolveSession(session),restore};
}

test('VR aligns a 3DoF viewer, supports gaze without controllers and restores the camera on exit', async () => {
  const f=fixture();
  try {
    await f.view.start({x:2,y:1.65,z:5,yaw:0}); assert.equal(f.requested,'immersive-vr'); assert.deepEqual(f.changes,[true]);
    const pose={transform:{position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1}}};
    const frame={getViewerPose:()=>pose}; f.view.update(frame,0);
    assert.deepEqual(f.camera.parent.position.toArray(),[2,1.65,5]);
    // First gaze button is at (-.35,-.69,-1.65) relative to the anchored seat.
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,-1),new T.Vector3(-.35,-.69,-1.65).normalize());
    Object.assign(pose.transform.orientation,{x:q.x,y:q.y,z:q.z,w:q.w});
    for(let time=100;time<=1700;time+=100)f.view.update(frame,time);
    assert.equal(f.clicks,1);f.view.update(frame,1800);assert.equal(f.clicks,1);
    f.view.teleport({x:-8,y:1.65,z:0,yaw:Math.PI/2});f.view.update(frame,1900);
    assert.ok(f.camera.parent.position.distanceTo(new T.Vector3(-8,1.65,0))<1e-8);
    await f.view.end();await settle();assert.deepEqual(f.changes,[true,false]);assert.equal(f.ended,1);
    assert.ok(f.camera.position.equals(f.original.position));assert.ok(f.camera.quaternion.equals(f.original.quaternion));assert.equal(f.camera.aspect,1.7);
  } finally {f.view.dispose();f.restore();}
});

test('a rejected VR renderer restores normal view and closes the requested session', async () => {
  const f=fixture({fail:true});
  try {await assert.rejects(f.view.start({x:0,y:1.65,z:5,yaw:0}));assert.equal(f.view.active,false);assert.ok(f.camera.position.equals(f.original.position));}
  finally {f.view.dispose();f.restore();}
});

test('duplicate entry is ignored and a session arriving after unmount is closed', async () => {
  const f=fixture({deferred:true});let ended=0;f.session.addEventListener('end',()=>ended++);
  try {const entry=f.view.start({x:0,y:1.65,z:5,yaw:0});await f.view.start({x:0,y:1.65,z:5,yaw:0});assert.equal(f.count,1);f.view.dispose();f.resolve();await entry;assert.equal(ended,1);assert.deepEqual(f.changes,[]);}
  finally {f.restore();}
});

test('normal viewing allocates no VR textures, and lost tracking cancels selection', async () => {
  const f=fixture();
  try {
    assert.equal(f.scene.children.flatMap(o=>o.children).filter(o=>o.isMesh).length,0);
    await f.view.start({x:0,y:1.65,z:5,yaw:0});
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,-1),new T.Vector3(-.35,-.69,-1.65).normalize());
    const pose={transform:{position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1}}};
    const frame={getViewerPose:()=>pose};f.view.update(frame,0);
    Object.assign(pose.transform.orientation,{x:q.x,y:q.y,z:q.z,w:q.w});
    for(let time=100;time<=1500;time+=100)f.view.update(frame,time);
    f.view.update({getViewerPose:()=>null},1600);f.view.update(frame,1700);assert.equal(f.clicks,0);
    f.session.visibilityState='visible-blurred';f.view.update(frame,1800);f.session.visibilityState='visible';
    f.view.update(frame,1900);assert.equal(f.clicks,0);
    await f.view.end();
  } finally {f.view.dispose();f.restore();}
});
