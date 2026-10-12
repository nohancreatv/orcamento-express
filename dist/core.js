(function(root){
  'use strict';
  function amount(value,max){var n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max===undefined?1e9:max,n)):0}
  function round(n){return Math.round((n+Number.EPSILON)*100)/100}
  function calculate(d){
    var subtotal=round(d.items.filter(function(i){return !i.optional||i.selected}).reduce(function(sum,i){return sum+round(amount(i.qty,100000)*amount(i.price,10000000))},0));
    var discount=round(subtotal*amount(d.discount,100)/100), total=round(subtotal-discount);
    var labor=round((amount(d.hours,10000)+amount(d.prep,10000))*amount(d.hourly,100000));
    var raw=round(labor+amount(d.material)+amount(d.travel)),reserve=round(raw*amount(d.reserve,100)/100),cost=round(raw+reserve);
    var rate=amount(d.tax,99)/100,tax=round(total*rate),profit=round(total-tax-cost);
    var floor=Math.ceil(cost/(1-rate)*100-1e-7)/100,target=Math.ceil((cost+amount(d.target))/(1-rate)*100-1e-7)/100;
    var deposit=round(total*amount(d.deposit,100)/100),gap=round(Math.max(0,amount(d.upfront)-deposit));
    var room=subtotal>0?Math.floor(Math.max(0,(subtotal-target)/subtotal*100)*10)/10:0;
    return {subtotal:subtotal,discount:discount,total:total,labor:labor,reserve:reserve,cost:cost,tax:tax,profit:profit,floor:floor,target:target,deposit:deposit,balance:round(total-deposit),gap:gap,room:room,margin:total>0?profit/total*100:0};
  }
  function escapeHtml(value){return String(value===undefined?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(n){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n)}
  function dateLabel(value){var a=String(value).split('-');return a.length===3?a[2]+'/'+a[1]+'/'+a[0]:''}
  function publicDocument(d){
    var c=calculate(d),e=escapeHtml;
    var logo=/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(d.logo||'')?'<img class="doc-logo" alt="Logo do profissional" src="'+d.logo+'">':'';
    var rows=d.items.filter(function(i){return !i.optional||i.selected}).map(function(i){return '<tr><td>'+e(i.name||'Item sem descrição')+'</td><td>'+e(amount(i.qty))+'</td><td>'+money(amount(i.price))+'</td><td>'+money(round(amount(i.qty)*amount(i.price)))+'</td></tr>'}).join('');
    var sections=[['Incluído',d.scope],['Fora do escopo',d.excluded],['Prazo de execução',d.deadline],['Pagamento',(d.payment||'A combinar')+'. Sinal de '+money(c.deposit)+' ('+amount(d.deposit,100)+'%) e saldo de '+money(c.balance)+' na entrega.']].filter(function(s){return s[1]}).map(function(s){return '<section><h3>'+s[0]+'</h3><p>'+e(s[1])+'</p></section>'}).join('');
    return '<div class="doc-header"><div>'+logo+'<div class="doc-brand">'+e(d.pro||'Seu nome ou negócio')+'</div><p class="doc-contact">'+e(d.contact)+'</p></div><div class="doc-meta">PROPOSTA Nº '+e(d.number)+'<br>Emissão: '+dateLabel(d.issued)+'<br>Validade: '+Math.max(1,amount(d.validity,365))+' dias</div></div><h2 class="doc-title">'+e(d.title||'Proposta de serviço')+'</h2><p class="doc-client">Preparada para <strong>'+e(d.client||'Nome do cliente')+'</strong></p><table class="doc-table"><thead><tr><th>Entrega</th><th>Qtd.</th><th>Unitário</th><th>Valor</th></tr></thead><tbody>'+rows+'</tbody></table><div class="doc-total">'+(c.discount?'<p>Subtotal: '+money(c.subtotal)+'</p><p>Desconto ('+amount(d.discount,100)+'%): − '+money(c.discount)+'</p>':'')+'<p>Valor total da proposta</p><strong>'+money(c.total)+'</strong></div><div class="doc-sections">'+sections+'</div><p class="doc-foot">Alterações fora do escopo serão combinadas antes da execução, com revisão de prazo e valor quando necessário. Esta proposta não é nota fiscal nem comprovante de pagamento.</p>';
  }
  var api={amount:amount,round:round,calculate:calculate,escapeHtml:escapeHtml,money:money,publicDocument:publicDocument};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OE=api;
})(typeof window!=='undefined'?window:globalThis);
