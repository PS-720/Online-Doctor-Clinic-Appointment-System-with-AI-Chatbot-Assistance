<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$patient_id = $data['patient_id'] ?? null;
$conditions = $data['medical_conditions'] ?? '';

if (!$patient_id) {
    echo json_encode(["success" => false, "message" => "Missing patient ID"]);
    exit;
}

$query = "UPDATE patients SET medical_conditions = ? WHERE patient_id = ?";
$stmt = mysqli_prepare($conn, $query);
mysqli_stmt_bind_param($stmt, "si", $conditions, $patient_id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Conditions updated successfully"]);
} else {
    echo json_encode(["success" => false, "message" => "Update failed: " . mysqli_error($conn)]);
}

mysqli_close($conn);
?>
