import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

test('a QR/PIN guest keeps the nickname form while waiting and reaches the host lobby',async()=>{
 const {document,window}=parseHTML(await readFile(new URL('../dist/live.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{document,window,location:{search:'?pin=123456'},history:{replaceState(){}},sessionStorage:{getItem(){return null;},setItem(){}}});
 const intervals=[];globalThis.setInterval=fn=>{intervals.push(fn);return intervals.length;};
 const id='8b7771f1-0449-4d7d-8772-6aeebd184021';let reads=0;
 globalThis.fetch=async(url,options={})=>{let status=200,data;
  if(url==='/api/config')data={categories:['Capitals']};
  else if(url==='/api/session')data={stage:'anonymous'};
  else if(url==='/api/live/pin/123456')data={id,pin:'123456',category:'Capitals',teamMode:false,maxPlayers:2};
  else if(url===`/api/live/rooms/${id}/join`){status=201;data={token:'a'.repeat(43),playerId:'player-1'};}
  else if(url===`/api/live/rooms/${id}`){reads++;data={id,pin:'123456',category:'Capitals',teamMode:false,maxPlayers:2,status:'lobby',roundIndex:0,total:5,questionMs:20000,deadline:null,serverNow:Date.now(),question:null,reveal:null,players:[{id:'player-1',name:'Guest',team:null,points:0}],teams:[],answeredCount:0,myAnswer:null,playerId:'player-1',isHost:false,joinUrl:'http://localhost:4173/live.html?pin=123456'};}
  else throw new Error('Unexpected request '+url);
  return {ok:status<400,status,json:async()=>data};
 };
 await import('../dist/live.js');await new Promise(resolve=>setTimeout(resolve,10));
 assert.match(document.querySelector('main').textContent,/What should we call you/);
 assert.equal(document.querySelector('#host-form'),null);
 intervals[0]();assert.equal(reads,0);assert.ok(document.querySelector('#nickname'));
 document.querySelector('#nickname').value='Guest';await document.querySelector('#join-form').onsubmit({preventDefault(){},submitter:document.querySelector('#join-form button')});
 assert.equal(reads,1);assert.match(document.querySelector('main').textContent,/Gather your explorers/);
 assert.match(document.querySelector('main').textContent,/1 \/ 2 players/);
});

test('a signed-in host sees room capacity while the join pane is a separate player choice',async()=>{
 const {document,window}=parseHTML(await readFile(new URL('../dist/live.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{document,window,location:{search:''},history:{replaceState(){}},sessionStorage:{getItem(){return null;},setItem(){}}});
 globalThis.setInterval=()=>1;
 globalThis.fetch=async(url)=>({ok:true,status:200,json:async()=>url==='/api/config'?{categories:['Capitals']}:{stage:'full',csrf:'test'}});
 await import('../dist/live.js?host-view');await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(document.querySelector('#host-form'));
 assert.equal(document.querySelector('#max-players').getAttribute('max'),'30');
 assert.equal(document.querySelector('#pin-form'),null);
 document.querySelector('#join-instead').click();
 assert.ok(document.querySelector('#pin-form'));
 assert.equal(document.querySelector('#host-form'),null);
});
