const $ = id => document.getElementById(id);
const enabled = window.OE_AUTH_CONFIG?.backendEnabled === true;
let csrf = '';
const auth = window.OEAuth = {
  user: null, settings: null, ready: null,
  go(mode='signup') { location.assign('/login.html?mode='+encodeURIComponent(mode)); },
  async signOut() { await request('auth/logout','POST',{}); location.replace('/'); },
  request,
};
async function request(path, method='GET', data, accountId) {
  if(!enabled)throw Object.assign(new Error('O serviço de contas está sendo configurado.'),{status:503});
  const headers={Accept:'application/json'};
  if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=csrf;}
  if(accountId)headers['X-OE-Account']=accountId;
  let response;
  try {response=await fetch('/api/'+path,{method,headers,credentials:'same-origin',cache:'no-store',body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(22000)});}
  catch {throw Object.assign(new Error('Sem conexão com o servidor. Suas alterações ainda não foram salvas online.'),{status:0});}
  let result;try {result=await response.json();} catch {throw Object.assign(new Error('O serviço de contas está temporariamente indisponível.'),{status:503});}
  if(!response.ok)throw Object.assign(new Error(result.message||'Não foi possível concluir.'),{status:response.status,code:result.error});
  if(result.csrf)csrf=result.csrf;
  return result;
}
auth.ready=(async()=>{
  if(!enabled)return null;
  try {const session=await request('session');auth.settings=session;auth.user=session.user;window.dispatchEvent(new CustomEvent('oe-auth',{detail:session.user}));return session.user;}
  catch(error){auth.error=error;return null;}
})();
if($('authForm'))initLogin();
async function initLogin(){
  const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
  const token=fragment.get('reset_token')||fragment.get('verify_token');
  let mode=fragment.has('reset_token')?'recovery':fragment.has('verify_token')?'verify':query.get('mode')==='signup'?'signup':'login';
  if(token)history.replaceState(null,'',location.pathname+location.search);
  let busy=false, available=false;
  const labels={google:'Google',microsoft:'Microsoft',facebook:'Facebook',github:'GitHub'};
  const message=text=>{$('authMessage').textContent=text;};
  function update(){
    const titles={signup:'Seu próximo orçamento começa aqui.',login:'Bom ter você de volta.',reset:'Vamos recuperar seu acesso.',recovery:'Escolha uma nova senha.',verify:'Confirme seu e-mail.',resend:'Receba um novo link.',account:'Seus acessos, no mesmo lugar.'};
    $('authTitle').textContent=titles[mode];
    $('authSubmit').textContent={signup:'Criar minha conta',login:'Entrar',reset:'Enviar link de recuperação',recovery:'Salvar nova senha',verify:'Confirmar meu e-mail',resend:'Reenviar confirmação'}[mode]||'Entrar';
    $('nameLabel').hidden=mode!=='signup';$('authName').required=mode==='signup';
    const emailHidden=['recovery','verify','account'].includes(mode);
    $('emailLabel').hidden=emailHidden;$('authEmail').required=!emailHidden;
    const passwordHidden=['reset','resend','verify','account'].includes(mode);
    $('passwordLabel').hidden=passwordHidden;$('authPassword').required=!passwordHidden;
    $('authPassword').minLength=mode==='login'?1:10;$('authPassword').maxLength=72;
    $('authPassword').autocomplete=mode==='login'?'current-password':'new-password';
    $('providerArea').hidden=!['login','signup','account'].includes(mode);
    $('forgotPassword').hidden=mode!=='login';$('resendConfirmation').hidden=mode!=='login';
    $('switchMode').textContent=mode==='signup'?'Já tenho conta. Entrar':mode==='login'?'Ainda não tenho conta. Criar conta':'Voltar para entrar';
    $('switchMode').hidden=mode==='account';$('authSubmit').hidden=mode==='account';
    $('accountHome').hidden=mode!=='account';
    const emailAllowed=auth.settings?.emailEnabled===true;
    $('authSubmit').disabled=!available||(!emailAllowed&&['signup','reset','resend'].includes(mode));
  }
  async function run(fn){if(busy||!available)return;busy=true;message('Aguarde…');$('authControls').disabled=true;try{await fn();}catch(error){message(error.message);}finally{busy=false;$('authControls').disabled=!available;update();}}
  $('switchMode').onclick=()=>{mode=mode==='login'?'signup':'login';message('');update();};
  $('forgotPassword').onclick=()=>{mode='reset';message('');update();};
  $('resendConfirmation').onclick=()=>{mode='resend';message('');update();};
  $('togglePassword').onclick=()=>{const show=$('authPassword').type==='password';$('authPassword').type=show?'text':'password';$('togglePassword').textContent=show?'Ocultar':'Mostrar';};
  $('authForm').onsubmit=e=>{e.preventDefault();run(async()=>{
    const data={email:$('authEmail').value.trim(),password:$('authPassword').value,name:$('authName').value.trim(),token};
    const route={signup:'register',login:'login',reset:'forgot',resend:'resend',verify:'verify',recovery:'reset'}[mode];
    const result=await request('auth/'+route,'POST',data);$('authPassword').value='';
    if(mode==='login'){location.replace('/');return;}
    message(result.message);if(['verify','recovery'].includes(mode)){mode='login';update();}
  });};
  update();message('Verificando opções de acesso…');
  const current=await auth.ready;available=!!auth.settings;
  if(current&&!['recovery','verify'].includes(mode))mode='account';
  for(const [provider,label] of Object.entries(labels)){
    const linked=auth.settings?.identities?.includes(provider);
    const button=document.createElement('button');button.type='button';button.className='provider-button';
    button.disabled=!available||!auth.settings.providers.includes(provider)||!!linked;
    button.textContent=(mode==='account'?'Conectar ':'Continuar com ')+label+(linked?' · conectado':button.disabled?' · em breve':'');
    button.onclick=()=>run(async()=>{
      const result=await request('auth/oauth/'+provider+'/start','POST',{link:mode==='account'});
      const url=new URL(result.url);if(url.protocol!=='https:')throw new Error('Endereço de acesso inválido.');location.assign(url.href);
    });
    $('providerButtons').append(button);
  }
  $('authControls').disabled=!available;update();
  if(!available)message('O cadastro está sendo preparado. Por enquanto, você pode explorar a planilha pública.');
  else if(query.has('error'))message('O acesso não foi concluído. Tente novamente. Para conectar outra plataforma, entre primeiro na sua conta existente.');
  else if(query.has('linked'))message('Novo acesso conectado à sua conta.');
  else if(mode==='account')message('Conecte outras plataformas aqui para acessar os mesmos orçamentos.');
  else if(!auth.settings.emailEnabled&&mode==='signup')message('O cadastro por e-mail ainda está sendo preparado. Use uma opção de acesso disponível.');
  else message('');
}
