<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['doctor_id'])) {
    echo json_encode(["success" => false, "message" => "Critical error: Missing doctor ID."]);
    exit;
}

$doctor_id = intval($data['doctor_id']);

// Update is_approved = 1 for the doctor
$query = "UPDATE doctors SET is_approved = 1 WHERE doctor_id = ?";
$stmt = mysqli_prepare($conn, $query);
mysqli_stmt_bind_param($stmt, "i", $doctor_id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Doctor approved successfully!"]);
} else {
    echo json_encode(["success" => false, "message" => "Database error: Could not approve doctor."]);
}

mysqli_stmt_close($stmt);
mysqli_close($conn);
?>
