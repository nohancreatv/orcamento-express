import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider, GithubAuthProvider, OAuthProvider, signInWithPopup, linkWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { encodeWorkspace, decodeWorkspace, nextRevision } from './firebase-workspace.mjs';

const config=window.OE_AUTH_CONFIG;
if(config?.firebase){
  const app=initializeApp(config.firebase),auth=getAuth(app),db=getFirestore(app);
  const providers={google:()=>new GoogleAuthProvider(),microsoft:()=>new OAuthProvider('microsoft.com'),facebook:()=>new FacebookAuthProvider(),github:()=>new GithubAuthProvider()};
  const ids={google:'google.com',microsoft:'microsoft.com',facebook:'facebook.com',github:'github.com'};
  const allowed=(config.providers||[]).filter(p=>p in providers);
  const accepted=u=>!!u&&(u.emailVerified||u.providerData.some(p=>p.providerId!=='password'));
  const user=()=>accepted(auth.currentUser)?{id:auth.currentUser.uid,email:auth.currentUser.email,name:auth.currentUser.displayName}:null;
  const ready=(async()=>{await setPersistence(auth,browserSessionPersistence);await auth.authStateReady();})();
  const failure=(text,status)=>Object.assign(new Error(text),{status});
  function friendly(error){
    if(error.status!==undefined)return error;
    const messages={
      'auth/popup-blocked':'Permita a janela de login no navegador e tente novamente.',
      'auth/popup-closed-by-user':'A janela foi fechada antes de concluir o acesso.',
      'auth/account-exists-with-different-credential':'Entre pela opção que já usa e conecte a nova plataforma em Minha conta.',
      'auth/credential-already-in-use':'Este acesso já pertence a outra conta.',
      'auth/email-already-in-use':'Use Entrar ou recupere sua senha para este e-mail.',
      'auth/invalid-credential':'E-mail ou senha incorretos.',
      'auth/too-many-requests':'Muitas tentativas. Aguarde e tente novamente.',
      'auth/unauthorized-domain':'Este endereço ainda precisa ser autorizado no Firebase.',
      'auth/operation-not-allowed':'Esta opção ainda precisa ser ativada no Firebase.',
      'permission-denied':'A sessão não tem permissão para acessar estes dados. Entre novamente.',
      'resource-exhausted':'A cota gratuita foi atingida. Faça backup e tente mais tarde.',
      'unavailable':'Sem conexão. As alterações ainda não foram salvas; faça backup.'
    };
    return failure(messages[error.code]||'Não foi possível concluir. Confira sua conexão e tente novamente.',error.code==='permission-denied'?403:0);
  }
  const transport=window.OEFirebaseTransport={ready,async request(path,method='GET',data,accountId){
    try{
      await ready;
      if(path==='session')return {user:user(),emailEnabled:config.emailEnabled===true,providers:allowed,identities:auth.currentUser?.providerData.map(p=>Object.keys(ids).find(k=>ids[k]===p.providerId)).filter(Boolean)||[]};
      if(path==='auth/logout'){await signOut(auth);return {};}
      if(path==='auth/register'){
        if(!config.emailEnabled)throw failure('Cadastro por e-mail não ativado.',503);
        if(data.password.length<10)throw failure('Use uma senha com pelo menos 10 caracteres.',422);
        const result=await createUserWithEmailAndPassword(auth,data.email,data.password);
        try{await updateProfile(result.user,{displayName:data.name.slice(0,120)});await sendEmailVerification(result.user);}finally{await signOut(auth);}
        return {message:'Confira seu e-mail para confirmar o cadastro antes de entrar.'};
      }
      if(path==='auth/login'){
        const result=await signInWithEmailAndPassword(auth,data.email,data.password);
        if(!accepted(result.user)){
          try{await sendEmailVerification(result.user);}finally{await signOut(auth);}
          throw failure('Confirme seu e-mail. Enviamos um novo link de confirmação.',403);
        }
        return {};
      }
      if(path==='auth/forgot'){
        try{await sendPasswordResetEmail(auth,data.email);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
        return {message:'Se houver uma conta para este e-mail, você receberá um link de recuperação.'};
      }
      if(path==='auth/resend')return {message:'Use Entrar com seu e-mail e senha. Se faltar confirmar o e-mail, enviaremos um novo link.'};
      const match=path.match(/^auth\/oauth\/(google|microsoft|facebook|github)\/start$/);
      if(match){
        if(!allowed.includes(match[1]))throw failure('Provedor não ativado.',503);
        const provider=providers[match[1]]();
        if(data?.link){if(!user())throw failure('Entre antes de conectar uma plataforma.',401);await linkWithPopup(auth.currentUser,provider);}
        else await signInWithPopup(auth,provider);
        return {completed:true};
      }
      if(path!=='workspace')throw failure('Operação indisponível.',404);
      if(!user())throw failure('Entre novamente para acessar seus orçamentos.',401);
      if(accountId!==auth.currentUser.uid)throw failure('A conta mudou. Faça backup e recarregue a página.',409);
      const ref=doc(db,'workspaces',accountId);
      if(method==='GET'){
        const snap=await getDocFromServer(ref);
        return snap.exists()?{revision:snap.data().revision,workspace:decodeWorkspace(snap.data().payload)}:{revision:0,workspace:null};
      }
      if(method!=='PUT')throw failure('Operação indisponível.',405);
      const payload=encodeWorkspace(data.workspace);
      return await runTransaction(db,async tx=>{
        if(auth.currentUser?.uid!==accountId)throw failure('A conta mudou. Recarregue a página.',409);
        const snap=await tx.get(ref),revision=nextRevision(snap.exists()?snap.data().revision:0,data.revision);
        tx.set(ref,{payload,revision,updatedAt:serverTimestamp()});return {revision};
      });
    }catch(error){throw friendly(error);}
  }};
  ready.then(()=>onAuthStateChanged(auth,()=>{
    if(window.OEAuth){window.OEAuth.user=user();window.dispatchEvent(new CustomEvent('oe-auth',{detail:user()}));}
  })).catch(()=>{});
}
