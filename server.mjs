import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import handler from './api/index.mjs';
import {SECURITY_HEADERS} from './backend/api.mjs';
try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
export function createServer(apiHandler=handler){return http.createServer({maxHeaderSize:16384,requestTimeout:30000,headersTimeout:10000},async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await apiHandler(req,res);
 for(const [name,value]of Object.entries(SECURITY_HEADERS))res.setHeader(name,value);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const pathname=decodeURIComponent(url.pathname);const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!filename.startsWith(root)||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);return res.end('Not found');}
 const body=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':pathname.startsWith('/models/')||pathname.startsWith('/vendor/')?'public, max-age=86400':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
 });}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';const server=createServer();server.listen(port,host,()=>console.log(`GeoVoice ready at http://localhost:${port}`));
 let exiting=false;const shutdown=()=>{if(exiting)return;exiting=true;server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
