-- Create database
CREATE DATABASE IF NOT EXISTS smartcare_db;
USE smartcare_db;

--1. USERS TABLE (Shared for Patient, Doctor, Admin login)
-- =========================================================
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone         VARCHAR(15) NOT NULL,
    password      VARCHAR(255) NOT NULL,  
    role          ENUM('patient', 'doctor', 'admin') NOT NULL DEFAULT 'patient',
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. PATIENTS TABLE (Extra details for patients)
-- =========================================================
CREATE TABLE patients (
    patient_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL UNIQUE,
    date_of_birth DATE DEFAULT NULL,
    gender        ENUM('male', 'female', 'other') DEFAULT NULL,
    address       TEXT DEFAULT NULL,
    blood_group   VARCHAR(5) DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. DOCTORS TABLE (Extra details for doctors)
-- =========================================================
CREATE TABLE doctors (
    doctor_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL UNIQUE,
    specialization    VARCHAR(100) NOT NULL,
    qualification     VARCHAR(200) NOT NULL,
    experience_years  INT DEFAULT 0,
    consultation_fee  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    rating            DECIMAL(3, 2) DEFAULT 0.00,
    bio               TEXT DEFAULT NULL,
    profile_image     VARCHAR(255) DEFAULT NULL,
    location          VARCHAR(200) DEFAULT NULL,
    is_approved       TINYINT(1) NOT NULL DEFAULT 0,  
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- 4. DOCTOR AVAILABILITY (Doctor sets working schedule)
--    Step 1 of workflow: Doctor defines working days & hours
-- =========================================================
CREATE TABLE doctor_availability (
    availability_id   INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id         INT NOT NULL,
    day_of_week       ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    start_time        TIME NOT NULL,          -- e.g., 10:00:00
    end_time          TIME NOT NULL,          -- e.g., 14:00:00
    slot_duration     INT NOT NULL DEFAULT 15, -- in minutes (e.g., 15, 30)
    is_approved       TINYINT(1) NOT NULL DEFAULT 0,  -- Admin approval required
    status            ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    UNIQUE KEY unique_doctor_day (doctor_id, day_of_week)
) ENGINE=InnoDB;

-- 5. DOCTOR LEAVES (Doctor marks leave days)
-- =========================================================
CREATE TABLE doctor_leaves (
    leave_id      INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id     INT NOT NULL,
    leave_date    DATE NOT NULL,
    reason        VARCHAR(255) DEFAULT NULL,
    status        ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    UNIQUE KEY unique_doctor_leave (doctor_id, leave_date)
) ENGINE=InnoDB;


-- 6. TIME SLOTS (System-generated based on approved availability)
--    Step 3 of workflow: Generated slots like 10:00, 10:15, 10:30...
-- =========================================================
CREATE TABLE time_slots (
    slot_id       INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id     INT NOT NULL,
    slot_date     DATE NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    status        ENUM('available', 'booked', 'blocked', 'completed') DEFAULT 'available',
    blocked_by    INT DEFAULT NULL,          -- admin user_id who blocked the slot
    block_reason  VARCHAR(255) DEFAULT NULL, -- e.g., "emergency surgery"
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE KEY unique_slot (doctor_id, slot_date, start_time)
) ENGINE=InnoDB;


-- 7. APPOINTMENTS (Patient books with a doctor)
--    Steps 4-6 of workflow: Book → Validate → Confirm
-- =========================================================
CREATE TABLE appointments (
    appointment_id    INT AUTO_INCREMENT PRIMARY KEY,
    patient_id        INT NOT NULL,
    doctor_id         INT NOT NULL,
    slot_id           INT NOT NULL,
    appointment_date  DATE NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME NOT NULL,
    status            ENUM('confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled') DEFAULT 'confirmed',
    notes             TEXT DEFAULT NULL,       -- Patient's reason for visit
    cancel_reason     VARCHAR(255) DEFAULT NULL,
    cancelled_by      ENUM('patient', 'doctor', 'admin') DEFAULT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES time_slots(slot_id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- 8. APPOINTMENT HISTORY (Tracks all status changes)
--    For admin monitoring & audit trail
-- =========================================================
CREATE TABLE appointment_history (
    history_id        INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id    INT NOT NULL,
    old_status        VARCHAR(20) DEFAULT NULL,
    new_status        VARCHAR(20) NOT NULL,
    changed_by        INT NOT NULL,           -- user_id who made the change
    change_reason     VARCHAR(255) DEFAULT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- 9. NOTIFICATIONS (SMS/Email confirmations)
-- =========================================================
CREATE TABLE notifications (
    notification_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL,
    title             VARCHAR(200) NOT NULL,
    message           TEXT NOT NULL,
    type              ENUM('appointment', 'cancellation', 'reminder', 'system') DEFAULT 'system',
    is_read           TINYINT(1) DEFAULT 0,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- 10. FAVOURITE DOCTORS (Patient's favourite doctors list)
-- =========================================================
CREATE TABLE favourite_doctors (
    favourite_id  INT AUTO_INCREMENT PRIMARY KEY,
    patient_id    INT NOT NULL,
    doctor_id     INT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    UNIQUE KEY unique_favourite (patient_id, doctor_id)
) ENGINE=InnoDB;


-- =========================================================
INSERT INTO users (full_name, email, phone, password, role) VALUES
('Admin', 'admin@smartcare.com', '0000000000', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- INDEXES FOR PERFORMANCE
-- =========================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_slots_doctor_date ON time_slots(doctor_id, slot_date);
CREATE INDEX idx_slots_status ON time_slots(status);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
