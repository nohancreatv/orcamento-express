<?php
declare(strict_types=1);
require dirname(__DIR__) . '/vendor/autoload.php';
Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
function env(string $key, string $default = ''): string { return (string)($_ENV[$key] ?? getenv($key) ?: $default); }
function fail(int $status, string $code, string $message): never { http_response_code($status); echo json_encode(['error'=>$code,'message'=>$message], JSON_UNESCAPED_UNICODE); exit; }
function output(array $data, int $status = 200): never { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit; }
function appUrl(): string { return rtrim(env('APP_URL'), '/'); }
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $options = [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false];
        if (env('DB_SSL_CA')) {$options[PDO::MYSQL_ATTR_SSL_CA]=env('DB_SSL_CA');$options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT]=true;}
        $pdo = new PDO('mysql:host='.env('DB_HOST','127.0.0.1').';port='.env('DB_PORT','3306').';dbname='.env('DB_NAME').';charset=utf8mb4', env('DB_USER'), env('DB_PASSWORD'), $options);
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}
function query(string $sql, array $values = []): PDOStatement { $s=db()->prepare($sql); $s->execute($values); return $s; }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function body(): array {
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) fail(415,'json_required','Envie os dados em JSON.');
    $raw = file_get_contents('php://input', false, null, 0, 12582913);
    if (strlen($raw) > 12582912) fail(413,'too_large','O arquivo excede o limite de 12 MB.');
    try { $data=json_decode($raw,true,32,JSON_THROW_ON_ERROR); } catch (Throwable $e) { fail(400,'invalid_json','Dados inválidos.'); }
    if (!is_array($data)) fail(400,'invalid_json','Dados inválidos.');
    return $data;
}
function mutationGuard(): void {
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== appUrl()) fail(403,'origin','Origem não autorizada.');
    if (!hash_equals(csrf(), $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail(403,'csrf','Sua sessão mudou. Atualize a página.');
}
function currentUser(): ?array {
    if (empty($_SESSION['uid'])) return null;
    $u=query('SELECT id,name,email,email_verified_at,session_version FROM users WHERE id=?',[$_SESSION['uid']])->fetch();
    if (!$u || (int)$u['session_version'] !== (int)($_SESSION['version'] ?? 0) || time() > ($_SESSION['expires'] ?? 0)) {
        unset($_SESSION['uid'],$_SESSION['version'],$_SESSION['expires']);return null;
    }
    return $u;
}
function requireUser(): array { return currentUser() ?? fail(401,'unauthorized','Entre novamente para acessar seus orçamentos.'); }
function publicUser(?array $u): ?array { return $u ? ['id'=>$u['id'],'name'=>$u['name'],'email'=>$u['email']] : null; }
function signIn(array $u): void {
    session_regenerate_id(true); $_SESSION=[];
    $_SESSION['uid']=$u['id']; $_SESSION['version']=(int)$u['session_version']; $_SESSION['expires']=time()+43200; csrf();
}
function limit(string $action, string $identifier, int $max=10, int $seconds=900): void {
    $bucket=hash_hmac('sha256', $action.'|'.$identifier.'|'.intdiv(time(),$seconds), env('APP_KEY'));
    query('INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=attempts+1',[$bucket,gmdate('Y-m-d H:i:s',time()+$seconds)]);
    if ((int)query('SELECT attempts FROM rate_limits WHERE bucket=?',[$bucket])->fetchColumn()>$max) fail(429,'rate_limit','Muitas tentativas. Aguarde alguns minutos e tente novamente.');
}
function emailInput(array $data): string {
    $email=strtolower(trim(is_string($data['email'] ?? null)?$data['email']:''));
    if (strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL)) fail(422,'email','Informe um e-mail válido.'); return $email;
}
function passwordInput(array $data): string {
    $p=$data['password'] ?? null;
    if (!is_string($p) || mb_strlen($p)<10 || strlen($p)>72) fail(422,'password','Use uma senha com pelo menos 10 caracteres e até 72 bytes.'); return $p;
}
function mailReady(): bool { return env('SMTP_HOST')!=='' && env('MAIL_FROM')!==''; }
function sendToken(array $user, string $purpose): void {
    $token=bin2hex(random_bytes(32));
    query('INSERT INTO email_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,?)',[hash('sha256',$token),$user['id'],$purpose,gmdate('Y-m-d H:i:s',time()+1800)]);
    $link=appUrl().'/login.html#'.($purpose==='verify'?'verify_token':'reset_token').'='.$token;
    $mail=new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();$mail->Host=env('SMTP_HOST');$mail->Port=(int)env('SMTP_PORT','587');
    $mail->SMTPAuth=env('SMTP_USER')!=='';$mail->Username=env('SMTP_USER');$mail->Password=env('SMTP_PASSWORD');
    $encryption=env('SMTP_ENCRYPTION','tls');$mail->SMTPSecure=$encryption==='none'?'':$encryption;if($encryption==='none')$mail->SMTPAutoTLS=false;$mail->Timeout=10;$mail->CharSet='UTF-8';
    $mail->setFrom(env('MAIL_FROM'),env('MAIL_FROM_NAME','Orçamento Express'));$mail->addAddress($user['email']);
    $mail->Subject=$purpose==='verify'?'Confirme seu cadastro':'Recupere sua senha';
    $mail->Body="Abra o link abaixo para ".($purpose==='verify'?'confirmar o cadastro':'definir uma nova senha')." no Orçamento Express. O link expira em 30 minutos.\n\n".$link."\n\nSe você não solicitou, ignore esta mensagem.";
    try {$mail->send();}catch(Throwable $e){query('DELETE FROM email_tokens WHERE token_hash=?',[hash('sha256',$token)]);throw $e;}
}
function consumeToken(string $token, string $purpose, callable $action): void {
    if (!preg_match('/^[a-f0-9]{64}$/D',$token)) fail(400,'token','Link inválido ou expirado.');
    db()->beginTransaction();
    $row=query('SELECT user_id FROM email_tokens WHERE token_hash=? AND purpose=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[hash('sha256',$token),$purpose])->fetch();
    if (!$row){db()->rollBack();fail(400,'token','Link inválido ou expirado.');}
    $action($row['user_id']);
    query('DELETE FROM email_tokens WHERE user_id=? AND purpose=?',[$row['user_id'],$purpose]);db()->commit();
}
