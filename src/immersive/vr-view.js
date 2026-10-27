import * as T from 'three';
import { ensureInstrumentFonts, fitCanvasText } from '../observatory/canvas-type.js';
import { createGazeDwell } from './vr-support.js';

// A local (not floor-dependent) reference space supports seated/3DoF headsets.
// Browser sessions are entered only from the visible Enter VR button.
export function createVRView({ renderer, scene, camera, buttons, caption, onChange = () => {}, beforeStart = () => {}, afterEnd = () => {} }) {
  const rig = new T.Group(); scene.add(rig); rig.add(camera);
  const menu = new T.Group(); menu.visible = false; scene.add(menu);
  const reticle = new T.Group(); reticle.visible = false; reticle.position.z = -.8; camera.add(reticle);
  const resources = [], targets = [], labels = [], dwell = createGazeDwell();
  const raycaster = new T.Raycaster(), origin = new T.Vector3(), direction = new T.Vector3(), orientation = new T.Quaternion();
  let session = null, pending = false, disposed = false, anchor = null, saved = null, pose = null, lastCaption = '';
  const own = resource => { resources.push(resource); return resource; };
  let progressGeometry, heading, prepared = false;
  function label(text, width, height) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
    const texture = own(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace;
    const material = own(new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    const mesh = new T.Mesh(own(new T.PlaneGeometry(width, height)), material);
    const draw = value => {
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 1024, 160); ctx.fillStyle = '#161f30'; ctx.fillRect(0, 0, 1024, 160);
      ctx.strokeStyle = '#56c6b5'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 1018, 154);
      fitCanvasText(ctx, value, 960, 48); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fffef6'; ctx.fillText(value, 512, 80); texture.needsUpdate = true;
    };
    const entry = { mesh, text, draw }; labels.push(entry); draw(text); menu.add(mesh); return entry;
  }
  function prepare() {
    if (prepared) return;
    prepared = true;
  const ring = new T.Mesh(own(new T.RingGeometry(.008, .010, 48)), own(new T.MeshBasicMaterial({ color: '#fffef6', depthTest: false, depthWrite: false })));
  progressGeometry = own(new T.RingGeometry(.011, .014, 48)); progressGeometry.setDrawRange(0, 0);
  const progress = new T.Mesh(progressGeometry, own(new T.MeshBasicMaterial({ color: '#ffd400', depthTest: false, depthWrite: false })));
  ring.renderOrder = progress.renderOrder = 1000; reticle.add(ring, progress);
  heading = label('', 1.35, .18); heading.mesh.position.set(0, -.26, -1.65);
  const guidance = label('Hold your gaze on a button to select', 1.35, .15); guidance.mesh.position.set(0, -.46, -1.65);
  buttons.forEach((button, index) => {
    const entry = label(button.label, .64, .17);
    entry.mesh.position.set(index % 2 ? .35 : -.35, -.69 - Math.floor(index / 2) * .21, -1.65);
    entry.mesh.userData.activate = button.action; targets.push(entry.mesh);
  });
  ensureInstrumentFonts().then(() => { if (!disposed) labels.forEach(entry => entry.draw(entry.text)); });
  }
  function teleport(destination) { anchor = { ...destination }; }
  function reset() {
    const previous = saved;
    session = null; pose = null; anchor = null; menu.visible = reticle.visible = false; dwell.reset();
    if (!previous || disposed) return;
    saved = null; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion);
    camera.fov = previous.fov; camera.aspect = previous.aspect; camera.updateProjectionMatrix();
    onChange(false);
    // Three.js restores its framebuffer later in the same session-end event.
    queueMicrotask(() => { if (!disposed) afterEnd(); });
  }
  async function start(destination) {
    if (disposed || pending || session || renderer.xr.isPresenting) return;
    if (!navigator.xr?.requestSession) throw new Error('VR unavailable');
    pending = true;
    let requested;
    try {
      // No controller, hand-tracking, floor or DOM-overlay requirements.
      requested = await navigator.xr.requestSession('immersive-vr');
      if (disposed) { await requested.end(); return; }
      prepare();
      saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect };
      beforeStart(); renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
      session = requested; requested.addEventListener('end', reset, { once: true });
      camera.position.set(0, 0, 0); camera.quaternion.identity();
      dwell.reset();
      teleport(destination);
      await renderer.xr.setSession(requested);
      if (disposed) { await requested.end(); return; }
      menu.visible = true; onChange(true);
    } catch (error) {
      if (requested) await requested.end().catch(() => {});
      reset(); throw error;
    } finally { pending = false; }
  }
  function update(frame, time) {
    if (!session || !frame) return;
    pose = frame.getViewerPose(renderer.xr.getReferenceSpace());
    reticle.visible = menu.visible = Boolean(pose) && session.visibilityState === 'visible';
    if (!reticle.visible) { dwell.reset(); return; }
    const transform = pose.transform;
    orientation.set(transform.orientation.x, transform.orientation.y, transform.orientation.z, transform.orientation.w);
    if (anchor) {
      const headingYaw = new T.Euler().setFromQuaternion(orientation, 'YXZ').y;
      rig.rotation.set(0, anchor.yaw - headingYaw, 0);
      origin.set(transform.position.x, transform.position.y, transform.position.z).applyQuaternion(rig.quaternion);
      rig.position.set(anchor.x, anchor.y, anchor.z).sub(origin);
      menu.position.set(anchor.x, anchor.y, anchor.z); menu.rotation.set(0, anchor.yaw, 0);
      anchor = null;
    }
    origin.set(transform.position.x, transform.position.y, transform.position.z).applyQuaternion(rig.quaternion).add(rig.position);
    direction.set(0, 0, -1).applyQuaternion(orientation).applyQuaternion(rig.quaternion);
    scene.updateMatrixWorld(true); raycaster.set(origin, direction);
    const hit = raycaster.intersectObjects(targets)[0]?.object;
    const result = dwell.update(hit, time); progressGeometry.setDrawRange(0, Math.floor(result.progress * 48) * 6);
    targets.forEach(target => target.material.color.set(target === hit ? '#ffd400' : '#ffffff'));
    const text = caption();
    if (text !== lastCaption) { heading.text = lastCaption = text; heading.draw(text); }
    if (result.activate) hit.userData.activate();
  }
  return {
    start, update, teleport,
    get active() { return Boolean(session); },
    end: () => session?.end(),
    dispose() {
      disposed = true; session?.end().catch(() => {});
      menu.removeFromParent(); reticle.removeFromParent(); resources.forEach(resource => resource.dispose());
      scene.add(camera); rig.removeFromParent();
    },
  };
}
