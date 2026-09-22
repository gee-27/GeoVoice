import {randomUUID,createHmac} from 'node:crypto';
import {HttpError,requireThat,token,digest,username,displayName,validatePassword,hashPassword,verifyPassword,validateSamples,encryptFace,decryptFace,recoveryCode,recoveryHash} from './security.mjs';
import {buildQuiz,matchesFace,distance,score} from '../dist/core.js';
import {questions,categories} from './questions.js';
const minute=60000,hour=60*minute;
const publicUser=u=>({id:u.id,username:u.username,name:u.name,created:new Date(Number(u.created)).toISOString()});
const safeQuestion=q=>({id:q.id,category:q.category,prompt:q.prompt,options:q.options});
const result=q=>({id:q.id,category:q.category,date:new Date(Number(q.completed)).toISOString(),duration:Math.round((Number(q.completed)-Number(q.started))/1000),answers:q.answers,...score(q.answers)});
export const SECURITY_HEADERS={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(self), microphone=(self), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
export function createApi({db,config,now=Date.now}){
 const cookieName=config.production?'__Host-geovoice':'geovoice';
 const keyed=value=>createHmac('sha256',config.key).update(value).digest('hex');
 async function one(sql,values=[],client=db){return (await client.query(sql,values)).rows[0];}
 const ready=(async()=>{const version=await one("SELECT value FROM metadata WHERE key='schema_version'");if(version?.value!=='2')throw new Error('Run database migrations before starting.');const fingerprint=digest(config.key);await db.query("INSERT INTO metadata(key,value) VALUES ('key_fingerprint',$1) ON CONFLICT DO NOTHING",[fingerprint]);const stored=await one("SELECT value FROM metadata WHERE key='key_fingerprint'");if(stored.value!==fingerprint)throw new Error('Encryption key does not match this database.');})();
 // Attach a rejection handler immediately; requests still receive the failure through await ready.
 ready.catch(()=>{});
 function setCookie(res,raw,maxAge=43200){res.setHeader('Set-Cookie',`${cookieName}=${raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.production?'; Secure':''}`);}
 function rawCookie(req){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 async function limit(key,max,window){const t=now();const row=await one(`INSERT INTO rate_limits(key,hits,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<=$3 THEN 1 ELSE rate_limits.hits+1 END, reset_at=CASE WHEN rate_limits.reset_at<=$3 THEN $2 ELSE rate_limits.reset_at END RETURNING hits`,[key,t+window,t]);requireThat(row.hits<=max,429,'Too many attempts. Please wait before trying again.');}
 async function session(req){const raw=rawCookie(req);if(!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;const s=await one('SELECT s.*,u.auth_version AS current_version,u.verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE id_hash=$1',[digest(raw)]);if(!s||Number(s.expires)<=now()||Number(s.seen)+30*minute<=now()||s.auth_version!==s.current_version)return null;await db.query('UPDATE sessions SET seen=$1 WHERE id_hash=$2',[now(),s.id_hash]);return s;}
 async function issue(client,res,u,stage){const raw=token(),csrf=token(),t=now();await client.query(`INSERT INTO sessions(id_hash,user_id,csrf,stage,created,seen,expires,auth_version) VALUES($1,$2,$3,$4,$5,$5,$6,$7)`,[digest(raw),u.id,csrf,stage,t,t+(stage==='full'?12*hour:10*minute),u.auth_version]);setCookie(res,raw,stage==='full'?43200:600);return {stage,csrf,user:publicUser(u)};}
 async function credentials(body){const login=username(body.username);const u=await one('SELECT * FROM users WHERE username=$1',[login]);const ok=await verifyPassword(body.password,u?.password_hash);requireThat(ok&&u&&(u.verified||Number(u.created)>now()-24*hour),401,'Username or password is incorrect.');return u;}
 async function getUser(s,client=db,lock=false){const u=await one('SELECT * FROM users WHERE id=$1'+(lock?' FOR UPDATE':''),[s.user_id],client);requireThat(u&&u.auth_version===s.auth_version,401,'Your session has expired. Please sign in again.');return u;}
 async function sensitivePassword(s,password){await limit('password:'+s.user_id,8,15*minute);const u=await getUser(s);requireThat(await verifyPassword(password,u.password_hash),403,'Your current password is incorrect.');return u;}
 async function parseBody(req){requireThat((req.headers['content-type']||'').split(';')[0]==='application/json',415,'Send JSON requests.');if(req.body&&typeof req.body==='object'){requireThat(Buffer.byteLength(JSON.stringify(req.body))<=32768,413,'Request is too large.');return req.body;}let data='',size=0;for await(const chunk of req){size+=chunk.length;requireThat(size<=32768,413,'Request is too large.');data+=chunk;}try{const value=JSON.parse(data||'{}');requireThat(value&&typeof value==='object'&&!Array.isArray(value),400,'Invalid request.');return value;}catch{throw new HttpError(400,'Invalid JSON request.');}}
 async function cleanExpired(){await db.query('DELETE FROM sessions WHERE expires<$1',[now()]);await db.query('DELETE FROM rate_limits WHERE reset_at<$1',[now()]);await db.query('DELETE FROM quizzes WHERE completed IS NULL AND expires<$1',[now()]);await db.query('DELETE FROM users WHERE verified=FALSE AND created<$1',[now()-24*hour]);}
 async function handle(req,res){const requestId=randomUUID();for(const [name,value]of Object.entries(SECURITY_HEADERS))res.setHeader(name,value);if(config.production)res.setHeader('Strict-Transport-Security','max-age=31536000');res.setHeader('X-Request-Id',requestId);
 try{
  await ready;
  const url=new URL(req.url,config.origin),route=url.pathname,method=req.method;
  if(route==='/api/maintenance'&&method==='GET'){requireThat(config.cronSecret&&req.headers.authorization==='Bearer '+config.cronSecret,401,'Unauthorized.');await cleanExpired();return send(res,200,{ok:true});}
  if(route==='/api/health'&&method==='GET'){await db.query('SELECT 1');return send(res,200,{status:'ok'});}
  if(route==='/api/config'&&method==='GET')return send(res,200,{categories,registrationOpen:config.registration,operator:config.operator,privacyContact:config.privacyContact,consentVersion:'2026-09-22',authentication:['password','face']});
  const ip=config.trustProxy?String(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean).at(-1)||req.socket?.remoteAddress:req.socket?.remoteAddress;
  await limit('request:'+keyed(ip||'unknown'),240,minute);
  let body={};
  if(!['GET','HEAD'].includes(method)){requireThat(req.headers.origin===config.origin&&req.headers['x-geovoice']==='1',403,'This request origin is not allowed.');body=await parseBody(req);}
  const s=await session(req);
  const requireSession=(stage='full')=>{requireThat(s&&(stage==='any'||s.stage===stage)&&(stage!=='full'||s.verified),401,'Please complete sign-in to continue.');if(!['GET','HEAD'].includes(method))requireThat(req.headers['x-csrf-token']===s.csrf,403,'Your security token is invalid. Refresh and try again.');};
  if(route==='/api/session'&&method==='GET'){if(!s)return send(res,200,{stage:'anonymous'});const u=await getUser(s);return send(res,200,{stage:s.stage,csrf:s.csrf,user:publicUser(u)});}
  if(route==='/api/auth/register'&&method==='POST'){
   requireThat(config.registration,403,'New registrations are currently closed.');await limit('register:'+keyed(ip||'unknown'),15,hour);await cleanExpired();
   const name=displayName(body.name),login=username(body.username),password=validatePassword(body.password),samples=validateSamples(body.samples,3);
   requireThat(body.consent===true&&body.consentVersion==='2026-09-22',400,'Please agree to the current privacy notice.');requireThat(samples.every(x=>distance(x,samples[0])<.45),400,'Face captures were inconsistent. Try again.');
   const passwordHash=await hashPassword(password),id=randomUUID(),t=now();
   const code=recoveryCode();let response;try{response=await db.transaction(async c=>{const u=await one(`INSERT INTO users(id,username,name,password_hash,face_cipher,created,consent_at,consent_version,verified,recovery_hash) VALUES($1,$2,$3,$4,$5,$6,$6,$7,TRUE,$8) RETURNING *`,[id,login,name,passwordHash,encryptFace(samples,config.key,id),t,body.consentVersion,recoveryHash(code)],c);if(s)await c.query('DELETE FROM sessions WHERE id_hash=$1',[s.id_hash]);return issue(c,res,u,'full');});}catch(e){if(e.code==='23505')throw new HttpError(409,'That username is unavailable. Choose another or sign in.');throw e;}
   return send(res,201,{...response,recoveryCode:code});
  }

  if(route==='/api/auth/login'&&method==='POST'){
   await limit('login-ip:'+keyed(ip||'unknown'),25,15*minute);await limit('login-name:'+keyed(String(body.username).toLowerCase()),15,15*minute);
   const u=await credentials(body);if(s)await db.query('DELETE FROM sessions WHERE id_hash=$1',[s.id_hash]);return send(res,200,await issue(db,res,u,'face'));
  }
  if(route==='/api/auth/recover'&&method==='POST'){
   await limit('recover-ip:'+keyed(ip||'unknown'),10,hour);await limit('recover-name:'+keyed(String(body.username).toLowerCase()),5,hour);
   const login=username(body.username),password=validatePassword(body.newPassword),code=body.recoveryCode;
   requireThat(typeof code==='string'&&code.length<=100,400,'Enter your recovery code.');const u=await one('SELECT * FROM users WHERE username=$1 AND verified=TRUE',[login]);
   requireThat(u&&u.recovery_hash===recoveryHash(code),401,'Account recovery details are incorrect.');const passwordHash=await hashPassword(password),nextCode=recoveryCode();
   const response=await db.transaction(async c=>{const current=await one('SELECT * FROM users WHERE id=$1 FOR UPDATE',[u.id],c);requireThat(current&&current.recovery_hash===recoveryHash(code),401,'This recovery code has already been used.');current.auth_version++;await c.query('UPDATE users SET password_hash=$1,recovery_hash=$2,auth_version=$3 WHERE id=$4',[passwordHash,recoveryHash(nextCode),current.auth_version,current.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[current.id]);return issue(c,res,current,'full');});return send(res,200,{...response,recoveryCode:nextCode});
  }

  if(route==='/api/auth/logout'&&method==='POST'){requireSession('any');await db.query('DELETE FROM sessions WHERE id_hash=$1',[s.id_hash]);setCookie(res,'',0);return send(res,200,{ok:true});}
  if(route==='/api/auth/face'&&method==='POST'){
   requireSession('face');await limit('face:'+s.user_id,10,15*minute);const samples=validateSamples(body.samples,2);const u=await getUser(s);
   requireThat(matchesFace(samples,decryptFace(u.face_cipher,config.key,u.id)),401,'Your face was not recognized. Check your lighting and try again.');
   const response=await db.transaction(async c=>{const current=await getUser(s,c,true);const deleted=await c.query("DELETE FROM sessions WHERE id_hash=$1 AND stage='face' RETURNING id_hash",[s.id_hash]);requireThat(deleted.rows.length,409,'This sign-in step has already been used.');let code=null;if(!current.verified){code=recoveryCode();await c.query('UPDATE users SET verified=TRUE,recovery_hash=$1 WHERE id=$2',[recoveryHash(code),current.id]);}return {...await issue(c,res,current,'full'),recoveryCode:code};});return send(res,200,response);
  }
  requireSession();
  if(route==='/api/account'&&method==='DELETE'){
   const u=await sensitivePassword(s,body.password);await db.transaction(async c=>{await getUser(s,c,true);await c.query('DELETE FROM users WHERE id=$1',[u.id]);});setCookie(res,'',0);return send(res,200,{ok:true});
  }
  if(route==='/api/account/password'&&method==='POST'){
   const u=await sensitivePassword(s,body.currentPassword);const passwordHash=await hashPassword(validatePassword(body.newPassword));const response=await db.transaction(async c=>{await getUser(s,c,true);u.auth_version++;await c.query('UPDATE users SET password_hash=$1,auth_version=$2 WHERE id=$3',[passwordHash,u.auth_version,u.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);return issue(c,res,u,'full');});return send(res,200,response);
  }
  if(route==='/api/account/face'&&method==='POST'){
   const u=await sensitivePassword(s,body.password),samples=validateSamples(body.samples,3);requireThat(body.consent===true,400,'Agree to replace the stored face template.');requireThat(samples.every(x=>distance(x,samples[0])<.45),400,'Face captures were inconsistent.');const response=await db.transaction(async c=>{await getUser(s,c,true);u.auth_version++;await c.query('UPDATE users SET face_cipher=$1,auth_version=$2,consent_at=$3 WHERE id=$4',[encryptFace(samples,config.key,u.id),u.auth_version,now(),u.id]);await c.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);return issue(c,res,u,'full');});return send(res,200,response);
  }
  if(route==='/api/account/recovery-code'&&method==='POST'){
   const u=await sensitivePassword(s,body.password),code=recoveryCode();await db.transaction(async c=>{await getUser(s,c,true);await c.query('UPDATE users SET recovery_hash=$1 WHERE id=$2',[recoveryHash(code),u.id]);await c.query("DELETE FROM sessions WHERE user_id=$1 AND stage<>'full'",[u.id]);});return send(res,200,{recoveryCode:code});
  }
  if(route==='/api/account/export'&&method==='GET'){const u=await getUser(s),rows=(await db.query('SELECT * FROM quizzes WHERE user_id=$1 AND completed IS NOT NULL ORDER BY completed DESC',[u.id])).rows;return send(res,200,{profile:publicUser(u),history:rows.map(result)});}
  if(route==='/api/history'&&method==='GET'){const page=Number(url.searchParams.get('page')||0);requireThat(Number.isInteger(page)&&page>=0&&page<10000,400,'Invalid page.');const rows=(await db.query('SELECT * FROM quizzes WHERE user_id=$1 AND completed IS NOT NULL ORDER BY completed DESC LIMIT 21 OFFSET $2',[s.user_id,page*20])).rows;const stats=await one(`SELECT COUNT(*)::int AS quizzes,COALESCE(SUM(jsonb_array_length(answers)),0)::int AS total,COALESCE(SUM((SELECT COUNT(*) FROM jsonb_array_elements(answers) a WHERE (a->>'selected')::int=(a->'question'->>'answer')::int)),0)::int AS correct FROM quizzes WHERE user_id=$1 AND completed IS NOT NULL`,[s.user_id]);return send(res,200,{attempts:rows.slice(0,20).map(result),hasMore:rows.length>20,stats});}
  if(route==='/api/quizzes'&&method==='POST'){
   await limit('quiz-start:'+s.user_id,30,hour);requireThat(['All',...categories].includes(body.category)&&[5,10].includes(body.count),400,'Choose a valid topic and 5 or 10 questions.');const bank=buildQuiz(questions,body.category,body.count),id=randomUUID(),t=now();await db.transaction(async c=>{await c.query('DELETE FROM quizzes WHERE user_id=$1 AND completed IS NULL',[s.user_id]);await c.query('INSERT INTO quizzes(id,user_id,category,questions,started,expires) VALUES($1,$2,$3,$4,$5,$6)',[id,s.user_id,body.category,JSON.stringify(bank),t,t+2*hour]);});return send(res,201,{id,category:body.category,total:bank.length,index:0,correct:0,question:safeQuestion(bank[0])});
  }
  const match=route.match(/^\/api\/quizzes\/([a-f0-9-]{36})(\/answer)?$/);
  if(match){const id=match[1];
   if(method==='GET'&&!match[2]){const q=await one('SELECT * FROM quizzes WHERE id=$1 AND user_id=$2',[id,s.user_id]);requireThat(q,404,'Quiz not found.');if(q.completed)return send(res,200,{result:result(q)});requireThat(Number(q.expires)>now(),410,'This quiz has expired. Start another quiz.');return send(res,200,{id:q.id,category:q.category,total:q.questions.length,index:q.answers.length,correct:score(q.answers).correct,question:safeQuestion(q.questions[q.answers.length])});}
   if(method==='POST'&&match[2]){requireThat(Number.isInteger(body.index)&&Number.isInteger(body.selected)&&body.selected>=0&&body.selected<=3,400,'Choose a valid answer.');const output=await db.transaction(async c=>{const q=await one('SELECT * FROM quizzes WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,s.user_id],c);requireThat(q,404,'Quiz not found.');requireThat(Number(q.expires)>now()||q.completed,410,'This quiz has expired.');let answer;
     if(body.index<q.answers.length){answer=q.answers[body.index];requireThat(answer&&answer.selected===body.selected,409,'This question already has a different answer.');}
     else{requireThat(!q.completed&&body.index===q.answers.length,409,'That question is not awaiting an answer.');answer={selected:body.selected,question:q.questions[body.index]};q.answers.push(answer);q.completed=q.answers.length===q.questions.length?now():null;await c.query('UPDATE quizzes SET answers=$1,completed=$2 WHERE id=$3',[JSON.stringify(q.answers),q.completed,q.id]);}
     return {answer,correct:score(q.answers).correct,next:q.completed?null:{id:q.id,category:q.category,total:q.questions.length,index:q.answers.length,correct:score(q.answers).correct,question:safeQuestion(q.questions[q.answers.length])},result:q.completed?result(q):null};});return send(res,200,output);}
  }
  throw new HttpError(404,'Not found.');
 }catch(error){const status=error instanceof HttpError?error.status:500;if(status===429)res.setHeader('Retry-After','60');if(status>=500)console.error(JSON.stringify({event:'request_failed',requestId,status}));if(!res.headersSent){res.removeHeader('Set-Cookie');send(res,status,{error:status===500?'The service is temporarily unavailable. Please try again.':error.message,requestId});}else res.end();}
 }
 return {handle,ready,cleanExpired};
}
