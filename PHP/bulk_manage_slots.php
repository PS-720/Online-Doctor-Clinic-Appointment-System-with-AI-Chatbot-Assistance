<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$doctor_id = $data['doctor_id'] ?? null;
$date = $data['date'] ?? null;
$action = $data['action'] ?? null; // 'block_all', 'unblock_all', 'emergency_only'
$admin_id = $data['admin_id'] ?? null;

if (!$doctor_id || !$date || !$action || !$admin_id) {
    echo json_encode(["success" => false, "message" => "Missing required fields"]);
    exit;
}

mysqli_begin_transaction($conn);

try {
    if ($action === 'block_all') {
        // Block all available slots
        $query = "UPDATE time_slots SET status = 'blocked', blocked_by = ?, block_reason = 'Admin Bulk Block' 
                  WHERE doctor_id = ? AND slot_date = ? AND status = 'available'";
        $stmt = mysqli_prepare($conn, $query);
        mysqli_stmt_bind_param($stmt, "iis", $admin_id, $doctor_id, $date);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);

        mysqli_commit($conn);
        echo json_encode(["success" => true, "message" => "All remaining slots blocked successfully"]);

    } elseif ($action === 'unblock_all') {
        // Unblock all blocked slots
        $query = "UPDATE time_slots SET status = 'available', blocked_by = NULL, block_reason = NULL 
                  WHERE doctor_id = ? AND slot_date = ? AND status = 'blocked'";
        $stmt = mysqli_prepare($conn, $query);
        mysqli_stmt_bind_param($stmt, "is", $doctor_id, $date);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);

        mysqli_commit($conn);
        echo json_encode(["success" => true, "message" => "All blocked slots unblocked successfully"]);

    } elseif ($action === 'emergency_only') {
        // Mark as Emergency Only: block all slots and cancel all booked appointments
        
        // 1. Get all booked slot IDs for this doctor and date
        $find_booked_query = "SELECT slot_id FROM time_slots WHERE doctor_id = ? AND slot_date = ? AND status = 'booked'";
        $stmt_find = mysqli_prepare($conn, $find_booked_query);
        mysqli_stmt_bind_param($stmt_find, "is", $doctor_id, $date);
        mysqli_stmt_execute($stmt_find);
        $res = mysqli_stmt_get_result($stmt_find);
        
        $booked_slot_ids = [];
        while ($row = mysqli_fetch_assoc($res)) {
            $booked_slot_ids[] = (int)$row['slot_id'];
        }
        mysqli_stmt_close($stmt_find);

        if (!empty($booked_slot_ids)) {
            // 2. Cancel appointments for these slots
            $placeholders = implode(',', array_fill(0, count($booked_slot_ids), '?'));
            $cancel_query = "UPDATE appointments SET status = 'cancelled', cancel_reason = 'Emergency Cancelled by Admin' 
                             WHERE slot_id IN ($placeholders) AND status = 'confirmed'";
            $stmt_cancel = mysqli_prepare($conn, $cancel_query);
            
            // Bind params dynamically
            $types = str_repeat('i', count($booked_slot_ids));
            mysqli_stmt_bind_param($stmt_cancel, $types, ...$booked_slot_ids);
            mysqli_stmt_execute($stmt_cancel);
            mysqli_stmt_close($stmt_cancel);
        }

        // 3. Block all slots for this doctor and date
        $block_all_query = "UPDATE time_slots SET status = 'blocked', blocked_by = ?, block_reason = 'Emergency Only' 
                            WHERE doctor_id = ? AND slot_date = ? AND status != 'completed'";
        $stmt_block = mysqli_prepare($conn, $block_all_query);
        mysqli_stmt_bind_param($stmt_block, "iis", $admin_id, $doctor_id, $date);
        mysqli_stmt_execute($stmt_block);
        mysqli_stmt_close($stmt_block);

        mysqli_commit($conn);
        echo json_encode(["success" => true, "message" => "All slots marked as Emergency Only and active bookings cancelled"]);
    } else {
        throw new Exception("Invalid bulk action");
    }

} catch (Exception $e) {
    mysqli_rollback($conn);
    echo json_encode(["success" => false, "message" => "Bulk action failed: " . $e->getMessage()]);
}

mysqli_close($conn);
?>
