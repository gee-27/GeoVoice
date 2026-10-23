import {application} from '../backend/bootstrap.mjs';
try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
const app=application();try{await app.ready;await app.cleanExpired();console.log('Expired sessions, pending registrations and unfinished quizzes removed.');}finally{await app.db.close();}
