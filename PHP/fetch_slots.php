<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

// Get POST data
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$doctor_id = $data['doctor_id'] ?? null;
$date = $data['date'] ?? date('Y-m-d');

if (!$doctor_id) {
    echo json_encode(["success" => false, "message" => "Missing doctor ID"]);
    exit;
}

// Fetch slots
$query = "SELECT ts.*, u_p.full_name as patient_name FROM time_slots ts 
          LEFT JOIN appointments a ON ts.slot_id = a.slot_id AND a.status = 'confirmed'
          LEFT JOIN patients p ON a.patient_id = p.patient_id
          LEFT JOIN users u_p ON p.user_id = u_p.user_id
          WHERE ts.doctor_id = ? AND ts.slot_date = ?
          ORDER BY ts.start_time ASC";

$stmt = mysqli_prepare($conn, $query);
mysqli_stmt_bind_param($stmt, "is", $doctor_id, $date);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);

$slots = [];
while ($row = mysqli_fetch_assoc($res)) {
    $slots[] = $row;
}

echo json_encode(["success" => true, "slots" => $slots]);
mysqli_close($conn);
?>
