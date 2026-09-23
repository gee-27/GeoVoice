import test from 'node:test';
import assert from 'node:assert/strict';
import {testApp,registration,password,enroll} from './helpers.mjs';
import {testPhoto} from './photo-fixture.mjs';
import {validatePhoto} from '../backend/security.mjs';
import {startCountdown} from '../dist/countdown.js';
test('photo validation requires consent and rejects invalid or oversized captures',()=>{
 assert.equal(validatePhoto(testPhoto,true),testPhoto);assert.equal(validatePhoto(undefined,false),null);
 for(const photo of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,AAAA','x'.repeat(90001)])assert.throws(()=>validatePhoto(photo,true));
 assert.throws(()=>validatePhoto(testPhoto,false));
});
test('private profile photos are encrypted, require full sign-in, and can be removed',async t=>{
 const app=await testApp();t.after(()=>app.db.close());const a=app.client('photo-a'),b=app.client('photo-b');
 assert.equal((await a.request('/account/photo')).status,401);
 const r=await a.request('/auth/register','POST',{...registration('photo_user'),photo:testPhoto,photoConsent:true});assert.equal(r.status,201);assert.equal(r.data.user.hasPhoto,true);
 const row=(await app.db.query('SELECT photo_cipher FROM users WHERE id=$1',[r.data.user.id])).rows[0];assert.ok(row.photo_cipher&&!row.photo_cipher.includes(testPhoto));
 assert.equal((await a.request('/account/photo')).data.photo,testPhoto);await enroll(b,'other_user');const ownPhoto=await b.request('/account/photo?userId='+r.data.user.id);assert.equal(ownPhoto.status,200);assert.equal(ownPhoto.data.photo,testPhoto);
 await a.request('/auth/logout','POST',{});const login=await a.request('/auth/login','POST',{username:'photo_user',password});assert.equal(login.data.stage,'full');assert.equal((await a.request('/account/photo')).data.photo,testPhoto);
 assert.equal((await a.request('/account/photo','DELETE',{}, {'x-csrf-token':'wrong'})).status,403);assert.equal((await a.request('/account/photo','DELETE',{})).status,200);assert.equal((await a.request('/account/photo')).status,404);
 await a.request('/account','DELETE',{password});assert.equal((await app.db.query('SELECT id FROM users WHERE id=$1',[r.data.user.id])).rows.length,0);
});
test('five-second countdown tracks elapsed time and completes exactly once',()=>{
 let time=0,callback,finished=0,cancelled=0;const ticks=[];
 const stop=startCountdown({now:()=>time,schedule:fn=>{callback=fn;return 1;},cancel:()=>cancelled++,tick:(seconds,fraction)=>ticks.push([seconds,fraction]),done:()=>finished++});
 assert.deepEqual(ticks.at(-1),[5,1]);time=2200;callback();assert.equal(ticks.at(-1)[0],3);time=5000;callback();callback();stop();assert.equal(finished,1);assert.equal(cancelled,1);
});
test('pausing a countdown prevents navigation even after its deadline',()=>{
 let time=0,callback,finished=0;const stop=startCountdown({now:()=>time,schedule:fn=>{callback=fn;return 1;},cancel:()=>{},tick:()=>{},done:()=>finished++});stop();time=6000;callback();assert.equal(finished,0);
});
