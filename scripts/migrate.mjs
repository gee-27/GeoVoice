import {openDatabase,migrate} from '../backend/database.mjs';
try{process.loadEnvFile();}catch(e){if(e.code!=='ENOENT')throw e;}
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL before running migrations.');
const db=openDatabase(process.env.DATABASE_URL);try{await migrate(db);console.log('Database migrations complete.');}finally{await db.close();}
