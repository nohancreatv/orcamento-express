const fs=require('node:fs');
const esbuild=require('esbuild');
const origin=(process.env.API_ORIGIN||'').replace(/\/$/,'');
if(origin){const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('API_ORIGIN must be the HTTPS origin of the PHP host, without credentials or path.');}
const firebaseMode=process.env.AUTH_MODE==='firebase';
let config={backendEnabled:!!origin||process.env.API_LOCAL==='true'};
if(firebaseMode){
  const firebase=JSON.parse(process.env.FIREBASE_WEB_CONFIG||'{}');
  const keys=['apiKey','authDomain','projectId','appId'];
  if(keys.some(key=>typeof firebase[key]!=='string'||!firebase[key]))throw new Error('FIREBASE_WEB_CONFIG requires apiKey, authDomain, projectId and appId.');
  if(Object.keys(firebase).some(key=>!['apiKey','authDomain','projectId','appId','messagingSenderId','storageBucket','measurementId'].includes(key)))throw new Error('Only public Firebase Web config is allowed; never supply a service-account credential.');
  if(firebase.authDomain!==firebase.projectId+'.firebaseapp.com')throw new Error('Use the project Firebase authDomain.');
  config={backendEnabled:true,firebase,emailEnabled:process.env.FIREBASE_EMAIL_ENABLED==='true',providers:(process.env.AUTH_PROVIDERS||'').split(',').filter(p=>['google','microsoft','facebook','github'].includes(p))};
}
fs.writeFileSync('dist/auth-config.js','window.OE_AUTH_CONFIG='+JSON.stringify(config)+';\n');
fs.writeFileSync('dist/_redirects',origin?'/api/* '+origin+'/api/:splat 200!\n':'');
esbuild.buildSync({entryPoints:[firebaseMode?'src/firebase-entry.js':'src/auth.js'],bundle:true,minify:true,outfile:'dist/auth.js',target:['es2020']});
esbuild.buildSync({entryPoints:['src/workspace-store.js'],bundle:true,minify:true,outfile:'dist/workspace-store.js',target:['es2020']});
