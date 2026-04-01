/**
 * Admin Dashboard Functionality for SmartCare
 */

// Global state for Slot Control
let currentDoctorId = null; 
let currentDate = new Date().toISOString().split('T')[0];

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in as admin
    const userData = checkAuth('admin');
    if (!userData) return;

    // Set default date for slot picker
    const datePicker = document.getElementById('slot-date-picker');
    if (datePicker) {
        datePicker.value = currentDate;
        datePicker.addEventListener('change', (e) => {
            currentDate = e.target.value;
            if(currentDoctorId) loadSlots();
        });
    }

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

    // Form submission for adding a doctor
    const addDoctorForm = document.getElementById('add-doctor-form');
    if (addDoctorForm) {
        addDoctorForm.onsubmit = handleAddDoctor;
    }

    // Initial data fetch
    loadAdminDashboardData(userData);
});

function loadAdminDashboardData(userData) {
    if (!userData) return;
    
    fetch("../PHP/fetch_dashboard_data.php", {
        method: "POST",
        body: JSON.stringify({ user_id: userData.user_id, role: userData.role })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            const data = res.data;
            updateAdminStats(data.stats);
            updateRecentAppointments(data.recent_appointments);
            updatePendingApprovals(data.pending_approvals);
            renderDoctorsTable(data.all_doctors);
            renderAppointmentsTable(data.all_appointments);
            populateDoctorSelect(data.all_doctors);
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
        docMetrics[1].textContent = stats.total_doctors || 0; 
        docMetrics[2].textContent = 0;
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
            <td><span class="badge-pill available" style="background: #ecfdf5; color: #059669; padding: 4px 8px; border-radius: 99px; font-size: 0.75rem;">Active</span></td>
            <td>
                <div class="action-icon-btns" style="display: flex; gap: 8px;">
                    <button class="btn-icon-action" title="Edit Doctor" style="background:none; border:none; cursor:pointer;"><img src="../Assets/Icons/gray-edit.svg" alt="Edit" style="width: 16px;"></button>
                    <button class="btn-icon-action" title="View Schedule" onclick="viewDoctorSchedule(${doc.doctor_id})" style="background:none; border:none; cursor:pointer;"><img src="../Assets/Icons/gray-calendar.svg" alt="Schedule" style="width: 16px;"></button>
                </div>
            </td>
        </tr>
    `).join('');
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
                <button class="btn-icon-action" title="Edit" style="background:none; border:none; cursor:pointer;"><img src="../Assets/Icons/gray-edit.svg" alt="Edit" style="width: 16px;"></button>
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
        
        return `
            <div class="slot-card-admin ${slot.status}" style="background:#fff; border-radius:12px; padding:15px; box-shadow:0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                <div class="slot-header-admin" style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="slot-time-admin"><img src="../Assets/Icons/brown-clock.svg" alt="Clock" style="width: 16px; filter: grayscale(1);"> ${slot.start_time.slice(0, 5)}</div>
                    <span class="slot-status-badge ${slot.status}" style="font-size:0.7rem; text-transform:uppercase; font-weight:700;">${slot.status}</span>
                </div>
                ${isBooked ? `<p class="slot-patient-info" style="font-size:0.75rem; margin-top:8px;">Patient: <strong>${slot.patient_name || 'N/A'}</strong></p>` : ''}
                
                <div class="slot-actions-admin" style="margin-top:12px; display:flex; gap:5px;">
                    ${slot.status === 'available' ? `
                        <button class="btn-slot-action" onclick="handleSlotAction(${slot.slot_id}, 'block')" style="background:#f1f5f9; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.75rem;">Block</button>
                    ` : ''}

                    ${isBooked ? `
                        <button class="btn-slot-action" onclick="handleSlotAction(${slot.slot_id}, 'cancel')" style="background:#fee2e2; color:#b91c1c; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.75rem;">Cancel</button>
                    ` : ''}

                    ${isBlocked ? `
                        <button class="btn-slot-action" onclick="handleSlotAction(${slot.slot_id}, 'unblock')" style="background:#f1f5f9; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:0.75rem;">Unblock</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function handleSlotAction(id, action) {
    let endpoint = "../PHP/manage_slots.php";
    let payload = { slot_id: id, action: action, admin_id: user.user_id };

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
            loadAdminDashboardData();
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
            loadAdminDashboardData();
        } else {
            alert("Error: " + res.message);
        }
    });
}

function viewDoctorSchedule(id) {
    currentDoctorId = id;
    const drSelect = document.getElementById('slot-dr-select');
    if (drSelect) drSelect.value = id;
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
