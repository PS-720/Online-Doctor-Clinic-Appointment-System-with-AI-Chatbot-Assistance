/**
 * Login Logic for SmartCare
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.signupForm'); // Login form uses signupForm class
    if (!loginForm) return;

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            alert("Email and password are required.");
            return;
        }

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        fetch('../PHP/login.php', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Save user data to localStorage
                localStorage.setItem('smartcare_user', JSON.stringify(data.user));
                
                // Redirect based on role
                window.location.href = data.redirect;
            } else {
                alert(data.message || "Login failed.");
            }
        })
        .catch(err => {
            console.error("Login error:", err);
            alert("An error occurred during login. Please try again.");
        });
    });
});
