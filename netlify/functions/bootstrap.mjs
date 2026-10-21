import {store,key,hashPass,response} from './_auth.mjs';
import {randomUUID,timingSafeEqual,createHash} from 'node:crypto';
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return response(405,{error:'Método inválido'});
 const code=process.env.AURORA_BOOTSTRAP_CODE;if(!code||code.length<20)return response(503,{error:'Configure AURORA_BOOTSTRAP_CODE longo para criar o administrador.'});
 let body;try{body=JSON.parse(event.body||'{}')}catch{return response(400,{error:'JSON inválido'})}
 const provided=String(body.code||'');const a=createHash('sha256').update(code).digest(),b=createHash('sha256').update(provided).digest();if(!timingSafeEqual(a,b))return response(403,{error:'Código incorreto'});
 const s=store();const existing=await s.get('system/admin-created');if(existing)return response(409,{error:'Administrador já inicializado'});
 const email=String(body.email||'').toLowerCase().trim(),password=String(body.password||''),name=String(body.name||'Administrador').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>128)return response(400,{error:'E-mail válido e senha de no mínimo 12 caracteres.'});
 const user={id:randomUUID(),name,email,hash:hashPass(password),role:'admin',disabled:false,createdAt:new Date().toISOString()};
 try{await s.setJSON(key(email),user,{onlyIfNew:true});await s.set('system/admin-created','true',{onlyIfNew:true})}catch{return response(409,{error:'Administrador já existe ou conflito no cadastro'})}
 return response(201,{ok:true,message:'Administrador criado. Desative AURORA_BOOTSTRAP_CODE após concluir.'});
};
