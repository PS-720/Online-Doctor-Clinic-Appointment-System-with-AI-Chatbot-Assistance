<?php
// Delete a specific chat session for the logged in user
error_reporting(0);
header('Content-Type: application/json');
session_start();

$db_path = 'db_connect.php';
if (!file_exists($db_path)) {
    echo json_encode(['success' => false, 'message' => "Database configuration file missing."]);
    exit;
}
require_once $db_path;

$input = json_decode(file_get_contents('php://input'), true);
$session_id = isset($input['session_id']) ? mysqli_real_escape_string($conn, $input['session_id']) : '';
$user_id = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;

if (!$session_id) {
    echo json_encode(['success' => false, 'message' => "Session ID missing."]);
    exit;
}

// Ensure the user can only delete their own session, or an unassigned session if they are logged out.
$where = "session_id = '$session_id'";
if ($user_id !== null) {
    $where .= " AND (user_id = $user_id OR user_id IS NULL)";
}

$query = "DELETE FROM chatbot_logs WHERE $where";
$result = mysqli_query($conn, $query);

if ($result) {
    echo json_encode(['success' => true, 'message' => 'Session deleted successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to delete session.']);
}
?>
