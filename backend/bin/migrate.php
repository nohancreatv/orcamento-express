<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/src/bootstrap.php';
db()->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));
echo "Database schema ready.\n";
