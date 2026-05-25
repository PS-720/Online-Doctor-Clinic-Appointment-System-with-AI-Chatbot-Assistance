<?php
// Fetch unique chat sessions for the logged in user
error_reporting(0);
header('Content-Type: application/json');
session_start();

$db_path = 'db_connect.php';
if (!file_exists($db_path)) {
    echo json_encode(['success' => false, 'message' => "Database configuration file missing."]);
    exit;
}
require_once $db_path;

// Try to use logged-in user, otherwise use session_id from JS
$input = json_decode(file_get_contents('php://input'), true);
$js_session_id = isset($input['session_id']) ? mysqli_real_escape_string($conn, $input['session_id']) : '';
$user_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;

// Get the specific session's messages if a specific session is requested
$fetch_session = isset($input['fetch_session']) ? mysqli_real_escape_string($conn, $input['fetch_session']) : '';

if ($fetch_session) {
    // Fetch messages for a specific session
    $where = "session_id = '$fetch_session'";
    if ($user_id !== null) {
        $where .= " AND (user_id = $user_id OR user_id IS NULL)";
    }
    
    $query = "SELECT sender, message, created_at FROM chatbot_logs WHERE $where ORDER BY log_id ASC";
    $result = mysqli_query($conn, $query);
    
    $messages = [];
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $messages[] = [
                'sender' => $row['sender'],
                'message' => $row['message'],
                'created_at' => $row['created_at']
            ];
        }
    }
    echo json_encode(['success' => true, 'messages' => $messages]);
    exit;
}

// Otherwise, fetch list of recent sessions
$where = "1=1";
if ($user_id !== null) {
    $where = "user_id = $user_id";
} else if ($js_session_id) {
    $where = "session_id = '$js_session_id'";
} else {
    echo json_encode(['success' => true, 'sessions' => []]);
    exit;
}

// Group by session_id, get the first user message as title, and the latest message time
$query = "
    SELECT 
        session_id, 
        MIN(created_at) as started_at,
        MAX(created_at) as last_updated,
        (SELECT message FROM chatbot_logs c2 WHERE c2.session_id = c.session_id AND c2.sender = 'user' ORDER BY log_id ASC LIMIT 1) as title
    FROM chatbot_logs c
    WHERE $where
    GROUP BY session_id
    ORDER BY last_updated DESC
    LIMIT 20
";

$result = mysqli_query($conn, $query);
$sessions = [];
if ($result) {
    while ($row = mysqli_fetch_assoc($result)) {
        // If there's no user message (e.g. only bot welcome), title will be null
        if (!$row['title']) {
            $row['title'] = "New Chat";
        } else {
            // Truncate title to ~30 chars
            $row['title'] = strlen($row['title']) > 30 ? substr($row['title'], 0, 27) . "..." : $row['title'];
        }
        $sessions[] = $row;
    }
}

echo json_encode(['success' => true, 'sessions' => $sessions]);
?>
