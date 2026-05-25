let doctorProfile = null;
let doctorPatients = [];
let activePatientId = null;

// Initialization
window.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in as doctor
  const userData = checkAuth("doctor");
  if (!userData) return;

  // Initial data fetch
  loadDashboardData();

  // Add Slot Handler (Availability Tab)
  const addSlotBtn = document.querySelector(".btn-add-slot");
  if (addSlotBtn) {
    addSlotBtn.addEventListener("click", handleAddSlot);
  }

  // Quick Save Handler (Dashboard Section)
  const quickSaveBtn = document.querySelector(".save-btn");
  if (quickSaveBtn) {
    quickSaveBtn.addEventListener("click", handleQuickSave);
  }

  // Profile Edit Modal Listeners
  const editProfileBtn = document.querySelector(".btn-edit-profile");
  const modal = document.getElementById("modal-edit-profile");
  const closeModalBtn = document.querySelector(".btn-close-modal");
  const cancelEditBtn = document.querySelector(".btn-cancel-edit");
  const editForm = document.getElementById("form-edit-profile");

  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
      populateEditModal();
      modal.classList.add("active");
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
  }

  if (editForm) {
    editForm.addEventListener("submit", handleUpdateProfile);
  }

  // Patients Roster Listeners
  const searchInput = document.getElementById("search-patients-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = doctorPatients.filter((p) => {
        return (
          p.full_name.toLowerCase().includes(query) ||
          p.email.toLowerCase().includes(query)
        );
      });
      renderPatientsGrid(filtered);
    });
  }

  const patientModal = document.getElementById("modal-patient-details");
  const closePatientModalBtn = document.querySelector(".btn-close-patient-modal");
  if (closePatientModalBtn && patientModal) {
    closePatientModalBtn.addEventListener("click", () => {
      patientModal.classList.remove("active");
    });
  }

  if (patientModal) {
    patientModal.addEventListener("click", (e) => {
      if (e.target === patientModal) {
        patientModal.classList.remove("active");
      }
    });
  }

  const saveConditionsBtn = document.getElementById("btn-save-conditions");
  if (saveConditionsBtn) {
    saveConditionsBtn.addEventListener("click", handleUpdateConditions);
  }
});

function populateEditModal() {
  if (!doctorProfile) return;

  document.getElementById("edit-name").value = doctorProfile.full_name || "";
  document.getElementById("edit-email").value = doctorProfile.email || "";
  document.getElementById("edit-phone").value = doctorProfile.phone || "";
  document.getElementById("edit-specialization").value = doctorProfile.specialization || "";
  document.getElementById("edit-experience").value = doctorProfile.experience_years || 0;
  document.getElementById("edit-qualification").value = doctorProfile.qualification || "";
  document.getElementById("edit-fee").value = parseInt(doctorProfile.consultation_fee) || 0;
  document.getElementById("edit-location").value = doctorProfile.location || "";
  document.getElementById("edit-bio").value = doctorProfile.bio || "";
  document.getElementById("edit-education").value = doctorProfile.education || "";
  document.getElementById("edit-languages").value = doctorProfile.languages || "";
  document.getElementById("edit-address").value = doctorProfile.address || "";
}

function handleUpdateProfile(e) {
  e.preventDefault();
  const userData = checkAuth("doctor");
  if (!userData) return;

  const updatedData = {
    user_id: userData.id,
    full_name: document.getElementById("edit-name").value,
    email: document.getElementById("edit-email").value,
    phone: document.getElementById("edit-phone").value,
    specialization: document.getElementById("edit-specialization").value,
    experience_years: document.getElementById("edit-experience").value,
    qualification: document.getElementById("edit-qualification").value,
    consultation_fee: document.getElementById("edit-fee").value,
    location: document.getElementById("edit-location").value,
    bio: document.getElementById("edit-bio").value,
    education: document.getElementById("edit-education").value,
    languages: document.getElementById("edit-languages").value,
    address: document.getElementById("edit-address").value,
  };

  fetch("../PHP/update_profile.php", {
    method: "POST",
    body: JSON.stringify(updatedData),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        alert("Profile updated successfully!");
        document.getElementById("modal-edit-profile").classList.remove("active");
        loadDashboardData();
      } else {
        alert("Update failed: " + res.message);
      }
    })
    .catch((err) => {
      console.error("Profile update error:", err);
      alert("An error occurred while updating profile.");
    });
}

function handleQuickSave() {
  const userData = checkAuth("doctor");
  if (!userData) return;

  const dayRows = document.querySelectorAll("#section-dashboard .day-row");
  const startTime = document.getElementById("quick-start-time").value;
  const endTime = document.getElementById("quick-end-time").value;

  const checkedDays = [];
  dayRows.forEach((row) => {
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked) {
      checkedDays.push(row.querySelector("span").textContent.trim());
    }
  });

  if (checkedDays.length === 0) {
    alert("Please select at least one working day.");
    return;
  }

  // Sequential save to avoid race conditions and handle one-by-one backend logic
  const savePromises = checkedDays.map((day) => {
    return fetch("../PHP/save_availability.php", {
      method: "POST",
      body: JSON.stringify({
        user_id: userData.id,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
      }),
    }).then((res) => res.json());
  });

  Promise.all(savePromises)
    .then((results) => {
      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        alert("Availability updated for selected days. Some may be pending admin approval.");
        loadDashboardData();
      } else {
        const error = results.find((r) => !r.success);
        alert("Some updates failed: " + (error ? error.message : "Unknown error"));
      }
    })
    .catch((err) => {
      console.error("Quick save error:", err);
      alert("An error occurred while saving availability.");
    });
}

function loadDashboardData() {
  // Re-check authentication to get latest user data
  const userData = checkAuth("doctor");
  if (!userData) return;

  fetch("../PHP/fetch_dashboard_data.php", {
    method: "POST",
    body: JSON.stringify({ user_id: userData.id, role: userData.role }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        const data = res.data;
        updateDashboardStats(data.stats);
        updateUpcomingAppointments(data.upcoming);
        updateAvailabilityList(data.availability);
        if (data.profile) {
          doctorProfile = data.profile;
          updateDoctorProfile(data.profile);
        }
        loadPatientsData();
      }
    })
    .catch((err) => console.error("Data fetch error:", err));
}

function updateDoctorProfile(profile) {
  // Top summary
  const nameEle = document.getElementById("prof-full-name");
  const specEle = document.getElementById("prof-specialization");
  const expEle = document.getElementById("prof-experience");

  if (nameEle) nameEle.textContent = "Dr. " + profile.full_name;
  if (specEle) specEle.textContent = profile.specialization;
  if (expEle)
    expEle.textContent = profile.experience_years + " years of experience";

  // Basic Info table
  const name2Ele = document.getElementById("prof-full-name-2");
  const emailEle = document.getElementById("prof-email");
  const phoneEle = document.getElementById("prof-phone");
  const spec2Ele = document.getElementById("prof-specialization-2");
  const exp2Ele = document.getElementById("prof-experience-2");
  const licEle = document.getElementById("prof-license");
  const feeEle = document.getElementById("prof-fee");

  if (name2Ele) name2Ele.textContent = "Dr. " + profile.full_name;
  if (emailEle) emailEle.textContent = profile.email;
  if (phoneEle) phoneEle.textContent = profile.phone || "N/A";
  if (spec2Ele) spec2Ele.textContent = profile.specialization;
  if (exp2Ele) exp2Ele.textContent = profile.experience_years + " years";
  if (licEle) licEle.textContent = profile.qualification || "N/A";
  if (feeEle) feeEle.textContent = "₹" + profile.consultation_fee;

  // Professional Info
  const locEle = document.getElementById("prof-location");
  const bioEle = document.getElementById("prof-bio");
  const eduEle = document.getElementById("prof-education");
  const langEle = document.getElementById("prof-languages");
  const addrEle = document.getElementById("prof-address");

  if (locEle) locEle.textContent = profile.location || "N/A";
  if (bioEle) bioEle.textContent = profile.bio || "No biography provided.";
  if (eduEle) eduEle.textContent = profile.education || "Qualification details not available.";
  if (langEle) langEle.textContent = profile.languages || "N/A";
  if (addrEle) addrEle.textContent = profile.address || "No address provided.";
}

function updateDashboardStats(stats) {
  // 1. Update counts in the Main Dashboard Section (.stats-grid)
  const dashboardStatValues = document.querySelectorAll("#section-dashboard .stat-value");
  if (dashboardStatValues.length >= 3) {
    dashboardStatValues[0].textContent = stats.today_appointments || 0;
    dashboardStatValues[1].textContent = stats.completed_today || 0;
    dashboardStatValues[2].textContent = stats.total_patients || 0;
  }

  // 2. Update counts in the My Appointments Section (.mini-stats)
  const miniStatValues = document.querySelectorAll("#section-appointments .mini-stats h4");
  if (miniStatValues.length >= 3) {
    miniStatValues[0].textContent = stats.today_appointments || 0;
    miniStatValues[1].textContent = stats.completed || 0;
    miniStatValues[2].textContent = stats.cancelled || 0;
  }
}

function updateUpcomingAppointments(upcoming) {
  const list = document.querySelector(".upcoming-appointment-list");
  if (!list) return;
  if (!upcoming.length) {
    list.innerHTML =
      '<p style="text-align:center; padding: 2rem; color: #64748b;">No upcoming appointments.</p>';
    return;
  }

  list.innerHTML = upcoming
    .map(
      (appt) => `
        <div class="appointment-detail-card" style="background:#fff; border-radius:12px; padding:15px; margin-bottom:15px; border:1px solid #e2e8f0;">
            <div class="appointment-main-info" style="display:flex; justify-content:space-between; align-items:center;">
                <div class="appointment-patient" style="display:flex; gap:12px; align-items:center;">
                    <div class="patient-avatar-circle" style="width:40px; height:40px; background:#eff6ff; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                        <img src="../Assets/Icons/blue-user-circle.svg" alt="Patient" style="width: 24px;">
                    </div>
                    <div class="patient-text">
                        <h4 style="margin:0; font-size:1rem;">${appt.patient_name}</h4>
                        <span style="font-size:0.8rem; color:#64748b;">${appt.notes || "Status: " + appt.status}</span>
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
    `,
    )
    .join("");
}

function updateAvailabilityList(availability) {
  const list = document.querySelector(".schedule-list");
  if (!list) return;
  list.innerHTML = availability
    .map(
      (row) => `
        <div class="schedule-row ${row.is_approved ? "active" : "pending"}" style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:#f8fafc; border-radius:12px; margin-bottom:10px;">
            <input type="checkbox" ${row.is_approved ? "checked" : ""} disabled style="width: 20px; height: 20px;">
            <div style="flex:1; margin-left:15px;">
                <span class="row-label" style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">Day</span>
                <span class="row-value" style="font-weight:700;">${row.day_of_week}</span>
            </div>
            <div style="flex:1;">
                <span class="row-label" style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">Start Time</span>
                <span class="row-value" style="font-weight:700;">${formatTo12Hr(row.start_time)}</span>
            </div>
            <div style="flex:1;">
                <span class="row-label" style="display:block; font-size:0.7rem; color:#94a3b8; font-weight:700;">End Time</span>
                <span class="row-value" style="font-weight:700;">${formatTo12Hr(row.end_time)}</span>
            </div>
            <span class="status-badge ${row.status}" style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:4px 10px; border-radius:20px; background:#e2e8f0;">${row.status}</span>
            <button class="btn-trash" onclick="deleteAvailability(${row.availability_id})" style="background:none; border:none; cursor:pointer; margin-left:15px;">
                <img src="../Assets/Icons/red-trash.svg" alt="Delete" style="width: 18px;">
            </button>
        </div>
    `,
    )
    .join("");
}

function handleAddSlot() {
  // Get current user auth data
  const userData = checkAuth("doctor");
  if (!userData) return;

  const day = document.querySelector(".add-slot-card select").value;
  const inputs = document.querySelectorAll(".add-slot-card input");
  const start = inputs[0].value;
  const end = inputs[1].value;

  if (!day || !start || !end) {
    alert("Please fill in all fields.");
    return;
  }

  fetch("../PHP/save_availability.php", {
    method: "POST",
    body: JSON.stringify({
      user_id: userData.id,
      day_of_week: day,
      start_time: start,
      end_time: end,
    }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        alert(res.message);
        loadDashboardData();
      } else {
        alert(res.message);
      }
    })
    .catch((err) => {
      console.error("Save availability error:", err);
      alert("Failed to save availability.");
    });
}

function updateStatus(id, newStatus) {
  if (
    !confirm(`Are you sure you want to mark this appointment as ${newStatus}?`)
  )
    return;

  fetch("../PHP/appointment_actions.php", {
    method: "POST",
    body: JSON.stringify({ appointment_id: id, status: newStatus }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        loadDashboardData();
      } else {
        alert("Update failed: " + res.message);
      }
    });
}

function deleteAvailability(id) {
  if (!confirm("Are you sure you want to delete this availability slot?"))
    return;

  fetch("../PHP/manage_availability.php", {
    method: "POST",
    body: JSON.stringify({ availability_id: id, status: "deleted" }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        loadDashboardData();
      } else {
        alert("Delete failed: " + res.message);
      }
    });
}

function showSection(sectionName) {
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.remove("active");
  });
  const targetSection = document.getElementById("section-" + sectionName);
  if (targetSection) targetSection.classList.add("active");

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active");
  });

  const activeItem = document.getElementById("menu-" + sectionName);
  if (activeItem) {
    activeItem.classList.add("active");
  }

  if (sectionName === "patients") {
    loadPatientsData();
  }
}

function formatTo12Hr(timeStr) {
  if (!timeStr) return "N/A";
  let [hours, minutes] = timeStr.split(":");
  hours = parseInt(hours);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

/* ===== Patients Tab Logic ===== */
function loadPatientsData() {
  const userData = checkAuth("doctor");
  if (!userData) return;

  fetch("../PHP/fetch_patients.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userData.id }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        doctorPatients = res.patients || [];

        // Update stats cards
        const totalEl = document.getElementById("stat-total-patients");
        const activeEl = document.getElementById("stat-active-patients");
        const newEl = document.getElementById("stat-new-patients");

        if (totalEl) totalEl.textContent = res.stats.total_patients || 0;
        if (activeEl) activeEl.textContent = res.stats.active_patients || 0;
        if (newEl) newEl.textContent = res.stats.new_patients || 0;

        // Render roster cards
        renderPatientsGrid(doctorPatients);
      } else {
        console.error("Failed to load patients:", res.message);
      }
    })
    .catch((err) => console.error("Error loading patients:", err));
}

function renderPatientsGrid(patientsList) {
  const grid = document.getElementById("patients-grid");
  if (!grid) return;

  if (patientsList.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary); background: white; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05);">
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-main);">No patients found.</p>
        <p style="font-size: 0.9rem; margin-top: 4px; color: var(--text-secondary);">Try searching for another name or email address.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = patientsList
    .map((patient) => {
      // Split comma separated conditions into badges
      const conditions = patient.medical_conditions
        ? patient.medical_conditions.split(",").map((c) => c.trim()).filter(Boolean)
        : [];
      const tagsHtml = conditions
        .map((c) => `<span class="patient-condition-tag">${c}</span>`)
        .join("");

      return `
        <div class="patient-card">
          <div class="patient-card-body">
            <div class="patient-card-avatar">
              <img src="../Assets/Icons/blue-user-circle.svg" alt="Patient">
            </div>
            <div class="patient-card-info">
              <h3>${patient.full_name}</h3>
              <p class="patient-card-meta">${patient.age ? patient.age + " years" : "Age N/A"} &bull; ${patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "N/A"}</p>
              
              <div class="patient-info-list">
                <div class="patient-info-row">
                  <img src="../Assets/Icons/gray-phone.svg" alt="Phone">
                  <span>${patient.phone || "N/A"}</span>
                </div>
                <div class="patient-info-row email">
                  <img src="../Assets/Icons/gray-mail.svg" alt="Email">
                  <span>${patient.email}</span>
                </div>
                <div class="patient-info-row">
                  <img src="../Assets/Icons/gray-calendar.svg" alt="Calendar">
                  <span>Last visit: ${formatVisitDate(patient.last_visit)}</span>
                </div>
              </div>

              ${tagsHtml ? `<div class="patient-conditions-container">${tagsHtml}</div>` : ""}
            </div>
          </div>
          <div class="patient-card-footer">
            <span>${patient.total_visits} total visits</span>
            <a onclick="openPatientDetails(${patient.patient_id})">View Details &rarr;</a>
          </div>
        </div>
      `;
    })
    .join("");
}

function openPatientDetails(patientId) {
  const patient = doctorPatients.find((p) => p.patient_id === patientId);
  if (!patient) return;

  activePatientId = patientId;

  // Set patient summary details
  const nameEl = document.getElementById("det-patient-name");
  const metaEl = document.getElementById("det-patient-meta");
  const phoneEl = document.getElementById("det-patient-phone");
  const emailEl = document.getElementById("det-patient-email");
  const addrEl = document.getElementById("det-patient-address");

  if (nameEl) nameEl.textContent = patient.full_name;
  if (metaEl) {
    const ageStr = patient.age ? patient.age + " years" : "Age N/A";
    const genderStr = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "Gender N/A";
    const bloodStr = patient.blood_group ? "Blood Group " + patient.blood_group : "Blood Group N/A";
    metaEl.textContent = `${ageStr} • ${genderStr} • ${bloodStr}`;
  }

  // Set contact & home address details
  if (phoneEl) {
    phoneEl.innerHTML = `<img src="../Assets/Icons/gray-phone.svg" alt="Phone" style="width: 14px; opacity: 0.6; vertical-align: middle; margin-right: 8px;">${patient.phone || "N/A"}`;
  }
  if (emailEl) {
    emailEl.innerHTML = `<img src="../Assets/Icons/gray-mail.svg" alt="Email" style="width: 14px; opacity: 0.6; vertical-align: middle; margin-right: 8px;">${patient.email}`;
  }
  if (addrEl) {
    addrEl.textContent = patient.address || "No address details available.";
  }

  // Set conditions
  const conditionsContainer = document.getElementById("det-conditions-tags");
  if (conditionsContainer) {
    conditionsContainer.innerHTML = "";
    if (patient.medical_conditions) {
      const list = patient.medical_conditions.split(",").map((c) => c.trim()).filter(Boolean);
      list.forEach((c) => {
        const span = document.createElement("span");
        span.className = "patient-condition-tag";
        span.textContent = c;
        conditionsContainer.appendChild(span);
      });
    } else {
      conditionsContainer.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">No documented conditions.</span>`;
    }
  }
  
  const condInput = document.getElementById("input-update-conditions");
  if (condInput) {
    condInput.value = patient.medical_conditions || "";
  }

  // Set visits history list
  const visitList = document.getElementById("det-visit-list");
  if (visitList) {
    visitList.innerHTML = "";
    if (patient.visits && patient.visits.length > 0) {
      patient.visits.forEach((v) => {
        const row = document.createElement("div");
        row.className = "visit-history-row";
        
        const badgeClass = v.status.toLowerCase();
        const formattedTime = formatTo12Hr(v.start_time);
        const formattedDate = formatVisitDate(v.appointment_date);

        row.innerHTML = `
          <div class="visit-time-info">
            <span class="visit-date">${formattedDate}</span>
            <span class="visit-time">${formattedTime}</span>
          </div>
          <div class="visit-notes">${v.notes || "No consultation notes recorded."}</div>
          <span class="status-badge ${badgeClass}" style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 20px;">${v.status}</span>
        `;
        visitList.appendChild(row);
      });
    } else {
      visitList.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-style: italic; font-size: 0.9rem; padding: 1rem;">No visits found.</p>`;
    }
  }

  // Show Patient Details modal
  const detailsModal = document.getElementById("modal-patient-details");
  if (detailsModal) {
    detailsModal.classList.add("active");
  }
}

function handleUpdateConditions() {
  if (!activePatientId) return;

  const conditionsInput = document.getElementById("input-update-conditions").value.trim();

  fetch("../PHP/update_patient_conditions.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: activePatientId,
      medical_conditions: conditionsInput,
    }),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        alert("Patient conditions updated successfully!");
        
        // Refresh local cache and sidebar rosters
        loadPatientsData();
        
        // Update tags in the open details modal immediately
        const conditionsContainer = document.getElementById("det-conditions-tags");
        if (conditionsContainer) {
          conditionsContainer.innerHTML = "";
          if (conditionsInput) {
            const list = conditionsInput.split(",").map((c) => c.trim()).filter(Boolean);
            list.forEach((c) => {
              const span = document.createElement("span");
              span.className = "patient-condition-tag";
              span.textContent = c;
              conditionsContainer.appendChild(span);
            });
          } else {
            conditionsContainer.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">No documented conditions.</span>`;
          }
        }
      } else {
        alert("Failed to update conditions: " + res.message);
      }
    })
    .catch((err) => {
      console.error("Error updating conditions:", err);
      alert("An error occurred while updating conditions.");
    });
}

function formatVisitDate(dateStr) {
  if (!dateStr) return "N/A";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${month}/${day}/${year}`;
}
