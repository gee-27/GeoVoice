let csrf='';
export class ApiError extends Error{constructor(message,status){super(message);this.status=status;}}
export async function api(path,method='GET',body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 let response;try{response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-GeoVoice':'1',...(csrf?{'X-CSRF-Token':csrf}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});}catch{throw new ApiError('Could not reach GeoVoice. Check your connection and try again.',0);}finally{clearTimeout(timer);}
 const data=await response.json().catch(()=>({error:'The server returned an unexpected response.'}));
 if(!response.ok)throw new ApiError(data.error||'Request failed.',response.status);
 if(data.csrf)csrf=data.csrf;
 return data;
}
export const clearSession=()=>{csrf='';};
