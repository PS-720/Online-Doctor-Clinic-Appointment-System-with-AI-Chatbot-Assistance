<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

// Set timezone for date calculations
date_default_timezone_set('Asia/Kolkata');

$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$user_id = $data['user_id'] ?? null;
if (!$user_id) {
    echo json_encode(["success" => false, "message" => "Missing user ID"]);
    exit;
}

// 1. Get Doctor ID from user ID
$doc_query = "SELECT doctor_id FROM doctors WHERE user_id = ?";
$stmt = mysqli_prepare($conn, $doc_query);
mysqli_stmt_bind_param($stmt, "i", $user_id);
mysqli_stmt_execute($stmt);
$doc_res = mysqli_stmt_get_result($stmt);
$doc = mysqli_fetch_assoc($doc_res);

if (!$doc) {
    echo json_encode(["success" => false, "message" => "Doctor record not found"]);
    exit;
}
$doctor_id = $doc['doctor_id'];

// 2. Fetch Patients List
$patients_query = "SELECT 
                    p.patient_id,
                    u.full_name,
                    u.email,
                    u.phone,
                    p.gender,
                    p.blood_group,
                    p.address,
                    p.medical_conditions,
                    CASE WHEN p.date_of_birth IS NOT NULL THEN TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) ELSE NULL END AS age
                  FROM appointments a
                  JOIN patients p ON a.patient_id = p.patient_id
                  JOIN users u ON p.user_id = u.user_id
                  WHERE a.doctor_id = ?
                  GROUP BY p.patient_id
                  ORDER BY u.full_name ASC";

$stmt = mysqli_prepare($conn, $patients_query);
mysqli_stmt_bind_param($stmt, "i", $doctor_id);
mysqli_stmt_execute($stmt);
$patients_res = mysqli_stmt_get_result($stmt);
$patients = [];

while ($row = mysqli_fetch_assoc($patients_res)) {
    $patient_id = $row['patient_id'];
    
    // Fetch visits for this patient
    $visits_query = "SELECT appointment_date, start_time, status, notes 
                    FROM appointments 
                    WHERE patient_id = ? AND doctor_id = ? 
                    ORDER BY appointment_date DESC, start_time DESC";
    $v_stmt = mysqli_prepare($conn, $visits_query);
    mysqli_stmt_bind_param($v_stmt, "ii", $patient_id, $doctor_id);
    mysqli_stmt_execute($v_stmt);
    $visits_res = mysqli_stmt_get_result($v_stmt);
    
    $visits = [];
    $total_visits = 0;
    $last_visit = null;
    $upcoming_visit = null;
    $today = date('Y-m-d');
    
    while ($v_row = mysqli_fetch_assoc($visits_res)) {
        $visits[] = $v_row;
        $total_visits++;
        
        $v_date = $v_row['appointment_date'];
        if ($v_date <= $today && !$last_visit && $v_row['status'] === 'completed') {
            $last_visit = $v_date;
        }
        if ($v_date >= $today && !$upcoming_visit && $v_row['status'] === 'confirmed') {
            $upcoming_visit = $v_date;
        }
    }
    
    // Fallback for last visit if no completed ones are found (just take latest past one)
    if (!$last_visit) {
        foreach ($visits as $v) {
            if ($v['appointment_date'] <= $today) {
                $last_visit = $v['appointment_date'];
                break;
            }
        }
    }
    
    $row['visits'] = $visits;
    $row['total_visits'] = $total_visits;
    $row['last_visit'] = $last_visit;
    $row['upcoming_visit'] = $upcoming_visit;
    
    $patients[] = $row;
}

// 3. Fetch Stats
$current_year = date('Y');
$current_month = date('m');

// Total unique patients
$total_patients = count($patients);

// Active patients this month (have appointments in current calendar month)
$active_query = "SELECT COUNT(DISTINCT patient_id) AS count 
                 FROM appointments 
                 WHERE doctor_id = ? 
                   AND YEAR(appointment_date) = ? 
                   AND MONTH(appointment_date) = ?";
$stmt = mysqli_prepare($conn, $active_query);
mysqli_stmt_bind_param($stmt, "iss", $doctor_id, $current_year, $current_month);
mysqli_stmt_execute($stmt);
$active_res = mysqli_stmt_get_result($stmt);
$active_count = mysqli_fetch_assoc($active_res)['count'] ?? 0;

// New patients this month (first ever appointment with this doctor is in current month)
$new_query = "SELECT COUNT(*) AS count FROM (
                SELECT patient_id, MIN(appointment_date) as first_visit 
                FROM appointments 
                WHERE doctor_id = ? 
                GROUP BY patient_id
             ) t 
             WHERE YEAR(first_visit) = ? AND MONTH(first_visit) = ?";
$stmt = mysqli_prepare($conn, $new_query);
mysqli_stmt_bind_param($stmt, "iss", $doctor_id, $current_year, $current_month);
mysqli_stmt_execute($stmt);
$new_res = mysqli_stmt_get_result($stmt);
$new_count = mysqli_fetch_assoc($new_res)['count'] ?? 0;

echo json_encode([
    "success" => true,
    "stats" => [
        "total_patients" => $total_patients,
        "active_patients" => $active_count,
        "new_patients" => $new_count
    ],
    "patients" => $patients
]);

mysqli_close($conn);
?>
