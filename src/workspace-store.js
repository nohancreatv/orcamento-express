// The server owns the data. Revision checks prevent a stale tab overwriting another device.
class WorkspaceStore {
  constructor(request, onStatus){this.request=request;this.onStatus=onStatus;this.account=null;this.generation=0;this.timer=null;this.pending=null;this.inflight=null;this.loaded=false;this.blocked=false;this.revision=0;this.saved='';}
  status(text,error=false){this.onStatus(text,error);}
  async load(account){
    this.reset();this.account=account;const generation=this.generation;
    this.status('Carregando seus orçamentos…');
    const result=await this.request('workspace','GET',undefined,account);
    if(generation!==this.generation)return null;
    this.revision=result.revision;this.loaded=true;this.saved=result.workspace?JSON.stringify(result.workspace):'';
    this.status('Sincronizado com sua conta');return result.workspace;
  }
  reset(){clearTimeout(this.timer);this.generation++;this.account=null;this.loaded=false;this.pending=null;this.inflight=null;this.blocked=false;this.saved='';}
  queue(workspace){
    if(!this.loaded||!this.account)return;
    const payload=JSON.stringify(workspace);
    if(payload===this.pending||(!this.pending&&payload===this.saved))return;
    this.pending=payload;
    if(this.blocked)return;
    this.status('Alterações aguardando salvamento…');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),700);
  }
  async flush(){
    clearTimeout(this.timer);
    if(this.blocked)throw new Error('Faça backup e recarregue para resolver o conflito.');
    if(this.inflight){await this.inflight;return this.pending?this.flush():undefined;}
    if(!this.pending||!this.loaded)return;
    const payload=this.pending, generation=this.generation, account=this.account;
    this.status('Salvando na sua conta…');
    const task=(async()=>{
      try {
        const result=await this.request('workspace','PUT',{revision:this.revision,workspace:JSON.parse(payload)},account);
        if(generation!==this.generation)return;
        this.revision=result.revision;this.saved=payload;if(this.pending===payload)this.pending=null;
        this.status(this.pending?'Alterações aguardando salvamento…':'Salvo na sua conta');
      } catch(error){
        if(generation!==this.generation)return;
        if([409,401,403].includes(error.status))this.blocked=true;
        this.status(error.message||'Falha ao salvar. Tente novamente ou faça backup.',true);throw error;
      } finally {if(generation===this.generation)this.inflight=null;}
    })();
    this.inflight=task;await task;
    if(generation===this.generation&&this.pending&&!this.blocked)return this.flush();
  }
  get dirty(){return !!this.pending||!!this.inflight;}
}
window.OEWorkspaceStore=WorkspaceStore;
