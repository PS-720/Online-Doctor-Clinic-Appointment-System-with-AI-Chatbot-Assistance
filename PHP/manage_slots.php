<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$slot_id = $data['slot_id'] ?? null;
$action = $data['action'] ?? null; // 'block' or 'unblock'
$admin_id = $data['admin_id'] ?? null;
$reason = $data['reason'] ?? 'Admin Manual Block';

if (!$slot_id || !$action || !$admin_id) {
    echo json_encode(["success" => false, "message" => "Missing slot ID, admin ID, or action"]);
    exit;
}

// 1. Update status
$new_status = ($action === 'block') ? 'blocked' : 'available';

// 2. Check if a booked appointment exists for this slot (if blocking)
if ($action === 'block') {
    $check_query = "SELECT appointment_id FROM appointments WHERE slot_id = ? AND status = 'confirmed'";
    $stmt_check = mysqli_prepare($conn, $check_query);
    mysqli_stmt_bind_param($stmt_check, "i", $slot_id);
    mysqli_stmt_execute($stmt_check);
    $res = mysqli_stmt_get_result($stmt_check);
    
    if (mysqli_num_rows($res) > 0) {
        $appt = mysqli_fetch_assoc($res);
        // Force cancel the appointment
        mysqli_query($conn, "UPDATE appointments SET status = 'cancelled', cancel_reason = 'Admin Blocked Slot' WHERE appointment_id = " . $appt['appointment_id']);
    }
}

// 3. Update the slot
$update_query = "UPDATE time_slots SET status = ?, blocked_by = ?, block_reason = ? WHERE slot_id = ?";
$stmt = mysqli_prepare($conn, $update_query);
mysqli_stmt_bind_param($stmt, "sisi", $new_status, $admin_id, $reason, $slot_id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "message" => "Slot $action" . "ed successfully"]);
} else {
    echo json_encode(["success" => false, "message" => "Database error: " . mysqli_error($conn)]);
}

mysqli_stmt_close($stmt);
mysqli_close($conn);
?>
