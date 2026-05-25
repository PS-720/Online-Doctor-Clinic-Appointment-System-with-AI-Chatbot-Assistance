<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$user_id = $data['user_id'] ?? null;

if (!$user_id) {
    echo json_encode(["success" => false, "message" => "Missing user ID"]);
    exit;
}

// Start Transaction
mysqli_begin_transaction($conn);

try {
    $delete_query = "DELETE FROM users WHERE user_id = ?";
    $stmt = mysqli_prepare($conn, $delete_query);
    mysqli_stmt_bind_param($stmt, "i", $user_id);
    
    if (!mysqli_stmt_execute($stmt)) {
        throw new Exception("Failed to delete user account");
    }

    mysqli_commit($conn);
    echo json_encode(["success" => true, "message" => "Doctor deleted successfully"]);
} catch (Exception $e) {
    mysqli_rollback($conn);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

mysqli_close($conn);
?>
