<?php
$_POST_json = '{"fetch_session": "test"}';
$input = json_decode($_POST_json, true);
echo isset($input['fetch_session']) ? "yes" : "no";
