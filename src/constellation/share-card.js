import { ORBITS } from './game-model.js';

function wrappedText(ctx,text,x,y,maxWidth,lineHeight){
  let line='';
  for(const word of text.split(' ')){
    const next=line ? `${line} ${word}` : word;
    if(line&&ctx.measureText(next).width>maxWidth){ctx.fillText(line,x,y);y+=lineHeight;line=word;}else line=next;
  }
  if(line)ctx.fillText(line,x,y);
  return y+lineHeight;
}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});}

// Export locally; no upload, analytics, account or image-generation service.
export async function createOrbitCard(orbit) {
  await Promise.all([document.fonts.load('400 24px Poppins'),document.fonts.load('700 86px Poppins')]);
  const meta=ORBITS[orbit];
  if(!meta)throw new Error('Unknown orbit');
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  ctx.fillStyle='#161f30';ctx.fillRect(0,0,1080,1350);
  const glow=ctx.createRadialGradient(800,450,0,800,450,800);glow.addColorStop(0,'#233f70');glow.addColorStop(1,'#161f30');ctx.fillStyle=glow;ctx.fillRect(0,0,1080,1350);
  for(let i=0;i<64;i++){ctx.fillStyle=i%3?'#fffef655':'#ffd400';ctx.beginPath();ctx.arc(40+(i*197)%1000,150+(i*137)%1130,i%5===0?3:1.3,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#56c6b580';ctx.lineWidth=2;ctx.strokeRect(40,40,1000,1270);
  ctx.fillStyle='#ffd400';ctx.font='bold 34px Poppins';ctx.fillText('ARTSTRONOMY',78,105);
  ctx.fillStyle='#fffef6';ctx.font='24px Poppins';ctx.fillText('FIND YOUR CREATIVE CONSTELLATION',78,154);
  ctx.font='40px Poppins';ctx.fillText('I’m in the',78,264);
  ctx.font=`bold ${orbit==='Advertising'?76:86}px Poppins`;ctx.fillStyle='#ffd400';ctx.fillText(orbit.toUpperCase(),74,363);
  ctx.fillStyle='#fffef6';ctx.font='bold 86px Poppins';ctx.fillText('ORBIT',74,458);
  const pts=meta.points.map(([x,y])=>[80+x*5.7,530+y*4.5]);
  ctx.strokeStyle='#56c6b5';ctx.lineWidth=4;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  for(const [x,y] of pts){ctx.shadowColor='#ffd400';ctx.shadowBlur=22;ctx.fillStyle='#ffd400';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
  // One same-origin sprite is shared by the game and its download card.
  // A card is still usable if a browser cannot decode the mascot asset.
  try {const image=await loadImage('/assets/hoshi-emotions.webp');const sw=image.naturalWidth/4;ctx.drawImage(image,meta.emotion*sw,0,sw,image.naturalHeight,650,550,350,350*image.naturalHeight/sw);}catch{/* Preserve the result card if artwork is unavailable. */}
  ctx.fillStyle='#fffef6';ctx.font='bold 36px Poppins';wrappedText(ctx,meta.line,78,1020,910,46);
  ctx.font='25px Poppins';wrappedText(ctx,'Five creative directions. Your own constellation. Discover yours at ARTStronomy 2026.',78,1120,900,36);
  ctx.fillStyle='#a7c2f5';ctx.font='20px Poppins';ctx.fillText('artstronomy-fyp-exhibition.mongjonah1229.chatgpt.site',78,1250);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image export failed');
  return blob;
}
