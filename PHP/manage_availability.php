<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$availability_id = $data['availability_id'] ?? null;
$status = $data['status'] ?? null; // 'approved' or 'rejected'

if (!$availability_id || !$status) {
    echo json_encode(["success" => false, "message" => "Missing ID or status"]);
    exit;
}

// 1. Update availability status
$is_approved = ($status === 'approved') ? 1 : 0;
$update_query = "UPDATE doctor_availability SET status = ?, is_approved = ? WHERE availability_id = ?";
$stmt = mysqli_prepare($conn, $update_query);
mysqli_stmt_bind_param($stmt, "sii", $status, $is_approved, $availability_id);

if (mysqli_stmt_execute($stmt)) {
    if ($status === 'approved') {
        // Step 3: Trigger Slot Generation
        $avail_query = "SELECT * FROM doctor_availability WHERE availability_id = ?";
        $stmt_avail = mysqli_prepare($conn, $avail_query);
        mysqli_stmt_bind_param($stmt_avail, "i", $availability_id);
        mysqli_stmt_execute($stmt_avail);
        $avail_data = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt_avail));
        
        if ($avail_data) {
            generateSlots($conn, $avail_data);
        }
    }
    echo json_encode(["success" => true, "message" => "Schedule $status successfully"]);
} else {
    echo json_encode(["success" => false, "message" => "Database error: " . mysqli_error($conn)]);
}

/**
 * Function to generate time slots for the next 30 days
 */
function generateSlots($conn, $avail) {
    $doctor_id = $avail['doctor_id'];
    $day_name = $avail['day_of_week'];
    $start = $avail['start_time'];
    $end = $avail['end_time'];
    $duration = $avail['slot_duration'];

    for ($i = 0; $i < 30; $i++) {
        $date = date('Y-m-d', strtotime("+$i days"));
        $current_day = date('l', strtotime($date));

        if ($current_day === $day_name) {
            $current_time = strtotime($start);
            $end_time = strtotime($end);

            while ($current_time < $end_time) {
                $slot_start = date("H:i:s", $current_time);
                $current_time = strtotime("+$duration minutes", $current_time);
                if ($current_time > $end_time) break;
                $slot_end = date("H:i:s", $current_time);

                // Insert into time_slots
                $insert = "INSERT IGNORE INTO time_slots (doctor_id, slot_date, start_time, end_time, status) 
                          VALUES (?, ?, ?, ?, 'available')";
                $stmt_slot = mysqli_prepare($conn, $insert);
                mysqli_stmt_bind_param($stmt_slot, "isss", $doctor_id, $date, $slot_start, $slot_end);
                mysqli_stmt_execute($stmt_slot);
            }
        }
    }
}

mysqli_close($conn);
?>
