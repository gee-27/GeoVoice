import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {createApi} from '../backend/api.mjs';
export async function testApp(){const engine=new PGlite();const wrap=c=>({query:(sql,values=[])=>values.length===0&&sql.includes(';')?c.exec(sql).then(r=>r.at(-1)||{rows:[]}):c.query(sql,values)});const db={...wrap(engine),transaction:fn=>engine.transaction(tx=>fn(wrap(tx))),close:()=>engine.close()};await engine.exec(await readFile(new URL('../backend/schema.sql',import.meta.url),'utf8'));
 let time=Date.now();
 const config={production:false,origin:'http://localhost:4173',key:randomBytes(32),operator:'Test operator',privacyContact:'privacy@example.test',trustProxy:false,registration:true};
 let app=createApi({db,config,now:()=>time});await app.ready;
 function client(ip='127.0.0.1'){let cookie='',csrf='';return {get cookie(){return cookie;},get csrf(){return csrf;},async request(route,method='GET',body,headers={}){const text=body===undefined?'':JSON.stringify(body);const req=Readable.from([Buffer.from(text)]);Object.assign(req,{url:'/api'+route,method,socket:{remoteAddress:ip},headers:{origin:config.origin,'content-type':'application/json','x-geovoice':'1','x-csrf-token':csrf,cookie,...headers}});const responseHeaders={};let response='';const res={headersSent:false,statusCode:200,setHeader(k,v){responseHeaders[k.toLowerCase()]=v;},removeHeader(k){delete responseHeaders[k.toLowerCase()];},writeHead(status,values={}){this.statusCode=status;Object.entries(values).forEach(([k,v])=>this.setHeader(k,v));this.headersSent=true;},end(data=''){response+=data;}};await app.handle(req,res);const data=JSON.parse(response||'{}');if(responseHeaders['set-cookie'])cookie=responseHeaders['set-cookie'].split(';')[0];if(data.csrf)csrf=data.csrf;return {status:res.statusCode,data,headers:responseHeaders};}};}
 return {db,config,client,advance(ms){time+=ms;},async restart(){app=createApi({db,config,now:()=>time});await app.ready;}};
}
export const samples=(value=.1,count=3)=>Array.from({length:count},()=>Array(128).fill(value));
export const password='A long unique test passphrase!';
export function registration(name='explorer',value=.1){return {username:name,name:'Explorer '+name,password,samples:samples(value),consent:true,consentVersion:'2026-09-22'};}
export async function enroll(client,name='explorer',value=.1){const registrationResult=await client.request('/auth/register','POST',registration(name,value));if(registrationResult.status!==201)throw new Error(JSON.stringify(registrationResult));return registrationResult.data;}
