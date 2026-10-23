import {application} from '../backend/bootstrap.mjs';
import {SECURITY_HEADERS} from '../backend/api.mjs';
export default async function handler(req,res){
 try{const url=new URL(req.url,'https://geovoice.invalid');const route=url.searchParams.get('__route')??req.query?.__route??null;if(typeof route==='string'){url.searchParams.delete('__route');req.url='/api/'+route+(url.search?'?'+url.searchParams.toString():'');}return await application().handle(req,res);}
 catch{for(const [key,value] of Object.entries(SECURITY_HEADERS))res.setHeader(key,value);res.setHeader('Cache-Control','no-store');res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'GeoVoice is not available yet. Please try again later.'}));console.error(JSON.stringify({event:'configuration_unavailable'}));}
}
