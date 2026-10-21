import {store,norm,key,hashPass,checkPass,sign,requireUser,response} from './_auth.mjs';
import {randomUUID} from 'node:crypto';
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return response(405,{error:'Método não permitido'});
 if((event.body||'').length>12000)return response(413,{error:'Solicitação excessiva'});
 if(!process.env.AURORA_SESSION_SECRET||process.env.AURORA_SESSION_SECRET.length<32)return response(503,{error:'Configure AURORA_SESSION_SECRET no Netlify (32+ caracteres).'});
 let body={};try{body=JSON.parse(event.body||'{}')}catch{return response(400,{error:'JSON inválido'})}
 const action=body.action;const users=store();
 try{
 if(action==='register'){
   const email=norm(body.email),name=String(body.name||'').trim().slice(0,80),pass=String(body.password||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||pass.length<10||pass.length>128)return response(400,{error:'Informe nome, e-mail válido e senha com 10 a 128 caracteres.'});
   const user={id:randomUUID(),name,email,hash:hashPass(pass),role:'user',disabled:false,createdAt:new Date().toISOString()};
   try{await users.setJSON(key(email),user,{onlyIfNew:true})}catch{return response(409,{error:'E-mail já cadastrado.'})}
   return response(201,{token:sign(user),user:{id:user.id,name,email,role:user.role}})
 }
 if(action==='login'){
   const email=norm(body.email),pass=String(body.password||'');const user=await users.get(key(email),{type:'json',consistency:'strong'});
   if(!user||!checkPass(pass,user.hash)||user.disabled)return response(401,{error:'Credenciais inválidas ou conta bloqueada.'});
   return response(200,{token:sign(user),user:{id:user.id,name:user.name,email,role:user.role}})
 }
 const current=await requireUser(event);if(!current)return response(401,{error:'Sessão inválida. Faça login novamente.'});
 if(action==='me')return response(200,{user:current});
 if(current.role!=='admin')return response(403,{error:'Acesso exclusivo do administrador.'});
 if(action==='users'){
  const list=await users.list({prefix:'account/'});const found=await Promise.all(list.blobs.slice(0,500).map(b=>users.get(b.key,{type:'json'})));
  return response(200,{users:found.filter(Boolean).map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,disabled:u.disabled,createdAt:u.createdAt}))});
 }
 if(action==='toggle'){
  const list=await users.list({prefix:'account/'});let found=null;for(const b of list.blobs){const u=await users.get(b.key,{type:'json',consistency:'strong'});if(u?.id===body.userId){found={u,k:b.key};break}}
  if(!found)return response(404,{error:'Usuário não encontrado'});
  if(found.u.id===current.id||found.u.role==='admin')return response(403,{error:'Não é possível bloquear administradores.'});
  found.u.disabled=!found.u.disabled;await users.setJSON(found.k,found.u);return response(200,{ok:true});
 }
 return response(400,{error:'Ação inválida'})
 }catch(e){return response(500,{error:'Falha ao acessar armazenamento de usuários. Confira as configurações do Netlify Blobs.'})}
};
