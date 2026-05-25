/**
 * Admin Dashboard Functionality for SmartCare
 */

// Global state for Slot Control
let currentDoctorId = null; 
let currentDate = new Date().toISOString().split('T')[0];
let allDoctors = [];
let calendarDisplayDate = new Date(currentDate);

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in as admin
    const userData = checkAuth('admin');
    if (!userData) return;

    // Initialize mini calendar
    renderAdminCalendar();

    // Calendar Navigation Listeners
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    if (prevBtn && nextBtn) {
        prevBtn.onclick = () => {
            calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() - 1);
            renderAdminCalendar();
        };
        nextBtn.onclick = () => {
            calendarDisplayDate.setMonth(calendarDisplayDate.getMonth() + 1);
            renderAdminCalendar();
        };
    }

    // Bulk Actions Click Handlers
    const btnBlockAll = document.getElementById('btn-block-all');
    const btnUnblockAll = document.getElementById('btn-unblock-all');
    const btnEmergencyOnly = document.getElementById('btn-emergency-only');

    if (btnBlockAll) btnBlockAll.onclick = () => handleBulkAction('block_all');
    if (btnUnblockAll) btnUnblockAll.onclick = () => handleBulkAction('unblock_all');
    if (btnEmergencyOnly) btnEmergencyOnly.onclick = () => handleBulkAction('emergency_only');

    // Handle doctor selection for slot management
    const drSelect = document.getElementById('slot-dr-select');
    if (drSelect) {
        drSelect.addEventListener('change', (e) => {
            currentDoctorId = e.target.value;
            loadSlots();
        });
    }

    // Modal Control for Adding Doctors
    const addDoctorBtn = document.querySelector('.btn-add-doctor');
    const modal = document.getElementById('add-doctor-modal');
    const closeBtn = document.querySelector('.close-modal');

    if (addDoctorBtn && modal) {
        addDoctorBtn.onclick = () => modal.style.display = 'block';
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    // Modal Control for Password Change
    const passwordModal = document.getElementById('password-change-modal');
    const openPasswordBtn = document.getElementById('open-password-modal');
    const closePasswordBtn = document.getElementById('close-password-modal');

    if (openPasswordBtn && passwordModal) {
        openPasswordBtn.onclick = () => passwordModal.style.display = 'block';
    }
    if (closePasswordBtn && passwordModal) {
        closePasswordBtn.onclick = () => passwordModal.style.display = 'none';
    }

    // Password matching validation
    const newPass = document.getElementById('new-password');
    const confirmPass = document.getElementById('confirm-password');
    const passError = document.getElementById('password-error');

    if (newPass && confirmPass) {
        const validate = () => {
            if (confirmPass.value && newPass.value !== confirmPass.value) {
                passError.style.display = 'block';
            } else {
                passError.style.display = 'none';
            }
        };
        newPass.oninput = validate;
        confirmPass.oninput = validate;
    }

    // Form submissions
    const addDoctorForm = document.getElementById('add-doctor-form');
    if (addDoctorForm) addDoctorForm.onsubmit = handleAddDoctor;

    const changePassForm = document.getElementById('change-password-form');
    if (changePassForm) changePassForm.onsubmit = (e) => handleChangePassword(e, userData);

    // Modal Control for Editing Doctors
    const editModal = document.getElementById('edit-doctor-modal');
    const closeEditBtn = document.getElementById('close-edit-modal');
    if (closeEditBtn && editModal) {
        closeEditBtn.onclick = () => editModal.style.display = 'none';
    }

    const editDoctorForm = document.getElementById('edit-doctor-form');
    if (editDoctorForm) editDoctorForm.onsubmit = handleEditDoctor;

    // Initial data fetch
    loadAdminDashboardData(userData);
});

function handleChangePassword(e, userData) {
    e.preventDefault();
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    if (newPass !== confirmPass) {
        alert("Passwords do not match!");
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.user_id = userData.id;

    fetch("../PHP/change_password.php", {
        method: "POST",
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        alert(res.message);
        if (res.success) {
            document.getElementById('password-change-modal').style.display = 'none';
            e.target.reset();
        }
    })
    .catch(err => console.error("Password change error:", err));
}

function loadAdminDashboardData(userData) {
    if (!userData) {
        userData = JSON.parse(localStorage.getItem("smartcare_user"));
    }
    if (!userData) return;
    
    fetch("../PHP/fetch_dashboard_data.php", {
        method: "POST",
        body: JSON.stringify({ user_id: userData.id, role: userData.role })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            console.log("Admin Dashboard Data Loaded:", res.data);
            const data = res.data;
            allDoctors = data.all_doctors;
            updateAdminStats(data.stats);
            updateRecentAppointments(data.recent_appointments);
            updatePendingApprovals(data.pending_approvals);
            renderDoctorsTable(data.all_doctors);
            renderAppointmentsTable(data.all_appointments);
            populateDoctorSelect(data.all_doctors);
        } else {
            console.warn("Admin fetch error:", res.message);
        }
    })
    .catch(err => console.error("Admin data fetch error:", err));
}

function updateAdminStats(stats) {
    if (!stats) return;

    // Dashboard Section Stats
    const metrics = document.querySelectorAll('#section-dashboard .metric-value');
    if (metrics.length >= 4) {
        metrics[0].textContent = stats.total_doctors || 0;
        metrics[1].textContent = stats.total_users || 0;
        metrics[2].textContent = stats.total_appointments || 0;
        metrics[3].textContent = (stats.approval_rate || 0) + '%';
    }

    // Doctor Management Section Stats
    const docMetrics = document.querySelectorAll('#section-doctors .metric-value');
    if (docMetrics.length >= 3) {
        docMetrics[0].textContent = stats.total_doctors || 0;
        docMetrics[1].textContent = stats.active_doctors || 0; 
        docMetrics[2].textContent = stats.pending_doctors || 0;
    }
}

function renderDoctorsTable(doctors) {
    const body = document.getElementById('doctors-table-body');
    const label = document.getElementById('doctors-count-label');
    if (label) label.textContent = `All Doctors (${doctors.length})`;
    
    if(!body) return;
    if(!doctors.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No doctors registered yet.</td></tr>';
        return;
    }

    body.innerHTML = doctors.map(doc => `
        <tr>
            <td>
                <div class="doctor-cell">
                    <img src="../Assets/Icons/blue-user-circle.svg" alt="Doctor" class="doctor-avatarImg" style="width: 32px; border-radius: 50%;">
                    <div class="doctor-name-info">
                        <h4 style="margin: 0; font-size: 0.9rem;">${doc.full_name}</h4>
                        <p style="margin: 0; font-size: 0.75rem; color: #64748b;">${doc.email}</p>
                    </div>
                </div>
            </td>
            <td>${doc.specialization}</td>
            <td>${doc.experience_years} years</td>
            <td>
                ${doc.is_approved == 1 
                    ? '<span class="badge-pill available" style="background: #ecfdf5; color: #059669; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem;">Active</span>' 
                    : '<span class="badge-pill pending" style="background: #fffbeb; color: #d97706; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem;">Pending</span>'
                }
            </td>
            <td>
                <div class="action-icon-btns" style="display: flex; gap: 8px;">
                    ${doc.is_approved == 0 ? `
                        <button class="btn-icon-action approve-doctor" title="Approve Doctor" onclick="approveDoctor(${doc.doctor_id})" style="background:#dcfce7; border:none; border-radius:4px; padding:4px; cursor:pointer;"><img src="../Assets/Icons/green-check.svg" alt="Approve" style="width: 16px;"></button>
                    ` : ''}
                    <button class="btn-icon-action" title="Edit Doctor" onclick="openEditDoctorModal(${doc.doctor_id})"><img src="../Assets/Icons/gray-edit.svg" alt="Edit" style="width: 16px;"></button>
                    <button class="btn-icon-action delete" title="Delete Doctor" onclick="deleteDoctor(${doc.user_id})"><img src="../Assets/Icons/red-trash.svg" alt="Delete" style="width: 16px;"></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function approveDoctor(id) {
    if (!confirm("Are you sure you want to approve this doctor?")) return;

    fetch("../PHP/approve_doctor.php", {
        method: "POST",
        body: JSON.stringify({ doctor_id: id })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert(res.message);
            // Refresh data
            const userData = JSON.parse(localStorage.getItem("smartcare_user"));
            if (userData) loadAdminDashboardData(userData);
        } else {
            alert(res.message);
        }
    })
    .catch(err => console.error("Approval error:", err));
}

function renderAppointmentsTable(appts) {
    const body = document.getElementById('appointments-table-body');
    const label = document.getElementById('appts-count-label');
    if (label) label.textContent = `All Appointments (${appts.length})`;
    
    if(!body) return;

    // Stats updates for Appointments section
    const total = appts.length;
    const confirmed = appts.filter(a => a.status === 'confirmed').length;
    const completed = appts.filter(a => a.status === 'completed').length;
    const cancelled = appts.filter(a => a.status === 'cancelled').length;

    const statTotal = document.getElementById('stat-total-appts');
    const statConf = document.getElementById('stat-confirmed-appts');
    const statComp = document.getElementById('stat-completed-appts');
    const statCanc = document.getElementById('stat-cancelled-appts');

    if(statTotal) statTotal.textContent = total;
    if(statConf) statConf.textContent = confirmed;
    if(statComp) statComp.textContent = completed;
    if(statCanc) statCanc.textContent = cancelled;

    if(!appts.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No appointments found.</td></tr>';
        return;
    }

    body.innerHTML = appts.map(appt => `
        <tr>
            <td><span style="font-weight: 700;">${appt.patient_name}</span></td>
            <td>${appt.doctor_name}</td>
            <td>
                <div style="font-size: 0.85rem;">
                    <p style="margin: 0; font-weight: 600;">${appt.appointment_date}</p>
                    <p style="margin: 0; color: #64748b;">${appt.start_time}</p>
                </div>
            </td>
            <td><span class="badge-pill ${appt.status}">${appt.status}</span></td>
            <td>
                <button class="btn-icon-action" title="Edit"><img src="../Assets/Icons/gray-edit.svg" alt="Edit" style="width: 16px;"></button>
            </td>
        </tr>
    `).join('');
}

function populateDoctorSelect(doctors) {
    const select = document.getElementById('slot-dr-select');
    if(!select) return;
    const options = doctors.map(doc => `<option value="${doc.doctor_id}">${doc.full_name}</option>`);
    select.innerHTML = '<option value="" selected disabled>Select a doctor</option>' + options.join('');
}

function loadSlots() {
    if(!currentDoctorId) return;

    fetch("../PHP/fetch_slots.php", {
        method: "POST",
        body: JSON.stringify({ doctor_id: currentDoctorId, date: currentDate })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            renderSlots(res.slots);
        }
    });
}

function renderSlots(slots) {
    const container = document.querySelector('.slots-container-admin');
    if (!container) return;
    if (!slots.length) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: #64748b; grid-column: span 4;">No slots found for this date. Ask doctor to set availability.</p>';
        return;
    }

    container.innerHTML = slots.map(slot => {
        const isBooked = slot.status === 'booked';
        const isBlocked = slot.status === 'blocked';
        
        // Format time to e.g., "11:00 AM"
        const timeParts = slot.start_time.split(':');
        let hours = parseInt(timeParts[0], 10);
        const minutes = timeParts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const formattedTime = `${hours}:${minutes} ${ampm}`;
        
        return `
            <div class="slot-card-admin ${slot.status}">
                <div class="slot-header-admin">
                    <div class="slot-time-admin"><img src="../Assets/Icons/brown-clock.svg" alt="Clock" style="width: 16px; filter: grayscale(1);"> ${formattedTime}</div>
                    <span class="slot-status-badge ${slot.status}">${slot.status}</span>
                </div>
                ${isBooked ? `<p class="slot-patient-info">Patient: <strong>${slot.patient_name || 'N/A'}</strong></p>` : ''}
                
                <div class="slot-actions-admin">
                    ${slot.status === 'available' ? `
                        <button class="btn-slot-action block" onclick="handleSlotAction(${slot.slot_id}, 'block')">
                            <img src="../Assets/Icons/black-lock.svg" alt="Lock" style="width: 12px; opacity: 0.7;"> Block Slot
                        </button>
                    ` : ''}

                    ${isBooked ? `
                        <button class="btn-slot-action cancel" onclick="handleSlotAction(${slot.slot_id}, 'cancel')">Cancel Booking</button>
                    ` : ''}

                    ${isBlocked ? `
                        <button class="btn-slot-action unblock" onclick="handleSlotAction(${slot.slot_id}, 'unblock')">Unblock Slot</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function handleSlotAction(id, action) {
    let endpoint = "../PHP/manage_slots.php";
    const userData = checkAuth('admin');
    if (!userData) return;
    let payload = { slot_id: id, action: action, admin_id: userData.id };

    if (action === 'cancel') {
        if (!confirm("Are you sure you want to cancel this booking?")) return;
        payload.action = 'block'; 
    } else {
        if (!confirm(`Are you sure you want to ${action} this slot?`)) return;
    }

    fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            loadSlots();
            loadAdminDashboardData(userData);
        } else {
            alert(res.message);
        }
    });
}

function updateRecentAppointments(recent) {
    const container = document.getElementById('activity-list-container');
    if (!container) return;
    if (!recent || !recent.length) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: #64748b;">No recent activity.</p>';
        return;
    }
    container.innerHTML = recent.map(appt => `
        <div class="activity-item" style="padding:10px 0; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
            <div class="activity-info">
                <h4 style="margin:0; font-size:0.9rem;">${appt.patient_name}</h4>
                <p style="margin:0; font-size:0.8rem; color:#64748b;">Dr. ${appt.doctor_name}</p>
                <p class="date" style="margin:0; font-size:0.75rem; color: #94a3b8;">${appt.appointment_date}</p>
            </div>
            <span class="status-pill ${appt.status}" style="font-size:0.7rem; padding:4px 8px; border-radius:12px; font-weight:700;">${appt.status}</span>
        </div>
    `).join('');
}

function updatePendingApprovals(pending) {
    const container = document.getElementById('approval-list-container');
    if (!container) return;
    if (!pending || !pending.length) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem; color: #64748b;">No pending approvals.</p>';
        return;
    }
    container.innerHTML = pending.map(item => `
        <div class="activity-item" style="padding:10px 0; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; border-left: 4px solid #fbbf24; padding-left:10px;">
            <div class="activity-info">
                <h4 style="margin:0; font-size:0.9rem;">Dr. ${item.doctor_name}</h4>
                <p style="margin:0; font-size:0.8rem; color:#64748b;">${item.day_of_week} | ${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="status-pill approved" style="border:none; cursor:pointer; background:#dcfce7; color:#15803d; padding:4px 12px; border-radius:99px; font-size:0.75rem; font-weight:700;" onclick="manageAvailability(${item.availability_id}, 'approved')">Approve</button>
            </div>
        </div>
    `).join('');
}

function manageAvailability(id, status) {
    if (!confirm(`Are you sure you want to ${status} this schedule?`)) return;
    fetch("../PHP/manage_availability.php", {
        method: "POST",
        body: JSON.stringify({ availability_id: id, status: status })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            const userData = checkAuth('admin');
            loadAdminDashboardData(userData);
        } else {
            alert("Error: " + res.message);
        }
    });
}

function viewDoctorSchedule(id) {
    currentDoctorId = id;
    const drSelect = document.getElementById('slot-dr-select');
    if (drSelect) drSelect.value = id;
    calendarDisplayDate = new Date(currentDate);
    renderAdminCalendar();
    showSection('slots');
    loadSlots();
}

function handleAddDoctor(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    fetch("../PHP/add_doctor.php", {
        method: "POST",
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert("Doctor added successfully!");
            document.getElementById('add-doctor-modal').style.display = 'none';
            e.target.reset();
            
            // Re-fetch data using current auth state
            const userData = checkAuth('admin');
            loadAdminDashboardData(userData);
        } else {
            alert(res.message);
        }
    })
    .catch(err => {
        console.error("Add doctor error:", err);
        alert("Failed to add doctor.");
    });
}

function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById('section-' + sectionName);
    if(targetSection) targetSection.classList.add('active');

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.getElementById('menu-' + sectionName);
    if (activeItem) activeItem.classList.add('active');
}

function openEditDoctorModal(doctorId) {
    const doc = allDoctors.find(d => d.doctor_id == doctorId);
    if (!doc) {
        alert("Doctor not found.");
        return;
    }

    document.getElementById('edit-doc-id').value = doc.doctor_id;
    document.getElementById('edit-doc-user-id').value = doc.user_id;
    document.getElementById('edit-doc-name').value = doc.full_name || '';
    document.getElementById('edit-doc-email').value = doc.email || '';
    document.getElementById('edit-doc-phone').value = doc.phone || '';
    document.getElementById('edit-doc-password').value = ''; // empty by default
    document.getElementById('edit-doc-specialization').value = doc.specialization || '';
    document.getElementById('edit-doc-experience').value = doc.experience_years || 0;
    document.getElementById('edit-doc-fee').value = doc.consultation_fee || 0;
    document.getElementById('edit-doc-license').value = doc.qualification || '';
    document.getElementById('edit-doc-status').value = doc.is_approved;
    document.getElementById('edit-doc-location').value = doc.location || '';
    document.getElementById('edit-doc-bio').value = doc.bio || '';

    document.getElementById('edit-doctor-modal').style.display = 'block';
}

function handleEditDoctor(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    fetch("../PHP/edit_doctor.php", {
        method: "POST",
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert("Doctor information updated successfully!");
            document.getElementById('edit-doctor-modal').style.display = 'none';
            
            // Re-fetch data
            const userData = checkAuth('admin');
            loadAdminDashboardData(userData);
        } else {
            alert(res.message);
        }
    })
    .catch(err => {
        console.error("Edit doctor error:", err);
        alert("Failed to update doctor information.");
    });
}

function deleteDoctor(userId) {
    if (!confirm("Are you sure you want to delete this doctor? This will permanently delete their profile, appointments, and slots.")) return;

    fetch("../PHP/delete_doctor.php", {
        method: "POST",
        body: JSON.stringify({ user_id: userId })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert(res.message);
            const userData = checkAuth('admin');
            loadAdminDashboardData(userData);
        } else {
            alert(res.message);
        }
    })
    .catch(err => {
        console.error("Delete doctor error:", err);
        alert("Failed to delete doctor.");
    });
}

function renderAdminCalendar() {
    const grid = document.getElementById('cal-dates-grid');
    const title = document.getElementById('cal-month-title');
    if (!grid || !title) return;

    grid.innerHTML = '';
    
    // Set title e.g. "May 2026"
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    title.textContent = `${monthNames[calendarDisplayDate.getMonth()]} ${calendarDisplayDate.getFullYear()}`;

    // Add day labels
    const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    dayLabels.forEach(label => {
        const div = document.createElement('div');
        div.className = 'cal-day-label';
        div.textContent = label;
        grid.appendChild(div);
    });

    const year = calendarDisplayDate.getFullYear();
    const month = calendarDisplayDate.getMonth();

    // First day of current month
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 6 is Saturday
    
    // Number of days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Number of days in previous month
    const prevTotalDays = new Date(year, month, 0).getDate();

    // Today's date (local)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Selected date
    const selectedStr = currentDate;

    // Previous month's trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const day = prevTotalDays - i;
        const cellDate = new Date(year, month - 1, day);
        const cellDateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        
        const div = document.createElement('div');
        div.className = 'cal-date muted';
        div.textContent = day;
        div.onclick = () => {
            currentDate = cellDateStr;
            calendarDisplayDate = new Date(cellDate);
            renderAdminCalendar();
            loadSlots();
        };
        grid.appendChild(div);
    }

    // Current month's days
    for (let day = 1; day <= totalDays; day++) {
        const cellDate = new Date(year, month, day);
        const cellDateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        
        const div = document.createElement('div');
        let className = 'cal-date';
        
        if (cellDateStr === selectedStr) {
            className += ' active';
        } else if (cellDateStr === todayStr) {
            className += ' today';
        }
        
        div.className = className;
        div.textContent = day;
        div.onclick = () => {
            currentDate = cellDateStr;
            renderAdminCalendar();
            loadSlots();
        };
        grid.appendChild(div);
    }

    // Next month's leading days to fill up to 42 cells total (6 rows of 7 days)
    const currentCellsCount = firstDayIndex + totalDays;
    const remainingCells = 42 - currentCellsCount;
    for (let day = 1; day <= remainingCells; day++) {
        const cellDate = new Date(year, month + 1, day);
        const cellDateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        
        const div = document.createElement('div');
        div.className = 'cal-date muted';
        div.textContent = day;
        div.onclick = () => {
            currentDate = cellDateStr;
            calendarDisplayDate = new Date(cellDate);
            renderAdminCalendar();
            loadSlots();
        };
        grid.appendChild(div);
    }
}

function handleBulkAction(action) {
    if (!currentDoctorId) {
        alert("Please select a doctor first.");
        return;
    }

    const userData = checkAuth('admin');
    if (!userData) return;

    let confirmationMessage = "";
    if (action === 'block_all') {
        confirmationMessage = "Are you sure you want to block all remaining available slots for this doctor on this date?";
    } else if (action === 'unblock_all') {
        confirmationMessage = "Are you sure you want to unblock all blocked slots for this doctor on this date?";
    } else if (action === 'emergency_only') {
        confirmationMessage = "WARNING: This will block all slots and cancel ALL booked appointments for this doctor on this date. Are you sure you want to proceed?";
    }

    if (!confirm(confirmationMessage)) return;

    fetch("../PHP/bulk_manage_slots.php", {
        method: "POST",
        body: JSON.stringify({
            doctor_id: currentDoctorId,
            date: currentDate,
            action: action,
            admin_id: userData.id
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert(res.message);
            loadSlots();
            loadAdminDashboardData(userData);
        } else {
            alert(res.message);
        }
    })
    .catch(err => {
        console.error("Bulk action error:", err);
        alert("Failed to perform bulk action.");
    });
}
