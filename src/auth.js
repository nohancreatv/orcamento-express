import { createClient } from '@supabase/supabase-js';
const config = window.OE_AUTH_CONFIG || {};
const client = config.url && config.key ? createClient(config.url, config.key, {auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}) : null;
const $ = id => document.getElementById(id);
let user = null;
let recovery = new URLSearchParams(location.search).get('mode') === 'recovery';
const auth = window.OEAuth = {user:null, ready:null, go(mode='signup'){location.assign('/login.html?mode='+mode);},async signOut(){if(client){const {error}=await client.auth.signOut();if(error)throw error;}location.replace('/');}};
function publish(next){user=next;auth.user=next;window.dispatchEvent(new CustomEvent('oe-auth',{detail:next}));}
if(client)client.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY')recovery=true;
  if(event==='SIGNED_OUT')publish(null);
  // Never await another Supabase call inside this callback.
  if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(()=>refresh(),0);
});
async function refresh(){if(!client)return null;try{const {data,error}=await client.auth.getUser();publish(error?null:data.user);return auth.user;}catch{publish(null);return null;}}
auth.ready=refresh();
if($('authForm'))initLogin();
async function initLogin(){
  let mode=new URLSearchParams(location.search).get('mode')==='signup'?'signup':'login';
  let busy=false;
  const labels={google:'Google',azure:'Microsoft',facebook:'Facebook',github:'GitHub'};
  function message(text){$('authMessage').textContent=text;}
  function update(){
    $('authTitle').textContent=mode==='signup'?'Seu próximo orçamento começa aqui.':mode==='reset'?'Vamos recuperar seu acesso.':mode==='recovery'?'Escolha uma nova senha.':'Bom ter você de volta.';
    $('authSubmit').textContent=mode==='signup'?'Criar minha conta':mode==='reset'?'Enviar link de recuperação':mode==='recovery'?'Salvar nova senha':'Entrar';
    $('nameLabel').hidden=mode!=='signup';$('authName').required=mode==='signup';
    $('emailLabel').hidden=mode==='recovery';$('authEmail').required=mode!=='recovery';
    $('passwordLabel').hidden=mode==='reset';$('authPassword').required=mode!=='reset';
    $('authPassword').minLength=mode==='login'?1:8;
    $('authPassword').autocomplete=mode==='login'?'current-password':'new-password';
    $('providerArea').hidden=['reset','recovery'].includes(mode);
    $('forgotPassword').hidden=mode!=='login';
    $('switchMode').textContent=mode==='signup'?'Já tenho conta. Entrar':mode==='login'?'Ainda não tenho conta. Criar conta':'Voltar para entrar';
  }
  async function run(fn){if(busy||!client)return;busy=true;message('Aguarde…');$('authControls').disabled=true;try{await fn();}catch(error){message(friendly(error));}finally{busy=false;$('authControls').disabled=!client;}}
  function friendly(error){if(error?.code==='invalid_credentials')return 'E-mail ou senha incorretos.';if(error?.code==='email_not_confirmed')return 'Confirme seu e-mail antes de entrar.';if(error?.status===429)return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';return 'Não foi possível concluir. Confira os dados e sua conexão e tente novamente.';}
  $('switchMode').onclick=()=>{mode=mode==='login'?'signup':'login';message('');update();};
  $('forgotPassword').onclick=()=>{mode='reset';message('');update();};
  $('togglePassword').onclick=()=>{const show=$('authPassword').type==='password';$('authPassword').type=show?'text':'password';$('togglePassword').textContent=show?'Ocultar':'Mostrar';};
  const providers=Array.isArray(config.providers)?config.providers:[];
  Object.entries(labels).forEach(([provider,label])=>{
    const b=document.createElement('button');b.type='button';b.className='provider-button';b.textContent='Continuar com '+label;b.disabled=!client||!providers.includes(provider);
    if(b.disabled){b.textContent+=' · em breve';b.title='Esta opção ainda não foi ativada.';}
    b.onclick=()=>run(async()=>{const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+'/login.html',...(provider==='azure'?{scopes:'email'}:{})}});if(error)throw error;});
    $('providerButtons').append(b);
  });
  $('authForm').onsubmit=e=>{e.preventDefault();run(async()=>{
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    if(mode==='reset'){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/login.html?mode=recovery'});if(error)throw error;message('Se houver uma conta para este e-mail, você receberá um link de recuperação.');return;}
    if(mode==='recovery'){const {error}=await client.auth.updateUser({password});if(error)throw error;location.replace('/');return;}
    const result=mode==='signup'?await client.auth.signUp({email,password,options:{data:{full_name:$('authName').value.trim()},emailRedirectTo:location.origin+'/login.html'}}):await client.auth.signInWithPassword({email,password});
    if(result.error)throw result.error;
    $('authPassword').value='';
    if(result.data.session)location.replace('/');else message('Confira seu e-mail para confirmar o cadastro. Se já tiver conta, use Entrar ou recupere a senha.');
  });};
  update();
  if(!client){$('authControls').disabled=true;message('O cadastro está sendo preparado. Por enquanto, você pode explorar a planilha pública.');return;}
  $('authControls').disabled=true;
  const current=await auth.ready;
  $('authControls').disabled=false;
  if(recovery){mode=current?'recovery':'reset';if(!current)message('Este link expirou ou não pôde ser validado. Solicite um novo link.');update();}
  else if(current)location.replace('/');
  else if(new URLSearchParams(location.search).has('error')||location.hash.includes('error'))message('O acesso não foi concluído. Tente entrar novamente ou solicite um novo link.');
}
