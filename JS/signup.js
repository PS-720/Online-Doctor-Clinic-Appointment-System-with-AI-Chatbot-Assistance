/**
 * Signup Logic for SmartCare
 */

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.querySelector('.signupForm');
    if (!signupForm) return;

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const role = document.getElementById('signup-role').value;
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('number').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        const formData = new FormData();
        formData.append('role', document.getElementById('signup-role').value);
        formData.append('fullName', document.getElementById('fullName').value);
        formData.append('email', document.getElementById('email').value);
        formData.append('phone', document.getElementById('number').value);
        formData.append('password', password);
        formData.append('confirmPassword', confirmPassword);

        // Add doctor-specific fields if needed
        if (formData.get('role') === 'doctor') {
            formData.append('specialization', document.getElementById('specialization').value);
            formData.append('qualification', document.getElementById('qualification').value);
            formData.append('experience', document.getElementById('experience').value);
            formData.append('consultationFee', document.getElementById('consultationFee').value);
            
            if (!formData.get('specialization') || !formData.get('qualification')) {
                alert("Please fill in specialized doctor fields.");
                return;
            }
        }

        fetch('../PHP/signup.php', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                alert(res.message || "Account created successfully! You can now log in.");
                window.location.href = 'logIn.html';
            } else {
                alert(res.message || "Signup failed.");
            }
        })
        .catch(err => {
            console.error("Signup error:", err);
            alert("An error occurred. Please try again.");
        });
    });
});
