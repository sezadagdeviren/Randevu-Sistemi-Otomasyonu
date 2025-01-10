document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');

  const firstNameInput = document.getElementById('first_name');
  const lastNameInput = document.getElementById('last_name');
  const tcKimlikInput = document.getElementById('tc_kimlik');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('password_confirm');

  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const togglePasswordConfirmBtn = document.getElementById('togglePasswordConfirmBtn');

  // Rakam engelleme (Ad, Soyad, Kullanıcı Adı)
  function blockDigitsAndLimit(e) {
    const allowedRegex = /^[a-zA-ZığüşöçİĞÜŞÖÇ\s]*$/;
    if (!allowedRegex.test(e.key) || e.target.value.length >= 30) {
      e.preventDefault();
    }
  }
  [firstNameInput, lastNameInput, usernameInput].forEach(input => {
    input.addEventListener('keypress', blockDigitsAndLimit);
  });

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
  togglePasswordConfirmBtn.addEventListener('click', () => {
    const icon = togglePasswordConfirmBtn.querySelector('i');
    togglePasswordVisibility(passwordConfirmInput, icon);
  });

  // Form Submit
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const first_name = firstNameInput.value.trim();
    const last_name = lastNameInput.value.trim();
    const tc_kimlik = tcKimlikInput.value.trim();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const password_confirm = passwordConfirmInput.value.trim();

    // (Örnek basit kontroller)
    if (!first_name || !last_name || !tc_kimlik || !username || !email || !password || !password_confirm) {
      alert('Tüm alanları doldurun.');
      return;
    }
    if (password !== password_confirm) {
      alert('Şifreler uyuşmuyor!');
      return;
    }
    // Şifre karmaşıklık
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      alert('Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf, 1 rakam ve 1 özel karakter içermeli.');
      return;
    }
    // TC kimlik 11 hane
    if (!/^\d{11}$/.test(tc_kimlik)) {
      alert('TC Kimlik 11 haneli olmalı.');
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name, last_name, tc_kimlik, username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Başarılı',
          text: data.message,
        }).then(() => {
          // Kullanıcının emailini sessionStorage'a kaydet
          sessionStorage.setItem('email', email);
          // Doğrulama sayfasına yönlendir
          window.location.href = '/verification.html';
        });
        registerForm.reset();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Hata',
          text: data.message || 'Kayıt olma işlemi başarısız oldu.',
        });
      }
    } catch (err) {
      console.error('Register Error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Hata',
        text: 'Bir hata oluştu.',
      });
    }
  });
});

