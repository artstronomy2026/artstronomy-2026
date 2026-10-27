import { creatorCount } from '../observatory/content.js';
import { ensureInstrumentFonts, fitCanvasText } from '../observatory/canvas-type.js';
import * as T from 'three';
import { HUB_SCREENS } from './hub-config.js';

// Dynamic monitor textures contain real exhibition assets and functional UI.
// This radio preview is a simulation; the full scanner owns all audio.
export function makeHubScreens() {
  let disposed=false;
  const images={};
  const load=(key,src)=>{const img=new Image();images[key]=img;img.onload=()=>{if(!disposed) drawAll(0);};img.src=src;};
  const items=HUB_SCREENS.map(()=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=648;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;return {canvas,ctx:canvas.getContext('2d'),texture,material:new T.MeshBasicMaterial({map:texture,toneMapped:false})};});
  function crop(ctx,img,x,y,w,h){if(!img?.complete||!img.naturalWidth)return;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,x,y,w,h);}
  function draw(index,time=0,selected=false){
    const {ctx,canvas,texture}=items[index], screen=HUB_SCREENS[index];
    ctx.fillStyle='#161f30';ctx.fillRect(0,0,1024,648);
    ctx.fillStyle=selected?'#ffd400':'#fffef6';ctx.font='500 38px "Poppins", sans-serif';fitCanvasText(ctx,screen.title,944,38);ctx.fillText(screen.title,40,66);
    ctx.fillStyle='#3e536f';ctx.fillRect(36,94,952,2);
    if(index===0){
      ctx.fillStyle='#161f30';ctx.fillRect(34,114,956,391);
      // Hoshi's supplied artwork remains recognizable at monitor scale.
      const mascot=images.hoshi;if(mascot?.complete&&mascot.naturalWidth){const h=357,w=h*mascot.naturalWidth/mascot.naturalHeight;ctx.drawImage(mascot,(1024-w)/2,120,w,h);}
      ctx.strokeStyle='#798da9';ctx.lineWidth=2;ctx.strokeRect(220,131,584,342);
    }else if(index===1){crop(ctx,images.gallery,34,114,956,391);}
    else if(index===2){
      ctx.fillStyle='#fffef6';ctx.font='500 60px "Poppins", sans-serif';ctx.fillText('1420.40',40,181);const mhzX=40+ctx.measureText('1420.40').width+16;ctx.font='24px "Poppins", sans-serif';ctx.fillText('MHz',mhzX,181);
      ctx.fillStyle='#b9c6d9';ctx.font='18px "Poppins", sans-serif';ctx.fillText('EXHIBITION SIGNAL SIMULATION',40,218);
      ctx.strokeStyle='#798da935';ctx.lineWidth=1;
      for(let x=40;x<980;x+=47){ctx.beginPath();ctx.moveTo(x,244);ctx.lineTo(x,402);ctx.stroke();}
      for(let y=244;y<402;y+=31){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(980,y);ctx.stroke();}
      ctx.strokeStyle='#56c6b5';ctx.lineWidth=2.5;ctx.beginPath();
      for(let x=40;x<=980;x++){const envelope=9+87*Math.exp(-Math.pow((x-560)/25,2));const y=335+Math.sin(x*.24+time*.001)*envelope+Math.sin(x*.91)*5;x===40?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
      for(let x=40;x<980;x+=8)for(let y=415;y<501;y+=6){const v=(Math.sin(x*.33+y*.78+time*.0003)+1)/2;ctx.fillStyle=`hsl(${175+v*60} 55% ${8+v*25}%)`;ctx.fillRect(x,y,7,5);}
    }else{
      ctx.fillStyle='#161f30';ctx.fillRect(34,114,956,391);ctx.fillStyle='#ffd400';ctx.font='bold 67px "Poppins", sans-serif';ctx.fillText('ARTSTRONOMY',55,225);
      ctx.font='20px "Poppins", sans-serif';ctx.fillStyle='#b9c6d9';ctx.fillText(`${creatorCount} CREATORS. ONE UNIVERSE.`,59,272);
      const mascot=images.hoshi;if(mascot?.complete&&mascot.naturalWidth)ctx.drawImage(mascot,665,274,240,218);
      crop(ctx,images.art,55,303,275,170);crop(ctx,images.animation,344,303,275,170);
    }
    ctx.fillStyle='#b9c6d9';ctx.font='22px "Poppins", sans-serif';ctx.fillText(screen.note.toUpperCase(),40,539);
    ctx.fillStyle=selected?'#fffef6':'#ffd400';ctx.beginPath();ctx.roundRect(182,566,660,57,7);ctx.fill();ctx.textAlign='center';ctx.fillStyle='#161f30';ctx.font='bold 26px "Poppins", sans-serif';ctx.fillText(screen.action.toUpperCase(),512,605);ctx.textAlign='left';
    texture.needsUpdate=true;
  }
  function drawAll(time){items.forEach((_,i)=>draw(i,time));}
  load('hoshi','/assets/hoshi-mascot.webp');load('gallery','/assets/hub/gallery-preview.webp');load('art','/assets/project-graphic-design.webp');load('animation','/assets/project-animation.webp');drawAll(0);
  const nameplate=document.createElement('canvas');nameplate.width=1200;nameplate.height=145;const nc=nameplate.getContext('2d');function drawNameplate(){nc.fillStyle='#0b1220';nc.fillRect(0,0,1200,145);nc.fillStyle='#fffef6';nc.textAlign='center';nc.font='500 64px "Poppins", sans-serif';nc.fillText('A R T S T R O N O M Y',600,73);nc.fillStyle='#ffd400';nc.font='24px "Poppins", sans-serif';nc.fillText('C O N T R O L   S T A T I O N',600,123);}drawNameplate();const nameplateTexture=new T.CanvasTexture(nameplate);nameplateTexture.colorSpace=T.SRGBColorSpace;const nameplateMaterial=new T.MeshBasicMaterial({map:nameplateTexture,toneMapped:false});
  ensureInstrumentFonts().then(()=>{if(!disposed){drawAll(0);drawNameplate();nameplateTexture.needsUpdate=true;}});
  return {items,draw,nameplateMaterial,dispose(){disposed=true;nameplateTexture.dispose();nameplateMaterial.dispose();Object.values(images).forEach(img=>img.onload=null);items.forEach(i=>{i.texture.dispose();i.material.dispose();});}};
}
