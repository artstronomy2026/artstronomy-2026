import * as THREE from 'three';
import { GifReader } from './omggif.js';

const $ = selector => document.querySelector(selector);
const intro = $('#intro');
const experience = $('#experience');
const stage = $('#stage');
const notice = $('#notice');
const embedded = window.parent !== window && new URLSearchParams(location.search).get('embedded') === '1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const startButton = $('#start');
const titles = [
  'Idea', 'Spacing', 'Workload', 'Hammer', 'Undo', 'Layers', 'Tablet', 'Design apps',
  'Dab', 'Paint palette', 'Coffee', 'Due o’clock', 'Deadline', 'Click', 'Error 404', 'Pilot',
];
const stickerName = index => `Hoshi Sticker-${String(index).padStart(2, '0')}`;

const loader = new THREE.TextureLoader();
const viewer = new THREE.Vector3();
let mind, renderer, scene, camera, trackerReady;
let activeTarget, effect, requested = 0, returning = false;
let posterPromise, stickerSurface;
let elapsed = 0, lastTime = 0;

function status(text, hint = '') {
  $('#tracking').textContent = text;
  $('#hint').textContent = hint;
}

function cleanup() {
  returning = true;
  requested++;
  effect?.video?.pause();
  renderer?.setAnimationLoop(null);
  mind?.controller?.stopProcessVideo();
  mind?.controller?.worker?.terminate();
  if (mind?.video) {
    mind.video.srcObject?.getTracks().forEach(track => track.stop());
    mind.video.pause();
    mind.video.srcObject = null;
  }
  renderer?.dispose();
  renderer?.forceContextLoss();
}

function close() {
  if (returning) return;
  cleanup();
  if (embedded) {
    window.parent.postMessage({type:'artstronomy:poster-close'}, location.origin);
  } else {
    location.reload();
  }
}

addEventListener('pagehide', cleanup, {once:true});
$('#close').onclick = close;
if (embedded) {
  $('#back-to-ship').hidden = false;
  $('#back-to-ship').onclick = close;
  $('#home').onclick = event => { event.preventDefault(); close(); };
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (!experience.hidden || embedded)) {
    event.preventDefault();
    close();
  }
  if (event.key === 'Tab' && embedded) {
    const visible = [...document.querySelectorAll('a[href],button:not(:disabled)')]
      .filter(node => node.getClientRects().length);
    if (event.shiftKey && document.activeElement === visible[0]) {
      event.preventDefault();
      visible.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === visible.at(-1)) {
      event.preventDefault();
      visible[0]?.focus();
    }
  }
});

async function fetchAsset(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error(`Could not load ${path} (HTTP ${response.status})`);
  return response;
}

function plane(texture, width, height, transparent) {
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent, depthWrite: !transparent, toneMapped: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

async function buildPoster() {
  const { aspect, layers } = await (await fetchAsset('poster-v2-layers.json')).json();
  const root = new THREE.Group();
  const meshes = await Promise.all(layers.map(async ({ image, bounds }, index) => {
    const texture = await loader.loadAsync(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    const [left, top, width, height] = bounds;
    const mesh = plane(texture, width, height, index !== 0);
    mesh.position.set(left + width / 2 - .5, aspect / 2 - top - height / 2, 0);
    mesh.renderOrder = index * 2;
    const layer = new THREE.Group();
    layer.add(mesh);
    return layer;
  }));
  root.add(...meshes);
  const video = document.createElement('video');
  video.src = 'poster-v2-aurora.mp4';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'none';
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  const aurora = plane(videoTexture, 1, aspect, true);
  aurora.renderOrder = 1;
  aurora.position.z = .001;
  aurora.material.opacity = 0;
  aurora.visible = false;
  video.addEventListener('loadedmetadata', () => {
    const ratio = video.videoWidth / video.videoHeight;
    if (ratio > 0) {
      const y = Math.min(1, aspect * ratio);
      const x = Math.min(1, 1 / (aspect * ratio));
      videoTexture.repeat.set(x, y);
      videoTexture.offset.set((1 - x) / 2, (1 - y) / 2);
    }
  });
  meshes[0].add(aurora);
  return { root, meshes, video, aurora, tilt: 0 };
}

function posterArt() {
  if (!posterPromise) {
    posterPromise = buildPoster().catch(error => {
      posterPromise = null;
      throw error;
    });
  }
  return posterPromise;
}

function getStickerSurface() {
  if (!stickerSurface) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const root = plane(texture, 1, 1, true);
    root.renderOrder = 1;
    stickerSurface = {root, context, texture};
  }
  return stickerSurface;
}

async function stickerArt(index) {
  const response = await fetchAsset(`Hoshi-Sticker-${String(index).padStart(2, '0')}.gif`);
  const reader = new GifReader(new Uint8Array(await response.arrayBuffer()));
  if (reader.width !== 480 || reader.height !== 480 || !reader.numFrames()) throw Error('Invalid sticker GIF');
  const frameEnds = [];
  let duration = 0;
  for (let i = 0; i < reader.numFrames(); i++) {
    duration += reader.frameInfo(i).delay * 10;
    frameEnds.push(duration);
  }
  const {root, context, texture} = getStickerSurface();
  const buffer = context.createImageData(reader.width, reader.height);
  return {root, context, texture, reader, frameEnds, duration, buffer, frame: -1, restore: null};
}

function drawSticker(sticker, milliseconds) {
  const {reader, frameEnds, buffer, context, texture} = sticker;
  const upcoming = frameEnds.findIndex(end => end > milliseconds);
  const target = upcoming < 0 ? frameEnds.length - 1 : upcoming;
  if (target === sticker.frame) return;
  if (target < sticker.frame) {
    sticker.frame = -1;
    sticker.restore = null;
    buffer.data.fill(0);
  }
  for (let i = sticker.frame + 1; i <= target; i++) {
    if (i > 0) {
      const last = reader.frameInfo(i - 1);
      if (last.disposal === 2) {
        for (let row = last.y; row < last.y + last.height; row++) {
          const start = (row * reader.width + last.x) * 4;
          buffer.data.fill(0, start, start + last.width * 4);
        }
      } else if (last.disposal === 3 && sticker.restore) {
        buffer.data.set(sticker.restore);
      }
    }
    sticker.restore = reader.frameInfo(i).disposal === 3 ? buffer.data.slice() : null;
    reader.decodeAndBlitFrameRGBA(i, buffer.data);
  }
  context.putImageData(buffer, 0, 0);
  texture.needsUpdate = true;
  sticker.frame = target;
}

function startEffect() {
  elapsed = 0;
  if (activeTarget.index === 0) {
    effect.tilt = 0;
    effect.aurora.visible = false;
    effect.video.currentTime = 0;
    if (!reducedMotion.matches) effect.video.play().catch(() => {});
  } else {
    drawSticker(effect, reducedMotion.matches ? Infinity : 0);
  }
}

function clearEffect() {
  requested++;
  effect?.video?.pause();
  if (effect) effect.root.removeFromParent();
  effect = null;
  activeTarget = null;
  experience.classList.remove('is-found');
}

async function activate(index, parent) {
  clearEffect();
  const target = {index, parent};
  activeTarget = target;
  const request = requested;
  const label = index ? `${stickerName(index)} · ${titles[index - 1]}` : 'Official poster';
  experience.classList.add('is-found');
  status(`Loading ${label}…`);
  try {
    const artwork = await (index === 0 ? posterArt() : stickerArt(index));
    if (requested !== request || returning) return;
    effect = artwork;
    effect.root.position.set(0, 0, index ? .12 : 0);
    effect.root.rotation.set(0, 0, 0);
    effect.root.scale.setScalar(1);
    parent.add(effect.root);
    status(label, index === 0 ? 'Move around the poster to see the five layers at different depths.' : '');
    startEffect();
  } catch (error) {
    if (requested !== request || returning) return;
    console.error('AR artwork:', error);
    status('Effect could not load', 'Move off the artwork, then scan it again.');
  }
}

function scanPrompt() {
  status('Find the poster or a Hoshi sticker', 'Keep one design in view. Use even light and avoid glare.');
}

function animatePoster(delta) {
  camera.getWorldPosition(viewer);
  effect.root.worldToLocal(viewer);
  const angle = Math.atan2(Math.hypot(viewer.x, viewer.y), Math.abs(viewer.z));
  const tilt = THREE.MathUtils.smoothstep(angle, .07, .7);
  effect.tilt = THREE.MathUtils.lerp(effect.tilt, tilt, 1 - Math.exp(-8 * delta));
  const motion = !reducedMotion.matches;
  const phase = elapsed * Math.PI / 3;
  const depth = .026 + effect.tilt * .033;
  effect.meshes.forEach((layer, index) => {
    const bob = motion && index === effect.meshes.length - 1 ? Math.sin(phase) * .012 : 0;
    layer.position.set(0, bob, index * depth);
  });
  const stars = effect.meshes[1].children[0];
  stars.material.opacity = motion ? .92 + .08 * Math.cos(phase) : 1;

  const { video, aurora } = effect;
  aurora.visible = motion && !video.paused && video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0;
  if (aurora.visible) {
    // Fade back to the original illustration at both ends of the video loop.
    aurora.material.opacity = .42 * Math.sin(Math.PI * video.currentTime / video.duration) ** 2;
  }
}

function render(now) {
  const delta = lastTime ? Math.min(.1, (now - lastTime) / 1000) : 0;
  lastTime = now;
  if (document.hidden) return;
  if (effect) {
    elapsed += delta;
    if (activeTarget.index === 0) {
      animatePoster(delta);
    } else if (!reducedMotion.matches) {
      drawSticker(effect, (elapsed * 1000) % effect.duration);
    }
  }
  renderer.render(scene, camera);
}

function showCamera() {
  intro.hidden = true;
  experience.hidden = false;
  $('#close').textContent = embedded ? 'Back to spaceship' : 'Close camera';
  $('#close').focus();
}

function fail(error) {
  if (returning) return;
  console.error('ARTStronomy AR:', error);
  cleanup();
  experience.hidden = true;
  intro.hidden = false;
  notice.textContent = 'The camera could not start. Check browser camera access, then reload to try again.';
  startButton.disabled = false;
  startButton.onclick = () => location.reload();
  notice.focus();
}

async function startAR() {
  startButton.disabled = true;
  notice.textContent = 'Preparing image tracking…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Camera API unavailable');
    const {MindARThree} = await import('./vendor/mindar-image-three.prod.js');
    if (returning) return;
    showCamera();
    status('Allow camera access to scan the artwork');
    mind = new MindARThree({
      container:stage, imageTargetSrc:'targets-v2.mind', maxTrack:1, uiLoading:'no',
      uiScanning:'no', uiError:'no', warmupTolerance:3, missTolerance:6,
      filterMinCF:.001, filterBeta:1000,
    });
    ({renderer, scene, camera} = mind);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    for (let index = 0; index <= titles.length; index++) {
      const anchor = mind.addAnchor(index);
      anchor.onTargetFound = () => { if (!returning) activate(index, anchor.group); };
      anchor.onTargetLost = () => {
        if (returning || activeTarget?.parent !== anchor.group) return;
        clearEffect();
        scanPrompt();
      };
    }
    await mind.start();
    if (returning) { cleanup(); return; }
    trackerReady = true;
    if (document.hidden) mind.controller.stopProcessVideo();
    if (!activeTarget) scanPrompt();
    renderer.setAnimationLoop(render);
  } catch (error) {
    fail(error);
  }
}

startButton.onclick = startAR;
document.addEventListener('visibilitychange', () => {
  lastTime = 0;
  if (!trackerReady || returning) return;
  if (document.hidden) {
    effect?.video?.pause();
    mind.controller.stopProcessVideo();
  } else {
    if (!reducedMotion.matches) effect?.video?.play().catch(() => {});
    mind.controller.processVideo(mind.video);
  }
});
