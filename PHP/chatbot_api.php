<?php
// SmartCare | AI Chatbot Backend Proxy
// ========================================================
error_reporting(0); // Prevent warnings from breaking JSON response
header('Content-Type: application/json');

session_start();

$db_path = 'db_connect.php';
if (!file_exists($db_path)) {
    echo json_encode(['success' => false, 'message' => "Database configuration file missing."]);
    exit;
}
require_once $db_path;

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$user_message = isset($input['message']) ? trim($input['message']) : '';
$session_id = isset($input['session_id']) ? $input['session_id'] : 'unknown_session';
$user_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;

if (empty($user_message) && $user_message !== 'reset') {
    echo json_encode(['success' => false, 'message' => 'Empty message']);
    exit;
}

// 1. Send request to Python ML Server
$python_url = "http://localhost:5050/api/chat";
$ch = curl_init($python_url);
$payload = json_encode([
    'message' => $user_message,
    'session_id' => $session_id,
    'user_id' => $user_id,
    // If PHP session already has chatbot profile, pass it to Python so it can skip asking
    'user_profile' => isset($_SESSION['chatbot_profile']) ? json_decode($_SESSION['chatbot_profile'], true) : null
]);

curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$python_response_raw = curl_exec($ch);
$http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($python_response_raw === false || $http_status !== 200) {
    echo json_encode([
        'success' => false,
        'state' => 'error',
        'response' => "⚠️ Could not connect to the AI server. Please make sure the chatbot server is running on port 5050.",
        'follow_up' => null,
        'result' => null
    ]);
    exit;
}

$python_response = json_decode($python_response_raw, true);

// If Python indicates profile was collected, persist it in PHP session so subsequent chats skip asking
if (is_array($python_response) && isset($python_response['profile_collected']) && $python_response['profile_collected'] === true) {
    if (isset($python_response['profile']) && is_array($python_response['profile'])) {
        $_SESSION['chatbot_profile'] = json_encode($python_response['profile']);
        $_SESSION['chatbot_profile_collected'] = true;
    }
}

// 2. Ensure table exists
$check_table = mysqli_query($conn, "SELECT 1 FROM chatbot_logs LIMIT 1");
if (!$check_table) {
    $create_table = "CREATE TABLE IF NOT EXISTS chatbot_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        session_id VARCHAR(100) NOT NULL,
        sender ENUM('user', 'bot') NOT NULL,
        message TEXT NOT NULL,
        detected_intent VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB";
    mysqli_query($conn, $create_table);
}

// 3. Log messages to DB
// Only log if it's a real message, not a 'reset' command.
if ($user_message !== 'reset') {
    $u_id_val = ($user_id !== null) ? $user_id : "NULL";
    $s_id = mysqli_real_escape_string($conn, $session_id);
    $u_msg = mysqli_real_escape_string($conn, $user_message);

    // Log user message
    $sql_user = "INSERT INTO chatbot_logs (user_id, session_id, sender, message) VALUES ($u_id_val, '$s_id', 'user', '$u_msg')";
    mysqli_query($conn, $sql_user);

    // Determine what the bot responded with
    $b_res = "";
    $b_intent = null;
    if (isset($python_response['response']) && $python_response['response']) {
        $b_res = $python_response['response'];
        if (stripos($b_res, 'Detected symptoms:') !== false) {
            $b_intent = 'symptom_check';
        }
    } elseif (isset($python_response['follow_up']) && $python_response['follow_up']) {
        $b_res = $python_response['follow_up']['question'];
        $b_intent = 'follow_up';
    } elseif (isset($python_response['result']) && $python_response['result']) {
        $b_res = "Diagnosis: " . $python_response['result']['disease'] . " (" . $python_response['result']['confidence'] . "% confidence). " . $python_response['result']['description'];
        $b_intent = 'diagnosis';
    }

    // Log bot response
    if ($b_res) {
        $b_res_esc = mysqli_real_escape_string($conn, $b_res);
        $b_intent_sql = ($b_intent !== null) ? "'" . mysqli_real_escape_string($conn, $b_intent) . "'" : "NULL";
        $sql_bot = "INSERT INTO chatbot_logs (user_id, session_id, sender, message, detected_intent) VALUES ($u_id_val, '$s_id', 'bot', '$b_res_esc', $b_intent_sql)";
        mysqli_query($conn, $sql_bot);
    }
}

// 4. Return exact Python response back to JS
echo $python_response_raw;
?>
