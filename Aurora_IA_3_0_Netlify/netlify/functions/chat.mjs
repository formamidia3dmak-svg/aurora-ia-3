const json = (statusCode, data) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) });
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido.' });
  if ((event.body || '').length > 2_800_000) return json(413, {error:'Solicitação grande demais.'});
  const { requireUser } = await import('./_auth.mjs');
  const user=await requireUser(event);
  if(!user)return json(401,{error:'Faça login para utilizar a Aurora.'});
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(503, { error: 'Configure OPENAI_API_KEY no painel do Netlify.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido.' }); }
  const prompt = String(body.prompt || '').trim().slice(0, 5000);
  const history = Array.isArray(body.history) ? body.history.slice(-8).map(m => ({role: m.role === 'assistant' ? 'assistant':'user', content: String(m.content || '').slice(0,1200)})) : [];
  const image = body.image;
  const validImage = typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length < 2_000_000;
  if (!prompt && !validImage) return json(400, {error:'Envie texto ou uma imagem da câmera.'});
  if (image && !validImage) return json(400, {error:'Imagem inválida ou grande demais.'});
  const input = [...history.map(m => ({role:m.role,content:[{type:'input_text',text:m.content}]})), {role:'user',content:[{type:'input_text',text:prompt || 'Descreva o que está nesta imagem.'}, ...(validImage ? [{type:'input_image',image_url:image,detail:'low'}] : [])]}];
  const includeSearch = Boolean(body.search);
  try {
    const payload = { model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', instructions: 'Você é Aurora IA, assistente em português do Brasil. Seja prestativa, clara e rigorosa quanto à privacidade. Ao analisar câmera, relate apenas o que a imagem atual mostra. Não afirme observar vídeo em tempo real. Não alegue reconhecer pessoas ou identidade. Ao pesquisar, indique fontes e não invente links. Não alegue executar ações que não executou.', input, max_output_tokens: 850, ...(includeSearch ? {tools:[{type:'web_search_preview'}]} : {})};
    const response = await fetch('https://api.openai.com/v1/responses', {method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(27000)});
    const data = await response.json();
    if (!response.ok) return json(502, {error: `Serviço de IA: ${data.error?.message || 'erro inesperado'}`});
    const text = (data.output || []).flatMap(o => (o.content || []).filter(c => c.type === 'output_text').map(c=>c.text)).join('\n') || data.output_text || 'Não consegui elaborar uma resposta.';
    const sources = [];
    for (const o of (data.output || [])) for (const c of (o.content || [])) for (const a of (c.annotations || [])) if (a.type === 'url_citation' && /^https?:\/\//.test(a.url || '')) sources.push({title:String(a.title||'Fonte').slice(0,150),url:a.url});
    return json(200, {reply:text,sources:[...new Map(sources.map(s=>[s.url,s])).values()].slice(0,8)});
  } catch(e) { return json(504,{error: e.name === 'TimeoutError' ? 'A IA demorou a responder. Tente novamente.' : 'Falha na conexão com a IA.'}); }
};
