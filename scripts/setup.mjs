import {randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const template=await readFile('.env.example','utf8');
try{await writeFile('.env',template.replace('FACE_ENCRYPTION_KEY=','FACE_ENCRYPTION_KEY='+randomBytes(32).toString('base64')).replace('CRON_SECRET=','CRON_SECRET='+randomBytes(32).toString('hex')),{flag:'wx',mode:0o600});console.log('Created .env with a unique encryption key. Fill in your PostgreSQL settings before starting.');}catch(e){if(e.code==='EEXIST')console.log('.env already exists; preserved all settings.');else throw e;}
