import {createHandSignal} from './hand-signal.js';
import {BAND,LOCK_DELAY,LOCK_RADIUS,clampFrequency,normalizeFrequency,makeBeacons,nearestBeacon,signalMatch} from './signal-model.js';
import {gallerySignals} from './gallery-signals.js';

// One shared, dependency-free experience for the physical monitor and static embed.
export function mountRadioScanner(host) {
  const beacons=makeBeacons(gallerySignals),root=document.createElement('section');
  root.className='radio';root.setAttribute('aria-label','ARTStronomy radio lounge');
  root.innerHTML=`<div class="radio__workspace">
    <header class="radio__nav"><span class="radio__wordmark">ARTSTRONOMY</span><span class="radio__nav-caption">THE RADIO LOUNGE</span><div class="radio__nav-actions"><div class="radio__hand-slot" data-hand-control-slot></div></div></header>
    <section class="radio__hero" aria-label="Featured exhibition artwork">
      <div class="radio__hero-copy"><span class="radio__eyebrow">ARTSTRONOMY GALLERY</span><h2 data-headline></h2><p data-description></p><button type="button" class="radio__explore" data-explore>Find your signal</button></div>
      <figure class="radio__hero-art"><img data-image alt="" decoding="async"></figure>

    </section>
    <div class="radio__bento">
      <section class="radio__card radio__tuner" aria-label="Signal tuner">
        <div class="radio__card-head"><h3>Follow the signal.</h3><span data-status>Exploring</span></div>
        <div class="radio__band"><canvas data-spectrum aria-hidden="true"></canvas><div class="radio__needle" aria-hidden="true"></div></div>
        <label class="radio__dial-label">Slide to explore<input data-frequency-input type="range" min="1200" max="1700" step="1" aria-label="Explore exhibition signals"></label>
        <div class="radio__signal-labels"><span>Drag, tap or use arrow keys</span><span>Hold steady to reveal</span></div>
      </section>
      <section class="radio__card radio__detection" aria-label="Simulated signal match"><span class="radio__eyebrow">SIGNAL DETECTION</span><strong class="radio__percentage" data-percentage>0%</strong><progress data-progress max="100" value="0" aria-label="Simulated signal match percentage"></progress><span data-match>Searching for a signal</span><small>Simulated signal match</small></section>
    </div>

  </div>`;
  host.append(root);
  const q=s=>root.querySelector(s),abort=new AbortController();
  const listen=(target,event,callback,options={})=>target.addEventListener(event,callback,{...options,signal:abort.signal});
  const input=q('[data-frequency-input]'),needle=q('.radio__needle'),handSignal=createHandSignal(BAND.min,BAND.max);
  let frequency=BAND.min,movementAnchor=frequency,locked=null,selected=beacons[0];
  let frame=0,disposed=false,visible=true,pointerId=null,lastPointer=-Infinity,lastMoved=performance.now(),lastVisual=0,lastTime=0,clock=0;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const photo = q('[data-image]');
  const handSlot = q('[data-hand-control-slot]');
  function renderArtwork(beacon) {
    selected = beacon;
    const { number, name, catalog, exposure } = beacon;
    q('[data-headline]').textContent = name;
    root.classList.toggle('has-long-title', name.length > 26);
    q('[data-description]').textContent = [
      catalog,
      exposure && `Exposure · ${exposure} minutes`,
    ].filter(Boolean).join(' · ');
    photo.alt = name;
    photo.src = new URL(`./gallery-${number}.webp`, import.meta.url).href;
  }
  function update(){
    input.value=frequency;input.setAttribute('aria-valuetext',locked?`${locked.name} signal`:'Searching for a signal');needle.style.left=`${normalizeFrequency(frequency)*100}%`;
    q('[data-status]').textContent=locked?'Signal found':'Exploring';
    const percentage=signalMatch(beacons,frequency);
    q('[data-percentage]').textContent=`${percentage}%`;
    q('[data-progress]').value=percentage;
    q('[data-match]').textContent=locked?'Gallery photo revealed':percentage>=95?'Hold steady to reveal':'Keep tuning';
  }
  function lock(beacon) {
    if (locked === beacon) return;
    locked = beacon;
    if (beacon !== selected) renderArtwork(beacon);
    update();
  }
  function tune(value,{jump=false,hand=false}={}){
    const next=clampFrequency(value);
    if(Math.abs(next-movementAnchor)>.35){movementAnchor=next;lastMoved=performance.now();}
    frequency=next;
    if(!hand){lastPointer=performance.now();handSignal.reset();}
    if(locked&&Math.abs(frequency-locked.frequency)>LOCK_RADIUS)locked=null;
    if(jump){const found=nearestBeacon(beacons,frequency).beacon;if(found)lock(found);}
    update();
  }

  listen(input,'input',event=>tune(event.target.value));
  listen(q('[data-explore]'),'click',()=>{input.focus({preventScroll:true});input.scrollIntoView({block:'nearest',behavior:motion.matches?'instant':'smooth'});});
  const band=q('.radio__band');
  const scrub=e=>{const r=band.getBoundingClientRect();if(r.width)tune(BAND.min+(e.clientX-r.left)/r.width*(BAND.max-BAND.min));};
  listen(band,'pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;pointerId=e.pointerId;band.setPointerCapture(pointerId);scrub(e);});
  listen(band,'pointermove',e=>{if(e.pointerId===pointerId)scrub(e);});
  const release=e=>{if(e.pointerId===pointerId){pointerId=null;lastMoved=performance.now();if(band.hasPointerCapture(e.pointerId))band.releasePointerCapture(e.pointerId);}};
  listen(band,'pointerup',release);listen(band,'pointercancel',release);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});intersection.observe(host);
  const panels={};
  for(const name of ['spectrum']){const canvas=q(`[data-${name}]`);panels[name]={canvas,ctx:canvas.getContext('2d'),w:1,h:1};}
  function resize(){for(const p of Object.values(panels)){const r=p.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);p.w=Math.max(1,r.width);p.h=Math.max(1,r.height);const w=Math.round(p.w*dpr),h=Math.round(p.h*dpr);if(p.canvas.width!==w||p.canvas.height!==h){p.canvas.width=w;p.canvas.height=h;p.ctx?.setTransform(dpr,0,0,dpr,0,0);}}}
  const observer=new ResizeObserver(resize);Object.values(panels).forEach(p=>observer.observe(p.canvas));
  function draw(t){
    const p=panels.spectrum,{ctx,w,h}=p;
    if(ctx){ctx.clearRect(0,0,w,h);ctx.strokeStyle='#fffef612';ctx.lineWidth=1;ctx.beginPath();for(let i=1;i<4;i++){ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);}ctx.stroke();
      for(const [line,color] of [[0,'#56c6b5'],[1,'#ffd400']]){ctx.beginPath();for(let i=0;i<=160;i++){const x=i/160,peak=Math.exp(-Math.pow((x-normalizeFrequency(frequency))/.15,2));const value=.4+Math.sin(x*10+t*.55+line)*.12+Math.sin(x*23-t*.3+line)*.06+peak*(line?.13:.27);const y=h*(1-value);i?ctx.lineTo(x*w,y):ctx.moveTo(0,y);}ctx.strokeStyle=color;ctx.lineWidth=line?1:1.6;ctx.stroke();}}

  }
  function tick(now){
    if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min(.05,(now-(lastTime||now))/1000);lastTime=now;
    if(document.hidden||!visible)return;clock+=dt;
    if(!locked){const nearest=nearestBeacon(beacons,frequency);if(nearest.distance<=LOCK_RADIUS&&now-lastMoved>=LOCK_DELAY&&pointerId===null)lock(nearest.beacon);}
    if(now-lastVisual>=1000/(motion.matches?4:24)){draw(motion.matches?0:clock);lastVisual=now;}
  }
  renderArtwork(selected);update();resize();frame=requestAnimationFrame(tick);
  return {
    handControlSlot: handSlot,
    tune,
    setHand(hand){if(disposed)return;if(performance.now()-lastPointer<1600){handSignal.reset();return;}const next=handSignal.update(hand,frequency);if(next!==null)tune(next,{hand:true});},
    setTrackingStatus(text) {
      if (disposed) return;
      if (handSlot.querySelector('button[aria-pressed="true"]')) handSlot.title = text;
      else handSlot.removeAttribute('title');
    },
    destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);abort.abort();observer.disconnect();intersection.disconnect();root.remove();},
  };
}
