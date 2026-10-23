import test from 'node:test';
import assert from 'node:assert/strict';
import {testApp} from './helpers.mjs';

test('guests can complete a temporary quiz without an account',async t=>{
 const app=await testApp();t.after(()=>app.db.close());const guest=app.client('guest-player');
 const start=await guest.request('/guest/quizzes','POST',{category:'All',count:5});
 assert.equal(start.status,201);assert.equal(start.data.total,5);assert.ok(start.data.guestToken);assert.ok(!Object.hasOwn(start.data.question,'answer'));
 let token=start.data.guestToken,response;
 for(let index=0;index<5;index++){response=await guest.request('/guest/quizzes/answer','POST',{index,selected:0,guestToken:token});token=response.data.guestToken;assert.equal(response.status,200);}
 assert.equal(response.data.result.total,5);assert.equal(response.data.guestToken,null);
 assert.equal((await app.db.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count,0);
 assert.equal((await app.db.query('SELECT COUNT(*)::int AS count FROM quizzes')).rows[0].count,0);
 const altered=start.data.guestToken.slice(0,-1)+(start.data.guestToken.endsWith('A')?'B':'A');
 assert.equal((await guest.request('/guest/quizzes/answer','POST',{index:0,selected:0,guestToken:altered})).status,401);
});
