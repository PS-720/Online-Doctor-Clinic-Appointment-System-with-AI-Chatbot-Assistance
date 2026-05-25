// SmartCare | AI Chatbot Frontend Logic (Fixed Path Edition)
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
      };
    }

    // Handle any elements with .chat-button class (including dynamic ones)
    document.addEventListener("click", (e) => {
      const chatBtn = e.target.closest(".chat-button");
      if (chatBtn && popup) {
        popup.classList.add("visible");
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
  },

  appendMessage(text, sender) {
    if (!this.messagesArea) return;
    
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}`;
    // Simple sanitization for **bold** text support
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    msgDiv.innerHTML = formattedText;
    
    this.messagesArea.appendChild(msgDiv);
    this.scrollToBottom();
  },

  showTyping(show) {
    if (this.typingIndicator) {
      this.typingIndicator.style.display = show ? "block" : "none";
      this.scrollToBottom();
    }
  },

  scrollToBottom() {
    if (this.messagesArea) {
      this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
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
        } else {
          this.appendMessage("I'm sorry, I'm having trouble understanding. Please try again.", "bot");
          console.error("Chatbot API error:", data.message);
        }
      })
      .catch((err) => {
        this.showTyping(false);
        console.error("Chatbot communication error:", err);
        this.appendMessage("An error occurred during communication. Please try again later.", "bot");
      });
  }
};

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  Chatbot.init();
});
