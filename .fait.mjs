// usage: node .fait.mjs "<sujet En cours>" "<début ligne Libre>" "<ligne Fait>"
import fs from 'node:fs';
const [enCours, libre, fait] = process.argv.slice(2);
const f='docs/09-CHANTIERS.md'; let l=fs.readFileSync(f,'utf8').split('\n');
const n=l.length;
l=l.filter(x=>!(x.startsWith('| '+enCours) && x.includes('| pris |')));
if(l.length!==n-1) throw new Error('ligne En cours introuvable');
const i=l.findIndex(x=>x.startsWith('| '+libre)); if(i<0) throw new Error('ligne Libre introuvable'); l.splice(i,1);
const j=l.findIndex(x=>x.startsWith('## Fait')); l.splice(j+4,0,fait);
fs.writeFileSync(f,l.join('\n'));
