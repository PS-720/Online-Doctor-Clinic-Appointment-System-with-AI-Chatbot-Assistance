/**
 * Patient Dashboard Functionality for SmartCare
 */

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in as patient
    const userData = checkAuth('patient');
    if (!userData) return;

    // Set Welcome Name
    const welcomeHeading = document.querySelector('.greetings h3');
    if (welcomeHeading) welcomeHeading.textContent = `Welcome Back, ${userData.full_name || 'Patient'}!`;

    // Initial data fetch
    loadPatientDashboard();

    // Booking Flow Setup
    setupBookingFlow();
});

function loadPatientDashboard() {
    fetch("../PHP/fetch_dashboard_data.php", {
        method: "POST",
        body: JSON.stringify({ user_id: user.user_id, role: user.role })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            updateDashboardUI(res.data);
        }
    })
    .catch(err => console.error("Patient dash load error:", err));
}

function updateDashboardUI(data) {
    // 1. Update Stats - Dashboard Section
    const statsNumbers = document.querySelectorAll('#section-dashboard .stats-numbers');
    if (statsNumbers.length >= 4) {
        statsNumbers[0].textContent = data.stats.total_appointments || 0;
        statsNumbers[1].textContent = data.stats.upcoming_visits || 0;
        statsNumbers[2].textContent = '5'; // Simulated
        statsNumbers[3].textContent = '92%'; // Simulated
    }

    // 2. Update Stats - My Appointments Section
    const tableStats = document.querySelectorAll('#section-my-appointments .stats-numbers');
    if (tableStats.length >= 3) {
        tableStats[0].textContent = data.stats.approved || 0;
        tableStats[1].textContent = data.stats.pending || 0;
        tableStats[2].textContent = data.stats.rejected || 0;
    }

    // 3. Update Upcoming Appointments - Dashboard
    const appList = document.querySelector('#section-dashboard .app-list');
    if (appList) {
        const upcoming = data.history.filter(a => a.status === 'confirmed').slice(0, 3);
        
        if (!upcoming.length) {
            appList.innerHTML = '<p style="text-align:center; padding: 2rem; color: #64748b;">No upcoming appointments.</p>';
        } else {
            appList.innerHTML = upcoming.map(appt => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:#f8fafc; border-radius:12px; margin-bottom:10px;">
                    <div class="doc-name-logo" style="display:flex; gap:12px; align-items:center;">
                        <div class="app-list-logo" style="width:32px; height:32px; background:#eff6ff; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                            <img class="icons" src="../Assets/Icons/blue-heart-light-border.svg" alt="Heart Icon" style="width:16px;" />
                        </div>
                        <div class="doc-name">
                            <h4 style="margin:0; font-size:0.95rem;">Dr. ${appt.doctor_name}</h4>
                            <p style="margin:0; font-size:0.8rem; color:#64748b;">${appt.specialization}</p>
                        </div>
                    </div>
                    <div class="app-day-time" style="text-align:center;">
                        <p class="app-day" style="margin:0; font-size:0.85rem; font-weight:700;">${appt.appointment_date}</p>
                        <p class="app-time" style="margin:0; font-size:0.75rem; color:#64748b;">${appt.start_time.slice(0, 5)}</p>
                    </div>
                    <div class="app-status-confirmed">
                        <p class="status-confirmed" style="margin:0; font-size:0.7rem; font-weight:800; text-transform:uppercase; color:#155dfc; background:#eff6ff; padding:4px 10px; border-radius:20px;">${appt.status}</p>
                    </div>
                </div>
            `).join('');
        }
    }

    // 4. Update History Table
    renderHistoryTable(data.history);
}

function renderHistoryTable(history) {
    const table = document.querySelector('.app-table');
    if (!table) return;

    // Keep header
    const header = `
        <tr>
            <th>Doctor</th>
            <th>Speciality</th>
            <th>Date & Time</th>
            <th>Symptoms</th>
            <th>Status</th>
            <th>Action</th>
        </tr>
    `;

    if (!history || !history.length) {
        table.innerHTML = header + '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No appointments found.</td></tr>';
        return;
    }

    const rows = history.map(appt => `
        <tr>
            <td style="font-weight:700;">Dr. ${appt.doctor_name}</td>
            <td>${appt.specialization}</td>
            <td>
                <div class="app-day-time">
                    <p class="app-day" style="margin:0; font-weight:700;">${appt.appointment_date}</p>
                    <p class="app-time" style="margin:0; color:#64748b; font-size:0.8rem;">${appt.start_time.slice(0, 5)}</p>
                </div>
            </td>
            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${appt.notes || 'N/A'}</td>
            <td><span class="status-badge ${appt.status}">${appt.status}</span></td>
            <td>
                <button class="btn-action" title="View Details" style="background:none; border:none; cursor:pointer;"><img src="../Assets/Icons/gray-eye.svg" alt="View" style="width:16px; opacity:0.6;"></button>
            </td>
        </tr>
    `).join('');

    table.innerHTML = header + rows;
}

function setupBookingFlow() {
    const drSelect = document.getElementById('select-doctor');
    const dateInput = document.getElementById('app-date');
    const timeSelect = document.getElementById('app-time');
    const symptomsInput = document.getElementById('desc-symptoms');

    if (!drSelect || !dateInput || !timeSelect) return;

    // Fetch approved doctors
    fetch("../PHP/fetch_approved_doctors.php")
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                drSelect.innerHTML = '<option value="" selected disabled hidden>Select Doctor</option>' + 
                    res.doctors.map(d => `<option value="${d.doctor_id}">${d.full_name} (${d.specialization})</option>`).join('');
            }
        });

    const updateSlots = () => {
        const drId = drSelect.value;
        const date = dateInput.value;
        if (drId && date) {
            timeSelect.innerHTML = '<option value="" selected disabled hidden>Loading slots...</option>';
            fetch("../PHP/fetch_slots.php", {
                method: "POST",
                body: JSON.stringify({ doctor_id: drId, date: date })
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    const available = res.slots.filter(s => s.status === 'available');
                    if (!available.length) {
                        timeSelect.innerHTML = '<option value="" selected disabled hidden>No Availability</option>';
                    } else {
                        timeSelect.innerHTML = '<option value="" selected disabled hidden>Select Time slot</option>' + 
                            available.map(s => `<option value="${s.slot_id}">${s.start_time.slice(0, 5)}</option>`).join('');
                    }
                }
            });
        }
    };

    drSelect.addEventListener('change', updateSlots);
    dateInput.addEventListener('change', updateSlots);

    // Form Submission
    const bookingForm = document.querySelector('.book-appointment-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const slotId = timeSelect.value;
            const symptoms = symptomsInput.value;

            if (!slotId) { alert("Please select an available time slot."); return; }

            fetch("../PHP/book_appointment.php", {
                method: "POST",
                body: JSON.stringify({ user_id: user.user_id, slot_id: slotId, symptoms: symptoms })
            })
            .then(res => res.json())
            .then(res => {
                alert(res.message);
                if (res.success) {
                    showSection('my-appointments');
                    loadPatientDashboard();
                    bookingForm.reset();
                }
            });
        });
    }

    // "Book Now" buttons on dashboard
    const bookNowBtns = document.querySelectorAll('.book-now-btn, .book-appointment-btn');
    bookNowBtns.forEach(btn => {
        btn.onclick = () => showSection('book-appointment');
    });
}

function showSection(sectionName) {
    document.querySelectorAll(".content-section").forEach(function (section) {
        section.classList.remove("active");
        section.classList.add("hidden");
    });

    document.querySelectorAll(".menu-item-anchor").forEach(function (btn) {
        btn.classList.remove("active-menu");
        let iconName = btn.getAttribute("data-icon");
        if (iconName) {
            let img = btn.querySelector("img");
            if (img) img.src = `../Assets/Icons/gray-${iconName}.svg`;
        }
    });

    let target = document.getElementById("section-" + sectionName);
    if (target) {
        target.classList.remove("hidden");
        target.classList.add("active");
    }

    let activeBtn = document.getElementById("btn-" + sectionName);
    if (activeBtn) {
        activeBtn.classList.add("active-menu");
        let iconName = activeBtn.getAttribute("data-icon");
        if (iconName) {
            let img = activeBtn.querySelector("img");
            if (img) img.src = `../Assets/Icons/blue-${iconName}.svg`;
        }
    }
}
