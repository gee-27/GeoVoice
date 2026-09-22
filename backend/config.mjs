import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function loadConfig(env=process.env){
 const production=env.NODE_ENV==='production'||Boolean(env.VERCEL);
 const port=Number(env.PORT||4173);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be a valid port.');
 const origin=env.APP_ORIGIN||`http://localhost:${port}`;const url=new URL(origin);
 if(url.origin!==origin||!['http:','https:'].includes(url.protocol))throw new Error('APP_ORIGIN must be an origin without a trailing slash or path.');
 if(production&&url.protocol!=='https:')throw new Error('Production requires an HTTPS APP_ORIGIN.');
 const keyText=env.FACE_ENCRYPTION_KEY;
 if(!keyText||!/^[A-Za-z0-9+/]{43}=$/.test(keyText)||Buffer.from(keyText,'base64').length!==32)throw new Error('FACE_ENCRYPTION_KEY must be a 32-byte base64 key. Run npm run setup for local configuration.');
 if(!env.DATABASE_URL)throw new Error('Set DATABASE_URL to a PostgreSQL connection string.');
 if(production&&(!env.PRIVACY_CONTACT||!env.OPERATOR_NAME))throw new Error('Set OPERATOR_NAME and PRIVACY_CONTACT before public launch.');
 if(env.PRIVACY_CONTACT&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PRIVACY_CONTACT))throw new Error('PRIVACY_CONTACT must be an email address.');
 return {production,port,origin,key:Buffer.from(keyText,'base64'),databaseUrl:env.DATABASE_URL,host:env.HOST||'127.0.0.1',operator:env.OPERATOR_NAME||'GeoVoice',privacyContact:env.PRIVACY_CONTACT||null,trustProxy:env.TRUST_PROXY==='1'||Boolean(env.VERCEL),registration:env.REGISTRATION_OPEN!=='0',staticRoot:path.join(root,'dist'),cronSecret:env.CRON_SECRET||null};
}
