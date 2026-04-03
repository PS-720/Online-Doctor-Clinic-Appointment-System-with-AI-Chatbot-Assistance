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

  logoutBtn.addEventListener("click", function () {
    if (confirm("Are you sure you want to logout?")) {
      fetch("../PHP/logout.php", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            localStorage.removeItem("smartcare_user");
            window.location.href = data.redirect || "logIn.html";
          } else {
            console.error("Logout failed:", data.message);
            // Force logout locally even if backend fails
            localStorage.removeItem("smartcare_user");
            window.location.href = "logIn.html";
          }
        })
        .catch((err) => {
          console.error("Logout error:", err);
          localStorage.removeItem("smartcare_user");
          window.location.href = "logIn.html";
        });
    }
  });
}

// Auto-init logout listener if the button exists
window.addEventListener("DOMContentLoaded", setupLogout);
