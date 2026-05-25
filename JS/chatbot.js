// SmartCare | AI Chatbot Frontend Logic (Advanced Version)
// ========================================================

const Chatbot = {
  container: null,
  input: null,
  sendBtn: null,
  messagesArea: null,
  typingIndicator: null,
  sessionId: localStorage.getItem("smartcare_chat_session") || "session_" + Math.random().toString(36).substr(2, 9),

  // Correct path detection based on current URL
  getBackendPath() {
    const path = window.location.pathname;
    if (path.includes("/HTML/")) {
      return "../PHP/chatbot.php";
    }
    return "PHP/chatbot.php";
  },

  init() {
    localStorage.setItem("smartcare_chat_session", this.sessionId);
    
    // Wire up landing page popup if present
    const fab = document.getElementById("chatbot-fab");
    const popup = document.getElementById("chatbot-popup");
    const closeBtn = document.getElementById("close-chat");

    if (fab && popup) {
      fab.onclick = () => {
        popup.classList.toggle("visible");
        this.scrollToBottom();
      };
    }

    // Handle any elements with .chat-button class (including dynamic ones)
    document.addEventListener("click", (e) => {
      const chatBtn = e.target.closest(".chat-button");
      if (chatBtn && popup) {
        popup.classList.add("visible");
        this.scrollToBottom();
      }
    });

    if (closeBtn && popup) {
      closeBtn.onclick = () => {
        popup.classList.remove("visible");
      };
    }

    // Wire up inputs
    this.container = document.querySelector(".chat-container");
    this.messagesArea = document.querySelector(".chat-messages");
    this.input = document.querySelector(".chat-input");
    this.sendBtn = document.querySelector(".send-message-btn");
    this.typingIndicator = document.querySelector(".typing-indicator");

    if (this.sendBtn && this.input) {
      this.sendBtn.onclick = () => this.sendMessage();
      this.input.onkeypress = (e) => {
        if (e.key === "Enter") this.sendMessage();
      };
    }

    // Render initial chips after DOM load
    if (this.messagesArea) {
      setTimeout(() => {
        this.renderQuickChips();
      }, 200);
    }
  },

  appendMessage(text, sender) {
    if (!this.messagesArea) return;
    
    // Remove existing chips container to keep chat clean
    const oldChips = this.messagesArea.querySelector(".chat-chips-container");
    if (oldChips) {
      oldChips.remove();
    }

    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}`;
    // Simple sanitization for **bold** text support and newlines
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    msgDiv.innerHTML = formattedText;
    
    this.messagesArea.appendChild(msgDiv);
    this.scrollToBottom();
  },

  showTyping(show) {
    if (this.typingIndicator) {
      // Move typing indicator to bottom of messages area
      if (show) {
        this.messagesArea.appendChild(this.typingIndicator);
      }
      this.typingIndicator.style.display = show ? "block" : "none";
      this.scrollToBottom();
    }
  },

  scrollToBottom() {
    if (this.messagesArea) {
      this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
    }
  },

  renderQuickChips() {
    if (!this.messagesArea) return;
    
    const oldChips = this.messagesArea.querySelector(".chat-chips-container");
    if (oldChips) {
      oldChips.remove();
    }

    const chipsDiv = document.createElement("div");
    chipsDiv.className = "chat-chips-container";

    const chips = [
      { text: "🔍 Check Symptoms", msg: "I want to describe my symptoms for analysis." },
      { text: "🫀 Find Cardiologist", msg: "Do we have a cardiologist available?" },
      { text: "🧠 Find Neurologist", msg: "Do we have a neurologist available?" },
      { text: "📅 How to Book", msg: "How do I book an appointment?" }
    ];

    chips.forEach(chip => {
      const chipBtn = document.createElement("div");
      chipBtn.className = "chat-chip";
      chipBtn.innerText = chip.text;
      chipBtn.onclick = () => {
        if (this.input) {
          this.input.value = chip.msg;
          this.sendMessage();
        }
      };
      chipsDiv.appendChild(chipBtn);
    });

    this.messagesArea.appendChild(chipsDiv);
    this.scrollToBottom();
  },

  renderDoctorCards(doctors, symptoms) {
    if (!this.messagesArea) return;

    doctors.forEach(doc => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "doctor-recommendation-card";

      const inHtmlSubdir = window.location.pathname.includes("/HTML/");
      const baseImgPath = inHtmlSubdir ? "../Assets/Images/" : "Assets/Images/";
      const baseIconPath = inHtmlSubdir ? "../Assets/" : "Assets/";

      // Check if image exists, otherwise fallback to logo
      const profileImage = doc.profile_image ? `doctors/${doc.profile_image}` : "logo.png";
      const starIcon = "Images/star.png";
      const bookIcon = "Icons/white-calendar.svg";

      cardDiv.innerHTML = `
        <div class="doc-rec-info">
          <img class="doc-rec-img" src="${baseImgPath}${profileImage}" alt="${doc.full_name}" onerror="this.src='${baseImgPath}logo.png'">
          <div class="doc-rec-details">
            <h4>Dr. ${doc.full_name}</h4>
            <p class="doc-spec">${doc.specialization} 👨‍⚕️</p>
            <p class="doc-qual">${doc.qualification}</p>
          </div>
        </div>
        <div class="doc-rec-stats">
          <span>
            <img class="icons" src="${baseImgPath}${starIcon}" alt="Star" style="width:14px; vertical-align:middle; margin-right:2px;">
            <b>${doc.rating.toFixed(1)}</b>
          </span>
          <span><b>Exp:</b> ${doc.experience_years} Years</span>
          <span><b>Fee:</b> ₹${parseInt(doc.consultation_fee)}</span>
        </div>
        <button class="doc-rec-btn">
          <img class="icons" src="${baseIconPath}${bookIcon}" alt="Book">
          Book Appointment
        </button>
      `;

      const btn = cardDiv.querySelector(".doc-rec-btn");
      btn.onclick = () => {
        this.handleBookingClick(doc.doctor_id, doc.full_name, doc.specialization, symptoms);
      };

      this.messagesArea.appendChild(cardDiv);
    });

    this.scrollToBottom();
  },

  handleBookingClick(doctorId, doctorName, specialization, symptoms) {
    // 1. Check if user is on dashboard
    const isDashboard = typeof showSection === "function";
    
    if (isDashboard) {
      // Switch section
      showSection('book-appointment');
      
      // Select Doctor
      const selectDr = document.getElementById("select-doctor");
      if (selectDr) {
        // Set doctor dropdown value
        selectDr.value = doctorId;
        selectDr.dispatchEvent(new Event('change'));
      }
      
      // Pre-fill symptoms
      const symptomsTextarea = document.getElementById("desc-symptoms");
      if (symptomsTextarea) {
        symptomsTextarea.value = symptoms || `Symptom check for ${specialization}`;
      }
      
      // Scroll form into view
      const bookingSection = document.getElementById("section-book-appointment");
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // On landing page: save context and redirect
      const pendingBooking = {
        doctorId: doctorId,
        doctorName: doctorName,
        specialization: specialization,
        symptoms: symptoms || `Symptom check for ${specialization}`
      };
      
      sessionStorage.setItem("smartcare_pending_booking", JSON.stringify(pendingBooking));
      
      const loggedInUser = localStorage.getItem("smartcare_user");
      if (loggedInUser) {
        window.location.href = "HTML/patientDashboard.html";
      } else {
        alert("Please log in to book your appointment. Redirecting to login...");
        window.location.href = "HTML/logIn.html";
      }
    }
  },

  sendMessage() {
    const message = this.input.value.trim();
    if (!message) return;

    this.input.value = "";
    this.appendMessage(message, "user");
    this.showTyping(true);

    // Get current user info from localStorage if available
    let userData = {};
    try {
      userData = JSON.parse(localStorage.getItem("smartcare_user") || "{}");
    } catch(e) { console.error("Error parsing user data"); }

    const backendUrl = this.getBackendPath();

    fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        user_id: userData.id || null,
        session_id: this.sessionId,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Server error " + res.status);
        return res.json();
      })
      .then((data) => {
        this.showTyping(false);
        if (data.success) {
          this.appendMessage(data.response, "bot");
          
          // Render recommended doctor cards if present
          if (data.doctors && data.doctors.length > 0) {
            this.renderDoctorCards(data.doctors, message);
          }
          
          // Show chips again below the response/cards
          this.renderQuickChips();
        } else {
          this.appendMessage("I'm sorry, I'm having trouble understanding. Please try again.", "bot");
          this.renderQuickChips();
          console.error("Chatbot API error:", data.message);
        }
      })
      .catch((err) => {
        this.showTyping(false);
        console.error("Chatbot communication error:", err);
        this.appendMessage("An error occurred during communication. Please try again later.", "bot");
        this.renderQuickChips();
      });
  }
};

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  Chatbot.init();
});
