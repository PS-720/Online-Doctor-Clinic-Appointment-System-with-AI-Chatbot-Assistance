/**
 * Patient Dashboard Functionality for SmartCare
 */

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in as patient
    const userData = checkAuth('patient');
    if (!userData) return;

    // Set Welcome Name
    const welcomeHeading = document.getElementById('patient-welcome');
    if (welcomeHeading) welcomeHeading.textContent = `Welcome Back, ${userData.full_name || 'Patient'}!`;

    // Initial data fetch
    loadPatientDashboard(userData);

    // Booking Flow Setup
    setupBookingFlow(userData);

    // Logout handling
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('smartcare_user');
            window.location.href = 'login.html';
        };
    }
});

function loadPatientDashboard(userData) {
    if (!userData) return;

    fetch("../PHP/fetch_dashboard_data.php", {
        method: "POST",
        body: JSON.stringify({ user_id: userData.id, role: userData.role })
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
    // 1. Update Stats - Main Dashboard (4 cards)
    const dashStats = document.querySelectorAll('#section-dashboard .stats-numbers');
    if (dashStats.length >= 4) {
        dashStats[0].textContent = data.stats.total_appointments || 0;
        dashStats[1].textContent = data.stats.upcoming_visits || 0;
        dashStats[2].textContent = '0'; // Favourite Doctors (Simulated)
        dashStats[3].textContent = '92%'; // Health Score (Simulated)
    }

    // 2. Update Stats - My Appointments View (3 cards)
    const tableStatApproved = document.getElementById('table-stat-approved');
    const tableStatPending = document.getElementById('table-stat-pending');
    const tableStatRejected = document.getElementById('table-stat-rejected');
    
    if (tableStatApproved) tableStatApproved.textContent = data.stats.approved || 0;
    if (tableStatPending) tableStatPending.textContent = data.stats.pending || 0;
    if (tableStatRejected) tableStatRejected.textContent = data.stats.rejected || 0;

    // 3. Update Upcoming Appointments - Dashboard List
    const appList = document.querySelector('#section-dashboard .app-list');
    if (appList) {
        const upcoming = (data.history || []).filter(a => a.status === 'confirmed').slice(0, 3);
        
        if (!upcoming.length) {
            appList.innerHTML = '<p style="text-align:center; padding: 2rem; color: #64748b;">No upcoming appointments.</p>';
        } else {
            appList.innerHTML = upcoming.map(appt => `
                <div class="activity-item">
                    <div class="doc-name-logo">
                        <div class="app-list-logo">
                            <img class="icons" src="../Assets/Icons/blue-heart-light-border.svg" alt="Heart" />
                        </div>
                        <div class="doc-name">
                            <h4>Dr. ${appt.doctor_name}</h4>
                            <p>${appt.specialization}</p>
                        </div>
                    </div>
                    <div class="app-day-time">
                        <p class="app-day">${appt.appointment_date}</p>
                        <p class="app-time">${appt.start_time.slice(0, 5)}</p>
                    </div>
                    <div class="app-status-confirmed">
                        <p class="status-confirmed">${appt.status}</p>
                    </div>
                </div>
            `).join('');
        }
    }

    // 4. Update History Table
    renderHistoryTable(data.history || []);
}

function renderHistoryTable(history) {
    const tableBody = document.getElementById('appointment-history-body');
    if (!tableBody) return;

    if (!history.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 3rem;">No appointment history found.</td></tr>';
        return;
    }

    tableBody.innerHTML = history.map(appt => `
        <tr>
            <td style="font-weight:700;">Dr. ${appt.doctor_name}</td>
            <td>${appt.specialization}</td>
            <td>
                <div class="app-day-time" style="align-items:start;">
                    <p class="app-day" style="margin:0;">${appt.appointment_date}</p>
                    <p class="app-time" style="margin:0;">${appt.start_time.slice(0, 5)}</p>
                </div>
            </td>
            <td>
                <div class="app-status-${appt.status === 'confirmed' ? 'confirmed' : (appt.status === 'cancelled' ? 'rejected' : 'pending')}">
                    <p class="status-${appt.status === 'confirmed' ? 'confirmed' : (appt.status === 'cancelled' ? 'rejected' : 'pending')}">${appt.status}</p>
                </div>
            </td>
            <td>
                <button class="view-detail-btn" title="View Details">Details</button>
            </td>
        </tr>
    `).join('');
}

function setupBookingFlow(userData) {
    if (!userData) return;
    const drSelect = document.getElementById('select-doctor');
    const dateInput = document.getElementById('app-date');
    const timeSelect = document.getElementById('app-time');
    const symptomsInput = document.getElementById('desc-symptoms');
    const notesInput = document.getElementById('add-notes');
    const bookingForm = document.querySelector('.book-appointment-form');

    if (!drSelect || !dateInput || !timeSelect) return;

    // Fetch approved doctors
    fetch("../PHP/fetch_approved_doctors.php")
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                if (!res.doctors.length) {
                    drSelect.innerHTML = '<option value="" disabled>No doctors available</option>';
                } else {
                    drSelect.innerHTML = '<option value="" selected disabled hidden>Select Doctor</option>' + 
                        res.doctors.map(d => `<option value="${d.doctor_id}">Dr. ${d.full_name} (${d.specialization})</option>`).join('');
                }
            }
        });

    const updateSlots = () => {
        const drId = drSelect.value;
        const date = dateInput.value;
        
        if (!drId) {
            timeSelect.innerHTML = '<option value="" disabled>Select Doctor First</option>';
            return;
        }
        if (!date) {
            timeSelect.innerHTML = '<option value="" disabled>Select Date First</option>';
            return;
        }

        timeSelect.innerHTML = '<option value="" disabled>Searching availability...</option>';
        
        fetch("../PHP/fetch_slots.php", {
            method: "POST",
            body: JSON.stringify({ doctor_id: drId, date: date })
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                const available = res.slots.filter(s => s.status === 'available');
                if (!available.length) {
                    timeSelect.innerHTML = '<option value="" disabled>No Slots Available</option>';
                } else {
                    timeSelect.innerHTML = '<option value="" selected disabled hidden>Select Time slot</option>' + 
                        available.map(s => {
                            const [h, m] = s.start_time.split(':');
                            const hh = parseInt(h);
                            const suffix = hh >= 12 ? 'PM' : 'AM';
                            const hour = hh % 12 || 12;
                            return `<option value="${s.slot_id}">${hour}:${m} ${suffix}</option>`;
                        }).join('');
                }
            }
        });
    };

    drSelect.addEventListener('change', updateSlots);
    dateInput.addEventListener('change', updateSlots);

    // Form Submission
    if (bookingForm) {
        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const slotId = timeSelect.value;
            const symptoms = symptomsInput.value;
            const notes = notesInput ? notesInput.value : '';

            if (!slotId) { alert("Please select an available time slot."); return; }

            fetch("../PHP/book_appointment.php", {
                method: "POST",
                body: JSON.stringify({ user_id: userData.id, slot_id: slotId, symptoms: symptoms, notes: notes })
            })
            .then(res => res.json())
            .then(res => {
                alert(res.message);
                if (res.success) {
                    showSection('my-appointments');
                    loadPatientDashboard(userData);
                    bookingForm.reset();
                    timeSelect.innerHTML = '<option value="" disabled>Select Doctor & Date first</option>';
                }
            });
        });
    }
}

function showSection(sectionName) {
    document.querySelectorAll(".content-section").forEach(section => {
        section.classList.remove("active");
        section.classList.add("hidden");
    });

    const target = document.getElementById("section-" + sectionName);
    if (target) {
        target.classList.remove("hidden");
        target.classList.add("active");
    }

    // Sidebar navigation states
    document.querySelectorAll(".menu-item-anchor").forEach(btn => {
        btn.classList.remove("active-menu");
        let iconName = btn.getAttribute("data-icon");
        if (iconName) {
            let img = btn.querySelector("img");
            if (img) img.src = `../Assets/Icons/gray-${iconName}.svg`;
        }
    });

    const activeBtn = document.getElementById("btn-" + sectionName);
    if (activeBtn) {
        activeBtn.classList.add("active-menu");
        let iconName = activeBtn.getAttribute("data-icon");
        if (iconName) {
            let img = activeBtn.querySelector("img");
            if (img) img.src = `../Assets/Icons/blue-${iconName}.svg`;
        }
    }
}
