const user = JSON.parse(localStorage.getItem("smartcare_user"));

/**
 * Validates that a user is logged in and has the expected role.
  @param {string} expectedRole
 */
function checkAuth(expectedRole) {
  if (!user || user.role !== expectedRole) {
    window.location.href = "logIn.html";
    return null;
  }
  return user;
}

/**
 * Global Logout functionality with database session clearance.
 */
function setupLogout() {
  const logoutBtn = document.getElementById("logout-button");
  if (!logoutBtn) return;

  // Inject CSS for custom logout modal
  const style = document.createElement("style");
  style.innerHTML = `
    .custom-logout-modal {
      display: none;
      position: fixed;
      z-index: 9999;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease-in-out;
      backdrop-filter: blur(4px);
    }
    .custom-logout-content {
      background-color: #fff;
      padding: 2.5rem;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      max-width: 400px;
      width: 90%;
      transform: scale(0.9);
      animation: scaleUp 0.3s forwards ease-in-out;
      font-family: 'Nunito Sans', sans-serif;
    }
    .custom-logout-content h3 {
      margin-top: 0;
      color: #1e293b;
      font-size: 1.5rem;
      margin-bottom: 0.75rem;
      font-weight: 700;
    }
    .custom-logout-content p {
      color: #64748b;
      margin-bottom: 2rem;
      font-size: 1rem;
      line-height: 1.5;
    }
    .custom-logout-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }
    .custom-logout-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .custom-logout-btn:active {
      transform: scale(0.95);
    }
    .custom-logout-cancel {
      background-color: #e2e8f0;
      color: #475569;
    }
    .custom-logout-cancel:hover {
      background-color: #cbd5e1;
    }
    .custom-logout-yes {
      background-color: #ef4444;
      color: #fff;
    }
    .custom-logout-yes:hover {
      background-color: #dc2626;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleUp {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Create modal elements
  const modal = document.createElement("div");
  modal.className = "custom-logout-modal";
  modal.innerHTML = `
    <div class="custom-logout-content">
      <h3>Logout Confirmation</h3>
      <p>Are you sure you want to log out from SmartCare?</p>
      <div class="custom-logout-actions">
        <button class="custom-logout-btn custom-logout-yes" id="custom-logout-yes">Yes</button>
        <button class="custom-logout-btn custom-logout-cancel" id="custom-logout-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const confirmBtn = document.getElementById("custom-logout-yes");
  const cancelBtn = document.getElementById("custom-logout-cancel");

  logoutBtn.addEventListener("click", function (e) {
    e.preventDefault();
    modal.style.display = "flex";
  });

  cancelBtn.addEventListener("click", function () {
    modal.style.display = "none";
  });

  confirmBtn.addEventListener("click", function () {
    modal.style.display = "none";
    fetch("../PHP/logout.php", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          localStorage.removeItem("smartcare_user");
          window.location.href = data.redirect || "logIn.html";
        } else {
          console.error("Logout failed:", data.message);
          localStorage.removeItem("smartcare_user");
          window.location.href = "logIn.html";
        }
      })
      .catch((err) => {
        console.error("Logout error:", err);
        localStorage.removeItem("smartcare_user");
        window.location.href = "logIn.html";
      });
  });
}

// Auto-init logout listener if the button exists
window.addEventListener("DOMContentLoaded", setupLogout);
