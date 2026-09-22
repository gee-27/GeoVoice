import pg from 'pg';
import {readFile} from 'node:fs/promises';
export function openDatabase(connectionString){
 const pool=new pg.Pool({connectionString,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true,application_name:'geovoice'});
 pool.on('error',()=>console.error(JSON.stringify({event:'database_connection_error'})));
 return {query:(text,values=[])=>pool.query(text,values),async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},close:()=>pool.end()};
}
export async function migrate(db){const sql=await readFile(new URL('./schema.sql',import.meta.url),'utf8');await db.transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(72480311)');await c.query(sql);});}
