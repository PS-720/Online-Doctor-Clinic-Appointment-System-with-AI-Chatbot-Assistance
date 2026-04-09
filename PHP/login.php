<?php

// Auto-detects user role from database

session_start();
header('Content-Type: application/json');
require_once 'db_connect.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Invalid request method"]);
    exit;
}

// Get form data
$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

// ---- Validation ----

if (empty($email) || empty($password)) {
    echo json_encode(["success" => false, "message" => "Email and password are required"]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => false, "message" => "Invalid email format"]);
    exit;
}

// Fetch user by email only (role is auto-detected)
$stmt = mysqli_prepare($conn, "SELECT user_id, full_name, email, password, role, is_active FROM users WHERE email = ?");
mysqli_stmt_bind_param($stmt, "s", $email);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

if (mysqli_num_rows($result) === 0) {
    echo json_encode(["success" => false, "message" => "No account found with this email"]);
    mysqli_stmt_close($stmt);
    exit;
}

$user = mysqli_fetch_assoc($result);

// Check if account is active
if ($user['is_active'] == 0) {
    echo json_encode(["success" => false, "message" => "Your account has been deactivated. Contact admin."]);
    mysqli_stmt_close($stmt);
    exit;
}

// Verify password
if (!password_verify($password, $user['password'])) {
    echo json_encode(["success" => false, "message" => "Incorrect password"]);
    mysqli_stmt_close($stmt);
    exit;
}

// If doctor, check admin approval
if ($user['role'] === 'doctor') {
    $docStmt = mysqli_prepare($conn, "SELECT is_approved FROM doctors WHERE user_id = ?");
    mysqli_stmt_bind_param($docStmt, "i", $user['user_id']);
    mysqli_stmt_execute($docStmt);
    $docResult = mysqli_stmt_get_result($docStmt);
    $doctor = mysqli_fetch_assoc($docResult);
    mysqli_stmt_close($docStmt);

    if ($doctor && $doctor['is_approved'] == 0) {
        echo json_encode(["success" => false, "message" => "Your doctor account is pending admin approval."]);
        mysqli_stmt_close($stmt);
        exit;
    }
}

// ---- Login Successful ----

// Set session variables
$_SESSION['user_id']   = $user['user_id'];
$_SESSION['full_name'] = $user['full_name'];
$_SESSION['email']     = $user['email'];
$_SESSION['role']      = $user['role'];
$_SESSION['logged_in'] = true;

// Determine redirect page based on role (auto-detected)
$redirectPage = '';
switch ($user['role']) {
    case 'patient':
        $redirectPage = '../HTML/patientDashboard.html';
        break;
    case 'doctor':
        $redirectPage = '../HTML/doctorDashboard.html';
        break;
    case 'admin':
        $redirectPage = '../HTML/adminDashboard.html';
        break;
}

echo json_encode([
    "success"  => true,
    "message"  => "Welcome back, " . $user['full_name'] . "!",
    "redirect" => $redirectPage,
    "user"     => [
        "id"        => $user['user_id'],
        "full_name" => $user['full_name'],
        "email"     => $user['email'],
        "role"      => $user['role']
    ]
]);

mysqli_stmt_close($stmt);
mysqli_close($conn);
?>
