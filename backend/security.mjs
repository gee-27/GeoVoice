import {randomBytes,createHash,createCipheriv,createDecipheriv,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const params={N:131072,r:8,p:1,maxmem:160*1024*1024};
let activeHashes=0;
export const token=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function requireThat(value,status,message){if(!value)throw new HttpError(status,message);}
export function validatePassword(value){requireThat(typeof value==='string'&&value.length>=15&&value.length<=128,400,'Use a password between 15 and 128 characters.');return value;}
export function username(value){requireThat(typeof value==='string'&&/^[a-zA-Z0-9_]{3,32}$/.test(value),400,'Use 3–32 letters, numbers, or underscores for your username.');return value.toLowerCase();}
export function displayName(value){requireThat(typeof value==='string'&&value.trim().length>=1&&value.trim().length<=60,400,'Enter a name between 1 and 60 characters.');return value.trim();}
async function derive(password,salt){requireThat(activeHashes<2,503,'Sign-in is busy. Please try again shortly.');activeHashes++;try{return await scrypt(password,salt,64,params);}finally{activeHashes--;}}
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${(await derive(password,salt)).toString('hex')}`;}
const dummySalt='4387445187b1268f486c6f4072ab285f';
export async function verifyPassword(password,stored){if(typeof password!=='string'||password.length>128)return false;const parts=(stored||'').split('$');const salt=parts[1]||dummySalt;const actual=await derive(password,salt);const expected=parts[2]?Buffer.from(parts[2],'hex'):Buffer.alloc(64);return expected.length===actual.length&&timingSafeEqual(actual,expected)&&parts[0]==='scrypt';}
export function validateSamples(samples,count){requireThat(Array.isArray(samples)&&samples.length===count&&samples.every(s=>Array.isArray(s)&&s.length===128&&s.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=2)),400,'Invalid face capture. Please capture your face again.');return samples;}
export function encryptFace(samples,key,userId){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(userId));const data=Buffer.concat([cipher.update(JSON.stringify(samples),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join('.');}
export function decryptFace(value,key,userId){const [iv,tag,data]=value.split('.').map(s=>Buffer.from(s,'base64'));const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(userId));decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));}
export function recoveryCode(){return randomBytes(24).toString('hex').match(/.{1,8}/g).join('-');}
export const recoveryHash=code=>digest(String(code).replace(/[-\s]/g,'').toLowerCase());
