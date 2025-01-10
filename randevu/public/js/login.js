// public/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginResponseDiv = document.getElementById('loginResponse');

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  const togglePasswordBtn = document.getElementById('togglePasswordBtn');

  // Hide/Show Fonksiyonu
  function togglePasswordVisibility(inputField, iconElem) {
    if (inputField.type === 'password') {
      inputField.type = 'text';
      iconElem.classList.remove('fa-eye-slash');
      iconElem.classList.add('fa-eye');
    } else {
      inputField.type = 'password';
      iconElem.classList.remove('fa-eye');
      iconElem.classList.add('fa-eye-slash');
    }
  }

  togglePasswordBtn.addEventListener('click', () => {
    const icon = togglePasswordBtn.querySelector('i');
    togglePasswordVisibility(passwordInput, icon);
  });

  // Form Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      loginResponseDiv.innerHTML = `<p style="color: red;">Kullanıcı adı ve şifre gerekli.</p>`;
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // Kullanıcının rolüne göre yönlendirme
        if (data.role === 'admin') {
          window.location.href = '/admin-dashboard.html';
        } else if (data.role === 'doctor') {
          window.location.href = '/doctor-dashboard.html';
        } else {
          window.location.href = '/index.html';
        }
      } else {
        loginResponseDiv.innerHTML = `<p style="color: red;">${data.message}</p>`;
      }
    } catch (err) {
      console.error('Login Error:', err);
      loginResponseDiv.innerHTML = `<p style="color: red;">Bir hata oluştu.</p>`;
    }
  });
});
