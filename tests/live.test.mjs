import test from 'node:test';
import assert from 'node:assert/strict';
import {testApp,enroll} from './helpers.mjs';

test('live game uses guest tokens, private answers, host teams, timed rounds and scoring',async()=>{
 const app=await testApp();try{
  const host=app.client('10.1.1.1'),alice=app.client('10.1.1.2'),bob=app.client('10.1.1.3');await enroll(host,'livehost');
  const created=await host.request('/live/rooms','POST',{category:'All',count:5,seconds:20,teamMode:true,maxPlayers:2});assert.equal(created.status,201);assert.match(created.data.pin,/^\d{6}$/);assert.match(created.data.qr,/^data:image\/png;base64,/);assert.equal(created.data.joinUrl,`http://localhost:4173/live.html?pin=${created.data.pin}`);
  const id=created.data.id;
  const found=await alice.request('/live/pin/'+created.data.pin);assert.equal(found.data.id,id);assert.equal(found.data.maxPlayers,2);
  const a=await alice.request(`/live/rooms/${id}/join`,'POST',{name:'Alice'}),b=await bob.request(`/live/rooms/${id}/join`,'POST',{name:'Bob'});assert.equal(a.status,201);assert.equal(b.status,201);assert.equal((await app.client('10.1.1.4').request(`/live/rooms/${id}/join`,'POST',{name:'Charlie'})).status,409);
  const aHeaders={'x-live-token':a.data.token},bHeaders={'x-live-token':b.data.token};
  const lobby=(await alice.request(`/live/rooms/${id}`,'GET',undefined,aHeaders)).data;assert.equal(lobby.status,'lobby');assert.equal(lobby.maxPlayers,2);
  assert.equal((await alice.request(`/live/rooms/${id}`)).status,401);
  assert.equal((await host.request(`/live/rooms/${id}/start`,'POST',{})).status,409);
  assert.equal((await host.request(`/live/rooms/${id}/team`,'POST',{playerId:a.data.playerId,team:'Atlas'})).status,200);
  assert.equal((await host.request(`/live/rooms/${id}/team`,'POST',{playerId:b.data.playerId,team:'Voyagers'})).status,200);
  assert.equal((await alice.request(`/live/rooms/${id}/start`,'POST',{},aHeaders)).status,403);
  assert.equal((await host.request(`/live/rooms/${id}/start`,'POST',{})).status,200);
  const initial=(await host.request(`/live/rooms/${id}`)).data;assert.equal(initial.status,'question');assert.equal(initial.reveal,null);assert.equal(initial.question.answer,undefined);
  const secret=(await app.db.query('SELECT questions FROM live_rooms WHERE id=$1',[id])).rows[0].questions[0].answer;
  assert.equal((await alice.request(`/live/rooms/${id}/answer`,'POST',{selected:secret},aHeaders)).status,200);
  assert.equal((await alice.request(`/live/rooms/${id}/answer`,'POST',{selected:secret},aHeaders)).status,409);
  const wrong=(secret+1)%4;assert.equal((await bob.request(`/live/rooms/${id}/answer`,'POST',{selected:wrong},bHeaders)).status,200);
  const hidden=(await bob.request(`/live/rooms/${id}`,'GET',undefined,bHeaders)).data;assert.equal(hidden.reveal,null);assert.equal(hidden.myAnswer,wrong);assert.equal(hidden.players.find(p=>p.name==='Alice').points,0);assert.equal(hidden.players.find(p=>p.name==='Bob').points,0);
  app.advance(20000);const revealed=(await host.request(`/live/rooms/${id}`)).data;assert.equal(revealed.status,'feedback');assert.equal(revealed.reveal.correctIndex,secret);assert.equal(revealed.players.find(p=>p.name==='Alice').points,1000);
  app.advance(6000);const next=(await host.request(`/live/rooms/${id}`)).data;assert.equal(next.status,'question');assert.equal(next.roundIndex,1);assert.equal(next.reveal,null);
  assert.equal((await host.request(`/live/rooms/${id}/pause`,'POST',{})).status,200);app.advance(40000);assert.equal((await alice.request(`/live/rooms/${id}`,'GET',undefined,aHeaders)).data.status,'paused');
  assert.equal((await host.request(`/live/rooms/${id}/resume`,'POST',{})).status,200);assert.equal((await host.request(`/live/rooms/${id}/end`,'POST',{})).status,200);assert.equal((await host.request(`/live/rooms/${id}`)).data.status,'finished');
 }finally{await app.db.close();}
});
