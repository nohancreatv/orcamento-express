const fail=(message,status=422)=>Object.assign(new Error(message),{status});
export function encodeWorkspace(workspace){
  if(workspace?.schema!==2||!workspace.draft||!Array.isArray(workspace.versions)||workspace.versions.length>100)throw fail('Formato de orçamento inválido.');
  const payload=JSON.stringify(workspace);
  if(new TextEncoder().encode(payload).length>900000)throw fail('Sua conta excede 900 KB nesta versão gratuita. Baixe um backup e reduza logos ou versões antes de salvar.');
  return payload;
}
export function decodeWorkspace(payload){
  const workspace=JSON.parse(payload);encodeWorkspace(workspace);return workspace;
}
export function nextRevision(current,expected){
  if(!Number.isSafeInteger(expected)||current!==expected)throw fail('Os dados foram alterados em outra aba ou aparelho. Faça backup e recarregue.',409);
  return current+1;
}
