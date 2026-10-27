import * as THREE from 'three';

// Vanilla Three.js engine. No React, network calls, backend, or paid dependencies.
// mountCosmicViewport(container, { creators }) returns controls and destroy().
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const colors = { Branding: '#ffd400', Advertising: '#56c6b5', Animation: '#a7c2f5', 'Web Design': '#56c6b5', Publishing: '#56c6b5' };
export const sectorCategory = category => /Animation|Mix Media/.test(category) ? 'Animation' : category;
export const clampZoom = value => clamp(Number(value) || 1, 1, 4);
export function sectorCoordinates(position) {
  const radius = Math.max(position.length(), .001);
  const ra = ((Math.atan2(position.z, position.x) / TAU * 24) + 24) % 24;
  const dec = Math.asin(clamp(position.y / radius, -1, 1)) * 180 / Math.PI;
  return `RA ${ra.toFixed(2)}h · DEC ${dec >= 0 ? '+' : ''}${dec.toFixed(1)}°`;
}

// One full-screen pass composites the space field, magnified scene and inspection
// layer. UVs are re-sampled inside the lens; red/blue split only near its rim.
const lensFragment = `
  uniform sampler2D sceneTex;
  uniform sampler2D gridTex;
  uniform vec2 resolution;
  uniform vec2 pointer;
  uniform float radius;
  uniform float zoom;
  uniform float lensOn;
  uniform float time;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y); }
  vec3 sky(vec2 uv){
    vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);
    float cloud=noise(p*3.3+time*.008)*.55+noise(p*7.5-time*.005)*.28+noise(p*15.)*.17;
    float band=exp(-pow(p.y+p.x*.32+.04,2.)*19.);
    vec3 dust=mix(vec3(.012,.071,.063),vec3(.115,.071,.034),smoothstep(-.3,.6,p.x));
    return vec3(.003,.011,.017)+dust*cloud*band*.78;
  }
  void main(){
    vec2 d=(vUv-pointer)*resolution;
    float r=length(d)/radius;
    float mask=(1.-smoothstep(.97,1.,r))*lensOn;
    // Slight radial bending accompanies true magnification.
    vec2 sampleUV=pointer+(vUv-pointer)/zoom*(1.+.045*r*r);
    vec2 shift=normalize(d+vec2(.001))/resolution*2.2*pow(min(r,1.),3.);
    vec2 lo=vec2(.002), hi=vec2(.998);
    vec3 lensed=vec3(texture2D(sceneTex,clamp(sampleUV+shift,lo,hi)).r,
      texture2D(sceneTex,clamp(sampleUV,lo,hi)).g,
      texture2D(sceneTex,clamp(sampleUV-shift,lo,hi)).b);
    lensed+=sky(sampleUV)+texture2D(gridTex,clamp(sampleUV,lo,hi)).rgb*.8;
    vec3 base=texture2D(sceneTex,vUv).rgb+sky(vUv);
    vec3 result=mix(base,lensed,mask);
    float rim=(1.-smoothstep(.005,.018,abs(r-1.)))*lensOn;
    result+=vec3(.34,.68,.60)*rim*.65;
    result*=1.-.27*pow(length((vUv-.5)*1.25),2.);
    gl_FragColor=vec4(result,1.);
    #include <colorspace_fragment>
  }
`;

// 1. HTML: the shell is generated here so it can be embedded in any plain div.
// All roster values are assigned with textContent, never interpreted as HTML.
function createShell(host, creators) {
  const root = document.createElement('section');
  root.className = 'cosmic';
  root.setAttribute('aria-label', 'ARTStronomy interactive galaxy');
  root.innerHTML = `
    <div class="cosmic__stage" tabindex="0" role="application" aria-label="Galaxy: drag or use arrow keys to rotate. Press plus or minus to zoom. Select a creator below to focus."></div>
    <canvas class="cosmic__reticles" aria-hidden="true"></canvas>
    <div class="cosmic__heading"><span class="cosmic__eyebrow">ARTSTRONOMY / OBSERVATORY 01</span><h2>Every creator.<br>A new constellation.</h2><p>${creators.length} stars. One creative universe.</p></div>
    <div class="cosmic__readout"><span>CELESTIAL SURVEY / 2026</span><b data-coordinates>RA 00.00h · DEC +00.0°</b><small>Exhibition sector coordinates</small></div>
    <div class="cosmic__core" aria-hidden="true"><span>ARTStronomy</span><strong>2026</strong></div>
    <div class="cosmic__labels" aria-hidden="true"></div>
    <aside class="cosmic__card" hidden aria-live="polite"><div class="cosmic__card-meta"><span data-sector></span><span data-category></span></div><h3 data-name></h3><p data-project></p><small data-star-coordinates></small><button type="button" data-focus>Enter this orbit ↗</button></aside>
    <div class="cosmic__lens-tag" hidden aria-hidden="true">COSMIC LENS <b>2.0×</b></div>
    <div class="cosmic__legend" aria-label="Exhibition categories"></div>
    <div class="cosmic__console">
      <div class="cosmic__modes" aria-label="Exploration mode"><button type="button" data-orbit aria-pressed="true">Orbit galaxy</button><button type="button" data-lens aria-pressed="false">Cosmic lens</button></div>
      <div class="cosmic__zoom"><button type="button" data-minus aria-label="Decrease magnification">−</button><output data-zoom>1.0×</output><button type="button" data-plus aria-label="Increase magnification">+</button></div>
      <button type="button" data-reset aria-label="Reset galaxy view">Reset view</button>
      <label class="cosmic__select"><span class="cosmic__sr">Focus a creator</span><select data-select><option value="">Explore ${creators.length} creators</option></select></label>
    </div>
    <p class="cosmic__hint" data-hint>Drag to orbit · hover a star · scroll to zoom</p>
    <span class="cosmic__tracking" data-tracking>Mouse & touch ready</span>
    <div class="cosmic__error" hidden role="alert"></div>`;
  host.append(root);
  const q = selector => root.querySelector(selector);
  Object.entries(colors).forEach(([name, color]) => {
    const item = document.createElement('span');
    const dot = document.createElement('i'); dot.style.background = color;
    item.append(dot, document.createTextNode(name)); q('.cosmic__legend').append(item);
  });
  creators.forEach((creator, i) => {
    const option = document.createElement('option'); option.value = i; option.textContent = creator.name;
    q('[data-select]').append(option);
  });
  return { root, q };
}

// 3. THREE.JS SETUP: two off-screen layers + a single lens composite pass.
export function mountCosmicViewport(host, { creators = [], onError = () => {} } = {}) {
  const { root, q } = createShell(host, creators);
  const stage = q('.cosmic__stage');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) {
    const box = q('.cosmic__error'); box.hidden = false;
    box.textContent = 'This browser cannot start the 3D galaxy. Enable hardware acceleration or try another browser.';
    onError(error);
    return { destroy: () => root.remove(), setHand() {}, setTrackingStatus() {} };
  }
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 150);
  const universe = new THREE.Group(); scene.add(universe);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  const abort = new AbortController();
  const listen = (target, type, fn, options = {}) => target.addEventListener(type, fn, { ...options, signal: abort.signal });
  let width = 1, height = 1, dpr = Math.min(devicePixelRatio || 1, coarsePointer ? 1.25 : 1.6);
  let disposed = false, frame = 0, clock = 0, lastTime = 0, lastHUD = 0, lastHover = -1, slowTime = 0;
  let mode = 'orbit', orbitZoom = 1, lensZoom = 2, selected = -1, hovered = -1, cardIndex = -1;
  let yaw = .25, pitch = .64, targetYaw = yaw, targetPitch = pitch;
  let velocityX = 0, velocityY = 0, lastInteraction = 0, isVisible = true;
  const cameraTarget = new THREE.Vector3(), desiredTarget = new THREE.Vector3();
  const pointer = { x: .5, y: .5, active: false, lastMouse: -Infinity };
  const pointers = new Map(); let down = null, pinchDistance = 0;
  let handSeen = -Infinity, wasPinched = false, handHold = -1, handHoldTime = 0;
  const world = new THREE.Vector3(), projected = new THREE.Vector3();

  // Radial sprites supply a soft glow without expensive full-screen bloom.
  const spriteCanvas = document.createElement('canvas'); spriteCanvas.width = spriteCanvas.height = 64;
  const ctx = spriteCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#fffef6'); gradient.addColorStop(.10, 'rgba(255,255,255,.96)');
  gradient.addColorStop(.3, 'rgba(255,255,255,.26)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(spriteCanvas);
  const spriteMaterial = color => new THREE.SpriteMaterial({ color, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

  // Deterministic stars: modest counts, one BufferGeometry, one draw call.
  let seed = 2026;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dustPositions = [], dustColors = [];
  for (let i = 0; i < (coarsePointer ? 850 : 1500); i++) {
    const angle = random() * TAU, radius = 2 + random() * 23;
    dustPositions.push(Math.cos(angle) * radius, (random() - .5) * 10, Math.sin(angle) * radius);
    const color = new THREE.Color(i % 4 ? '#56c6b5' : '#ffd400').multiplyScalar(.3 + random() * .5);
    dustColors.push(color.r, color.g, color.b);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ size: .065, map: glowTexture, transparent: true, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  const core = new THREE.Group(); universe.add(core);
  const coreGlow = new THREE.Sprite(spriteMaterial('#ffd400')); coreGlow.scale.setScalar(2.8); core.add(coreGlow);
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.46, 1), new THREE.MeshBasicMaterial({ color: '#ffd400', wireframe: true, transparent: true, opacity: .65 })));
  for (let i = 0; i < 3; i++) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(.82 + i * .12, .007, 4, 72), new THREE.MeshBasicMaterial({ color: i ? '#56c6b5' : '#ffd400', transparent: true, opacity: .48 }));
    hoop.rotation.set(i * .86, i * .74, i * .6); core.add(hoop);
  }
  const groups = Object.keys(colors);
  const orbitGroups = groups.map((category, index) => {
    const group = new THREE.Group();
    group.rotation.x = (index - 2) * .11; group.rotation.z = (index % 2 ? 1 : -1) * .1;
    const radius = 2.7 + index * .84;
    const points = Array.from({ length: 129 }, (_, n) => new THREE.Vector3(Math.cos(n / 128 * TAU) * radius, 0, Math.sin(n / 128 * TAU) * radius));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: colors[category], transparent: true, opacity: .2 })));
    universe.add(group); return { group, radius, category };
  });
  const counters = {};
  const nodes = creators.map((creator, index) => {
    const category = sectorCategory(creator.category), oi = Math.max(0, groups.indexOf(category));
    const orbit = orbitGroups[oi];
    const count = creators.filter(c => sectorCategory(c.category) === category).length;
    const order = counters[category] || 0; counters[category] = order + 1;
    const angle = order / count * TAU + oi * 1.42;
    const group = new THREE.Group(); orbit.group.add(group);
    const star = new THREE.Sprite(spriteMaterial(colors[category])); star.scale.setScalar(.58); group.add(star);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.25, .262, 48), new THREE.MeshBasicMaterial({ color: colors[category], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); group.add(ring);
    const label = document.createElement('span'); label.textContent = String(index + 1).padStart(2, '0'); q('.cosmic__labels').append(label);
    return { creator, category, index, group, star, ring, orbit, angle, label, screen: { x: 0, y: 0, visible: false }, world: new THREE.Vector3() };
  });
  // Dynamic faint links are rebuilt in place; no per-frame geometry allocations.
  const connectionBuffer = new Float32Array(Math.max(1, nodes.length * 2) * 6);
  const connectionGeometry = new THREE.BufferGeometry();
  connectionGeometry.setAttribute('position', new THREE.BufferAttribute(connectionBuffer, 3).setUsage(THREE.DynamicDrawUsage));
  const connections = new THREE.LineSegments(connectionGeometry, new THREE.LineBasicMaterial({ color: '#56c6b5', transparent: true, opacity: .16 })); scene.add(connections);
  const grid = new THREE.PolarGridHelper(9, 24, 12, 128, '#56c6b5', '#28405d'); grid.layers.set(1); scene.add(grid);
  const hiddenWire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.28, 1)), new THREE.LineBasicMaterial({ color: '#ffd400', transparent: true, opacity: .6 })); hiddenWire.layers.set(1); scene.add(hiddenWire);
  const vectors = new THREE.LineSegments(connectionGeometry, new THREE.LineBasicMaterial({ color: '#56c6b5', transparent: true, opacity: .7 })); vectors.layers.set(1); scene.add(vectors);

  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const gridTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const uniforms = { sceneTex: { value: sceneTarget.texture }, gridTex: { value: gridTarget.texture }, resolution: { value: new THREE.Vector2(1, 1) }, pointer: { value: new THREE.Vector2(.5, .5) }, radius: { value: 120 }, zoom: { value: 2 }, lensOn: { value: 0 }, time: { value: 0 } };
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: lensFragment, depthTest: false, depthWrite: false });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

  const hud = q('.cosmic__reticles'), hudCtx = hud.getContext('2d');
  function drawHUD() {
    hud.width = Math.round(width * dpr); hud.height = Math.round(height * dpr);
    hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0); hudCtx.clearRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2, r = Math.min(width * .43, height * .38);
    hudCtx.strokeStyle = 'rgba(153,204,186,.14)'; hudCtx.lineWidth = 1;
    hudCtx.beginPath(); hudCtx.arc(cx, cy, r, 0, TAU); hudCtx.stroke();
    hudCtx.font = '10px Poppins, sans-serif'; hudCtx.fillStyle = 'rgba(168,200,187,.45)'; hudCtx.textAlign = 'center';
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * TAU; const length = i % 10 === 0 ? 11 : 4;
      hudCtx.beginPath(); hudCtx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      hudCtx.lineTo(cx + Math.cos(a) * (r + length), cy + Math.sin(a) * (r + length)); hudCtx.stroke();
      if (i % 10 === 0) hudCtx.fillText(`${i * 3}°`, cx + Math.cos(a) * (r + 24), cy + Math.sin(a) * (r + 24) + 3);
    }
    hudCtx.strokeStyle = 'rgba(200,229,212,.38)';
    [[18,18,1,1],[width-18,18,-1,1],[18,height-18,1,-1],[width-18,height-18,-1,-1]].forEach(([x,y,sx,sy]) => {
      hudCtx.beginPath(); hudCtx.moveTo(x+26*sx,y); hudCtx.lineTo(x,y); hudCtx.lineTo(x,y+26*sy); hudCtx.stroke();
    });
  }
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr); renderer.setSize(width, height);
    sceneTarget.setSize(Math.round(width*dpr), Math.round(height*dpr)); gridTarget.setSize(Math.round(width*dpr), Math.round(height*dpr));
    uniforms.resolution.value.set(width, height); uniforms.radius.value = Math.min(130, width * .25, height * .23);
    drawHUD();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  const observer = new IntersectionObserver(entries => { isVisible = entries[0]?.isIntersecting ?? true; }); observer.observe(host);

  function updateControls() {
    q('[data-orbit]').setAttribute('aria-pressed', String(mode === 'orbit'));
    q('[data-lens]').setAttribute('aria-pressed', String(mode === 'lens'));
    q('[data-zoom]').textContent = `${(mode === 'lens' ? lensZoom : orbitZoom).toFixed(1)}×`;
    q('.cosmic__lens-tag b').textContent = `${lensZoom.toFixed(1)}×`;
    q('[data-hint]').textContent = mode === 'lens' ? 'Move to inspect · scroll or pinch to magnify · click a star to focus' : 'Drag to orbit · hover a star · scroll or pinch to zoom';
  }
  function setMode(value) { mode = value; pointer.active = true; updateControls(); }
  function zoomBy(amount) {
    if (mode === 'lens') lensZoom = clampZoom(lensZoom + amount); else orbitZoom = clampZoom(orbitZoom + amount);
    updateControls(); lastInteraction = performance.now();
  }
  function showCard(index) {
    cardIndex = index; const card = q('.cosmic__card'); card.hidden = index < 0;
    if (index < 0) return;
    const node = nodes[index];
    q('[data-sector]').textContent = `SECTOR ${String(index + 1).padStart(2, '0')}`;
    q('[data-category]').textContent = node.creator.category;
    q('[data-name]').textContent = node.creator.name;
    q('[data-project]').textContent = node.creator.projectTitle || 'Project title to be announced';
    q('[data-star-coordinates]').textContent = sectorCoordinates(node.world);
    q('[data-focus]').textContent = selected === index ? 'Return to full galaxy ↗' : 'Enter this orbit ↗';
    card.style.setProperty('--sector-color', colors[node.category]);
  }
  function focus(index) {
    if (!nodes[index]) return;
    selected = index; hovered = index; orbitZoom = 1;
    lastInteraction = performance.now(); velocityX = velocityY = 0;
    q('[data-select]').value = index; showCard(index); updateControls();
  }
  function reset() {
    selected = hovered = -1; orbitZoom = 1; lensZoom = 2; targetYaw = .25; targetPitch = .64;
    velocityX = velocityY = 0; desiredTarget.set(0, 0, 0); q('[data-select]').value = '';
    showCard(-1); updateControls(); lastInteraction = performance.now();
  }
  function movePointer(event) {
    const rect = stage.getBoundingClientRect(); pointer.x = clamp((event.clientX - rect.left)/width,0,1); pointer.y = clamp((event.clientY-rect.top)/height,0,1);
    pointer.active = true; pointer.lastMouse = performance.now(); lastInteraction = pointer.lastMouse;
  }
  function hitTest() {
    let best = -1, distance = coarsePointer ? 34 : 25;
    nodes.forEach(node => {
      if (!node.screen.visible) return;
      const d = Math.hypot(node.screen.x - pointer.x*width, node.screen.y-pointer.y*height);
      if (d < distance) { distance = d; best = node.index; }
    }); return best;
  }
  listen(stage, 'pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    movePointer(event); stage.focus({ preventScroll: true }); stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
    if (pointers.size === 1) { down = { x:event.clientX, y:event.clientY, moved:false }; velocityX = velocityY = 0; }
    if (pointers.size === 2) { const [a,b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x-b.x,a.y-b.y); if(down) down.moved=true; }
  });
  listen(stage, 'pointermove', event => {
    movePointer(event);
    const old = pointers.get(event.pointerId);
    if (!old) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (down && Math.hypot(event.clientX-down.x,event.clientY-down.y)>6) down.moved=true;
    if (pointers.size === 2) {
      const [a,b]=[...pointers.values()]; const distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinchDistance>0) zoomBy((distance/pinchDistance-1)*2); pinchDistance=distance;
    } else if (mode==='orbit') {
      velocityX = -(event.clientX-old.x)*.005; velocityY=(event.clientY-old.y)*.004;
      targetYaw+=velocityX; targetPitch=clamp(targetPitch+velocityY,-.1,1.35);
    }
  });
  const release = event => {
    if (event.type === 'pointerup' && down && !down.moved && pointers.size===1) { const index=hitTest(); if(index>=0) focus(index); }
    pointers.delete(event.pointerId); pinchDistance=0; if(!pointers.size) down=null;
    if(stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  listen(stage,'pointerup',release); listen(stage,'pointercancel',release);
  listen(stage,'pointerleave',()=> { if(!pointers.size){pointer.active=false; hovered=-1;} });
  listen(stage,'wheel',event=>{event.preventDefault();zoomBy(clamp(-event.deltaY*.002,-.3,.3));},{passive:false});
  listen(stage,'keydown',event=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Escape'].includes(event.key)) event.preventDefault();
    if(event.key==='ArrowLeft')targetYaw-=.12;if(event.key==='ArrowRight')targetYaw+=.12;
    if(event.key==='ArrowUp')targetPitch=clamp(targetPitch+.1,-.1,1.35);if(event.key==='ArrowDown')targetPitch=clamp(targetPitch-.1,-.1,1.35);
    if(event.key==='+'||event.key==='=')zoomBy(.25);if(event.key==='-')zoomBy(-.25);if(event.key==='Escape')reset();lastInteraction=performance.now();
  });
  listen(q('[data-orbit]'),'click',()=>setMode('orbit')); listen(q('[data-lens]'),'click',()=>setMode('lens'));
  listen(q('[data-plus]'),'click',()=>zoomBy(.25));listen(q('[data-minus]'),'click',()=>zoomBy(-.25));listen(q('[data-reset]'),'click',reset);
  listen(q('[data-select]'),'change',event=>event.target.value===''?reset():focus(Number(event.target.value)));
  listen(q('[data-focus]'),'click',()=>selected===cardIndex?reset():focus(cardIndex));
  listen(renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); q('.cosmic__error').hidden=false;q('.cosmic__error').textContent='The graphics session paused. Close and reopen the observatory to resume.'; });

  // Hand input from MediaPipe is optional. The engine also works on static pages
  // with pointer/touch only. Pinch selects; a steady hover selects after 1.4 sec.
  function setHand(hand) {
    const now=performance.now();
    if(!hand?.pinched||hand.gesture==='fist'){wasPinched=false;handHold=-1;if(handSeen>pointer.lastMouse)pointer.active=false;return;}
    if(now-pointer.lastMouse<1200)return;
    pointer.x+=(hand.x-pointer.x)*.35;pointer.y+=(hand.y-pointer.y)*.35;
    pointer.active=true;handSeen=now;lastInteraction=now;
    if(hand.pinched&&!wasPinched){const index=hitTest();if(index>=0)focus(index);}
    wasPinched=hand.pinched;
    if(mode==='orbit' && selected<0){targetYaw+=(pointer.x-.5)*.007;targetPitch=clamp(.64+(.5-pointer.y)*.6,-.1,1.35);}
    const index=hitTest();
    if(index!==handHold){handHold=index;handHoldTime=now;}
    if(index>=0&&now-handHoldTime>1400&&selected!==index){focus(index);handHoldTime=now;}
  }
  function setTrackingStatus(text){q('[data-tracking]').textContent=text;}
  function animate(now) {
    if(disposed)return; frame=requestAnimationFrame(animate);
    const dt=Math.min(.05,(now-(lastTime||now))/1000); lastTime=now;
    if(document.hidden||!isVisible)return;
    clock+=reducedMotion.matches?0:dt;
    // Lower pixel density if this device consistently misses the frame budget.
    slowTime=dt>.026?slowTime+dt:Math.max(0,slowTime-dt);
    if(slowTime>2.5&&dpr>1){dpr=Math.max(1,dpr-.25);slowTime=0;resize();}
    const ease=1-Math.exp(-dt*7);
    if(!pointers.size&&!reducedMotion.matches){targetYaw+=velocityX;targetPitch=clamp(targetPitch+velocityY,-.1,1.35);velocityX*=Math.exp(-dt*8);velocityY*=Math.exp(-dt*8);}
    if(now-lastInteraction>3500&&selected<0&&!reducedMotion.matches)targetYaw+=dt*.035;
    yaw+=(targetYaw-yaw)*ease;pitch+=(targetPitch-pitch)*ease;
    core.rotation.y=clock*.16; core.rotation.z=clock*.045; hiddenWire.rotation.copy(core.rotation);
    dust.rotation.y=clock*.008;
    nodes.forEach(node=>{
      const a=node.angle+(selected<0?clock*.018/(1+groups.indexOf(node.category)*.12):node.frozenAngle||0);
      if(selected<0)node.frozenAngle=clock*.018/(1+groups.indexOf(node.category)*.12);
      node.group.position.set(Math.cos(a)*node.orbit.radius,Math.sin(clock*.4+node.index)*.06,Math.sin(a)*node.orbit.radius);
    });
    scene.updateMatrixWorld(true);
    nodes.forEach(node=>node.group.getWorldPosition(node.world));
    desiredTarget.copy(selected>=0?nodes[selected].world:world.set(0,0,0)); cameraTarget.lerp(desiredTarget,ease);
    const baseDistance=width<600?26:19;
    const distance=(selected>=0?5.5:baseDistance)/orbitZoom;
    const parallaxX=pointer.active?(pointer.x-.5)*.22:0, parallaxY=pointer.active?(.5-pointer.y)*.16:0;
    const dest=world.set(cameraTarget.x+Math.sin(yaw)*Math.cos(pitch)*distance+parallaxX,cameraTarget.y+Math.sin(pitch)*distance+parallaxY,cameraTarget.z+Math.cos(yaw)*Math.cos(pitch)*distance);
    if(!lastHUD)camera.position.copy(dest);else camera.position.lerp(dest,ease);
    camera.lookAt(cameraTarget);camera.updateMatrixWorld();
    let linkCount=0;
    nodes.forEach((node,i)=>{
      node.ring.quaternion.copy(camera.quaternion);node.ring.quaternion.premultiply(node.orbit.group.quaternion.clone().invert());
      const active=i===hovered||i===selected;
      node.star.scale.setScalar((active?.96:.55)*(1+Math.sin(clock*1.5+i)*.09));
      node.ring.material.opacity+=( (active?.8:0)-node.ring.material.opacity)*ease;
      node.ring.scale.setScalar(active?1.4:1);
      projected.copy(node.world).project(camera);
      node.screen={x:(projected.x*.5+.5)*width,y:(-.5*projected.y+.5)*height,visible:projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1};
      node.label.style.transform=`translate(${node.screen.x+12}px,${node.screen.y-12}px)`;node.label.hidden=!node.screen.visible;
      node.label.style.opacity=active?'1':'.48';
      for(let offset=1;offset<=2;offset++){
        const other=nodes[(i+offset)%nodes.length];if(!other)continue;
        if(node.world.distanceTo(other.world)<5.4){node.world.toArray(connectionBuffer,linkCount*6);other.world.toArray(connectionBuffer,linkCount*6+3);linkCount++;}
      }
    });
    connectionGeometry.setDrawRange(0,linkCount*2);connectionGeometry.attributes.position.needsUpdate=true;connections.frustumCulled=false;vectors.frustumCulled=false;
    if(pointer.active&&!pointers.size)hovered=hitTest();
    if(!pointer.active)hovered=-1;
    const current=hovered>=0?hovered:q('.cosmic__card').matches(':hover')?cardIndex:selected;
    if(current!==lastHover){showCard(current);lastHover=current;}
    stage.style.cursor=hovered>=0?'pointer':pointers.size?'grabbing':mode==='lens'?'crosshair':'grab';
    projected.set(0,0,0).project(camera);q('.cosmic__core').style.transform=`translate(${(projected.x*.5+.5)*width}px,${(-projected.y*.5+.5)*height+48}px) translateX(-50%)`;
    q('.cosmic__core').hidden=selected>=0||projected.z>1;
    const lensActive=mode==='lens'&&pointer.active;
    uniforms.pointer.value.set(pointer.x,1-pointer.y);uniforms.zoom.value=lensZoom;uniforms.lensOn.value=lensActive?1:0;uniforms.time.value=clock;
    q('.cosmic__lens-tag').hidden=!lensActive;
    q('.cosmic__lens-tag').style.transform=`translate(${clamp(pointer.x*width-70,10,width-160)}px,${clamp(pointer.y*height+uniforms.radius.value+10,10,height-160)}px)`;
    camera.layers.set(0);renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
    if(lensActive){camera.layers.set(1);renderer.setRenderTarget(gridTarget);renderer.render(scene,camera);camera.layers.set(0);}
    renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
    if(now-lastHUD>150){q('[data-coordinates]').textContent=`RA ${((yaw/TAU*24+24)%24).toFixed(2)}h · DEC ${(pitch*180/Math.PI).toFixed(1)}° · ${(mode==='lens'?lensZoom:orbitZoom).toFixed(1)}×`;if(cardIndex>=0)q('[data-star-coordinates]').textContent=sectorCoordinates(nodes[cardIndex].world);lastHUD=now;}
  }
  updateControls();frame=requestAnimationFrame(animate);
  return {
    setHand, setTrackingStatus, focus, reset, setMode,
    destroy() {
      disposed=true;cancelAnimationFrame(frame);abort.abort();resizeObserver.disconnect();observer.disconnect();
      const geometries=new Set(),materials=new Set();
      [scene,postScene].forEach(s=>s.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}));
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());glowTexture.dispose();sceneTarget.dispose();gridTarget.dispose();renderer.dispose();renderer.forceContextLoss();root.remove();
    }
  };
}
