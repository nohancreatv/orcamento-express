(function(){
  'use strict';
  var $=function(id){return document.getElementById(id)},C=window.OE,clone=function(x){return JSON.parse(JSON.stringify(x))},key='oe-workspace-v2',draft,versions=[],storageOK=true,toastTimer;
  var today=function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  var uid=function(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)};
  var numeric={validity:365,hours:10000,hourly:100000,prep:10000,material:1e9,travel:1e9,reserve:100,tax:99,target:1e9,upfront:1e9,discount:100,deposit:100};
  function fresh(example){
    return {id:uid(),example:!!example,title:example?'Pintura da sala e corredor':'',client:example?'Marina Alves':'',pro:example?'Ateliê da Casa':'',contact:'',phone:'',number:'OE-'+new Date().getTime().toString().slice(-6),issued:today(),validity:7,logo:'',
      items:example?[{name:'Preparação e pintura · duas demãos',qty:1,price:680,optional:false,selected:true},{name:'Materiais e proteção do ambiente',qty:1,price:140,optional:false,selected:true},{name:'Pintura de uma porta',qty:1,price:180,optional:true,selected:false}]:[{name:'',qty:1,price:0,optional:false,selected:true}],
      scope:example?'Proteção dos móveis e piso, preparação leve da superfície e aplicação de duas demãos. Uma visita de conferência.':'',excluded:example?'Correção de infiltração e reparos estruturais.':'',deadline:example?'3 dias úteis após a confirmação.':'',payment:'Pix ou transferência',
      hours:example?6:0,hourly:example?55:0,prep:example?1:0,material:example?120:0,travel:example?35:0,reserve:5,tax:0,target:example?250:0,upfront:example?155:0,discount:0,deposit:40,baseline:null};
  }
  function normalize(input){
    if(!input||typeof input!=='object'||!Array.isArray(input.items)||input.items.length>100)throw Error('Formato de orçamento inválido.');
    var d=fresh(false);
    Object.keys(d).forEach(function(k){if(k==='items'||k==='baseline'||k==='logo')return;if(k in numeric)d[k]=C.amount(input[k],numeric[k]);else if(k==='example')d[k]=input[k]===true;else if(typeof input[k]==='string')d[k]=input[k].slice(0,10000)});
    d.validity=Math.max(1,Math.floor(d.validity||7));if(!/^\d{4}-\d{2}-\d{2}$/.test(d.issued))d.issued=today();
    d.items=input.items.map(function(i){return {name:String(i.name||'').slice(0,2000),qty:C.amount(i.qty,100000),price:C.amount(i.price,10000000),optional:i.optional===true,selected:i.selected!==false}});
    if(typeof input.logo==='string'&&input.logo.length<1500000&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(input.logo))d.logo=input.logo;
    if(input.baseline&&typeof input.baseline==='object'&&Array.isArray(input.baseline.items)){var b=clone(input.baseline);b.baseline=null;d.baseline=normalize(b);d.baseline.savedAt=String(input.baseline.savedAt||'')}
    return d;
  }
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').classList.remove('show')},4000)}
  function persist(){try{localStorage.setItem(key,JSON.stringify({schema:2,draft:draft,versions:versions}));storageOK=true}catch(e){storageOK=false}$('saveStatus').textContent=storageOK?'Salvo neste navegador':'Não foi possível salvar · faça backup';$('saveStatus').classList.toggle('error',!storageOK);$('count').textContent=versions.length}
  function setTab(name){
    document.querySelectorAll('[data-tab]').forEach(function(b){var active=b.dataset.tab===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1});
    ['proposal','health','preview'].forEach(function(p){$('panel-'+p).hidden=p!==name});
    if(name==='preview')render();
  }
  function bindValues(){
    document.querySelectorAll('[data-field]').forEach(function(el){el.value=draft[el.dataset.field]===undefined?'':draft[el.dataset.field]});
    $('logoThumb').hidden=!draft.logo;$('removeLogo').hidden=!draft.logo;if(draft.logo)$('logoThumb').src=draft.logo;else $('logoThumb').removeAttribute('src');
    renderItems();render();
  }
  function renderItems(){
    $('items').innerHTML=draft.items.map(function(i,n){
      var e=C.escapeHtml;
      return '<div class="item-row" data-index="'+n+'"><div class="item-name"><input aria-label="Descrição do item '+(n+1)+'" data-item="name" value="'+e(i.name)+'" placeholder="Descreva a entrega"><div class="item-options"><label><input type="checkbox" data-item="optional" '+(i.optional?'checked':'')+'>Opcional</label>'+(i.optional?'<label><input type="checkbox" data-item="selected" '+(i.selected?'checked':'')+'>Incluir na proposta</label>':'')+'</div></div><label class="quantity-cell"><span class="mobile-label">Qtd.</span><input aria-label="Quantidade do item '+(n+1)+'" data-item="qty" type="number" min="0" max="100000" step=".01" value="'+i.qty+'"></label><label class="price-cell"><span class="mobile-label">Unitário (R$)</span><input aria-label="Valor unitário do item '+(n+1)+'" data-item="price" type="number" min="0" max="10000000" step=".01" value="'+i.price+'"></label><div class="item-total"><span class="mobile-label">Total</span><span data-item-total>'+C.money(C.round(i.qty*i.price))+'</span></div><button class="remove-item" data-remove="'+n+'" aria-label="Remover item '+(n+1)+'">×</button></div>';
    }).join('');
  }
  function percent(v){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(v)+'%'}
  function diff(){
    var b=draft.baseline;if(!b){$('revisionDiff').innerHTML='<p class="helper">Nenhuma referência guardada ainda.</p>';return}
    var fields=[['Valor final',C.money(C.calculate(b).total),C.money(C.calculate(draft).total)],['Itens',itemText(b),itemText(draft)],['Incluído',b.scope,draft.scope],['Fora do escopo',b.excluded,draft.excluded],['Prazo',b.deadline,draft.deadline],['Pagamento',b.payment+' · sinal '+b.deposit+'%',draft.payment+' · sinal '+draft.deposit+'%']];
    var changes=fields.filter(function(f){return f[1]!==f[2]});
    $('revisionDiff').innerHTML='<p class="helper">Referência: '+C.escapeHtml(b.savedAt||'guardada localmente')+'</p>'+(changes.length?changes.map(function(f){return '<div class="revision-row"><b>'+f[0]+'</b><small>Antes: '+C.escapeHtml(f[1]||'Não informado')+'</small><small class="new-value">Agora: '+C.escapeHtml(f[2]||'Não informado')+'</small></div>'}).join(''):'<p class="helper">Itens, valor e condições permanecem iguais à referência.</p>');
  }
  function itemText(d){return d.items.filter(function(i){return !i.optional||i.selected}).map(function(i){return i.qty+' × '+(i.name||'Item sem descrição')+' · '+C.money(i.price)}).join('\n')}
  function render(){
    var c=C.calculate(draft),m=C.money;
    $('documentName').textContent=draft.title||'Nova proposta';$('exampleBadge').hidden=!draft.example;
    ['grandTotal','subtotal','discountAmount','costValue','taxValue','profitValue','depositValue','balanceValue','floorValue','targetValue'].forEach(function(id,index){$(id).textContent=m([c.total,c.subtotal,c.discount,c.cost,c.tax,c.profit,c.deposit,c.balance,c.floor,c.target][index])});
    $('marginValue').textContent=percent(c.margin)+' do valor final · após os custos informados';
    $('profitBlock').classList.toggle('negative',c.profit<0);
    $('summaryHint').textContent=c.subtotal===0?'Adicione valores aos itens para avaliar a proposta.':c.profit<0?'Atenção: o valor não cobre todos os custos informados.':c.profit<draft.target?'O preço cobre os custos, mas fica abaixo do lucro desejado.':'O valor alcança o lucro desejado com os custos informados.';
    $('discountRoom').textContent=percent(c.room);
    $('discountInsight').textContent=c.subtotal===0?'Preencha os valores dos itens para simular o desconto.':c.target>c.subtotal?'Mesmo sem desconto, faltam '+m(c.target-c.subtotal)+' no preço de venda para atingir seu lucro desejado.':c.profit<draft.target?'Com este desconto, o resultado fica '+m(draft.target-c.profit)+' abaixo do lucro desejado.':'Este desconto preserva o lucro desejado de '+m(draft.target)+'.';
    $('discountInsight').classList.toggle('warning',c.profit<draft.target);
    $('depositInsight').textContent=draft.upfront===0?'Informe as despesas antes de começar para avaliar a cobertura do sinal.':c.gap>0?'O sinal de '+m(c.deposit)+' deixa '+m(c.gap)+' para você financiar antes do início. '+(draft.upfront>c.total?'Os gastos iniciais superam o valor total da proposta. Reveja custos e preço.':'Um sinal de '+percent(Math.ceil(draft.upfront/c.total*1000)/10)+' cobriria as despesas informadas.'):'O sinal cobre os '+m(draft.upfront)+' de gastos informados para antes do início.';
    $('depositInsight').classList.toggle('warning',c.gap>0);
    var missing=[];if(!draft.pro.trim())missing.push('seu nome');if(!draft.client.trim())missing.push('cliente');if(!draft.title.trim())missing.push('título do serviço');if(!draft.items.some(function(i){return (!i.optional||i.selected)&&i.price>0&&i.qty>0}))missing.push('itens com valor');if(!draft.scope.trim())missing.push('escopo');
    if(draft.items.some(function(i){return (!i.optional||i.selected)&&!i.name.trim()}))missing.push('descrição de todos os itens');
    if(draft.items.some(function(i){return (!i.optional||i.selected)&&i.qty===0}))missing.push('quantidades maiores que zero');
    $('readiness').textContent=missing.length?'Antes de enviar, confira: '+missing.join(', ')+'.':'Dados essenciais preenchidos. Revise os detalhes abaixo antes de enviar.';
    $('readiness').classList.toggle('ready',missing.length===0);
    var publicHtml=C.publicDocument(draft);$('proposalPreview').innerHTML=publicHtml;$('printDocument').innerHTML=publicHtml;
    document.querySelectorAll('[data-item-total]').forEach(function(el,n){if(draft.items[n])el.textContent=m(C.round(draft.items[n].qty*draft.items[n].price))});
    diff();persist();
  }
  function saveVersion(silent){
    versions.unshift({id:uid(),savedAt:new Date().toISOString(),status:'Rascunho',data:clone(draft)});
    persist();if(!silent)toast(storageOK?'Versão guardada no arquivo local.':'Versão mantida na sessão. Faça um backup para não perder.');return true;
  }
  function history(){
    $('historyList').innerHTML=versions.length?versions.map(function(v,n){
      return '<div class="history-row"><div class="history-info"><p>'+C.escapeHtml(v.data.title||'Sem título')+'</p><small>'+C.escapeHtml(v.data.client||'Sem cliente')+' · '+C.money(C.calculate(v.data).total)+'<br>'+new Date(v.savedAt).toLocaleString('pt-BR')+'</small><select class="status-select" aria-label="Status manual da versão '+(n+1)+'" data-status="'+n+'">'+['Rascunho','Enviado','Aprovado (manual)','Recusado (manual)'].map(function(s){return '<option '+(s===v.status?'selected':'')+'>'+s+'</option>'}).join('')+'</select></div><div class="history-actions"><button class="secondary small-btn" data-load="'+n+'">Abrir</button><button class="quiet" data-duplicate="'+n+'">Duplicar</button></div></div>';
    }).join(''):'<p class="empty">Suas versões guardadas aparecem aqui.</p>';
  }
  function summaryText(){var c=C.calculate(draft);return ['Olá'+(draft.client?' '+draft.client:'')+'!','Proposta '+draft.number+' — '+draft.title,itemText(draft),'Total: '+C.money(c.total),c.discount?'Desconto incluído: '+C.money(c.discount):'',draft.scope?'Incluído: '+draft.scope:'',draft.excluded?'Fora do escopo: '+draft.excluded:'',draft.deadline?'Prazo: '+draft.deadline:'','Pagamento: '+(draft.payment||'a combinar')+'. Sinal: '+C.money(c.deposit)+'. Na entrega: '+C.money(c.balance)+'.','Validade: '+draft.validity+' dias a partir de '+draft.issued.split('-').reverse().join('/')+'.','Alterações fora do escopo serão combinadas antes da execução.',draft.pro,draft.contact].filter(Boolean).join('\n\n')}
  function fallbackCopy(text){$('messageText').value=text;$('messageDialog').showModal();$('messageText').select()}
  document.querySelectorAll('[data-field]').forEach(function(el){
    el.addEventListener('input',function(){var k=el.dataset.field;draft.example=false;draft[k]=k in numeric?C.amount(el.value,numeric[k]):el.value;render()});
    el.addEventListener('change',function(){var k=el.dataset.field;if(k in numeric){if(k==='validity')draft[k]=Math.max(1,Math.floor(draft[k]||7));el.value=draft[k]}render()});
  });
  document.querySelectorAll('[data-tab],[data-next]').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.tab||b.dataset.next);if(b.dataset.next)$('tab-'+b.dataset.next).focus()})});
  document.querySelector('.tabs').addEventListener('keydown',function(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;var tabs=Array.from(document.querySelectorAll('[data-tab]')),i=tabs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();var n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[n].dataset.tab);tabs[n].focus()});
  $('items').addEventListener('input',function(e){var input=e.target,k=input.dataset.item;if(!k)return;var index=Number(input.closest('[data-index]').dataset.index);draft.items[index][k]=k==='qty'||k==='price'?C.amount(input.value,k==='qty'?100000:10000000):k==='name'?input.value:input.checked;render()});
  $('items').addEventListener('change',function(e){if(e.target.dataset.item==='optional')renderItems();else if(['qty','price'].includes(e.target.dataset.item)){var row=Number(e.target.closest('[data-index]').dataset.index);e.target.value=draft.items[row][e.target.dataset.item]}render()});
  $('items').addEventListener('click',function(e){var b=e.target.closest('[data-remove]');if(!b)return;draft.items.splice(Number(b.dataset.remove),1);renderItems();render()});
  $('addItem').onclick=function(){if(draft.items.length>=100)return toast('Limite de 100 itens por proposta.');draft.items.push({name:'',qty:1,price:0,optional:false,selected:true});renderItems();render();$('items').lastElementChild.querySelector('input').focus()};
  $('saveBtn').onclick=function(){saveVersion(false)};
  $('newBtn').onclick=function(){saveVersion(true);var pro=draft.example?'':draft.pro,contact=draft.example?'':draft.contact,logo=draft.logo;draft=fresh(false);draft.pro=pro;draft.contact=contact;draft.logo=logo;bindValues();setTab('proposal');toast('Anterior guardado. Nova proposta pronta.')};
  $('historyBtn').onclick=function(){history();$('historyDialog').showModal()};
  $('closeHistory').onclick=function(){$('historyDialog').close()};
  $('closeMessage').onclick=function(){$('messageDialog').close()};
  $('historyList').addEventListener('change',function(e){if(e.target.dataset.status!==undefined){versions[Number(e.target.dataset.status)].status=e.target.value;persist()}});
  $('historyList').addEventListener('click',function(e){var b=e.target.closest('[data-load],[data-duplicate]');if(!b)return;var v=clone(versions[Number(b.dataset.load===undefined?b.dataset.duplicate:b.dataset.load)].data);if(!saveVersion(true))return toast('Arquivo cheio. Exporte um backup.');draft=v;if(b.dataset.duplicate!==undefined){draft.id=uid();draft.number=fresh(false).number;draft.issued=today();draft.baseline=null;draft.example=false}bindValues();setTab('proposal');$('historyDialog').close();toast('Versão aberta. O rascunho anterior foi guardado.')});
  $('baselineBtn').onclick=function(){if(draft.baseline&&!confirm('Substituir a referência anterior por esta versão?'))return;var b=clone(draft);b.baseline=null;b.savedAt=new Date().toLocaleString('pt-BR');draft.baseline=b;render();toast('Referência guardada para comparar alterações.')};
  $('printBtn').onclick=function(){render();window.print()};
  $('copyBtn').onclick=async function(){var text=summaryText();try{await navigator.clipboard.writeText(text);toast('Resumo copiado, sem custos internos.')}catch(e){fallbackCopy(text)}};
  $('whatsappBtn').onclick=function(){var n=draft.phone.replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;if(!/^55\d{10,11}$/.test(n)){toast('Informe um WhatsApp brasileiro com DDD.');document.querySelector('[data-field=phone]').focus();return}window.open('https://wa.me/'+n+'?text='+encodeURIComponent(summaryText()),'_blank','noopener,noreferrer')};
  $('logoInput').onchange=function(e){var file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>1048576){toast('Use PNG ou JPG de até 1 MB.');e.target.value='';return}var reader=new FileReader();reader.onload=function(){draft.logo=String(reader.result);bindValues();toast(storageOK?'Logo adicionado.':'Logo aplicado na sessão. Faça backup.')};reader.readAsDataURL(file)};
  $('removeLogo').onclick=function(){draft.logo='';$('logoInput').value='';bindValues()};
  $('backupBtn').onclick=function(){var payload=JSON.stringify({schema:2,draft:draft,versions:versions},null,2),url=URL.createObjectURL(new Blob([payload],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='orcamento-express-backup-'+today()+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(url)},2000);toast('Backup contém propostas e custos internos. Guarde com cuidado.')};
  $('importInput').onchange=async function(e){var file=e.target.files[0];if(!file)return;try{if(file.size>15000000)throw Error('O backup deve ter até 15 MB.');var data=JSON.parse(await file.text());if(data.schema!==2||!Array.isArray(data.versions))throw Error('Este arquivo não é um backup do Orçamento Express.');var imported=normalize(data.draft),incoming=data.versions.map(function(v){return {id:String(v.id||uid()),savedAt:Number.isFinite(Date.parse(v.savedAt))?v.savedAt:new Date().toISOString(),status:['Rascunho','Enviado','Aprovado (manual)','Recusado (manual)'].includes(v.status)?v.status:'Rascunho',data:normalize(v.data)}});var known=new Set(versions.map(function(v){return v.id})),merged=versions.concat(incoming.filter(function(v){return !known.has(v.id)}));if(!confirm('Restaurar o rascunho deste backup? O rascunho atual será guardado e os arquivos serão combinados.'))return;merged.unshift({id:uid(),savedAt:new Date().toISOString(),status:'Rascunho',data:clone(draft)});versions=merged;draft=imported;bindValues();toast('Backup restaurado. Versões anteriores preservadas.')}catch(err){toast(err.message||'Não foi possível restaurar o backup.')}finally{e.target.value=''}};
  try{
    var stored=JSON.parse(localStorage.getItem(key)||'null');
    if(stored&&stored.schema===2){draft=normalize(stored.draft);versions=(stored.versions||[]).map(function(v){return {id:v.id,savedAt:v.savedAt,status:v.status,data:normalize(v.data)}})}
    else{var old=JSON.parse(localStorage.getItem('oe-draft')||'null');draft=fresh(!old);if(old){['title','client','pro','phone','scope','excluded','payment'].forEach(function(k){draft[k]=old[k]||''});['hours','hourly','prep','material','travel','validity'].forEach(function(k){draft[k]=C.amount(old[k],numeric[k])});draft.travel+=C.amount(old.overhead);draft.reserve=C.amount(old.returnPct,100);draft.tax=C.amount(old.tax,99);draft.target=C.amount(old.profit);var c=C.calculate(draft);draft.items=[{name:draft.title||'Serviço',qty:1,price:c.target,optional:false,selected:true}];draft.example=false}}
  }catch(err){draft=fresh(true);toast('Não foi possível ler o arquivo salvo. O conteúdo anterior não será sobrescrito automaticamente.');storageOK=false;key='oe-workspace-recovery-'+Date.now()}
  bindValues();setTab('proposal');
})();
