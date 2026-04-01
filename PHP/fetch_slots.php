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

// 1. Check if slots exist
$check_query = "SELECT COUNT(*) as count FROM time_slots WHERE doctor_id = ? AND slot_date = ?";
$stmt = mysqli_prepare($conn, $check_query);
mysqli_stmt_bind_param($stmt, "is", $doctor_id, $date);
mysqli_stmt_execute($stmt);
$count = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt))['count'];

if ($count == 0) {
    // 2. Generate slots if availability exists
    $day_of_week = date('l', strtotime($date));
    $avail_query = "SELECT * FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ? AND is_approved = 1 AND status = 'approved'";
    $stmt = mysqli_prepare($conn, $avail_query);
    mysqli_stmt_bind_param($stmt, "is", $doctor_id, $day_of_week);
    mysqli_stmt_execute($stmt);
    $avail = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

    if ($avail) {
        $start = strtotime($avail['start_time']);
        $end = strtotime($avail['end_time']);
        $duration = $avail['slot_duration'] * 60; // Convert to seconds

        for ($t = $start; $t < $end; $t += $duration) {
            $slot_start = date("H:i:s", $t);
            $slot_end = date("H:i:s", $t + $duration);
            
            $insert = "INSERT INTO time_slots (doctor_id, slot_date, start_time, end_time, status) VALUES (?, ?, ?, ?, 'available')";
            $ins_stmt = mysqli_prepare($conn, $insert);
            mysqli_stmt_bind_param($ins_stmt, "isss", $doctor_id, $date, $slot_start, $slot_end);
            mysqli_stmt_execute($ins_stmt);
        }
    }
}

// 3. Fetch all slots (now populated)
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
