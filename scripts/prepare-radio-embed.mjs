import {mkdirSync,copyFileSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'public/radio-scanner');rmSync(destination,{recursive:true,force:true});mkdirSync(path.join(destination,'assets'),{recursive:true});
mkdirSync(path.join(destination,'fonts'),{recursive:true});
for(const name of ['poppins.css','Poppins-OFL.txt',...Array.from({length:6},(_,i)=>`poppins-latin-${400+i*100}-normal.woff2`)])copyFileSync(path.join(root,'public/fonts',name),path.join(destination,'fonts',name));
for(const file of ['index.html','radio-scanner.css','radio-scanner.js','cosmic-audio.js','signal-model.js','hand-signal.js','brand-signals.js','README.md'])copyFileSync(path.join(root,'src/radio',file),path.join(destination,file));
writeFileSync(path.join(destination,'brand-signals.js'),readFileSync(path.join(root,'src/radio/brand-signals.js'),'utf8').replaceAll("'/assets/","'./assets/"));
writeFileSync(path.join(destination,'radio-scanner.js'),readFileSync(path.join(root,'src/radio/radio-scanner.js'),'utf8').replaceAll('/assets/','./assets/'));
writeFileSync(path.join(destination,'radio-scanner.css'),readFileSync(path.join(root,'src/radio/radio-scanner.css'),'utf8').replaceAll('/assets/','./assets/').replaceAll('/fonts/','./fonts/'));
for(const name of ['hoshi-mascot.webp','hoshi-poster.webp','hoshi-emotions.webp'])copyFileSync(path.join(root,'public/assets',name),path.join(destination,'assets',name));
execFileSync('python3',['-c',`import pathlib,zipfile,os
root=pathlib.Path(${JSON.stringify(root)})
folder=root/'public/radio-scanner'
target=root/'public/artstronomy-radio-scanner.zip'
temp=target.with_suffix('.tmp')
with zipfile.ZipFile(temp,'w',zipfile.ZIP_DEFLATED) as z:
 for p in folder.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(root/'public'))
with zipfile.ZipFile(temp) as z:
 assert z.testzip() is None
os.replace(temp,target)
`]);
console.log('Prepared standalone radio scanner and source ZIP.');
