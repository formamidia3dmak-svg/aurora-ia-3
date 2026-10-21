'use strict';
const $ = id => document.getElementById(id);
const messages = $('messages');
let history = [], cameraStream = null, coords = null, recognition = null, busy = false;
let authToken = sessionStorage.getItem('auroraToken') || '';let signedUser=null;
const authHeaders=()=>({'Authorization':'Bearer '+authToken});
function mood(state,message){$('auroraAvatar').dataset.mood=state;$('avatarMood').textContent=message||({idle:'Pronta para ajudar',listening:'Estou ouvindo',thinking:'Pensando na resposta',speaking:'Conversando com você'}[state]||'Pronta');}
function speak(reply){if(!$('read').checked||!('speechSynthesis' in window)){mood('idle');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(reply.slice(0,1800));u.lang='pt-BR';u.rate=.99;u.onstart=()=>mood('speaking','Aurora está falando');u.onend=()=>mood('idle');u.onerror=()=>mood('idle');speechSynthesis.speak(u);}
function captureImage(){if(!cameraStream||!$('video').videoWidth) return null; const c=$('snapshotCanvas'),v=$('video');c.width=Math.min(640,v.videoWidth);c.height=Math.round(c.width*v.videoHeight/v.videoWidth);c.getContext('2d').drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.68);}

const tabs = {assistant:'Assistente Aurora',camera:'Webcam inteligente',location:'Localização autorizada',admin:'Administração'};
document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b===button));
  Object.keys(tabs).forEach(k=>$(k).classList.toggle('visible',k===button.dataset.tab));
  $('heading').textContent = tabs[button.dataset.tab];
}));
function bubble(text,role,sources=[]) {
  const item=document.createElement('article');item.className='bubble '+(role==='user'?'user':'ai');item.textContent=text;messages.append(item);
  if(sources.length){const div=document.createElement('div');div.className='sources';div.textContent='Fontes: '; sources.forEach((s,i)=>{if(i) div.append(' · ');const a=document.createElement('a');a.textContent=s.title||new URL(s.url).hostname;a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';div.append(a)});messages.append(div)}
  messages.scrollTop=messages.scrollHeight;
}
async function sendPrompt(image=null,customPrompt=null){
  if(busy)return;
  const prompt=customPrompt??$('prompt').value.trim();if(!prompt&&!image)return;
  busy=true;mood('thinking');$('send').disabled=true;$('snapshot').disabled=true;
  const context=$('shareLocation').checked&&coords?`\n[Localização fornecida voluntariamente: latitude ${coords.latitude.toFixed(3)}, longitude ${coords.longitude.toFixed(3)}]`:'';
  bubble(prompt || 'Analise esta imagem da webcam', 'user');$('prompt').value='';
  try {
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({prompt:prompt+context,image,search:$('search').checked,history})});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Falha na solicitação');
    bubble(data.reply,'ai',data.sources||[]);
    history.push({role:'user',content:prompt},{role:'assistant',content:data.reply});history=history.slice(-8);
    speak(data.reply)
  } catch(e){bubble('Erro: '+e.message,'ai');mood('idle')}finally{busy=false;$('send').disabled=false;$('snapshot').disabled=!cameraStream}
}
$('send').onclick=()=>sendPrompt();$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter')sendPrompt()});
$('clear').onclick=()=>{history=[];messages.replaceChildren();bubble('Conversa limpa neste navegador.','ai');if('speechSynthesis' in window)speechSynthesis.cancel()};
$('haltVoice').onclick=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();mood('idle')};
$('mic').onclick=()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){bubble('Este navegador não oferece reconhecimento de fala. Teste Chrome ou use o campo de texto.','ai');return}
  if(recognition){recognition.stop();return}
  recognition=new SpeechRecognition();recognition.lang='pt-BR';recognition.interimResults=false;
  recognition.onresult=e=>{const spoken=e.results[0][0].transcript.trim();$('prompt').value=spoken; if($('autoSend').checked){let image=null;const asksToLook=/\b(olhe|veja|observe|enxergue|analise a imagem|o que voc[eê] v[eê])\b/i.test(spoken);if($('autoVision').checked&&asksToLook)image=captureImage();setTimeout(()=>sendPrompt(image,spoken),120);}};
  recognition.onerror=e=>bubble('Microfone: '+e.error+'. Verifique a permissão.','ai');
  recognition.onend=()=>{recognition=null;$('mic').classList.remove('listening');if(!busy)mood('idle')};
  try{recognition.start();mood('listening');$('mic').classList.add('listening')}catch(e){recognition=null;bubble(e.message,'ai')}
};
$('startCam').onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia){$('cameraMsg').textContent='Webcam indisponível neste navegador ou fora de HTTPS.';return}
  try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:540}},audio:false});$('video').srcObject=cameraStream;$('camPlaceholder').hidden=true;$('startCam').disabled=true;$('snapshot').disabled=false;$('describeCam').disabled=false;$('stopCam').disabled=false;$('cameraMsg').textContent='Visualização local ativa. Nada é enviado automaticamente.'}
  catch(e){$('cameraMsg').textContent='Não foi possível acessar a câmera: '+e.message}
};
function stopCam(){cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;$('video').srcObject=null;$('camPlaceholder').hidden=false;$('startCam').disabled=false;$('snapshot').disabled=true;$('describeCam').disabled=true;$('stopCam').disabled=true}
$('stopCam').onclick=stopCam;
$('snapshot').onclick=()=>{const image=captureImage();if(!image)return;document.querySelector('[data-tab="assistant"]').click();sendPrompt(image,'Descreva com clareza o que você consegue observar nesta imagem capturada agora pela webcam.');};
$('describeCam').onclick=()=>{const q=prompt('O que você gostaria de perguntar à Aurora sobre a imagem atual?','O que você consegue ver?');if(!q)return;const image=captureImage();if(!image)return;document.querySelector('[data-tab="assistant"]').click();sendPrompt(image,q);};
$('getLocation').onclick=()=>{
  if(!navigator.geolocation){$('locationResult').textContent='Geolocalização indisponível.';return}
  navigator.geolocation.getCurrentPosition(pos=>{coords={latitude:pos.coords.latitude,longitude:pos.coords.longitude};$('locationResult').textContent=`Localização autorizada. Latitude aproximada: ${coords.latitude.toFixed(3)}; longitude aproximada: ${coords.longitude.toFixed(3)}.`;$('shareLocation').disabled=false},err=>{$('locationResult').textContent='Não foi possível obter localização: '+err.message},{enableHighAccuracy:false,timeout:12000,maximumAge:0})
};
$('forgetLocation').onclick=()=>{coords=null;$('shareLocation').checked=false;$('shareLocation').disabled=true;$('locationResult').textContent='Localização apagada desta sessão.'};
// Registro, login e administração de usuários
async function api(action,data={},method='POST'){const r=await fetch('/api/auth',{method,headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({action,...data})});const result=await r.json();if(!r.ok)throw Error(result.error||'Erro na solicitação');return result}
let signup=false;
$('authSwitch').onclick=()=>{signup=!signup;$('authName').hidden=!signup;$('authName').required=signup;$('authTitle').textContent=signup?'Criar minha conta':'Entrar na Aurora';$('authSubmit').textContent=signup?'Cadastrar':'Entrar';$('authSwitch').textContent=signup?'Já tenho uma conta':'Criar uma conta';$('authError').textContent=''};
$('authForm').onsubmit=async(e)=>{e.preventDefault();$('authError').textContent='';try{const r=await api(signup?'register':'login',{name:$('authName').value,email:$('authEmail').value,password:$('authPassword').value});authToken=r.token;signedUser=r.user;sessionStorage.setItem('auroraToken',authToken);showApp()}catch(error){$('authError').textContent=error.message}};
function showApp(){$('loginGate').hidden=true;$('appRoot').hidden=false;$('signedUser').textContent=signedUser.name+' ('+signedUser.role+')';$('authPassword').value='';const adm=signedUser.role==='admin';document.querySelector('[data-tab="admin"]').hidden=!adm;if(!adm&&$('admin').classList.contains('visible'))document.querySelector('[data-tab="assistant"]').click()}
$('signout').onclick=()=>{sessionStorage.removeItem('auroraToken');authToken='';signedUser=null;stopCam();speechSynthesis?.cancel();$('appRoot').hidden=true;$('loginGate').hidden=false;history=[];};
if(authToken)api('me').then(r=>{signedUser=r.user;showApp()}).catch(()=>{authToken='';sessionStorage.removeItem('auroraToken')});
$('loadUsers').onclick=async()=>{const target=$('usersList');target.textContent='Carregando...';try{const r=await api('users');target.replaceChildren();r.users.forEach(u=>{const item=document.createElement('div');item.className='user-entry';const info=document.createElement('div');const name=document.createElement('b');name.textContent=u.name;const meta=document.createElement('small');meta.textContent=u.email+' • '+u.role+' • '+(u.disabled?'Bloqueado':'Ativo');info.append(name,meta);const btn=document.createElement('button');btn.className='secondary';btn.textContent=u.disabled?'Reativar':'Bloquear';btn.disabled=u.id===signedUser.id;btn.onclick=async()=>{try{await api('toggle',{userId:u.id});$('loadUsers').click()}catch(err){alert(err.message)}};item.append(info,btn);target.append(item)})}catch(e){target.textContent=e.message}};
// Movimento 3D controlado: cabeça acompanha o ponteiro sem gravar movimentos
const stage=document.querySelector('.avatar-stage');stage.addEventListener('pointermove',e=>{const b=stage.getBoundingClientRect();const x=((e.clientX-b.left)/b.width-.5)*24,y=((e.clientY-b.top)/b.height-.5)*-15;$('auroraAvatar').style.setProperty('--lookX',x.toFixed(1)+'deg');$('auroraAvatar').style.setProperty('--lookY',y.toFixed(1)+'deg')});stage.addEventListener('pointerleave',()=>{$('auroraAvatar').style.setProperty('--lookX','0deg');$('auroraAvatar').style.setProperty('--lookY','0deg')});
window.addEventListener('pagehide',stopCam);
