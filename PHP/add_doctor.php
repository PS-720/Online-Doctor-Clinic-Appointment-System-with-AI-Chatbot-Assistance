<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

// Get POST data
$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$full_name = mysqli_real_escape_string($conn, $data['full_name']);
$email = mysqli_real_escape_string($conn, $data['email']);
$phone = mysqli_real_escape_string($conn, $data['phone'] ?? '0000000000'); // Added default phone
$password = password_hash($data['password'], PASSWORD_DEFAULT);
$specialization = mysqli_real_escape_string($conn, $data['specialization']);
$experience = (int)$data['experience'];
$fee = (float)$data['fee'];
$qualification = mysqli_real_escape_string($conn, $data['license']); // Mapping 'license' from form to 'qualification'

// Check if email already exists
$check_query = "SELECT * FROM users WHERE email = '$email'";
$check_res = mysqli_query($conn, $check_query);
if (mysqli_num_rows($check_res) > 0) {
    echo json_encode(["success" => false, "message" => "Email already registered"]);
    exit;
}

// Start Transaction
mysqli_begin_transaction($conn);

try {
    // 1. Insert into Users table
    $user_query = "INSERT INTO users (full_name, email, phone, password, role) VALUES (?, ?, ?, ?, 'doctor')";
    $stmt = mysqli_prepare($conn, $user_query);
    mysqli_stmt_bind_param($stmt, "ssss", $full_name, $email, $phone, $password);
    
    if (!mysqli_stmt_execute($stmt)) {
        throw new Exception("Failed to create user account");
    }
    
    $user_id = mysqli_insert_id($conn);

    // 2. Insert into Doctors table (Set is_approved = 1 since admin is adding)
    $doctor_query = "INSERT INTO doctors (user_id, specialization, qualification, experience_years, consultation_fee, is_approved) VALUES (?, ?, ?, ?, ?, 1)";
    $stmt2 = mysqli_prepare($conn, $doctor_query);
    mysqli_stmt_bind_param($stmt2, "issid", $user_id, $specialization, $qualification, $experience, $fee);
    
    if (!mysqli_stmt_execute($stmt2)) {
        throw new Exception("Failed to create doctor profile");
    }

    // Commit Transaction
    mysqli_commit($conn);
    
    echo json_encode(["success" => true, "message" => "Doctor registered successfully"]);

} catch (Exception $e) {
    // Rollback on error
    mysqli_rollback($conn);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

mysqli_close($conn);
?>
