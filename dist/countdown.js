export function startCountdown({duration=5000,tick,done,now=()=>performance.now(),schedule=fn=>setInterval(fn,50),cancel=clearInterval}){
 const started=now();let stopped=false,id;const update=()=>{if(stopped)return;const remaining=Math.max(0,duration-(now()-started));tick(Math.ceil(remaining/1000),remaining/duration);if(remaining===0){stopped=true;cancel(id);done();}};
 id=schedule(update);update();return ()=>{if(!stopped){stopped=true;cancel(id);}};
}
