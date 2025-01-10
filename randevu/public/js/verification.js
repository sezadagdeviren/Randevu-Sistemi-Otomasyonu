// public/js/verification.js

document.addEventListener('DOMContentLoaded', () => {
    const verificationForm = document.getElementById('verificationForm');

    verificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const verification_code = document.getElementById('verification_code').value.trim();
        const email = sessionStorage.getItem('email');

        if (!email) {
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: 'Email bulunamadı. Lütfen kayıt olunuz.',
            });
            return;
        }

        if (!verification_code) {
            Swal.fire({
                icon: 'warning',
                title: 'Uyarı',
                text: 'Doğrulama kodunu girmelisiniz.',
            });
            return;
        }

        // Doğrulama kodunun formatını kontrol et
        const codeRegex = /^\d{6}$/;
        if (!codeRegex.test(verification_code)) {
            Swal.fire({
                icon: 'warning',
                title: 'Uyarı',
                text: 'Doğrulama kodu 6 haneli olmalıdır.',
            });
            return;
        }

        try {
            const response = await fetch('/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, verification_code }),
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Başarılı',
                    text: data.message,
                }).then(() => {
                    // SessionStorage'daki emaili temizle ve giriş sayfasına yönlendir
                    sessionStorage.removeItem('email');
                    window.location.href = '/login.html';
                });
                verificationForm.reset();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: data.message || 'Doğrulama işlemi başarısız oldu.',
                });
            }
        } catch (err) {
            console.error('Verification Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: 'Bir hata oluştu.',
            });
        }
    });
    resendCodeButton.addEventListener('click', async () => {
        const email = sessionStorage.getItem('email');

        if (!email) {
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: 'Email bulunamadı. Lütfen kayıt olunuz.',
            });
            return;
        }

        try {
            const response = await fetch('/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Başarılı',
                    text: data.message,
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata',
                    text: data.message || 'Doğrulama kodu yeniden gönderilemedi.',
                });
            }
        } catch (err) {
            console.error('Resend Verification Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Hata',
                text: 'Bir hata oluştu.',
            });
        }
    });
});
