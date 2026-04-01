/**
 * Doctor Dashboard Functionality for SmartCare
 */

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in as doctor
    const userData = checkAuth('doctor');
    if (!userData) return;

    // Initial data fetch
    loadDashboardData();

    // Add Slot Handler
    const addSlotBtn = document.querySelector('.btn-add-slot');
    if (addSlotBtn) {
        addSlotBtn.addEventListener('click', handleAddSlot);
    }
});

function loadDashboardData() {
    fetch("../PHP/fetch_dashboard_data.php", {
        method: "POST",
        body: JSON.stringify({ user_id: user.user_id, role: user.role })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            const data = res.data;
            updateDashboardStats(data.stats);
            updateUpcomingAppointments(data.upcoming);
            updateAvailabilityList(data.availability);
        }
    })
    .catch(err => console.error("Data fetch error:", err));
}

function updateDashboardStats(stats) {
    // Update counts in dashboard section
    const statCards = document.querySelectorAll('.mini-stats h4');
    if (statCards.length >= 3) {
        statCards[0].textContent = stats.today_appointments || 0;
        statCards[1].textContent = stats.completed || 0;
        statCards[2].textContent = stats.cancelled || 0;
    }
}

function updateUpcomingAppointments(upcoming) {
    const list = document.querySelector('.upcoming-appointment-list');
    if (!list) return;
    if (!upcoming.length) {
        list.innerHTML = '<p style="text-align:center; padding: 2rem; color: #64748b;">No upcoming appointments.</p>';
        return;
    }

    list.innerHTML = upcoming.map(appt => `
        <div class="appointment-detail-card" style="background:#fff; border-radius:12px; padding:15px; margin-bottom:15px; border:1px solid #e2e8f0;">
            <div class="appointment-main-info" style="display:flex; justify-content:space-between; align-items:center;">
                <div class="appointment-patient" style="display:flex; gap:12px; align-items:center;">
                    <div class="patient-avatar-circle" style="width:40px; height:40px; background:#eff6ff; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                        <img src="../Assets/Icons/blue-user-circle.svg" alt="Patient" style="width: 24px;">
                    </div>
                    <div class="patient-text">
                        <h4 style="margin:0; font-size:1rem;">${appt.patient_name}</h4>
                        <span style="font-size:0.8rem; color:#64748b;">${appt.notes || 'Status: ' + appt.status}</span>
                        <div class="appointment-time-info" style="display:flex; gap:10px; margin-top:5px;">
                            <div class="time-row" style="display:flex; align-items:center; gap:5px; font-size:0.75rem; color:#94a3b8;">
                                <img src="../Assets/Icons/gray-calendar.svg" alt="Date" style="width: 14px;">
                                ${appt.appointment_date}
                            </div>
                            <div class="time-row" style="display:flex; align-items:center; gap:5px; font-size:0.75rem; color:#94a3b8;">
                                <img src="../Assets/Icons/brown-clock.svg" alt="Time" style="width: 14px; filter: grayscale(1);">
                                ${appt.start_time}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="appointment-actions" style="text-align:right;">
                    <span class="status-badge scheduled" style="display:inline-block; margin-bottom:10px; font-size:0.7rem; font-weight:700; text-transform:uppercase; color:#155dfc;">${appt.status}</span>
                    <div class="action-buttons" style="display:flex; gap:8px;">
                        <button class="btn-outline btn-complete" onclick="updateStatus(${appt.appointment_id}, 'completed')" style="background:none; border:1px solid #22c55e; color:#22c55e; padding:5px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:5px;">
                            <img src="../Assets/Icons/green-check.svg" alt="Complete" style="width: 14px;">
                            Complete
                        </button>
                        <button class="btn-outline btn-cancel" onclick="updateStatus(${appt.appointment_id}, 'cancelled')" style="background:none; border:1px solid #ef4444; color:#ef4444; padding:5px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:5px;">
                            <img src="../Assets/Icons/red-cross-circle.svg" alt="Cancel" style="width: 14px;">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function updateAvailabilityList(availability) {
    const list = document.querySelector('.schedule-list');
    if (!list) return;
    list.innerHTML = availability.map(row => `
        <div class="schedule-row ${row.is_approved ? 'active' : 'pending'}" style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:#f8fafc; border-radius:12px; margin-bottom:10px;">
            <input type="checkbox" ${row.is_approved ? 'checked' : ''} disabled style="width: 20px; height: 20px;">
            <div style="flex:1; margin-left:15px;">
                <span class="row-label" style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">Day</span>
                <span class="row-value" style="font-weight:700;">${row.day_of_week}</span>
            </div>
            <div style="flex:1;">
                <span class="row-label" style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">Start Time</span>
                <span class="row-value" style="font-weight:700;">${row.start_time.slice(0, 5)}</span>
            </div>
            <div style="flex:1;">
                <span class="row-label" style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">End Time</span>
                <span class="row-value" style="font-weight:700;">${row.end_time.slice(0, 5)}</span>
            </div>
            <span class="status-badge ${row.status}" style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:4px 10px; border-radius:20px; background:#e2e8f0;">${row.status}</span>
            <button class="btn-trash" onclick="deleteAvailability(${row.availability_id})" style="background:none; border:none; cursor:pointer; margin-left:15px;">
                <img src="../Assets/Icons/red-trash.svg" alt="Delete" style="width: 18px;">
            </button>
        </div>
    `).join('');
}

function handleAddSlot() {
    const day = document.querySelector('.add-slot-card select').value;
    const start = document.querySelectorAll('.add-slot-card input')[0].value;
    const end = document.querySelectorAll('.add-slot-card input')[1].value;

    fetch("../PHP/save_availability.php", {
        method: "POST",
        body: JSON.stringify({
            user_id: user.user_id, // Backend uses user_id to find doctor record
            day_of_week: day,
            start_time: start,
            end_time: end
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            alert(res.message);
            loadDashboardData();
        } else {
            alert(res.message);
        }
    });
}

function updateStatus(id, newStatus) {
    if(!confirm(`Are you sure you want to mark this appointment as ${newStatus}?`)) return;

    fetch("../PHP/appointment_actions.php", {
        method: "POST",
        body: JSON.stringify({ appointment_id: id, status: newStatus })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            loadDashboardData();
        } else {
            alert("Update failed: " + res.message);
        }
    });
}

function deleteAvailability(id) {
    if(!confirm("Are you sure you want to delete this availability slot?")) return;

    fetch("../PHP/manage_availability.php", {
        method: "POST",
        body: JSON.stringify({ availability_id: id, status: 'deleted' })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            loadDashboardData();
        } else {
            alert("Delete failed: " + res.message);
        }
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
    if (activeItem) {
        activeItem.classList.add('active');
    }
}
