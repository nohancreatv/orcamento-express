const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const requests=[];
 const dom=new JSDOM(fs.readFileSync('dist/login.html','utf8'),{url:'https://example.com/login.html?mode=signup',runScripts:'outside-only'}),w=dom.window;
 w.OE_AUTH_CONFIG={backendEnabled:true};w.AbortSignal=global.AbortSignal;
 w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>url==='/api/session'?{user:null,csrf:'test-csrf',providers:['google'],identities:[],emailEnabled:true}:{message:'Confira seu e-mail'}};};
 w.eval(fs.readFileSync('dist/auth.js','utf8'));await tick();
 assert.equal(w.document.getElementById('authControls').disabled,false);
 const buttons=w.document.querySelectorAll('.provider-button');assert.equal(buttons[0].disabled,false);assert.equal(buttons[1].disabled,true);
 w.document.getElementById('authName').value='A person';w.document.getElementById('authEmail').value='one@example.test';w.document.getElementById('authPassword').value='Long-password-2026';
 w.document.getElementById('authForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(requests[1].url,'/api/auth/register');assert.equal(requests[1].options.headers['X-CSRF-Token'],'test-csrf');assert.equal(requests[1].options.credentials,'same-origin');
 assert.equal(w.document.getElementById('authPassword').value,'');assert.equal(w.localStorage.length,0,'no browser password/token storage');
 dom.window.close();console.log('Login UI: backend settings, configured providers, CSRF and registration request passed.');
})();
