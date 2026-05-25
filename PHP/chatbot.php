<?php
// SmartCare | AI Chatbot Backend (Advanced AI & Fallback Edition)
// ========================================================
error_reporting(0); // Prevent warnings from breaking JSON response
header('Content-Type: application/json');

// Include DB connection
$db_path = __DIR__ . '/db_connect.php';
if (!file_exists($db_path)) {
    echo json_encode(['success' => false, 'message' => "Database configuration file missing."]);
    exit;
}
require_once $db_path;

// Include config file
$config_path = __DIR__ . '/config.php';
if (file_exists($config_path)) {
    require_once $config_path;
}

// Get JSON input
$input = isset($input) ? $input : json_decode(file_get_contents('php://input'), true);
$user_message = isset($input['message']) ? trim($input['message']) : '';
$user_id = isset($input['user_id']) && $input['user_id'] ? intval($input['user_id']) : null;
$session_id = isset($input['session_id']) ? $input['session_id'] : 'unknown_session';

if (empty($user_message)) {
    echo json_encode(['success' => false, 'message' => 'Empty message']);
    exit;
}

// 1. Fetch all approved/active doctors from the database for recommendations
$doctor_query = "SELECT d.doctor_id, u.full_name, d.specialization, d.qualification, d.experience_years, d.consultation_fee, d.rating, d.location, d.profile_image 
                 FROM doctors d 
                 JOIN users u ON d.user_id = u.user_id 
                 WHERE d.is_approved = 1 AND u.is_active = 1";
$doc_res = mysqli_query($conn, $doctor_query);
$doctorList = [];
if ($doc_res) {
    while ($row = mysqli_fetch_assoc($doc_res)) {
        $doctorList[] = $row;
    }
}

// 2. Retrieve session conversation history (last 6 messages) for context
$s_id_esc = mysqli_real_escape_string($conn, $session_id);
$history_query = "SELECT sender, message FROM chatbot_logs 
                  WHERE session_id = '$s_id_esc' 
                  ORDER BY created_at ASC LIMIT 6";
$hist_res = mysqli_query($conn, $history_query);
$history = [];
if ($hist_res) {
    while ($row = mysqli_fetch_assoc($hist_res)) {
        $history[] = $row;
    }
}

// Check if Gemini API key is defined and not empty
$apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
$bot_response = "";
$detected_specialization = null;
$recommended_doctor_ids = [];
$intent = "unknown";
$ai_called = false;

if (!empty($apiKey)) {
    // Attempt calling Google Gemini API
    $geminiResponse = callGeminiAPI($apiKey, $user_message, $history, $doctorList);
    
    if ($geminiResponse && isset($geminiResponse['response_text'])) {
        $bot_response = $geminiResponse['response_text'];
        $detected_specialization = isset($geminiResponse['specialization_needed']) ? $geminiResponse['specialization_needed'] : null;
        $recommended_doctor_ids = isset($geminiResponse['recommended_doctor_ids']) ? (array)$geminiResponse['recommended_doctor_ids'] : [];
        $intent = $detected_specialization ? strtolower($detected_specialization) : "ai_chat";
        $ai_called = true;
    }
}

// 3. Fallback engine if Gemini is not set up or call failed
if (!$ai_called) {
    $lower_msg = strtolower($user_message);
    $intent = "unknown";
    
    // Default fallback messages
    $bot_response = "I'm your AI health assistant. I can guide you to the right specialist based on your symptoms. Pro-tip: you can type symptoms like 'chest pain', 'toothache', 'skin rash', or 'headache'.\n\n*Note: I am an AI guidance tool, not a doctor. In case of emergency, please visit a clinic immediately.*";
    
    // Symptom-specialist keyword mapping
    $responses = [
        'heart' => ['Cardiologist', 'Chest pain or heart issues should be evaluated by a **Cardiologist**.'],
        'chest' => ['Cardiologist', 'Chest discomfort can be serious. I recommend consulting a **Cardiologist** immediately.'],
        'cardio' => ['Cardiologist', 'Heart-related and cardiovascular symptoms require a consultation with a **Cardiologist**.'],
        'tooth' => ['Dentist', 'For toothaches or gum issues, please visit a **Dentist**.'],
        'teeth' => ['Dentist', 'A **Dentist** can help with dental pain, cavities, and checkups.'],
        'dental' => ['Dentist', 'For dental checkups or tooth pain, consider booking a **Dentist**.'],
        'skin' => ['Dermatologist', 'Skin rashes, itchiness, or persistent irritation should be seen by a **Dermatologist**.'],
        'rash' => ['Dermatologist', 'A **Dermatologist** is the right specialist for skin-related concerns.'],
        'brain' => ['Neurologist', 'Neurological symptoms like severe headaches or dizziness require a **Neurologist**.'],
        'head' => ['Neurologist', 'If you have persistent headaches, dizziness, or migraines, a **Neurologist** can help.'],
        'bone' => ['Orthopedic', 'For fractures, joint pain, or bone injuries, an **Orthopedic** specialist is recommended.'],
        'joint' => ['Orthopedic', 'Joint pain and movement issues are best handled by an **Orthopedic** doctor.'],
        'eye' => ['Ophthalmologist', 'Vision problems, redness, or eye pain should be checked by an **Ophthalmologist**.'],
        'vision' => ['Ophthalmologist', 'An **Ophthalmologist** can assist with vision-related issues or optical concerns.'],
        'fever' => ['General Physician', 'A fever, cough, or general illness might indicate an infection. Consider starting with a **General Physician**.'],
        'cold' => ['General Physician', 'For cold, flu, cough, or general wellness issues, check with a **General Physician**.'],
        'hello' => [null, 'Hello! I am your SmartCare Assistant. How can I help you today? You can describe your symptoms, and I will recommend the right doctor.'],
        'hi' => [null, 'Hi there! How can I assist you with your health concerns today?'],
        'help' => [null, 'I can help identify which specialist you might need based on your symptoms and list available doctors.'],
        'book' => [null, 'You can book an appointment through the "Book Appointment" section in your dashboard, or by clicking "Book Appointment" on any doctor card recommended below!'],
        'thank' => [null, 'You\'re welcome! I\'m here to help. Let me know if you have any other questions.']
    ];

    foreach ($responses as $keyword => $data) {
        if (strpos($lower_msg, $keyword) !== false) {
            $detected_specialization = $data[0];
            $bot_response = $data[1];
            $intent = $keyword;
            break;
        }
    }

    // Filter doctors by detected specialization for recommendations
    if ($detected_specialization) {
        $bot_response .= " Based on your symptoms, we found available specialists in our system. You can consult with them:";
        foreach ($doctorList as $doc) {
            if (strcasecmp($doc['specialization'], $detected_specialization) === 0) {
                $recommended_doctor_ids[] = (int)$doc['doctor_id'];
            }
        }
    }
}

// 4. Resolve recommended doctors details to return to the frontend
$recommended_doctors = [];
if (!empty($recommended_doctor_ids)) {
    foreach ($doctorList as $doc) {
        if (in_array((int)$doc['doctor_id'], $recommended_doctor_ids)) {
            $recommended_doctors[] = [
                'doctor_id' => (int)$doc['doctor_id'],
                'full_name' => $doc['full_name'],
                'specialization' => $doc['specialization'],
                'qualification' => $doc['qualification'],
                'experience_years' => (int)$doc['experience_years'],
                'consultation_fee' => (float)$doc['consultation_fee'],
                'rating' => (float)$doc['rating'],
                'location' => $doc['location'],
                'profile_image' => $doc['profile_image']
            ];
        }
    }
}

// Ensure the chatbot_logs table exists
$check_table = mysqli_query($conn, "SELECT 1 FROM chatbot_logs LIMIT 1");
if (!$check_table) {
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

// 5. Log conversations in database
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

// Return response JSON
echo json_encode([
    'success' => true,
    'response' => $bot_response,
    'specialization' => $detected_specialization,
    'doctors' => $recommended_doctors,
    'intent' => $intent
]);

/**
 * Calls Google Gemini API (gemini-2.5-flash) and returns structured symptom analysis response.
 */
function callGeminiAPI($apiKey, $userMessage, $history, $doctorList) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . urlencode($apiKey);

    // Format doctors list for context
    $doctorsContext = "Here is the list of approved doctors in our clinic database:\n";
    foreach ($doctorList as $doc) {
        $doctorsContext .= "- Dr. {$doc['full_name']} (ID: {$doc['doctor_id']}, Specialization: {$doc['specialization']}, Qualification: {$doc['qualification']}, Experience: {$doc['experience_years']} years, Fee: ₹{$doc['consultation_fee']}, Rating: {$doc['rating']}, Location: {$doc['location']})\n";
    }

    $systemInstruction = "You are the advanced SmartCare AI Health Assistant. "
                       . "Your goal is to analyze the patient's symptoms, provide helpful health suggestions/disclaimers, "
                       . "recommend the right medical specialist category, "
                       . "and assist the patient in finding the most appropriate doctor from our system.\n\n"
                       . "CRITICAL INSTRUCTIONS:\n"
                       . "1. Always include a brief professional disclaimer that you are an AI assistant and not a replacement for a doctor. Keep it short.\n"
                       . "2. Analyze symptoms carefully and explain what kind of specialist is typically recommended.\n"
                       . "3. Check the list of active doctors in our system. If we have a doctor with a matching specialization, recommend them by name. If not, recommend they see a general practitioner.\n"
                       . "4. You MUST respond in a valid JSON format. Do not wrap in markdown ```json ... ```, just output raw JSON text. "
                       . "The JSON structure must be exactly:\n"
                       . "{\n"
                       . "  \"response_text\": \"Your chat response to the user. Use markdown for styling (like bold names or bullet points). Mention matching doctors by name and details.\",\n"
                       . "  \"specialization_needed\": \"The specialization name, matching exactly one of our doctor's specializations if applicable (e.g. 'Cardiologist', 'Dentist', 'Dermatologist', 'Neurologist', 'Orthopedic', 'Ophthalmologist', 'General Physician'), or null.\",\n"
                       . "  \"recommended_doctor_ids\": [1, 2] // Array of doctor IDs matching the specialization from the list.\n"
                       . "}\n\n"
                       . $doctorsContext;

    // Build chat contents including history
    $contents = [];
    foreach ($history as $chat) {
        $contents[] = [
            "role" => $chat['sender'] === 'user' ? 'user' : 'model',
            "parts" => [["text" => $chat['message']]]
        ];
    }
    
    // Current user message
    $contents[] = [
        "role" => "user",
        "parts" => [["text" => $userMessage]]
    ];

    $payload = [
        "contents" => $contents,
        "systemInstruction" => [
            "parts" => [["text" => $systemInstruction]]
        ],
        "generationConfig" => [
            "temperature" => 0.2,
            "maxOutputTokens" => 800,
            "responseMimeType" => "application/json"
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    // Set a reasonable timeout
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null; 
    }

    $decoded = json_decode($response, true);
    if (!isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
        return null;
    }

    $rawText = trim($decoded['candidates'][0]['content']['parts'][0]['text']);
    return json_decode($rawText, true);
}
?>
