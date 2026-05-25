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

// Group by session_id and pick a session title from bot-derived health text only.
// Prefer a diagnosis, then a symptom summary. Never use the person's name as the title.
$query = "
    SELECT
        session_id,
        MIN(created_at) as started_at,
        MAX(created_at) as last_updated,
        COALESCE(
            (SELECT message FROM chatbot_logs c2 WHERE c2.session_id = c.session_id AND c2.sender = 'bot' AND c2.detected_intent = 'diagnosis' ORDER BY log_id DESC LIMIT 1),
            (SELECT message FROM chatbot_logs c2 WHERE c2.session_id = c.session_id AND c2.sender = 'bot' AND c2.detected_intent = 'symptom_check' ORDER BY log_id DESC LIMIT 1),
            (SELECT message FROM chatbot_logs c2 WHERE c2.session_id = c.session_id AND c2.sender = 'bot' AND c2.message LIKE 'Diagnosis:%' ORDER BY log_id DESC LIMIT 1),
            (SELECT message FROM chatbot_logs c2 WHERE c2.session_id = c.session_id AND c2.sender = 'bot' AND c2.message LIKE '%Detected symptoms:%' ORDER BY log_id DESC LIMIT 1),
            'New Chat'
        ) as title
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
        $title = $row['title'] ?? '';

        // Remove common bot prefixes to keep the session title concise
        if (stripos($title, 'Diagnosis:') === 0) {
            $title = trim(substr($title, strlen('Diagnosis:')));
        }
        if (preg_match('/Detected symptoms:\s*/i', $title)) {
            $title = preg_replace('/^.*Detected symptoms:\s*/i', '', $title);
        }

        // If the title is still a long sentence, shorten it to the actual health topic
        $title = preg_replace('/^✅\s*/u', '', $title);
        $title = preg_replace('/\s*👉.*$/u', '', $title);

        // Sanitize -- remove newlines and collapse whitespace
        $title = preg_replace('/\s+/', ' ', trim($title));

        if ($title === '') $title = 'New Chat';

        // Truncate title to ~40 chars for display
        if (mb_strlen($title) > 40) {
            $title = mb_substr($title, 0, 37) . '...';
        }

        $row['title'] = $title;
        $sessions[] = $row;
    }
}

echo json_encode(['success' => true, 'sessions' => $sessions]);
?>
