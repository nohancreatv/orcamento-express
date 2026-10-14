<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store, private');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
try{
    require dirname(__DIR__).'/src/bootstrap.php';
    if(strlen(env('APP_KEY'))<32 || !preg_match('~^https?://[^/]+$~D',appUrl()) || (env('APP_ENV','production')==='production'&&!str_starts_with(appUrl(),'https://')))fail(503,'not_configured','O serviço de contas está sendo configurado.');
    ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');ini_set('session.gc_maxlifetime','43200');
    $secure=str_starts_with(appUrl(),'https://');
    session_name($secure?'__Host-oe_session':'oe_session_dev');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);session_start();
    require dirname(__DIR__).'/src/oauth.php';require dirname(__DIR__).'/src/workspaces.php';
    $method=$_SERVER['REQUEST_METHOD'];$route=trim((string)($_GET['route']??''),'/');
    if($method==='OPTIONS')fail(405,'method','Use o endereço público do site para acessar a API.');
    if(!in_array($method,['GET','POST','PUT'],true))fail(405,'method','Método não permitido.');
    if($method!=='GET')mutationGuard();
    if($method==='GET'&&$route==='session'){
        db();$u=currentUser();$identities=$u?query('SELECT provider FROM oauth_identities WHERE user_id=?',[$u['id']])->fetchAll(PDO::FETCH_COLUMN):[];
        output(['user'=>publicUser($u),'csrf'=>csrf(),'providers'=>enabledProviders(),'emailEnabled'=>mailReady(),'identities'=>$identities]);
    }
    if($method==='GET'&&preg_match('~^auth/oauth/(google|microsoft|facebook|github)/callback$~D',$route,$m))oauthCallback($m[1]);
    if($method==='POST'&&preg_match('~^auth/oauth/(google|microsoft|facebook|github)/start$~D',$route,$m)){ $data=body();oauthStart($m[1],($data['link']??false)===true); }
    if($route==='workspace'){ $u=requireUser();if(!hash_equals($u['id'],$_SERVER['HTTP_X_OE_ACCOUNT']??''))fail(409,'account_changed','A conta mudou em outra aba. Faça backup e recarregue a página.');if($method==='GET')getWorkspace($u['id']);if($method==='PUT')putWorkspace($u['id'],body()); }
    if($method==='POST'&&$route==='auth/logout'){
        $_SESSION=[];session_destroy();setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);output(['ok'=>true]);
    }
    if($method==='POST'&&$route==='auth/register'){
        if(!mailReady())fail(503,'email_unavailable','O cadastro por e-mail ainda não foi ativado.');
        $data=body();$email=emailInput($data);$password=passwordInput($data);$name=trim(is_string($data['name']??null)?$data['name']:'');
        if($name===''||mb_strlen($name)>120)fail(422,'name','Informe seu nome (até 120 caracteres).');
        limit('register-ip',$_SERVER['REMOTE_ADDR']??'unknown',50,3600);limit('register-email',$email,3,3600);
        $hash=password_hash($password,PASSWORD_DEFAULT);
        $existing=query('SELECT id FROM users WHERE email=?',[$email])->fetch();
        if(!$existing){
            $id=bin2hex(random_bytes(16));db()->beginTransaction();
            try{query('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',[$id,$name,$email,$hash]);query('INSERT INTO workspaces(user_id) VALUES(?)',[$id]);db()->commit();}
            catch(PDOException $e){if(db()->inTransaction())db()->rollBack();if($e->getCode()!=='23000')throw $e;$id=null;}
            if($id)sendToken(['id'=>$id,'email'=>$email],'verify');
        }
        output(['message'=>'Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, entre ou recupere a senha.'],202);
    }
    if($method==='POST'&&$route==='auth/login'){
        $data=body();$email=emailInput($data);$password=is_string($data['password']??null)?$data['password']:'';
        limit('login-ip',$_SERVER['REMOTE_ADDR']??'unknown',100);limit('login-email',$email,10);
        $u=query('SELECT * FROM users WHERE email=?',[$email])->fetch();
        $hash=$u['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $valid=password_verify($password,$hash);
        if(!$u||!$u['password_hash']||!$valid)fail(401,'invalid_credentials','E-mail ou senha incorretos.');
        if(!$u['email_verified_at'])fail(403,'email_not_confirmed','Confirme seu e-mail antes de entrar. Use Reenviar confirmação se necessário.');
        if(password_needs_rehash($hash,PASSWORD_DEFAULT))query('UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$u['id']]);
        signIn($u);output(['user'=>publicUser($u),'csrf'=>csrf()]);
    }
    if($method==='POST'&&in_array($route,['auth/forgot','auth/resend'],true)){
        if(!mailReady())fail(503,'email_unavailable','O envio de e-mails ainda não está disponível.');
        $data=body();$email=emailInput($data);limit('mail-ip',$_SERVER['REMOTE_ADDR']??'unknown',50,3600);limit('mail-email',$email,3,3600);
        $u=query('SELECT * FROM users WHERE email=?',[$email])->fetch();
        if($u&&$u['password_hash']&&($route==='auth/forgot'||!$u['email_verified_at']))sendToken($u,$route==='auth/forgot'?'reset':'verify');
        output(['message'=>'Se houver uma conta elegível para este e-mail, você receberá um link.'],202);
    }
    if($method==='POST'&&$route==='auth/verify'){
        $data=body();consumeToken(is_string($data['token']??null)?$data['token']:'','verify',function($id){query('UPDATE users SET email_verified_at=UTC_TIMESTAMP() WHERE id=?',[$id]);});
        output(['message'=>'E-mail confirmado. Você já pode entrar.']);
    }
    if($method==='POST'&&$route==='auth/reset'){
        $data=body();$hash=password_hash(passwordInput($data),PASSWORD_DEFAULT);
        consumeToken(is_string($data['token']??null)?$data['token']:'','reset',function($id)use($hash){query('UPDATE users SET password_hash=?,email_verified_at=UTC_TIMESTAMP(),session_version=session_version+1 WHERE id=?',[$hash,$id]);query('DELETE FROM email_tokens WHERE user_id=?',[$id]);});
        $_SESSION=[];session_regenerate_id(true);output(['message'=>'Senha atualizada. Entre com sua nova senha.','csrf'=>csrf()]);
    }
    fail(404,'not_found','Recurso não encontrado.');
}catch(Throwable $e){
    if(function_exists('db')){try{if(db()->inTransaction())db()->rollBack();}catch(Throwable $ignored){}}
    error_log('Orcamento Express API failure: '.get_class($e));
    http_response_code(503);echo json_encode(['error'=>'service_unavailable','message'=>'Não foi possível acessar o serviço. Tente novamente mais tarde.']);
}
