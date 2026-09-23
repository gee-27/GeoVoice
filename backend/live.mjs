import {randomInt,randomUUID} from 'node:crypto';
import QRCode from 'qrcode';
import {HttpError,requireThat,token,digest} from './security.mjs';
import {buildQuiz} from '../dist/core.js';
import {questions,categories} from './questions.js';

const minute=60000;
const publicQuestion=q=>({id:q.id,category:q.category,prompt:q.prompt,options:q.options,difficulty:q.difficulty});
const roomPath=/^\/api\/live\/rooms\/([a-f0-9-]{36})(?:\/(start|pause|resume|end|answer|team))?$/;

export function createLiveApi({db,config,now,one,send,limit,requireSession,session,ip,keyed}){
 async function lockedRoom(client,id){const room=await one('SELECT * FROM live_rooms WHERE id=$1 FOR UPDATE',[id],client);requireThat(room,404,'Live room not found.');requireThat(Number(room.expires)>now(),410,'This live room has expired.');return room;}
 async function advance(client,room){let changed=false;for(let i=0;i<room.questions.length*2+2&&['question','feedback'].includes(room.status)&&Number(room.deadline)<=now();i++){
   if(room.status==='question'){await client.query('UPDATE live_players SET points=points+(SELECT COALESCE(SUM(points),0) FROM live_answers WHERE live_answers.player_id=live_players.id AND live_answers.room_id=$1 AND live_answers.round_index=$2) WHERE room_id=$1',[room.id,room.round_index]);room.status='feedback';room.deadline=Number(room.deadline)+6000;}
   else if(room.round_index+1>=room.questions.length){room.status='finished';room.deadline=null;}
   else{room.status='question';room.round_index++;room.deadline=Number(room.deadline)+room.question_ms;}
   changed=true;
  }
  if(changed)await client.query('UPDATE live_rooms SET status=$1,round_index=$2,deadline=$3 WHERE id=$4',[room.status,room.round_index,room.deadline,room.id]);
 }
 function auth(req,room){const host=session?.stage==='full'&&session.verified&&session.user_id===room.host_id;
  const bearer=String(req.headers['x-live-token']||'');return {host,bearer};}
 async function participant(client,room,bearer){if(!/^[A-Za-z0-9_-]{43}$/.test(bearer))return null;return one('SELECT * FROM live_players WHERE room_id=$1 AND token_hash=$2',[room.id,digest(bearer)],client);}
 async function snapshot(client,room,player,host){const players=(await client.query('SELECT id,name,team,points FROM live_players WHERE room_id=$1 ORDER BY points DESC,joined ASC',[room.id])).rows;
  const answers=(await client.query('SELECT player_id,selected,points FROM live_answers WHERE room_id=$1 AND round_index=$2',[room.id,room.round_index])).rows;
  const q=room.questions[room.round_index];const reveal=['feedback','finished'].includes(room.status);
  const teams=room.team_mode?['Atlas','Voyagers'].map(name=>({name,points:players.filter(p=>p.team===name).reduce((n,p)=>n+p.points,0)})).sort((a,b)=>b.points-a.points):[];
  const joinUrl=`${config.origin}/live.html?pin=${room.pin}`;
  return {id:room.id,pin:room.pin,category:room.category,teamMode:room.team_mode,maxPlayers:room.max_players,status:room.status,roundIndex:room.round_index,total:room.questions.length,questionMs:room.question_ms,deadline:room.deadline,serverNow:now(),question:q?publicQuestion(q):null,reveal:reveal&&q?{correctIndex:q.answer,explanation:q.explanation}:null,players,teams,answeredCount:answers.length,myAnswer:player?answers.find(a=>a.player_id===player.id)?.selected??null:null,playerId:player?.id||null,isHost:host,joinUrl,qr:host&&room.status==='lobby'?await QRCode.toDataURL(joinUrl,{margin:1,width:240,errorCorrectionLevel:'M'}):null};
 }
 return async function handle(req,res,route,method,body){
  if(route==='/api/live/rooms'&&method==='POST'){
   requireSession();await limit('live-create:'+session.user_id,12,minute);
   requireThat(['All',...categories].includes(body.category)&&[5,10].includes(body.count)&&[20,30,45].includes(body.seconds)&&typeof body.teamMode==='boolean'&&Number.isInteger(body.maxPlayers)&&body.maxPlayers>=1&&body.maxPlayers<=30,400,'Choose a valid live game setup and a player limit from 1 to 30.');
   const bank=buildQuiz(questions,body.category,body.count),id=randomUUID(),t=now();let room;
   for(let attempt=0;attempt<8;attempt++)try{const pin=String(randomInt(100000,1000000));room=await one('INSERT INTO live_rooms(id,pin,host_id,category,questions,team_mode,question_ms,max_players,created,expires) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[id,pin,session.user_id,body.category,JSON.stringify(bank),body.teamMode,body.seconds*1000,body.maxPlayers,t,t+3*60*minute]);break;}catch(e){if(e.code!=='23505')throw e;}
   requireThat(room,503,'Could not create a room. Try again.');const joinUrl=`${config.origin}/live.html?pin=${room.pin}`;const qr=await QRCode.toDataURL(joinUrl,{margin:1,width:240,errorCorrectionLevel:'M'});return send(res,201,{id,pin:room.pin,joinUrl,qr});
  }
  const pinMatch=route.match(/^\/api\/live\/pin\/(\d{6})$/);
  if(pinMatch&&method==='GET'){await limit('live-pin:'+keyed(ip||'unknown'),80,minute);const room=await one('SELECT id,pin,category,team_mode,max_players,status,expires FROM live_rooms WHERE pin=$1',[pinMatch[1]]);requireThat(room&&Number(room.expires)>now()&&room.status==='lobby',404,'No open lobby has that PIN.');return send(res,200,{id:room.id,pin:room.pin,category:room.category,teamMode:room.team_mode,maxPlayers:room.max_players});}
  const joinMatch=route.match(/^\/api\/live\/rooms\/([a-f0-9-]{36})\/join$/);
  if(joinMatch&&method==='POST'){await limit('live-join:'+keyed(ip||'unknown'),30,minute);requireThat(typeof body.name==='string'&&/^[\p{L}\p{N}][\p{L}\p{N} ._'-]{1,23}$/u.test(body.name.trim()),400,'Use a nickname of 2–24 letters or numbers.');const name=body.name.trim();const raw=token();let player;
   try{player=await db.transaction(async c=>{const room=await lockedRoom(c,joinMatch[1]);requireThat(room.status==='lobby',409,'This game has already started.');const count=await one('SELECT COUNT(*)::int AS count FROM live_players WHERE room_id=$1',[room.id],c);requireThat(count.count<room.max_players,409,'This lobby is full.');return one('INSERT INTO live_players(id,room_id,token_hash,name,joined,seen) VALUES($1,$2,$3,$4,$5,$5) RETURNING id',[randomUUID(),room.id,digest(raw),name,now()],c);});}catch(e){if(e.code==='23505')throw new HttpError(409,'That nickname is already in this lobby.');throw e;}return send(res,201,{token:raw,playerId:player.id});
  }
  const match=route.match(roomPath);if(!match)return false;const [,id,action]=match;
  if(method==='GET'&&!action){const state=await db.transaction(async c=>{const room=await lockedRoom(c,id);const {host,bearer}=auth(req,room),player=await participant(c,room,bearer);requireThat(host||player,401,'Join this live room to continue.');await advance(c,room);if(player)await c.query('UPDATE live_players SET seen=$1 WHERE id=$2',[now(),player.id]);return snapshot(c,room,player,host);});return send(res,200,state);}
  if(method!=='POST'||!action)return false;
  const response=await db.transaction(async c=>{const room=await lockedRoom(c,id);await advance(c,room);const {host,bearer}=auth(req,room),player=await participant(c,room,bearer);
   if(action==='answer'){requireThat(player,401,'Join this room before answering.');requireThat(room.status==='question'&&Number(room.deadline)>now(),409,'This question is closed.');requireThat(Number.isInteger(body.selected)&&body.selected>=0&&body.selected<4,400,'Choose an answer.');const q=room.questions[room.round_index],correct=body.selected===q.answer,points=correct?600+Math.floor(400*Math.max(0,Number(room.deadline)-now())/room.question_ms):0;
    const inserted=await c.query('INSERT INTO live_answers(room_id,player_id,round_index,selected,correct,points,answered) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING selected',[room.id,player.id,room.round_index,body.selected,correct,points,now()]);requireThat(inserted.rows.length,409,'You already answered this question.');return {accepted:true,selected:body.selected};}
   requireThat(host,403,'Only the host can control this game.');requireSession();
   if(action==='team'){requireThat(room.status==='lobby'&&room.team_mode,409,'Teams can only be assigned in a team lobby.');requireThat(['Atlas','Voyagers'].includes(body.team),400,'Choose a valid team.');const updated=await c.query('UPDATE live_players SET team=$1 WHERE id=$2 AND room_id=$3 RETURNING id',[body.team,body.playerId,room.id]);requireThat(updated.rows.length,404,'Player not found.');return {ok:true};}
   if(action==='start'){requireThat(room.status==='lobby',409,'This game has already started.');const players=(await c.query('SELECT team FROM live_players WHERE room_id=$1',[room.id])).rows;requireThat(players.length>0,409,'Wait for at least one player.');requireThat(!room.team_mode||players.every(p=>p.team),409,'Assign every player to a team first.');await c.query("UPDATE live_rooms SET status='question',round_index=0,deadline=$1 WHERE id=$2",[now()+room.question_ms,room.id]);return {ok:true};}
   if(action==='pause'){requireThat(['question','feedback'].includes(room.status),409,'This game cannot be paused now.');await c.query("UPDATE live_rooms SET status='paused',paused_stage=$1,pause_remaining=$2,deadline=NULL WHERE id=$3",[room.status,Math.max(0,Number(room.deadline)-now()),room.id]);return {ok:true};}
   if(action==='resume'){requireThat(room.status==='paused',409,'This game is not paused.');await c.query('UPDATE live_rooms SET status=$1,deadline=$2,paused_stage=NULL,pause_remaining=NULL WHERE id=$3',[room.paused_stage,now()+Number(room.pause_remaining),room.id]);return {ok:true};}
   if(action==='end'){requireThat(room.status!=='finished',409,'Game already ended.');await c.query("UPDATE live_rooms SET status='finished',deadline=NULL WHERE id=$1",[room.id]);return {ok:true};}
  });return send(res,200,response);
 };
}
