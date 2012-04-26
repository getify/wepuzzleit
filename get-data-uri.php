<?php

$request_headers = http_get_request_headers();
$dataType = isset($request_headers["X-File-Type"]) ? $request_headers["X-File-Type"] : "image/jpg";

echo "data:".$dataType.";base64,".base64_encode(http_get_request_body());

?>