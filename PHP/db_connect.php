<?php

// Database Connection - SmartCare

$host = "localhost";
$username = "root";       
$password = "";          
$database = "smartcare_db";

// Create connection
$conn = mysqli_connect($host, $username, $password, $database);

// Check connection
if (!$conn) {
    die(json_encode([
        "success" => false,
        "message" => "Database connection failed: " . mysqli_connect_error()
    ]));
}

// Set charset to handle special characters
mysqli_set_charset($conn, "utf8mb4");
?>
