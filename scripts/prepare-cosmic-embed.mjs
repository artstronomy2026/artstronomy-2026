import { mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'public/cosmic');
mkdirSync(path.join(destination,'vendor'),{recursive:true});
mkdirSync(path.join(destination,'fonts'),{recursive:true});
for(const name of ['poppins.css','Poppins-OFL.txt',...Array.from({length:6},(_,i)=>`poppins-latin-${400+i*100}-normal.woff2`)])
  copyFileSync(path.join(root,'public/fonts',name),path.join(destination,'fonts',name));
for(const name of ['index.html','cosmic-viewport.css','cosmic-viewport.js','creators.js','hand-tracking.js','README.md'])
  copyFileSync(path.join(root,'src/cosmic',name),path.join(destination,name));
for(const name of ['three.module.js','three.core.js'])
  copyFileSync(path.join(root,'node_modules/three/build',name),path.join(destination,'vendor',name));
copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(destination,'vendor/THREE-LICENSE.txt'));
copyFileSync(path.join(root,'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'),path.join(destination,'vendor/vision_bundle.mjs'));
writeFileSync(path.join(destination,'vendor/MEDIAPIPE-NOTICE.txt'),'MediaPipe Tasks Vision by Google LLC. Licensed under Apache License 2.0.\nhttps://www.apache.org/licenses/LICENSE-2.0\nhttps://github.com/google-ai-edge/mediapipe\nThe JavaScript bundle and WASM files retain their embedded license headers.\n');
// Hosted demo reuses the website's model files without duplicating 41 MB.
rmSync(path.join(destination,'mediapipe'),{recursive:true,force:true});
writeFileSync(path.join(destination,'index.html'),readFileSync(path.join(root,'src/cosmic/index.html'),'utf8').replace("assetRoot:'./mediapipe'","assetRoot:'../mediapipe'"));
// A ZIP of this same source makes the requested static integration portable.
execFileSync('python',['-c',`import pathlib,zipfile,os
root=pathlib.Path(${JSON.stringify(root)})
folder=root/'public'/'cosmic'
target=root/'public'/'artstronomy-cosmic-embed.zip'
temp=target.with_suffix('.tmp')
with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED) as z:
 for p in folder.rglob('*'):
  if p.is_file() and p.name!='index.html': z.write(p,p.relative_to(root/'public'))
 z.write(root/'src/cosmic/index.html','cosmic/index.html')
 for p in (root/'public/mediapipe').rglob('*'):
  if p.is_file(): z.write(p,pathlib.Path('cosmic/mediapipe')/p.relative_to(root/'public/mediapipe'))
with zipfile.ZipFile(temp) as z:
 assert z.testzip() is None
os.replace(temp,target)
`]);
console.log('Prepared standalone cosmic embed and source ZIP.');
