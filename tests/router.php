<?php
// Local test server only. Production must expose backend/public as its document root.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(str_starts_with($path,'/api/')){$_GET['route']=substr($path,5);require dirname(__DIR__).'/backend/public/index.php';return true;}
return false;
