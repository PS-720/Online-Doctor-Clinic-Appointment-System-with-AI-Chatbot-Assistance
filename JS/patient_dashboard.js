window.addEventListener("DOMContentLoaded", () => {
	// Check if user is logged in as patient
	const userData = checkAuth("patient");
	if (!userData) return;

	// Set Welcome Name
	const welcomeHeading = document.getElementById("patient-welcome");
	if (welcomeHeading)
		welcomeHeading.textContent = `Welcome Back, ${userData.full_name || "Patient"}!`;

	// Initial data fetch
	loadPatientDashboard(userData);

	// Booking Flow Setup
	setupBookingFlow(userData);

	// Search button click handler
	const searchBtn = document.getElementById("btn-search-doctors");
	if (searchBtn) {
		searchBtn.addEventListener("click", () => {
			const locality = document.getElementById("find-locality-input").value;
			const specialization = document.getElementById("find-specialization-select").value;
			searchDoctors(locality, specialization);
		});
	}
});

// Helper: remove leading asterisks and capitalize first letter
function formatName(name) {
	if (!name || typeof name !== "string") return name || "";
	// Remove any leading '*' characters and trim whitespace
	const cleaned = name.replace(/^\*+/, "").trim();
	if (!cleaned) return "";
	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function loadPatientDashboard(userData) {
	if (!userData) return;

	fetch("../PHP/fetch_dashboard_data.php", {
		method: "POST",
		body: JSON.stringify({ user_id: userData.id, role: userData.role }),
	})
		.then((res) => res.json())
		.then((res) => {
			if (res.success) {
				updateDashboardUI(res.data);
			}
		})
		.catch((err) => console.error("Patient dash load error:", err));
}

function updateDashboardUI(data) {
	// 1. Update Stats - Main Dashboard (4 cards)
	const dashStats = document.querySelectorAll(
		"#section-dashboard .stats-numbers",
	);
	if (dashStats.length >= 4) {
		dashStats[0].textContent = data.stats.total_appointments || 0;
		dashStats[1].textContent = data.stats.upcoming_visits || 0;
		dashStats[2].textContent = "0"; // Favourite Doctors (Simulated)
		dashStats[3].textContent = "92%"; // Health Score (Simulated)
	}

	// 2. Update Stats - My Appointments View (3 cards)
	const tableStatApproved = document.getElementById("table-stat-approved");
	const tableStatPending = document.getElementById("table-stat-pending");
	const tableStatRejected = document.getElementById("table-stat-rejected");

	if (tableStatApproved)
		tableStatApproved.textContent = data.stats.approved || 0;
	if (tableStatPending) tableStatPending.textContent = data.stats.pending || 0;
	if (tableStatRejected)
		tableStatRejected.textContent = data.stats.rejected || 0;

	// 3. Update Upcoming Appointments - Dashboard List
	const appList = document.querySelector("#section-dashboard .app-list");
	if (appList) {
		const upcoming = (data.history || [])
			.filter((a) => a.status === "confirmed")
			.slice(0, 3);

		if (!upcoming.length) {
			appList.innerHTML =
				'<p style="text-align:center; padding: 2rem; color: #64748b;">No upcoming appointments.</p>';
		} else {
			appList.innerHTML = upcoming
				.map(
					(appt) => `
                <div class="activity-item">
                    <div class="doc-name-logo">
                        <div class="app-list-logo">
                            <img class="icons" src="../Assets/Icons/blue-heart-light-border.svg" alt="Heart" />
                        </div>
                        <div class="doc-name">
							<h4>${formatDoctorName(appt.doctor_name)}</h4>
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
            `,
				)
				.join("");
		}
	}

	// 4. Update History Table
	renderHistoryTable(data.history || []);
}

function renderHistoryTable(history) {
	const tableBody = document.getElementById("appointment-history-body");
	if (!tableBody) return;

	if (!history.length) {
		tableBody.innerHTML =
			'<tr><td colspan="5" style="text-align:center; padding: 3rem;">No appointment history found.</td></tr>';
		return;
	}

	tableBody.innerHTML = history
		.map(
			(appt) => `
        <tr>
			<td style="font-weight:700;">${formatDoctorName(appt.doctor_name)}</td>
            <td>${appt.specialization}</td>
            <td>
                <div class="app-day-time" style="align-items:start;">
                    <p class="app-day" style="margin:0;">${appt.appointment_date}</p>
                    <p class="app-time" style="margin:0;">${appt.start_time.slice(0, 5)}</p>
                </div>
            </td>
            <td>
                <div class="app-status-${appt.status === "confirmed" ? "confirmed" : appt.status === "cancelled" ? "rejected" : "pending"}">
                    <p class="status-${appt.status === "confirmed" ? "confirmed" : appt.status === "cancelled" ? "rejected" : "pending"}">${appt.status}</p>
                </div>
            </td>
            <td>
                <button class="view-detail-btn" title="View Details">Details</button>
            </td>
        </tr>
    `,
		)
		.join("");
}

function setupBookingFlow(userData) {
	if (!userData) return;
	const drSelect = document.getElementById("select-doctor");
	const dateInput = document.getElementById("app-date");
	const timeSelect = document.getElementById("app-time");
	const symptomsInput = document.getElementById("desc-symptoms");
	const notesInput = document.getElementById("add-notes");
	const bookingForm = document.querySelector(".book-appointment-form");

	if (!drSelect || !dateInput || !timeSelect) return;

	// Fetch approved doctors
	fetch("../PHP/fetch_approved_doctors.php")
		.then((res) => res.json())
		.then((res) => {
			if (res.success) {
				if (!res.doctors.length) {
					drSelect.innerHTML =
						'<option value="" disabled>No doctors available</option>';
				} else {
					drSelect.innerHTML =
						'<option value="" selected disabled hidden>Select Doctor</option>' +
						res.doctors
							.map(
								(d) =>
									`<option value="${d.doctor_id}">${formatDoctorName(d.full_name)} (${d.specialization})</option>`,
							)
							.join("");
				}

				// Check for pending booking from chatbot redirect
				const pendingBookingStr = sessionStorage.getItem("smartcare_pending_booking");
				if (pendingBookingStr) {
					try {
						const pendingBooking = JSON.parse(pendingBookingStr);
						sessionStorage.removeItem("smartcare_pending_booking");
						
						// Switch section to booking
						showSection('book-appointment');
						
						// Set doctor dropdown value
						drSelect.value = pendingBooking.doctorId;
						drSelect.dispatchEvent(new Event('change'));
						
						// Set symptoms
						if (symptomsInput) {
							symptomsInput.value = pendingBooking.symptoms;
						}
					} catch (e) {
						console.error("Error handling pending booking:", e);
					}
				}
			}
		});

	const updateSlots = () => {
		const drId = drSelect.value;
		const date = dateInput.value;

		if (!drId) {
			timeSelect.innerHTML =
				'<option value="" disabled>Select Doctor First</option>';
			return;
		}
		if (!date) {
			timeSelect.innerHTML =
				'<option value="" disabled>Select Date First</option>';
			return;
		}

		timeSelect.innerHTML =
			'<option value="" disabled>Searching availability...</option>';

		fetch("../PHP/fetch_slots.php", {
			method: "POST",
			body: JSON.stringify({ doctor_id: drId, date: date }),
		})
			.then((res) => res.json())
			.then((res) => {
				if (res.success) {
					const available = res.slots.filter((s) => s.status === "available");
					if (!available.length) {
						timeSelect.innerHTML =
							'<option value="" disabled>No Slots Available</option>';
					} else {
						timeSelect.innerHTML =
							'<option value="" selected disabled hidden>Select Time slot</option>' +
							available
								.map((s) => {
									const [h, m] = s.start_time.split(":");
									const hh = parseInt(h);
									const suffix = hh >= 12 ? "PM" : "AM";
									const hour = hh % 12 || 12;
									return `<option value="${s.slot_id}">${hour}:${m} ${suffix}</option>`;
								})
								.join("");
					}
				}
			});
	};

	drSelect.addEventListener("change", updateSlots);
	dateInput.addEventListener("change", updateSlots);

	// Form Submission
	if (bookingForm) {
		bookingForm.addEventListener("submit", (e) => {
			e.preventDefault();
			const slotId = timeSelect.value;
			const symptoms = symptomsInput.value;
			const notes = notesInput ? notesInput.value : "";

			if (!slotId) {
				alert("Please select an available time slot.");
				return;
			}

			fetch("../PHP/book_appointment.php", {
				method: "POST",
				body: JSON.stringify({
					user_id: userData.id,
					slot_id: slotId,
					symptoms: symptoms,
					notes: notes,
				}),
			})
				.then((res) => res.json())
				.then((res) => {
					alert(res.message);
					if (res.success) {
						showSection("my-appointments");
						loadPatientDashboard(userData);
						bookingForm.reset();
						timeSelect.innerHTML =
							'<option value="" disabled>Select Doctor & Date first</option>';
					}
				});
		});
	}
}

function showSection(sectionName) {
	document.querySelectorAll(".content-section").forEach((section) => {
		section.classList.remove("active");
		section.classList.add("hidden");
	});

	const target = document.getElementById("section-" + sectionName);
	if (target) {
		target.classList.remove("hidden");
		target.classList.add("active");
	}

	// Sidebar navigation states
	document.querySelectorAll(".menu-item-anchor").forEach((btn) => {
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

	// If Find Doctors tab is active, perform an initial search
	if (sectionName === "find-doctors") {
		const locInput = document.getElementById("find-locality-input");
		const specSelect = document.getElementById("find-specialization-select");
		if (locInput) locInput.value = "";
		if (specSelect) specSelect.value = "";
		searchDoctors("", "");
	}
}

function searchDoctors(locality, specialization) {
	const grid = document.getElementById("doctor-results-grid");
	if (!grid) return;
	grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 2rem; color: #64748b;">Loading doctors...</p>';

	fetch("../PHP/search_doctors.php", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ locality: locality, specialization: specialization })
	})
		.then((res) => res.json())
		.then((res) => {
			if (res.success) {
				renderDoctorSearchResults(res.doctors);
			} else {
				grid.innerHTML = `<p style="text-align:center; grid-column: 1/-1; padding: 2rem; color: #ef4444;">Error: ${res.message}</p>`;
			}
		})
		.catch((err) => {
			console.error("Error searching doctors:", err);
			grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 2rem; color: #ef4444;">Error loading search results.</p>';
		});
}

function renderDoctorSearchResults(doctors) {
	const grid = document.getElementById("doctor-results-grid");
	if (!grid) return;

	if (!doctors || doctors.length === 0) {
		grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 2rem; color: #64748b;">No doctors found matching your criteria in Uttarakhand.</p>';
		return;
	}

	grid.innerHTML = doctors
		.map((doc) => {
			const exp = doc.experience_years ? `${doc.experience_years} years exp` : "New Doctor";
			const fee = doc.consultation_fee ? `₹${parseFloat(doc.consultation_fee).toFixed(0)}` : "Free";
			const loc = doc.location ? doc.location : "Uttarakhand";
			const addr = doc.address ? doc.address : "Uttarakhand, India";
			const qualification = doc.qualification || "MBBS";
			let bio = doc.bio ? doc.bio.trim() : "";
			if (!bio || bio === "0" || bio === "null") {
				bio = "No bio available";
			}

			return `
      <div class="find-doctor-card">
        <div class="card-content">
          <div class="card-photo">
            <img src="../Assets/Icons/blue-user-circle.svg" alt="Doctor Profile" />
          </div>
          <div class="card-text">
            <h3>${formatDoctorName(doc.full_name)}</h3>
            <p style="color: #155dfc; font-weight: 700; margin: 0 0 4px;">${doc.specialization} (${qualification})</p>
            <p style="margin: 2px 0;">${exp} • Fee: ${fee}</p>
            <p style="display: flex; align-items: start; gap: 4px; margin-top: 6px;">
              <img src="../Assets/Icons/gray-map-pin.svg" alt="Pin" style="width: 14px; margin-top: 2px;" />
              <span>${loc}<br><span style="font-size:0.75rem; color: #94a3b8; font-weight: 500;">${addr}</span></span>
            </p>
          </div>
        </div>
        <div class="card-caption">
          <p style="font-size: 0.8rem; color: #64748b; font-weight: 500; max-width: 60%; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${bio.replace(/"/g, '&quot;')}">
            ${bio}
          </p>
          <button class="bookDoctor" onclick="redirectDoctorBooking(${doc.doctor_id})">
            <img src="../Assets/Icons/white-calendar.svg" alt="Calendar" style="width: 14px; filter: brightness(0) invert(1);">
            Book
          </button>
        </div>
      </div>
    `;
		})
		.join("");
}

function redirectDoctorBooking(doctorId) {
	// 1. Switch active section to 'book-appointment'
	showSection("book-appointment");

	// 2. Select the doctor in the dropdown
	const drSelect = document.getElementById("select-doctor");
	if (drSelect) {
		drSelect.value = doctorId;
		// Trigger the change event to fetch slots automatically
		drSelect.dispatchEvent(new Event("change"));
	}
}

function formatDoctorName(name) {
	if (!name) return "";
	let cleanName = formatName(name);
	if (cleanName.toLowerCase().startsWith("dr. ")) {
		cleanName = cleanName.substring(4).trim();
	} else if (cleanName.toLowerCase().startsWith("dr.")) {
		cleanName = cleanName.substring(3).trim();
	}
	return "Dr. " + cleanName;
}
