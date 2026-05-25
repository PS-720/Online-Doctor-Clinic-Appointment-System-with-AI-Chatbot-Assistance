<?php
// SmartCare | AI Chatbot Backend (Improved for local setup)
// ========================================================
error_reporting(0); // Prevent warnings from breaking JSON response
header('Content-Type: application/json');

// Include DB connection
$db_path = 'db_connect.php';
if (!file_exists($db_path)) {
    echo json_encode(['success' => false, 'message' => "Database configuration file missing."]);
    exit;
}
require_once $db_path;

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$user_message = isset($input['message']) ? trim($input['message']) : '';
$user_id = isset($input['user_id']) && $input['user_id'] ? intval($input['user_id']) : null;
$session_id = isset($input['session_id']) ? $input['session_id'] : 'unknown_session';

if (empty($user_message)) {
    echo json_encode(['success' => false, 'message' => 'Empty message']);
    exit;
}

// Symptom Response Map (Keyword -> [General Response, Database Specialization])
$responses = [
    'heart' => ['Chest pain or heart issues should be evaluated by a **Cardiologist**.', 'Cardiologist'],
    'chest' => ['Chest discomfort can be serious. I recommend consulting a **Cardiologist** immediately.', 'Cardiologist'],
    'tooth' => ['For toothaches or gum issues, please visit a **Dentist**.', 'Dentist'],
    'teeth' => ['A **Dentist** can help with dental pain and checkups.', 'Dentist'],
    'skin' => ['Skin rashes or persistent irritation should be seen by a **Dermatologist**.', 'Dermatologist'],
    'rash' => ['A **Dermatologist** is the right specialist for skin-related concerns.', 'Dermatologist'],
    'brain' => ['Neurological symptoms like severe headaches or dizziness require a **Neurologist**.', 'Neurologist'],
    'head' => ['If you have persistent headaches or dizziness, a **Neurologist** can help.', 'Neurologist'],
    'bone' => ['For fractures or joint pain, an **Orthopedic** specialist is recommended.', 'Orthopedic'],
    'joint' => ['Joint pain is common and best handled by an **Orthopedic** doctor.', 'Orthopedic'],
    'eye' => ['Vision problems or eye pain should be checked by an **Ophthalmologist**.', 'Ophthalmologist'],
    'vision' => ['An **Ophthalmologist** can assist with vision-related issues.', 'Ophthalmologist'],
    'fever' => ['A fever might indicate an infection. Consider starting with a **General Physician**.', 'General Physician'],
    'hello' => ['Hello! I am your SmartCare Assistant. How can I help you today?', null],
    'hi' => ['Hi there! How can I assist you with your health concerns?', null],
    'help' => ['I can help identify which specialist you might need based on your symptoms.', null],
    'book' => ['You can book an appointment through the "Book Appointment" section in your dashboard.', null],
    'thank' => ['You\'re welcome! Let me know if you have more questions.', null]
];

$lower_msg = strtolower($user_message);
$bot_response = "I'm not sure if I understand. Could you please describe your symptoms in more detail? (e.g. 'I have chest pain' or 'toothache')";
$intent = "unknown";
$target_specialization = null;

foreach ($responses as $keyword => $data) {
    if (strpos($lower_msg, $keyword) !== false) {
        $bot_response = $data[0];
        $target_specialization = $data[1];
        $intent = $keyword;
        break;
    }
}

// If a specialization was identified, suggest actual doctors
if ($target_specialization) {
    $spec_esc = mysqli_real_escape_string($conn, $target_specialization);
    $doc_query = "SELECT u.full_name FROM doctors d 
                  JOIN users u ON d.user_id = u.user_id 
                  WHERE d.specialization = '$spec_esc' AND d.is_approved = 1 
                  LIMIT 2";
    $doc_res = mysqli_query($conn, $doc_query);
    
    if ($doc_res && mysqli_num_rows($doc_res) > 0) {
        $doctor_names = [];
        while ($row = mysqli_fetch_assoc($doc_res)) {
            $doctor_names[] = "**Dr. " . $row['full_name'] . "**";
        }
        $bot_response .= " You can consult with " . implode(" or ", $doctor_names) . " currently available in our system.";
    }
}

// Ensure the table exists (Handling cases where the user didn't run the SQL script)
$check_table = mysqli_query($conn, "SELECT 1 FROM chatbot_logs LIMIT 1");
if (!$check_table) {
    // Attempt to create the table if it's missing
    $create_table = "CREATE TABLE IF NOT EXISTS chatbot_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        session_id VARCHAR(100) NOT NULL,
        sender ENUM('user', 'bot') NOT NULL,
        message TEXT NOT NULL,
        detected_intent VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB";
    mysqli_query($conn, $create_table);
}

// Log conversations
$u_id_val = ($user_id !== null) ? $user_id : "NULL";
$s_id = mysqli_real_escape_string($conn, $session_id);
$u_msg = mysqli_real_escape_string($conn, $user_message);
$b_res = mysqli_real_escape_string($conn, $bot_response);
$intl = mysqli_real_escape_string($conn, $intent);

// Log user message
$sql_user = "INSERT INTO chatbot_logs (user_id, session_id, sender, message, detected_intent) VALUES ($u_id_val, '$s_id', 'user', '$u_msg', '$intl')";
mysqli_query($conn, $sql_user);

// Log bot response
$sql_bot = "INSERT INTO chatbot_logs (user_id, session_id, sender, message, detected_intent) VALUES ($u_id_val, '$s_id', 'bot', '$b_res', '$intl')";
mysqli_query($conn, $sql_bot);

// Return response
echo json_encode([
    'success' => true,
    'response' => $bot_response,
    'intent' => $intent
]);
?>
