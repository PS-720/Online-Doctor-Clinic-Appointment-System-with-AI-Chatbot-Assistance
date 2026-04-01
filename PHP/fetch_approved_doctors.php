<?php
/**
 * PHP/fetch_approved_doctors.php
 * Fetches the list of all active/approved doctors for the patient booking form.
 */
header('Content-Type: application/json');
require_once 'db_connect.php';

$query = "SELECT d.doctor_id, u.full_name, d.specialization 
          FROM doctors d
          JOIN users u ON d.user_id = u.user_id
          WHERE u.role = 'doctor'"; // Can add status = 'active' if you have that column

$result = mysqli_query($conn, $query);

if ($result) {
    $doctors = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $doctors[] = $row;
    }
    echo json_encode(["success" => true, "doctors" => $doctors]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to fetch doctors"]);
}

mysqli_close($conn);
?>
