const fs=require('node:fs');
const esbuild=require('esbuild');
const origin=(process.env.API_ORIGIN||'').replace(/\/$/,'');
if(origin){const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('API_ORIGIN must be the HTTPS origin of the PHP host, without credentials or path.');}
fs.writeFileSync('dist/auth-config.js','window.OE_AUTH_CONFIG='+JSON.stringify({backendEnabled:!!origin||process.env.API_LOCAL==='true'})+';\n');
fs.writeFileSync('dist/_redirects',origin?'/api/* '+origin+'/api/:splat 200!\n':'');
esbuild.buildSync({entryPoints:['src/auth.js'],bundle:true,minify:true,outfile:'dist/auth.js',target:['es2020']});
esbuild.buildSync({entryPoints:['src/workspace-store.js'],bundle:true,minify:true,outfile:'dist/workspace-store.js',target:['es2020']});
