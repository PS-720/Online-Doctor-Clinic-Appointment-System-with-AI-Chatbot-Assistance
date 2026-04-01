<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$appointment_id = $data['appointment_id'] ?? null;
$status = $data['status'] ?? null; // 'confirmed', 'cancelled', 'completed', 'no_show'
$reason = $data['reason'] ?? null;

if (!$appointment_id || !$status) {
    echo json_encode(["success" => false, "message" => "Missing ID or status"]);
    exit;
}

// 1. Get Appointment and Slot info
$query = "SELECT slot_id, status as current_status FROM appointments WHERE appointment_id = ?";
$stmt = mysqli_prepare($conn, $query);
mysqli_stmt_bind_param($stmt, "i", $appointment_id);
mysqli_stmt_execute($stmt);
$appt = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

if (!$appt) {
    echo json_encode(["success" => false, "message" => "Appointment not found"]);
    exit;
}

mysqli_begin_transaction($conn);

try {
    // 2. Update Appointment Status
    $update_appt = "UPDATE appointments SET status = ?, cancel_reason = ? WHERE appointment_id = ?";
    $stmt_appt = mysqli_prepare($conn, $update_appt);
    mysqli_stmt_bind_param($stmt_appt, "ssi", $status, $reason, $appointment_id);
    mysqli_stmt_execute($stmt_appt);

    // 3. Update Slot Status based on appointment transition
    $slot_id = $appt['slot_id'];
    $new_slot_status = 'available'; // Default if cancelled
    
    if ($status === 'completed') {
        $new_slot_status = 'completed';
    } elseif ($status === 'confirmed') {
        $new_slot_status = 'booked';
    }

    $update_slot = "UPDATE time_slots SET status = ? WHERE slot_id = ?";
    $stmt_slot = mysqli_prepare($conn, $update_slot);
    mysqli_stmt_bind_param($stmt_slot, "si", $new_slot_status, $slot_id);
    mysqli_stmt_execute($stmt_slot);

    mysqli_commit($conn);
    echo json_encode(["success" => true, "message" => "Appointment marked as $status"]);

} catch (Exception $e) {
    mysqli_rollback($conn);
    echo json_encode(["success" => false, "message" => "Transaction failed: " . $e->getMessage()]);
}

mysqli_close($conn);
?>
