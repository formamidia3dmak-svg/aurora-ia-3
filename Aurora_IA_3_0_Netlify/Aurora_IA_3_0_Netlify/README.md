# Aurora IA 3.0 — Avatar interativo + Netlify

Projeto baseado no Aurora IA 2.0. **Versão de demonstração para implantação e testes**, não auditada para produção pública.

## Recursos implementados
- Avatar robotizado com **efeito tridimensional CSS** (perspectiva, inclinação acompanhando o ponteiro, expressões e movimento da boca durante fala). **Não é modelo 3D rigado/WebGL nem lip-sync por fonemas**.
- Webcam com ativação explícita e análise de uma foto mediante ação do usuário, inclusive comando verbal opcional.
- Reconhecimento de voz do navegador quando suportado e leitura de respostas por sintetizador do navegador.
- Chat usando OpenAI Responses via função Netlify; pesquisa Web opcional; localização após permissão.
- Cadastro, login, sessão assinada com prazo de 12 horas, senha com `scrypt`; contas persistidas em **Netlify Blobs**.
- Painel administrador: listar contas e bloquear/desbloquear usuários comuns.

## Publicação
1. Envie esta pasta para um repositório GitHub.
2. No Netlify, escolha Add new project > Import from Git e selecione o repositório. Build: vazio; publish: `public`; functions: `netlify/functions` (definidos em `netlify.toml`). Netlify instalará `@netlify/blobs` do package.json.
3. Configure em Site configuration > Environment variables: `OPENAI_API_KEY`, `AURORA_SESSION_SECRET` (32 ou mais caracteres aleatórios), `AURORA_BOOTSTRAP_CODE` (20 ou mais caracteres aleatórios), opcional `OPENAI_MODEL`.
4. Faça deploy e aguarde a URL HTTPS.
5. Crie **uma vez** o administrador por POST HTTPS para `https://SEU-SITE.netlify.app/api/bootstrap` com JSON `{"code":"VALOR_DE_AURORA_BOOTSTRAP_CODE","name":"Administrador","email":"voce@exemplo.com","password":"SENHA_FORTE_12+"}`. Use Postman, Insomnia ou curl. Depois **remova a variável AURORA_BOOTSTRAP_CODE e publique novamente**.
6. Acesse o site e faça login como administrador; os demais usuários podem criar contas pela interface.

## Limites e segurança
- Netlify Blobs é armazenamento chave-valor, **não substitui banco transacional**. Para serviço com muitos usuários, migre para Netlify DB/Postgres/Auth gerenciada, imponha limites, prevenção de abuso, política de privacidade e recuperação de senhas.
- O cadastro é público e não possui confirmação de e-mail, CAPTCHA, proteção contra tentativa repetida, recuperação de senha ou MFA. **Não publique abertamente antes dessas proteções** e de revisar a implantação.
- As sessões ficam em `sessionStorage`; ao sair, o token é apagado localmente. Revogação antes do vencimento requer bloqueio de conta.
- API de IA pode gerar custos por uso; implemente cotas e limite de requisições antes de acesso público.
- Webcam não transmite imagens continuamente; captura e envia uma foto **somente com solicitação**. O reconhecimento de voz pode usar serviços do navegador e nem sempre está disponível.
- Não há leitura de pensamentos, reconhecimento de identidades, vigilância autônoma nem autoedição de código sem revisão.
- Testes executados: sintaxe estática de JavaScript, estrutura de arquivos e integridade do ZIP; **nenhuma implantação ou integração em produção foi testada aqui**.

## Desenvolvimento local
`npm install`, `npx netlify dev`; para dados Netlify Blobs pode ser necessário autenticar Netlify CLI e vincular um site. Faça testes de login, admin, câmera, microfone e custos.
