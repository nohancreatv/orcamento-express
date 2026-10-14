<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/src/bootstrap.php';
require dirname(__DIR__).'/backend/src/oauth.php';
function check(bool $value,string $message): void {if(!$value)throw new RuntimeException($message);}
$_ENV['APP_URL']='https://example.test';$_ENV['FACEBOOK_GRAPH_VERSION']='v23.0';
foreach(['GOOGLE','MICROSOFT','FACEBOOK','GITHUB'] as $prefix){$_ENV[$prefix.'_CLIENT_ID']='test-client';$_ENV[$prefix.'_CLIENT_SECRET']='test-secret';}
foreach(['google','microsoft','facebook','github'] as $name){
    $provider=oauthProvider($name);
    $url=$provider->getAuthorizationUrl();parse_str(parse_url($url,PHP_URL_QUERY),$params);
    check(!empty($params['state']),'OAuth state missing');
    check($params['redirect_uri']==='https://example.test/api/auth/oauth/'.$name.'/callback','Wrong callback');
    if($name!=='facebook'){
        check(($params['code_challenge_method']??'')==='S256','PKCE not enabled for '.$name);
        check($params['code_challenge']===rtrim(strtr(base64_encode(hash('sha256',$provider->getPkceCode(),true)),'+/','-_'),'='),'PKCE challenge mismatch');
    }
    $history=[];$profile=['name'=>'Test User','email'=>'user@example.test',($name==='google'||$name==='microsoft'?'sub':'id')=>'provider-user'];
    $mock=new GuzzleHttp\Handler\MockHandler([
        new GuzzleHttp\Psr7\Response(200,['Content-Type'=>'application/json'],json_encode(['access_token'=>'test-access','token_type'=>'Bearer','expires_in'=>3600])),
        new GuzzleHttp\Psr7\Response(200,['Content-Type'=>'application/json'],json_encode($profile))
    ]);
    $stack=GuzzleHttp\HandlerStack::create($mock);$stack->push(GuzzleHttp\Middleware::history($history));
    $provider->setHttpClient(new GuzzleHttp\Client(['handler'=>$stack]));
    $token=$provider->getAccessToken('authorization_code',['code'=>'test-code']);
    $owner=$provider->getResourceOwner($token);
    check((string)$owner->getId()==='provider-user','Incorrect profile mapping for '.$name);
    parse_str((string)$history[0]['request']->getBody(),$exchange);
    if($name!=='facebook')check(($exchange['code_verifier']??'')===$provider->getPkceCode(),'Missing PKCE verifier');
}
echo "OAuth adapters: state, callbacks, PKCE, code exchange and profile mappings passed (mock HTTP).\n";
