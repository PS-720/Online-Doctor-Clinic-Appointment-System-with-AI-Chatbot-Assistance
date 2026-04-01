<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$user_id = $data['user_id'] ?? null;
$current_password = $data['current_password'] ?? '';
$new_password = $data['new_password'] ?? '';

if (!$user_id || !$current_password || !$new_password) {
    echo json_encode(["success" => false, "message" => "All fields are required"]);
    exit;
}

// 1. Fetch current password from DB
$query = "SELECT password FROM users WHERE user_id = ?";
$stmt = mysqli_prepare($conn, $query);
mysqli_stmt_bind_param($stmt, "i", $user_id);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($result);

if (!$user) {
    echo json_encode(["success" => false, "message" => "User not found"]);
    exit;
}

// 2. Verify current password
// Note: If the DB currently stores plain text (bad practice), verify accordingly.
// But we expect hashed passwords for security.
if (!password_verify($current_password, $user['password'])) {
    // Check if it's a plain text match (only for legacy transition if needed)
    if ($current_password !== $user['password']) {
        echo json_encode(["success" => false, "message" => "Incorrect current password"]);
        exit;
    }
}

// 3. Hash and Update new password
$hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
$update_query = "UPDATE users SET password = ? WHERE user_id = ?";
$update_stmt = mysqli_prepare($conn, $update_query);
mysqli_stmt_bind_param($update_stmt, "si", $hashed_password, $user_id);

if (mysqli_stmt_execute($update_stmt)) {
    echo json_encode(["success" => true, "message" => "Password updated successfully!"]);
} else {
    echo json_encode(["success" => false, "message" => "Database error: " . mysqli_error($conn)]);
}

mysqli_close($conn);
?>
