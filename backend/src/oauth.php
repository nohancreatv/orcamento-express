<?php
declare(strict_types=1);
final class PkceGoogle extends League\OAuth2\Client\Provider\Google {
    protected function getPkceMethod() { return self::PKCE_METHOD_S256; }
}
final class PkceGithub extends League\OAuth2\Client\Provider\Github {
    protected function getPkceMethod() { return self::PKCE_METHOD_S256; }
}
function enabledProviders(): array {
    $result=[];
    foreach(['google','microsoft','facebook','github'] as $name){$prefix=strtoupper($name);if(env($prefix.'_CLIENT_ID') && env($prefix.'_CLIENT_SECRET') && ($name!=='facebook'||preg_match('/^v[0-9]+\.[0-9]+$/D',env('FACEBOOK_GRAPH_VERSION'))))$result[]=$name;}
    return $result;
}
function oauthProvider(string $name): League\OAuth2\Client\Provider\AbstractProvider {
    if(!in_array($name,enabledProviders(),true)) fail(503,'provider_unavailable','Esta opção de acesso ainda não foi ativada.');
    $opts=['clientId'=>env(strtoupper($name).'_CLIENT_ID'),'clientSecret'=>env(strtoupper($name).'_CLIENT_SECRET'),'redirectUri'=>appUrl().'/api/auth/oauth/'.$name.'/callback'];
    $http=new GuzzleHttp\Client(['timeout'=>12,'connect_timeout'=>5,'allow_redirects'=>false]);
    $collaborators=['httpClient'=>$http];
    return match($name){
        'google'=>new PkceGoogle($opts,$collaborators),
        'facebook'=>new League\OAuth2\Client\Provider\Facebook($opts+['graphApiVersion'=>env('FACEBOOK_GRAPH_VERSION')],$collaborators),
        'github'=>new PkceGithub($opts,$collaborators),
        'microsoft'=>new League\OAuth2\Client\Provider\GenericProvider($opts+[
            'urlAuthorize'=>'https://login.microsoftonline.com/'.rawurlencode(env('MICROSOFT_TENANT','common')).'/oauth2/v2.0/authorize',
            'urlAccessToken'=>'https://login.microsoftonline.com/'.rawurlencode(env('MICROSOFT_TENANT','common')).'/oauth2/v2.0/token',
            'urlResourceOwnerDetails'=>'https://graph.microsoft.com/oidc/userinfo',
            'responseResourceOwnerId'=>'sub','scopes'=>['openid','profile','email'],'scopeSeparator'=>' ','pkceMethod'=>'S256'
        ],$collaborators),
    };
}
function oauthStart(string $name, bool $link): never {
    $user=$link?requireUser():null;
    if(!$link && currentUser()) fail(409,'already_signed_in','Saia da sua conta ou use Conectar acesso.');
    limit('oauth-start',$_SERVER['REMOTE_ADDR']??'unknown',60);
    $provider=oauthProvider($name);
    $scopes=match($name){'google'=>['openid','profile','email'],'microsoft'=>['openid','profile','email'],'facebook'=>['public_profile','email'],'github'=>['read:user','user:email']};
    $url=$provider->getAuthorizationUrl(['scope'=>$scopes]);
    $_SESSION['oauth']=['state'=>$provider->getState(),'pkce'=>$provider->getPkceCode(),'provider'=>$name,'created'=>time(),'link'=>$user['id']??null];
    output(['url'=>$url]);
}
function resolveIdentity(string $provider, string $subject, string $name, ?string $profileEmail, ?string $linkUser): array {
    if($subject==='' || strlen($subject)>255 || !preg_match('/^[\x20-\x7e]+$/D',$subject)) throw new RuntimeException('Invalid provider subject');
    db()->beginTransaction();
    try{
        $identity=query('SELECT user_id FROM oauth_identities WHERE provider=? AND subject=? FOR UPDATE',[$provider,$subject])->fetch();
        if($identity){
            if($linkUser && $identity['user_id']!==$linkUser)throw new RuntimeException('Identity already linked');
            $id=$identity['user_id'];
        }else{
            $id=$linkUser??bin2hex(random_bytes(16));
            if(!$linkUser){query('INSERT INTO users(id,name) VALUES(?,?)',[$id,mb_substr($name?:'Minha conta',0,120)]);query('INSERT INTO workspaces(user_id) VALUES(?)',[$id]);}
            // Never merge accounts based on an email supplied by an OAuth provider.
            query('INSERT INTO oauth_identities(user_id,provider,subject,profile_email) VALUES(?,?,?,?)',[$id,$provider,$subject,$profileEmail]);
        }
        $user=query('SELECT * FROM users WHERE id=?',[$id])->fetch();db()->commit();return $user;
    }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
}
function oauthCallback(string $name): never {
    $pending=$_SESSION['oauth']??null;unset($_SESSION['oauth']);
    try{
        if(!$pending || $pending['provider']!==$name || time()-$pending['created']>600 || !is_string($_GET['state']??null) || !hash_equals($pending['state'],$_GET['state']) || !is_string($_GET['code']??null))throw new RuntimeException('Invalid OAuth state');
        if($pending['link'] && (currentUser()['id']??null)!==$pending['link'])throw new RuntimeException('Link session expired');
        $provider=oauthProvider($name);if($pending['pkce'])$provider->setPkceCode($pending['pkce']);
        $token=$provider->getAccessToken('authorization_code',['code'=>$_GET['code']]);
        $owner=$provider->getResourceOwner($token);$profile=$owner->toArray();
        $subject=(string)$owner->getId();
        $display=(string)($profile['name']??$profile['displayName']??$profile['login']??'Minha conta');
        $email=is_string($profile['email']??null)&&filter_var($profile['email'],FILTER_VALIDATE_EMAIL)?mb_substr($profile['email'],0,254):null;
        $u=resolveIdentity($name,$subject,$display,$email,$pending['link']);signIn($u);
        header('Location: '.appUrl().($pending['link']?'/login.html?mode=account&linked=1':'/'),true,303);exit;
    }catch(Throwable $e){
        // Do not log authorization codes, tokens or provider responses.
        header('Location: '.appUrl().'/login.html?error=oauth',true,303);exit;
    }
}
