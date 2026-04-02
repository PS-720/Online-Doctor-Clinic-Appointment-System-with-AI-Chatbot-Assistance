<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

// Get POST data (user_id and role)
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$user_id = $data['user_id'] ?? null;
$role = $data['role'] ?? null;

if (!$user_id || !$role) {
    echo json_encode(["success" => false, "message" => "Missing user ID or role"]);
    exit;
}

$response = ["success" => true, "data" => []];
if ($role === 'doctor') {
    // 1. Get Full Doctor Profile
    $doctor_query = "SELECT d.*, u.full_name, u.email, u.phone 
                    FROM doctors d 
                    JOIN users u ON d.user_id = u.user_id 
                    WHERE d.user_id = ?";
    $stmt = mysqli_prepare($conn, $doctor_query);
    mysqli_stmt_bind_param($stmt, "i", $user_id);
    mysqli_stmt_execute($stmt);
    $doc_result = mysqli_stmt_get_result($stmt);
    $doctor = mysqli_fetch_assoc($doc_result);

    if (!$doctor) {
        echo json_encode(["success" => false, "message" => "Doctor record not found"]);
        exit;
    }
    $doctor_id = $doctor['doctor_id'];

    // 2. Fetch Dashboard Stats
    $stats = [];
    $today = date('Y-m-d');
    
    // Today's appointments count
    $today_count_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $doctor_id AND appointment_date = '$today' AND status = 'confirmed'");
    $stats['today_appointments'] = mysqli_fetch_assoc($today_count_res)['count'];

    // Completed count
    $completed_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $doctor_id AND status = 'completed'");
    $stats['completed'] = mysqli_fetch_assoc($completed_res)['count'];

    // Cancelled count
    $cancelled_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $doctor_id AND status = 'cancelled'");
    $stats['cancelled'] = mysqli_fetch_assoc($cancelled_res)['count'];

    // 3. Fetch Availability
    $avail_query = "SELECT * FROM doctor_availability WHERE doctor_id = ?";
    $stmt = mysqli_prepare($conn, $avail_query);
    mysqli_stmt_bind_param($stmt, "i", $doctor_id);
    mysqli_stmt_execute($stmt);
    $avail_res = mysqli_stmt_get_result($stmt);
    $availability = [];
    while ($row = mysqli_fetch_assoc($avail_res)) {
        $availability[] = $row;
    }

    // 4. Fetch Upcoming Appointments
    $appts_query = "SELECT a.*, u.full_name as patient_name FROM appointments a 
                  JOIN patients p ON a.patient_id = p.patient_id 
                  JOIN users u ON p.user_id = u.user_id 
                  WHERE a.doctor_id = ? AND a.appointment_date >= ? AND a.status = 'confirmed' 
                  ORDER BY a.appointment_date ASC, a.start_time ASC";
    $stmt = mysqli_prepare($conn, $appts_query);
    mysqli_stmt_bind_param($stmt, "is", $doctor_id, $today);
    mysqli_stmt_execute($stmt);
    $appts_res = mysqli_stmt_get_result($stmt);
    $upcoming = [];
    while ($row = mysqli_fetch_assoc($appts_res)) {
        $upcoming[] = $row;
    }

    $response['data'] = [
        "stats" => $stats,
        "availability" => $availability,
        "upcoming" => $upcoming,
        "profile" => $doctor
    ];

} elseif ($role === 'admin') {
    // 1. Fetch System Stats
    $stats = [];
    
    // Helper function for counts
    function getCount($conn, $query) {
        $res = mysqli_query($conn, $query);
        if (!$res) return 0;
        $row = mysqli_fetch_assoc($res);
        return $row ? $row['count'] : 0;
    }

    $stats['total_doctors'] = getCount($conn, "SELECT COUNT(*) as count FROM doctors");
    $stats['active_doctors'] = getCount($conn, "SELECT COUNT(*) as count FROM doctors WHERE is_approved = 1");
    $stats['pending_doctors'] = getCount($conn, "SELECT COUNT(*) as count FROM doctors WHERE is_approved = 0");
    $stats['total_users'] = getCount($conn, "SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
    $stats['total_appointments'] = getCount($conn, "SELECT COUNT(*) as count FROM appointments");
    
    $confirmed_count = getCount($conn, "SELECT COUNT(*) as count FROM appointments WHERE status = 'confirmed'");
    $stats['approval_rate'] = $stats['total_appointments'] > 0 ? round(($confirmed_count / $stats['total_appointments']) * 100) : 0;

    // 2. Fetch Pending Availability Requests
    $pending_avail_query = "SELECT da.*, u.full_name as doctor_name FROM doctor_availability da 
                          JOIN doctors d ON da.doctor_id = d.doctor_id 
                          JOIN users u ON d.user_id = u.user_id 
                          WHERE da.status = 'pending'";
    $pending_res = mysqli_query($conn, $pending_avail_query);
    $pending_approvals = [];
    if ($pending_res) {
        while ($row = mysqli_fetch_assoc($pending_res)) {
            $pending_approvals[] = $row;
        }
    }

    // 3. Recent Appointments for monitoring
    $recent_appts_query = "SELECT a.*, u_p.full_name as patient_name, u_d.full_name as doctor_name FROM appointments a 
                          JOIN patients p ON a.patient_id = p.patient_id JOIN users u_p ON p.user_id = u_p.user_id
                          JOIN doctors d ON a.doctor_id = d.doctor_id JOIN users u_d ON d.user_id = u_d.user_id
                          ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 5";
    $recent_res = mysqli_query($conn, $recent_appts_query);
    $recent_appts = [];
    if ($recent_res) {
        while ($row = mysqli_fetch_assoc($recent_res)) {
            $recent_appts[] = $row;
        }
    }

    // 4. All Doctors for Management
    $all_doctors_query = "SELECT d.*, u.full_name, u.email FROM doctors d JOIN users u ON d.user_id = u.user_id";
    $all_doctors_res = mysqli_query($conn, $all_doctors_query);
    $all_doctors = [];
    if ($all_doctors_res) {
        while ($row = mysqli_fetch_assoc($all_doctors_res)) {
            $all_doctors[] = $row;
        }
    }

    // 5. All Appointments for Management
    $all_appts_query = "SELECT a.*, u_p.full_name as patient_name, u_d.full_name as doctor_name, d.specialization FROM appointments a 
                       JOIN patients p ON a.patient_id = p.patient_id JOIN users u_p ON p.user_id = u_p.user_id
                       JOIN doctors d ON a.doctor_id = d.doctor_id JOIN users u_d ON d.user_id = u_d.user_id
                       ORDER BY a.appointment_date DESC, a.start_time DESC";
    $all_appts_res = mysqli_query($conn, $all_appts_query);
    $all_appts = [];
    if ($all_appts_res) {
        while ($row = mysqli_fetch_assoc($all_appts_res)) {
            $all_appts[] = $row;
        }
    }

    error_log("Admin dashboard accessed by user ID: " . $user_id);

    $response['data'] = [
        "stats" => $stats,
        "pending_approvals" => $pending_approvals,
        "recent_appointments" => $recent_appts,
        "all_doctors" => $all_doctors,
        "all_appointments" => $all_appts
    ];
} elseif ($role === 'patient') {
    $patient_query = "SELECT patient_id FROM patients WHERE user_id = ?";
    $stmt = mysqli_prepare($conn, $patient_query);
    mysqli_stmt_bind_param($stmt, "i", $user_id);
    mysqli_stmt_execute($stmt);
    $pat_result = mysqli_stmt_get_result($stmt);
    $patient = mysqli_fetch_assoc($pat_result);
    $patient_id = $patient['patient_id'] ?? null;

    if (!$patient_id) {
        echo json_encode(["success" => false, "message" => "Patient record not found. Please log in again."]);
        exit;
    }

    // 2. Fetch Dashboard Stats
    $stats = [];
    $today = date('Y-m-d');
    
    // Total visits (confirmed + completed)
    $total_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE patient_id = $patient_id AND status IN ('confirmed', 'completed')");
    $stats['total_appointments'] = mysqli_fetch_assoc($total_res)['count'] ?? 0;

    // Upcoming visits count
    $upcoming_count_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE patient_id = $patient_id AND appointment_date >= '$today' AND status = 'confirmed'");
    $stats['upcoming_visits'] = mysqli_fetch_assoc($upcoming_count_res)['count'] ?? 0;

    // Table Stats
    $approved_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE patient_id = $patient_id AND status = 'confirmed'");
    $stats['approved'] = mysqli_fetch_assoc($approved_res)['count'] ?? 0;

    $stats['pending'] = 0; // Not used in currently supported enum statuses

    $rejected_res = mysqli_query($conn, "SELECT COUNT(*) as count FROM appointments WHERE patient_id = $patient_id AND status = 'cancelled'");
    $stats['rejected'] = mysqli_fetch_assoc($rejected_res)['count'] ?? 0;

    // 3. Fetch Full Appointment History
    $history_query = "SELECT a.*, u_d.full_name as doctor_name, d.specialization FROM appointments a 
                    JOIN doctors d ON a.doctor_id = d.doctor_id 
                    JOIN users u_d ON d.user_id = u_d.user_id 
                    WHERE a.patient_id = ? 
                    ORDER BY a.appointment_date DESC, a.start_time DESC";
    $stmt = mysqli_prepare($conn, $history_query);
    mysqli_stmt_bind_param($stmt, "i", $patient_id);
    mysqli_stmt_execute($stmt);
    $history_res = mysqli_stmt_get_result($stmt);
    $history = [];
    while ($row = mysqli_fetch_assoc($history_res)) {
        $history[] = $row;
    }

    $response['data'] = [
        "stats" => $stats,
        "history" => $history
    ];
}

echo json_encode($response);
mysqli_close($conn);
?>
