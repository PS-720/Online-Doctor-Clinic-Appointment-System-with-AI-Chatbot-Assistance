<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

$doctor_id = $data['doctor_id'] ?? null;
$user_id = $data['user_id'] ?? null;

if (!$doctor_id || !$user_id) {
    echo json_encode(["success" => false, "message" => "Missing doctor or user ID"]);
    exit;
}

$full_name = mysqli_real_escape_string($conn, $data['full_name']);
$email = mysqli_real_escape_string($conn, $data['email']);
$phone = mysqli_real_escape_string($conn, $data['phone']);
$password_plain = $data['password'] ?? '';
$specialization = mysqli_real_escape_string($conn, $data['specialization']);
$experience = (int)$data['experience'];
$fee = (float)$data['fee'];
$qualification = mysqli_real_escape_string($conn, $data['license']);
$is_approved = (int)$data['is_approved'];
$location = mysqli_real_escape_string($conn, $data['location']);
$bio = mysqli_real_escape_string($conn, $data['bio']);

// Check if email already exists for a different user
$check_query = "SELECT * FROM users WHERE email = ? AND user_id != ?";
$stmt = mysqli_prepare($conn, $check_query);
mysqli_stmt_bind_param($stmt, "si", $email, $user_id);
mysqli_stmt_execute($stmt);
$check_res = mysqli_stmt_get_result($stmt);
if (mysqli_num_rows($check_res) > 0) {
    echo json_encode(["success" => false, "message" => "Email already taken by another user"]);
    exit;
}

// Start Transaction
mysqli_begin_transaction($conn);

try {
    // 1. Update Users table
    if (!empty($password_plain)) {
        $password_hash = password_hash($password_plain, PASSWORD_DEFAULT);
        $user_query = "UPDATE users SET full_name = ?, email = ?, phone = ?, password = ? WHERE user_id = ?";
        $stmt_user = mysqli_prepare($conn, $user_query);
        mysqli_stmt_bind_param($stmt_user, "ssssi", $full_name, $email, $phone, $password_hash, $user_id);
    } else {
        $user_query = "UPDATE users SET full_name = ?, email = ?, phone = ? WHERE user_id = ?";
        $stmt_user = mysqli_prepare($conn, $user_query);
        mysqli_stmt_bind_param($stmt_user, "sssi", $full_name, $email, $phone, $user_id);
    }
    
    if (!mysqli_stmt_execute($stmt_user)) {
        throw new Exception("Failed to update user account details");
    }

    // 2. Update Doctors table
    $doctor_query = "UPDATE doctors SET 
                    specialization = ?, 
                    qualification = ?, 
                    experience_years = ?, 
                    consultation_fee = ?, 
                    is_approved = ?,
                    location = ?,
                    bio = ?
                    WHERE doctor_id = ?";
    $stmt_doc = mysqli_prepare($conn, $doctor_query);
    mysqli_stmt_bind_param($stmt_doc, "ssidisii", $specialization, $qualification, $experience, $fee, $is_approved, $location, $bio, $doctor_id);
    
    if (!mysqli_stmt_execute($stmt_doc)) {
        throw new Exception("Failed to update doctor profile details");
    }

    // Commit Transaction
    mysqli_commit($conn);
    
    echo json_encode(["success" => true, "message" => "Doctor information updated successfully"]);

} catch (Exception $e) {
    // Rollback on error
    mysqli_rollback($conn);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

mysqli_close($conn);
?>
