import test from 'node:test';
import assert from 'node:assert/strict';
import {testApp,enroll,registration,samples,password} from './helpers.mjs';
import {loadConfig} from '../backend/config.mjs';
import {decryptFace,encryptFace} from '../backend/security.mjs';
import {randomBytes} from 'node:crypto';
test('public backend security and account workflows',async t=>{
 const app=await testApp();t.after(()=>app.db.close());const alice=app.client(),bob=app.client('127.0.0.2');let account,recovery,quizId;
 await t.test('registration requires one visible face capture and saves its profile photo',async()=>{
  assert.equal((await alice.request('/auth/register','POST',{...registration('alice'),consent:false})).status,400);
  assert.equal((await alice.request('/auth/register','POST',{...registration('alice'),samples:[]})).status,400);
  assert.equal((await alice.request('/auth/register','POST',{...registration('alice'),photo:undefined})).status,400);
  const r=await alice.request('/auth/register','POST',registration('alice'));assert.equal(r.status,201);assert.equal(r.data.stage,'full');assert.equal(r.data.user.hasPhoto,true);account=r.data.user;recovery=r.data.recoveryCode;assert.ok(recovery);assert.equal((await alice.request('/history')).status,200);
  assert.equal((await alice.request('/auth/otp/send','POST',{})).status,404);
 });
 await t.test('credentials and biometric templates are protected at rest and in responses',async()=>{
  const u=(await app.db.query('SELECT * FROM users WHERE id=$1',[account.id])).rows[0];assert.ok(u.password_hash.startsWith('scrypt$'));assert.ok(!u.face_cipher.includes('[0.1'));assert.ok(!Object.hasOwn(u,'phone_cipher'));assert.notEqual(u.recovery_hash,recovery);
  assert.deepEqual(decryptFace(u.face_cipher,app.config.key,u.id),samples(.1,1));assert.throws(()=>decryptFace(u.face_cipher,app.config.key,'wrong-user'));const exportData=(await alice.request('/account/export')).data;assert.ok(!JSON.stringify(exportData).includes('cipher'));assert.ok(!JSON.stringify(exportData).includes('password'));
 });
 await t.test('same-origin and CSRF protections reject cross-site writes',async()=>{
  assert.equal((await alice.request('/quizzes','POST',{category:'All',count:5},{origin:'https://evil.invalid'})).status,403);
  assert.equal((await alice.request('/quizzes','POST',{category:'All',count:5},{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await alice.request('/quizzes','POST',{category:'All',count:5},{'x-geovoice':''})).status,403);
 });
 await t.test('quiz answers remain server-side, ownership enforced, retries do not rescore',async()=>{
  await enroll(bob,'bob',.7);const start=await alice.request('/quizzes','POST',{category:'Philippines',count:5});assert.equal(start.status,201);quizId=start.data.id;assert.ok(!Object.hasOwn(start.data.question,'answer'));assert.ok(!Object.hasOwn(start.data.question,'explanation'));
  assert.equal((await bob.request('/quizzes/'+quizId)).status,404);assert.equal((await bob.request('/quizzes/'+quizId+'/answer','POST',{index:0,selected:0})).status,404);
  assert.equal((await alice.request('/quizzes/'+quizId+'/answer','POST',{index:3,selected:0})).status,409);
  const first=await alice.request('/quizzes/'+quizId+'/answer','POST',{index:0,selected:0,correct:999});assert.equal(first.status,200);const retry=await alice.request('/quizzes/'+quizId+'/answer','POST',{index:0,selected:0});assert.equal(retry.data.next.index,1);assert.equal(retry.data.correct,first.data.correct);
  assert.equal((await alice.request('/quizzes/'+quizId+'/answer','POST',{index:0,selected:1})).status,409);
  let end;for(let i=1;i<5;i++)end=await alice.request('/quizzes/'+quizId+'/answer','POST',{index:i,selected:0});assert.equal(end.data.result.total,5);assert.ok(end.data.result.correct<=5);
  const history=await alice.request('/history');assert.equal(history.status,200);assert.equal(history.data.stats.quizzes,1);assert.equal(history.data.stats.total,5);assert.equal((await bob.request('/history')).data.attempts.length,0);
 });
 await t.test('persistent sessions survive application restart; logout revokes token',async()=>{
  await app.restart();assert.equal((await alice.request('/session')).data.stage,'full');const stolen=alice.cookie;await alice.request('/auth/logout','POST',{});assert.equal((await alice.request('/session','GET',undefined,{cookie:stolen})).data.stage,'anonymous');
 });
 await t.test('returning sign-in uses username and password without another face capture',async()=>{
  assert.equal((await alice.request('/auth/login','POST',{username:'alice',password:'wrong'})).status,401);
  assert.equal((await alice.request('/auth/login','POST',{username:'alice',password})).data.stage,'full');assert.equal((await alice.request('/history')).status,200);
  assert.equal((await alice.request('/auth/face','POST',{samples:samples(.1,2)})).status,404);
 });
 await t.test('ten accounts can share a face and have separate IDs',async()=>{
  const ids=new Set();for(let i=0;i<10;i++){const client=app.client('test-register-'+i);const r=await client.request('/auth/register','POST',registration('shared_'+i));assert.equal(r.status,201);ids.add(r.data.user.id);}assert.equal(ids.size,10);
  assert.equal((await app.client('duplicate').request('/auth/register','POST',registration('SHARED_0'))).status,409);
 });
 await t.test('one-time recovery rotates password/code and invalidates sessions',async()=>{
  const recover=app.client('recovery');const newPassword='My replacement secret passphrase';assert.equal((await recover.request('/auth/recover','POST',{username:'alice',newPassword,recoveryCode:'invalid'})).status,401);
  const r=await recover.request('/auth/recover','POST',{username:'alice',newPassword,recoveryCode:recovery});const done=r;assert.equal(done.data.stage,'full');assert.notEqual(done.data.recoveryCode,recovery);assert.equal((await alice.request('/history')).status,401);
  assert.equal((await alice.request('/auth/recover','POST',{username:'alice',newPassword,recoveryCode:recovery})).status,401);
  assert.equal((await alice.request('/auth/login','POST',{username:'alice',password})).status,401);
  assert.equal((await recover.request('/account','DELETE',{password:'wrong'})).status,403);
  assert.equal((await recover.request('/account','DELETE',{password:newPassword})).status,200);
  assert.equal((await app.db.query('SELECT * FROM quizzes WHERE user_id=$1',[account.id])).rows.length,0);
  assert.equal((await app.db.query('SELECT * FROM sessions WHERE user_id=$1',[account.id])).rows.length,0);
  assert.equal((await bob.request('/history')).status,200);
 });
 await t.test('idle full sessions expire',async()=>{
  const c=app.client('expiry-test');await enroll(c,'expiry_test');await c.request('/auth/logout','POST',{});await c.request('/auth/login','POST',{username:'expiry_test',password});
  app.advance(31*60000);assert.equal((await c.request('/session')).data.stage,'anonymous');assert.equal((await bob.request('/history')).status,401);
 });
 await t.test('expired pending registrations are removed',async()=>{app.advance(25*60*60000);const {createApi}=await import('../backend/api.mjs');const maintenance=createApi({db:app.db,config:app.config,now:()=>Date.now()+48*60*60000});await maintenance.cleanExpired();assert.equal((await app.db.query('SELECT * FROM users WHERE verified=FALSE')).rows.length,0);});
});
test('production configuration refuses missing services and unsafe origin',()=>{
 assert.throws(()=>loadConfig({NODE_ENV:'production',APP_ORIGIN:'http://localhost:4173'}),/HTTPS/);
 assert.throws(()=>loadConfig({NODE_ENV:'production',APP_ORIGIN:'https://example.test'}),/ENCRYPTION_KEY/);
 const key=randomBytes(32);const cipher=encryptFace(samples(),key,'id');assert.throws(()=>decryptFace(cipher,randomBytes(32),'id'));
});

test('configuration requires no SMS provider',()=>{const config=loadConfig({NODE_ENV:'production',APP_ORIGIN:'https://example.test',DATABASE_URL:'postgresql://localhost/geovoice',FACE_ENCRYPTION_KEY:randomBytes(32).toString('base64'),OPERATOR_NAME:'Test',PRIVACY_CONTACT:'test@example.test'});assert.equal(config.production,true);assert.ok(!Object.hasOwn(config,'twilio'));});
