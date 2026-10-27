import { creatorCount } from '../observatory/content.js';
import { useEffect, useRef, useState } from 'react';
import { creatorData } from '../cosmic/creators.js';
import { createGallery } from './gallery-engine.js';
import {MuseumMap} from './MuseumMap.jsx';
import { wrapExhibit } from './gallery-layout.js';
import { ImmersiveHelp } from '../immersive/ImmersiveHelp.jsx';
import { isHandheld } from '../immersive/device-look.js';
import { VRControl } from '../immersive/VRControl.jsx';
import './virtual-gallery.css';

export function VirtualGallery({ onWebsite, onClose, busy=false, onReady=()=>{} }) {
  const host=useRef(null),overlay=useRef(null),engine=useRef(null);
  const [mapOpen,setMapOpen]=useState(false),[seated,setSeated]=useState(false),[tour,setTour]=useState(false);
  const [mapPosition,setMapPosition]=useState({x:0,z:5,yaw:0});
  const mapVisible=useRef(false),lastPosition=useRef({x:0,z:5,yaw:0});mapVisible.current=mapOpen;
  const [selected,setSelected]=useState(0),[inspection,setInspection]=useState(null);
  const [motion,setMotion]=useState('off'),[xr,setXR]=useState(false),[xrSupported,setXRSupported]=useState(false);
  const [vr,setVR]=useState(false);
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[atEnd,setAtEnd]=useState(false),[endDismissed,setEndDismissed]=useState(false);
  const [status,setStatus]=useState('Opening the orbital art museum…');
  useEffect(()=>{
    let active=true;
    try {
      engine.current=createGallery({host:host.current,overlay:overlay.current,creators:creatorData,
        onVR:value=>{if(active){setVR(value);setInspection(null);setMapOpen(false);}},
        onTour:value=>active&&setTour(value),
        onReady:()=>{if(active){setReady(true);onReady();}},onPosition:value=>{lastPosition.current=value;if(active&&mapVisible.current)setMapPosition(value);},
        onSelect:index=>active&&setSelected(index),onInspect:value=>active&&setInspection(value),
        onEnd:value=>{if(active){setAtEnd(value);if(!value)setEndDismissed(false);}},
        onStatus:text=>active&&setStatus(text),onMotion:value=>active&&setMotion(value),onXR:value=>{if(active){setXR(value);setInspection(null);}},onError:text=>active&&setError(text)});

    } catch {setError('The gallery could not load. Use navigation help to browse the creator details.');}
    if(engine.current?.supportsAR&&isHandheld()&&navigator.xr?.isSessionSupported)navigator.xr.isSessionSupported('immersive-ar').then(value=>active&&setXRSupported(value)).catch(()=>{});
    return()=>{active=false;engine.current?.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.setBlocked(busy);},[busy,ready]);
  useEffect(()=>{if(ready&&!busy&&!xr&&!vr&&isHandheld())engine.current?.startMotion(false);},[ready,busy,xr,vr]);
  const visit=index=>{const next=wrapExhibit(index,creatorData.length);setSelected(next);if(engine.current){setInspection(null);engine.current.visit(next);}else setInspection({index:next,x:30,y:180});};
  const creator=inspection?creatorData[inspection.index]:null;
  return <section ref={overlay} className={`virtual-gallery ${xr?'virtual-gallery--xr':''}`} aria-label="ARTStronomy virtual exhibition">
    <div ref={host} className="virtual-gallery__scene" />
    <VRControl available={ready&&engine.current?.supportsVR&&!xr} disabled={busy} active={vr} onEnter={()=>engine.current?.startVR()} onExit={()=>engine.current?.endVR()}/>
    <header className="virtual-gallery__heading"><h2>Orbital Art Museum</h2></header>
    <button className="virtual-gallery__back" onClick={()=>{if(xr)engine.current?.endAR();else onClose();}} aria-label={xr?'Exit walk-in AR':'Back to spaceship'}>{xr?'Exit AR':'Back to ship'}</button>
    <span className="sr-only" role="status">{status}</span>
    <ImmersiveHelp ready={(ready||!!error)&&!busy&&!vr} gallery fallback={xr?'Move your phone or tablet to explore. Open help to visit another creator.':''} motion={xr?'unavailable':motion} onMotion={enable=>enable?engine.current?.startMotion(true):engine.current?.stopMotion()}>
      {xrSupported&&!xr&&<button onClick={()=>engine.current?.startAR()}>Start walk-in AR</button>}
      <label className="virtual-gallery__help-select">Visit a creator<select aria-label="Visit a creator" value={selected} onChange={e=>visit(Number(e.target.value))}>{creatorData.map((item,index)=><option key={item.id} value={index}>{item.name} · {item.category}</option>)}</select></label>
      <button onClick={()=>{engine.current?.stopTour();setTour(false);engine.current?.home();}}>Return to atrium</button>
      {!xr&&<><button aria-pressed={seated} onClick={()=>{setSeated(!seated);engine.current?.setEyeHeight(!seated);}}>{seated?'Use standing eye height':'Use seated eye height'}</button>
      <button aria-pressed={tour} onClick={()=>{if(tour){engine.current?.stopTour();setTour(false);}else if(engine.current?.startTour())setTour(true);else setStatus('Guided camera travel is disabled with reduced motion. Choose any creator to move directly.');}}>{tour?'Stop guided tour':'Start guided tour'}</button>
      {!isHandheld()&&<button onClick={()=>engine.current?.lockPointer()}>Mouse look · Esc releases</button>}</>}

    </ImmersiveHelp>
    {!xr&&<button className="museum-map-toggle" aria-expanded={mapOpen} onClick={()=>{setMapPosition(lastPosition.current);setMapOpen(!mapOpen);}}>Map</button>}
    {mapOpen&&!xr&&<MuseumMap position={mapPosition} onClose={()=>setMapOpen(false)} onVisit={id=>{engine.current?.visitWing(id);setMapOpen(false);}}/>}
    {error&&<div className="virtual-gallery__error" role="alert"><p>{error}</p></div>}
    {creator&&<aside className="virtual-gallery__inspection" aria-label="Artwork and student details" style={{'--card-x':`${inspection.x}px`,'--card-y':`${inspection.y}px`}}>
      <span className="virtual-gallery__eyebrow">EXHIBIT {String(inspection.index+1).padStart(2,'0')} / {creatorCount}</span>
      <h3>{creator.name}</h3><strong>{creator.category}</strong>
      <p>Project title to be announced.</p><small>Category artwork shown · final project artwork coming soon</small>
    </aside>}
    {atEnd&&!endDismissed&&!xr&&<section className="virtual-gallery__end" aria-label="Continue your visit"><span className="virtual-gallery__eyebrow">YOUR NEXT ORBIT</span><h3>Explore more on our website?</h3><p>Meet the creators and discover the exhibition programme.</p><div><button className="virtual-gallery__primary" onClick={onWebsite}>Visit website</button><button onClick={()=>setEndDismissed(true)}>Keep exploring</button></div></section>}
  </section>;
}
