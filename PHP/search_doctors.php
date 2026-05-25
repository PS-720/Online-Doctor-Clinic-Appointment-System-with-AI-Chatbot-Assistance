<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
    echo json_encode(["success" => false, "message" => "No search criteria provided"]);
    exit;
}

$locality = isset($data['locality']) ? trim($data['locality']) : '';
$specialization = isset($data['specialization']) ? trim($data['specialization']) : '';

$query = "SELECT d.doctor_id, u.full_name, u.email, u.phone, d.specialization, d.qualification, d.experience_years, d.consultation_fee, d.location, d.address, d.bio 
          FROM doctors d
          JOIN users u ON d.user_id = u.user_id
          WHERE d.is_approved = 1";

$params = [];
$types = "";

if ($locality !== '') {
    $query .= " AND (d.location LIKE ? OR d.address LIKE ?)";
    $loc_param = "%" . $locality . "%";
    $params[] = $loc_param;
    $params[] = $loc_param;
    $types .= "ss";
}

if ($specialization !== '') {
    $query .= " AND d.specialization = ?";
    $params[] = $specialization;
    $types .= "s";
}

$query .= " ORDER BY u.full_name ASC";

$stmt = mysqli_prepare($conn, $query);

if (count($params) > 0) {
    mysqli_stmt_bind_param($stmt, $types, ...$params);
}

if (mysqli_stmt_execute($stmt)) {
    $result = mysqli_stmt_get_result($stmt);
    $doctors = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $doctors[] = $row;
    }
    echo json_encode(["success" => true, "doctors" => $doctors]);
} else {
    echo json_encode(["success" => false, "message" => "Search failed: " . mysqli_error($conn)]);
}

mysqli_close($conn);
?>
