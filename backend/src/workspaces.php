<?php
declare(strict_types=1);
function validateDraft(mixed $d, int $depth=0): void {
    if(!is_array($d)||!is_array($d['items']??null)||!array_is_list($d['items'])||count($d['items'])>100)fail(422,'workspace','Orçamento inválido ou com mais de 100 itens.');
    foreach($d['items'] as $item){
        if(!is_array($item)||!is_string($item['name']??null)||mb_strlen($item['name'])>2000)fail(422,'workspace','Descrição de item inválida.');
        foreach(['qty','price'] as $field){if(!is_numeric($item[$field]??null)||$item[$field]<0||$item[$field]>10000000)fail(422,'workspace','Quantidade ou preço inválido.');}
    }
    foreach(['title','client','pro','contact','phone','number','issued','scope','excluded','deadline','payment'] as $field){if(isset($d[$field])&&(!is_string($d[$field])||mb_strlen($d[$field])>10000))fail(422,'workspace','Texto do orçamento inválido.');}
    foreach(['validity','hours','hourly','prep','material','travel','reserve','tax','target','upfront','discount','deposit'] as $field){if(isset($d[$field])&&(!is_numeric($d[$field])||$d[$field]<0||$d[$field]>1e9))fail(422,'workspace','Valor numérico inválido.');}
    if(isset($d['logo']) && (!is_string($d['logo'])||strlen($d['logo'])>1500000||($d['logo']!==''&&!preg_match('~^data:image/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$~D',$d['logo']))))fail(422,'workspace','Logo inválido.');
    if(!empty($d['baseline'])){if($depth>0)fail(422,'workspace','Referência inválida.');validateDraft($d['baseline'],1);}
}
function validateWorkspace(array $data): string {
    if(($data['schema']??null)!==2||!is_array($data['versions']??null)||!array_is_list($data['versions'])||count($data['versions'])>100)fail(422,'workspace','Use um backup válido com até 100 versões.');
    validateDraft($data['draft']??null);
    foreach($data['versions'] as $v){if(!is_array($v)||!is_string($v['id']??null)||strlen($v['id'])>100||!is_string($v['savedAt']??null)||strtotime($v['savedAt'])===false||!in_array($v['status']??null,['Rascunho','Enviado','Aprovado (manual)','Recusado (manual)'],true))fail(422,'workspace','Versão inválida.');validateDraft($v['data']??null);}
    return json_encode(['schema'=>2,'draft'=>$data['draft'],'versions'=>$data['versions']],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
}
function getWorkspace(string $id): never {
    $row=query('SELECT payload,revision,updated_at FROM workspaces WHERE user_id=?',[$id])->fetch();
    output(['workspace'=>$row&&$row['payload']?json_decode($row['payload'],true):null,'revision'=>(int)($row['revision']??0),'updatedAt'=>$row['updated_at']??null]);
}
function putWorkspace(string $id, array $data): never {
    if(!is_int($data['revision']??null)||$data['revision']<0||!is_array($data['workspace']??null))fail(422,'workspace','Revisão inválida.');
    $payload=validateWorkspace($data['workspace']);
    $s=query('UPDATE workspaces SET payload=?,revision=revision+1 WHERE user_id=? AND revision=?',[$payload,$id,$data['revision']]);
    if($s->rowCount()!==1)fail(409,'conflict','Este orçamento foi alterado em outra aba ou aparelho. Faça backup antes de recarregar.');
    output(['revision'=>$data['revision']+1]);
}
