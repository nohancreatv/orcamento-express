<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/src/bootstrap.php';
query('DELETE FROM email_tokens WHERE expires_at<UTC_TIMESTAMP()');
query('DELETE FROM rate_limits WHERE expires_at<UTC_TIMESTAMP()');
echo "Expired tokens and rate buckets removed.\n";
