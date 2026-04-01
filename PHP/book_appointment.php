<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$user_id = $data['user_id'] ?? null;
$slot_id = $data['slot_id'] ?? null;
$symptoms = $data['symptoms'] ?? '';
$notes = $data['notes'] ?? '';

if (!$user_id || !$slot_id) {
    echo json_encode(["success" => false, "message" => "Missing user ID or slot selection"]);
    exit;
}

// 1. Get Patient ID from user_id
$patient_query = "SELECT patient_id FROM patients WHERE user_id = ?";
$stmt = mysqli_prepare($conn, $patient_query);
mysqli_stmt_bind_param($stmt, "i", $user_id);
mysqli_stmt_execute($stmt);
$patient = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));
$patient_id = $patient['patient_id'];

if (!$patient_id) {
    echo json_encode(["success" => false, "message" => "Patient record not found"]);
    exit;
}

// 2. Validate Slot Availability (Step 5 of workflow)
$slot_query = "SELECT status, slot_date, start_time, end_time, doctor_id FROM time_slots WHERE slot_id = ?";
$stmt = mysqli_prepare($conn, $slot_query);
mysqli_stmt_bind_param($stmt, "i", $slot_id);
mysqli_stmt_execute($stmt);
$slot = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

if (!$slot || $slot['status'] !== 'available') {
    echo json_encode(["success" => false, "message" => "This slot is no longer available"]);
    exit;
}

// 3. Perform Booking (Step 6 of workflow)
mysqli_begin_transaction($conn);

try {
    // A. Create Appointment
    $insert_appt = "INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, status, notes) 
                    VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)";
    $stmt_appt = mysqli_prepare($conn, $insert_appt);
    mysqli_stmt_bind_param($stmt_appt, "iiissss", $patient_id, $slot['doctor_id'], $slot_id, $slot['slot_date'], $slot['start_time'], $slot['end_time'], $symptoms);
    mysqli_stmt_execute($stmt_appt);
    
    // B. Mark slot as booked
    $update_slot = "UPDATE time_slots SET status = 'booked' WHERE slot_id = ?";
    $stmt_slot = mysqli_prepare($conn, $update_slot);
    mysqli_stmt_bind_param($stmt_slot, "i", $slot_id);
    mysqli_stmt_execute($stmt_slot);

    mysqli_commit($conn);
    echo json_encode(["success" => true, "message" => "Appointment booked successfully!"]);

} catch (Exception $e) {
    mysqli_rollback($conn);
    echo json_encode(["success" => false, "message" => "Booking failed: " . $e->getMessage()]);
}

mysqli_close($conn);
?>
