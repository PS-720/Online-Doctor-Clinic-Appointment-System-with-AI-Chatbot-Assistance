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

        const data = {
            role: role,
            full_name: fullName,
            email: email,
            phone: phone,
            password: password
        };

        // Add doctor-specific fields if needed
        if (role === 'doctor') {
            data.specialization = document.getElementById('specialization').value;
            data.qualification = document.getElementById('qualification').value;
            data.experience = document.getElementById('experience').value;
            data.fee = document.getElementById('consultationFee').value;
            
            if (!data.specialization || !data.qualification) {
                alert("Please fill in specialized doctor fields.");
                return;
            }
        }

        fetch('../PHP/signup.php', {
            method: 'POST',
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                alert("Account created successfully! You can now log in.");
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
