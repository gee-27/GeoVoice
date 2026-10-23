import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
for(const folder of ['dist','backend','api','scripts'])for(const name of await readdir(folder)){if(/\.(js|mjs)$/.test(name)){const result=spawnSync(process.execPath,['--check',path.join(folder,name)],{stdio:'inherit'});if(result.status!==0)process.exit(1);}}
const html=await readFile('dist/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="\.\/([^\"]+)"/g))await readFile('dist/'+match[1]);
const app=await readFile('dist/app.js','utf8');if(app.includes("from './questions.js'")||app.includes('indexedDB.open'))throw new Error('Legacy client database found.');
console.log('Source syntax and local assets verified.');
