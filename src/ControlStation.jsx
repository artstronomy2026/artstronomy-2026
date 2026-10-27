import { useEffect, useRef, useState } from 'react';
import { HUB_SCREENS } from './hub/hub-config.js';
import './control-station.css';
import { ImmersiveHelp } from './immersive/ImmersiveHelp.jsx';
import { isHandheld } from './immersive/device-look.js';
import { VRControl } from './immersive/VRControl.jsx';

export default function ControlStation({onSelect,onClose,cinematic=null,scanner=null,onScannerClose,onReady,introBlocked=false}){
 const root=useRef(null),host=useRef(null),monitor=useRef(null),engine=useRef(null),actions=useRef({onSelect,onClose,onReady}),cinematicRef=useRef(cinematic);
 const [ready,setReady]=useState(false),[fallback,setFallback]=useState(''),[selected,setSelected]=useState(null),[motion,setMotion]=useState('off');
 const [vr,setVR]=useState(false);
 actions.current={onSelect,onClose,onReady};cinematicRef.current=cinematic;
 const busy=!!cinematic,go=id=>id==='website'?actions.current.onClose():actions.current.onSelect(id);
 useEffect(()=>{let cancelled=false;
   import('./hub/hub-engine.js').then(({createHub})=>{if(cancelled)return;engine.current=createHub({host:host.current,monitorElement:monitor.current,initialCinematic:cinematicRef.current,onSelect:go,onHover:setSelected,onMotion:setMotion,onVR:setVR,onReady:()=>{setReady(true);actions.current.onReady?.(true);},onFallback:message=>{setFallback(message);setReady(true);actions.current.onReady?.(true);}});}).catch(()=>{if(!cancelled){setFallback('The 3D view could not load. All four destinations remain available.');setReady(true);actions.current.onReady?.(true);}});
   return()=>{cancelled=true;engine.current?.dispose();engine.current=null;};
 },[]);
 useEffect(()=>{engine.current?.setCinematic(cinematic);},[cinematic]);
 useEffect(()=>{if(ready&&!busy&&!scanner){root.current?.focus({preventScroll:true});const panorama=root.current?.querySelector('.seated-hub__fallback');if(panorama)panorama.scrollLeft=(panorama.scrollWidth-panorama.clientWidth)/2;}},[ready,busy,scanner]);
 useEffect(()=>{if(ready&&!fallback&&!busy&&!introBlocked&&!scanner&&!vr&&isHandheld())engine.current?.startMotion(false);},[ready,fallback,busy,introBlocked,scanner,vr]);
 const open=id=>{if(busy)return;setSelected(id);go(id);};
 return <div ref={root} tabIndex={-1} className={`seated-hub ${ready?'is-ready':''} ${fallback?'is-fallback':''} ${scanner?'has-scanner':''} ${busy?'is-travelling':''}`} aria-label="Seated spaceship control station" data-cinematic={cinematic?.kind||'idle'} data-destination={cinematic?.to||''}>
   <div ref={host} className="seated-hub__world" />
   <VRControl available={ready&&!fallback&&!scanner} disabled={busy||introBlocked} active={vr} onEnter={()=>engine.current?.startVR()} onExit={()=>engine.current?.endVR()}/>
   {fallback&&<div className="seated-hub__fallback"><div className="seated-hub__image"><img src="/assets/hub/seated-hub-fallback.webp" alt="Seated ARTStronomy cockpit with four destination monitors"/><div className="seated-hub__hotspots">{HUB_SCREENS.map(s=><button key={s.id} aria-label={`Open ${s.title}`} onClick={()=>open(s.id)} disabled={busy||!!scanner}>{s.id==='ar'&&<span className="poster-monitor-label">AR POSTER</span>}</button>)}</div></div></div>}
   {scanner&&<header className="seated-hub__header"><div className="seated-hub__scanner-tools"><button onClick={onScannerClose}>Back to seat</button></div></header>}
   {!ready&&<div className="seated-hub__loading" role="status"><span>ARTSTRONOMY</span><strong>Preparing your seat.</strong></div>}
   <div ref={monitor} className={`seated-hub__live-monitor ${scanner?'is-open':''}`} aria-label="Radio scanner cockpit monitor">{scanner}</div>
   {!scanner&&<>
     <ImmersiveHelp ready={ready&&!busy&&!introBlocked&&!vr} motion={fallback?'unavailable':motion} fallback={fallback?'Compatibility view · swipe across the cockpit and tap a monitor.':''} onMotion={enable=>enable?engine.current?.startMotion(true):engine.current?.stopMotion()}>
       <div className="obs-help-destinations" aria-label="Choose a destination">{HUB_SCREENS.map(s=><button key={s.id} disabled={!ready||busy} onClick={()=>open(s.id)}>{s.title} ↗</button>)}</div>
       {!fallback&&<><button onClick={()=>engine.current?.home()}>Recenter view</button><button onClick={()=>engine.current?.adjustConsole(0,.4)}>Rotate holographic star chart</button></>}
     </ImmersiveHelp>
     <nav className="immersive-access" aria-label="Spaceship destinations">{HUB_SCREENS.map(s=><button key={s.id} disabled={!ready||busy} onFocus={()=>{setSelected(s.id);engine.current?.focus(s.id);}} onClick={()=>open(s.id)}>{s.title}</button>)}</nav>
   </>}

 </div>;
}
