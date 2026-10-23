import {loadConfig} from './config.mjs';
import {openDatabase} from './database.mjs';
import {createApi} from './api.mjs';
let instance;
export function application(){if(!instance){const config=loadConfig();const db=openDatabase(config.databaseUrl);const api=createApi({db,config});instance={...api,config,db};}return instance;}
