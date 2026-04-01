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
$day_of_week = $data['day_of_week'] ?? null;
$start_time = $data['start_time'] ?? null;
$end_time = $data['end_time'] ?? null;
$slot_duration = $data['slot_duration'] ?? 15;

if (!$doctor_id || !$day_of_week || !$start_time || !$end_time) {
    echo json_encode(["success" => false, "message" => "Missing required fields"]);
    exit;
}

// Convert times to 24h format if needed (e.g. "09:00 AM" to "09:00:00")
$start_time = date("H:i:s", strtotime($start_time));
$end_time = date("H:i:s", strtotime($end_time));

// Check for existing availability for this day
$check_query = "SELECT availability_id FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ?";
$stmt = mysqli_prepare($conn, $check_query);
mysqli_stmt_bind_param($stmt, "is", $doctor_id, $day_of_week);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

if (mysqli_num_rows($result) > 0) {
    // Update existing
    $update_query = "UPDATE doctor_availability SET start_time = ?, end_time = ?, slot_duration = ?, status = 'pending', is_approved = 0 WHERE doctor_id = ? AND day_of_week = ?";
    $stmt = mysqli_prepare($conn, $update_query);
    mysqli_stmt_bind_param($stmt, "ssiis", $start_time, $end_time, $slot_duration, $doctor_id, $day_of_week);
} else {
    // Insert new
    $insert_query = "INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration, status, is_approved) VALUES (?, ?, ?, ?, ?, 'pending', 0)";
    $stmt = mysqli_prepare($conn, $insert_query);
    mysqli_stmt_bind_param($stmt, "isssi", $doctor_id, $day_of_week, $start_time, $end_time, $slot_duration);
}

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Availability saved and pending admin approval"]);
} else {
    echo json_encode(["success" => false, "message" => "Error saving availability: " . mysqli_error($conn)]);
}

mysqli_stmt_close($stmt);
mysqli_close($conn);
?>
