import { getStore } from '@netlify/blobs';
import {createHmac,timingSafeEqual,scryptSync,randomBytes,randomUUID} from 'node:crypto';
export const store=()=>getStore('aurora-accounts');
export const norm=(email)=>String(email||'').trim().toLowerCase();
export const key=(email)=>'account/'+Buffer.from(norm(email)).toString('base64url');
export const hashPass=(password,salt=randomBytes(16).toString('hex'))=>salt+':'+scryptSync(password,salt,64).toString('hex');
export function checkPass(input,stored){try{const [salt,hex]=stored.split(':');const a=scryptSync(input,salt,64),b=Buffer.from(hex,'hex');return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}}
const secret=()=>process.env.AURORA_SESSION_SECRET;
export function sign(user){if(!secret()||secret().length<32)throw Error('Defina AURORA_SESSION_SECRET com pelo menos 32 caracteres');const body=Buffer.from(JSON.stringify({id:user.id,email:user.email,role:user.role,exp:Date.now()+12*3600*1000})).toString('base64url');return body+'.'+createHmac('sha256',secret()).update(body).digest('base64url')}
export async function requireUser(event){try{const token=String(event.headers.authorization||'').replace(/^Bearer /i,'');const [body,sig]=token.split('.');if(!body||!sig||!secret())return null;const expected=createHmac('sha256',secret()).update(body).digest();const got=Buffer.from(sig,'base64url');if(got.length!==expected.length||!timingSafeEqual(got,expected))return null;const payload=JSON.parse(Buffer.from(body,'base64url').toString());if(payload.exp<Date.now())return null;const user=await store().get(key(payload.email),{type:'json',consistency:'strong'});if(!user||user.disabled||user.id!==payload.id)return null;return {id:user.id,name:user.name,email:user.email,role:user.role}}catch{return null}}
export const response=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(data)});
