// public/js/profile.js

document.addEventListener('DOMContentLoaded', () => {
    // Navbar Kullanıcı Menüsü Başlatma
    initializeUserMenu();

    // Sol Menü Tıklama İşlemleri
    const genelBilgilerLink = document.getElementById('genel-bilgiler-link');
    const kullaniciBilgileriLink = document.getElementById('kullanici-bilgileri-link');
    const tahlillerimLink = document.getElementById('tahlillerim-link');
    const gecmisRandevularimLink = document.getElementById('gecmis-randevularim-link'); // Yeni link

    const genelBilgilerSection = document.getElementById('genel-bilgiler-section');
    const kullaniciBilgileriSection = document.getElementById('kullanici-bilgileri-section');
    const tahlillerimSection = document.getElementById('tahlillerim-section');
    const gecmisRandevularimSection = document.getElementById('gecmis-randevularim-section'); // Yeni bölüm

    genelBilgilerLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('genel-bilgiler');
    });

    kullaniciBilgileriLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('kullanici-bilgileri');
    });

    tahlillerimLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('tahlillerim');
    });

    gecmisRandevularimLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection('gecmis-randevularim');
        loadGeçmişRandevular();
    });

    function showSection(section) {
        // Tüm bölümleri gizle
        genelBilgilerSection.style.display = 'none';
        kullaniciBilgileriSection.style.display = 'none';
        tahlillerimSection.style.display = 'none';
        gecmisRandevularimSection.style.display = 'none';

        // Tüm linklerin aktif sınıfını kaldır
        genelBilgilerLink.parentElement.classList.remove('active');
        kullaniciBilgileriLink.parentElement.classList.remove('active');
        tahlillerimLink.parentElement.classList.remove('active');
        gecmisRandevularimLink.parentElement.classList.remove('active');

        // Seçilen bölümü göster ve aktif yap
        if (section === 'genel-bilgiler') {
            genelBilgilerSection.style.display = 'block';
            genelBilgilerLink.parentElement.classList.add('active');
        } else if (section === 'kullanici-bilgileri') {
            kullaniciBilgileriSection.style.display = 'block';
            kullaniciBilgileriLink.parentElement.classList.add('active');
        } else if (section === 'tahlillerim') {
            tahlillerimSection.style.display = 'block';
            tahlillerimLink.parentElement.classList.add('active');
        } else if (section === 'gecmis-randevularim') {
            gecmisRandevularimSection.style.display = 'block';
            gecmisRandevularimLink.parentElement.classList.add('active');
        }
    }

    // Kullanıcı Menüsünü Başlat
    function initializeUserMenu() {
        // Kullanıcı durumunu kontrol et ve navbar'ı güncelle
        fetch('/current-user', {
            method: 'GET',
            credentials: 'include' // Oturum çerezlerini dahil etmek için
        })
            .then(response => response.json())
            .then(data => {
                const guestMenu = document.querySelector('.guest-menu');
                const userMenu = document.querySelector('.user-menu');

                if (data.user) {
                    // Kullanıcı giriş yapmış
                    if (guestMenu) guestMenu.style.display = 'none';
                    if (userMenu) userMenu.style.display = 'block';

                    // Kullanıcı adını göster
                    const usernameSpan = document.querySelector('.username');
                    if (usernameSpan) {
                        usernameSpan.textContent = data.username; // data.username kullanıcının adını içerir
                        usernameSpan.style.display = 'inline'; // Kullanıcı adını görünür yap
                    }
                } else {
                    // Kullanıcı giriş yapmamış
                    if (guestMenu) guestMenu.style.display = 'block';
                    if (userMenu) userMenu.style.display = 'none';

                    
                }
            })
            .catch(error => {
                console.error('Kullanıcı durumu kontrol edilirken hata:', error);
                // Hata durumunda giriş sayfasına yönlendir
                window.location.href = 'login.html';
            });

        // Kullanıcı Menüsü Açma/Kapatma İşlevi
        const userIconContainer = document.querySelector('.user-icon-container');
        const dropdownMenu = document.querySelector('.user-menu .dropdown');

        if (userIconContainer && dropdownMenu) {
            userIconContainer.addEventListener('click', (e) => {
                e.stopPropagation(); // Olayın yukarıya çıkmasını engelle
                dropdownMenu.style.display = (dropdownMenu.style.display === 'block') ? 'none' : 'block';
            });

            // Sayfanın herhangi bir yerine tıklandığında dropdown menüyü kapat
            document.addEventListener('click', () => {
                dropdownMenu.style.display = 'none';
            });

            // Dropdown menünün içine tıklandığında menünün kapanmasını engelle
            dropdownMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Çıkış Yapma İşlevi
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                fetch('/logout', {
                    method: 'POST',
                    credentials: 'include'
                })
                    .then(response => response.json())
                    .then(data => {
                        alert(data.message);
                        window.location.href = 'index.html'; // Anasayfaya yönlendir
                    })
                    .catch(error => console.error('Çıkış yapma sırasında hata:', error));
            });
        }
    }

    // Kullanıcı Bilgilerini Getir
    fetch('/get-user-info', {
        method: 'GET',
        credentials: 'include'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Genel Bilgiler Formunu Doldur
                document.getElementById('first-name').value = data.user.first_name;
                document.getElementById('last-name').value = data.user.last_name;
                document.getElementById('tc-kimlik').value = data.user.tc_kimlik;

                // Cinsiyet
                document.getElementById('gender').value = data.user.gender || '';

                // Doğum Tarihi Seçeneklerini Oluştur
                populateDateSelectors(data.user.dob);

                // Şehir ve Adres
                document.getElementById('city').value = data.user.city || '';
                document.getElementById('address').value = data.user.address || '';

                // Telefon, Kan Grubu, Boy, Kilo, IBAN
                document.getElementById('phone').value = data.user.phone || '';
                document.getElementById('blood-type').value = data.user.blood_type || '';
                document.getElementById('height').value = data.user.height || '';
                document.getElementById('weight').value = data.user.weight || '';
                document.getElementById('iban').value = data.user.iban || '';

                // Kullanıcı Bilgileri Formunu Doldur
                document.getElementById('username').value = data.user.username;
                document.getElementById('email').value = data.user.email;
            } else {
                alert('Kullanıcı bilgileri alınamadı. Lütfen tekrar giriş yapınız.');
                window.location.href = 'login.html';
            }
        })
        .catch(error => {
            console.error('Kullanıcı bilgileri alınırken hata:', error);
            alert('Kullanıcı bilgileri alınamadı. Lütfen tekrar giriş yapınız.');
            window.location.href = 'login.html';
        });

    // Doğum Tarihi Seçeneklerini Oluştur
    function populateDateSelectors(dob) {
        const daySelect = document.getElementById('dob-day');
        const monthSelect = document.getElementById('dob-month');
        const yearSelect = document.getElementById('dob-year');

        // Gün
        for (let i = 1; i <= 31; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            daySelect.appendChild(option);
        }

        // Ay
        const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        for (let i = 0; i < months.length; i++) {
            const option = document.createElement('option');
            option.value = i + 1; // Aylar 1-12
            option.textContent = months[i];
            monthSelect.appendChild(option);
        }

        // Yıl (1900 - Bugün)
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= 1900; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            yearSelect.appendChild(option);
        }

        // Eğer doğum tarihi varsa seçili hale getir
        if (dob) {
            const dobDate = new Date(dob);
            if (!isNaN(dobDate.getTime())) {
                daySelect.value = dobDate.getDate();
                monthSelect.value = dobDate.getMonth() + 1; // Aylar 0-11 arası
                yearSelect.value = dobDate.getFullYear();
            }
        }
    }

    // Genel Bilgiler Formunu Gönder
    const genelBilgilerForm = document.getElementById('genel-bilgiler-form');
    genelBilgilerForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validasyonlar
        const gender = document.getElementById('gender').value;
        const city = document.getElementById('city').value.trim();
        const address = document.getElementById('address').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const bloodType = document.getElementById('blood-type').value;
        const height = document.getElementById('height').value.trim();
        const weight = document.getElementById('weight').value.trim();
        const iban = document.getElementById('iban').value.trim();

        let valid = true;

        // Cinsiyet validasyonu
        if (!gender) {
            document.getElementById('gender-error').textContent = 'Lütfen cinsiyetinizi seçiniz.';
            valid = false;
        } else {
            document.getElementById('gender-error').textContent = '';
        }

        // Şehir validasyonu
        if (city.length < 2) {
            document.getElementById('city-error').textContent = 'Lütfen geçerli bir şehir giriniz.';
            valid = false;
        } else {
            document.getElementById('city-error').textContent = '';
        }

        // Adres validasyonu
        if (address.length < 5) {
            document.getElementById('address-error').textContent = 'Lütfen geçerli bir adres giriniz.';
            valid = false;
        } else {
            document.getElementById('address-error').textContent = '';
        }

        // Telefon validasyonu: 0 ile başlamalı ve 11 haneli olmalı
        if (!/^0\d{10}$/.test(phone)) {
            document.getElementById('phone-error').textContent = 'Lütfen geçerli bir telefon numarası giriniz. (0 ile başlamalı ve 11 haneli olmalı)';
            valid = false;
        } else {
            document.getElementById('phone-error').textContent = '';
        }

        // Kan grubu seçilmiş mi
        if (!bloodType) {
            document.getElementById('blood-type-error').textContent = 'Lütfen kan grubunuzu seçiniz.';
            valid = false;
        } else {
            document.getElementById('blood-type-error').textContent = '';
        }

        // Boy validasyonu
        if (isNaN(height) || height < 50 || height > 250) {
            document.getElementById('height-error').textContent = 'Lütfen geçerli bir boy giriniz.';
            valid = false;
        } else {
            document.getElementById('height-error').textContent = '';
        }

        // Kilo validasyonu
        if (isNaN(weight) || weight < 20 || weight > 300) {
            document.getElementById('weight-error').textContent = 'Lütfen geçerli bir kilo giriniz.';
            valid = false;
        } else {
            document.getElementById('weight-error').textContent = '';
        }

        // IBAN validasyonu (opsiyonel)
        if (iban && iban.length < 16) {
            document.getElementById('iban-error').textContent = 'Lütfen geçerli bir IBAN giriniz.';
            valid = false;
        } else {
            document.getElementById('iban-error').textContent = '';
        }

        // Doğum tarihi validasyonu
        const day = document.getElementById('dob-day').value;
        const month = document.getElementById('dob-month').value;
        const year = document.getElementById('dob-year').value;

        if (!day || !month || !year) {
            document.getElementById('dob-error').textContent = 'Lütfen geçerli bir doğum tarihi seçiniz.';
            valid = false;
        } else {
            // Geçerli bir tarih mi kontrol edelim
            const dobString = `${year}-${padZero(month)}-${padZero(day)}`;
            const dobDate = new Date(dobString);
            if (isNaN(dobDate.getTime())) {
                document.getElementById('dob-error').textContent = 'Lütfen geçerli bir doğum tarihi seçiniz.';
                valid = false;
            } else {
                document.getElementById('dob-error').textContent = '';
            }
        }

        if (!valid) return;

        // Form verilerini sunucuya gönder
        const formData = {
            gender,
            city,
            address,
            phone,
            bloodType,
            height,
            weight,
            iban,
            dob: `${year}-${padZero(month)}-${padZero(day)}`
        };

        fetch('/update-general-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Bilgileriniz başarıyla güncellendi.');
                } else {
                    alert('Bilgiler güncellenirken hata: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Bilgiler güncellenirken hata:', error);
                alert('Bilgiler güncellenirken bir hata oluştu.');
            });
    });

    // Kullanıcı Bilgileri Formunu Gönder
    const kullaniciBilgileriForm = document.getElementById('kullanici-bilgileri-form');
    kullaniciBilgileriForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validasyonlar
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        let valid = true;

        // Kullanıcı adı validasyonu
        if (username.length < 3 || username.length > 20) {
            document.getElementById('username-error').textContent = 'Kullanıcı adı 3-20 karakter arasında olmalıdır.';
            valid = false;
        } else {
            document.getElementById('username-error').textContent = '';
        }

        // E-posta validasyonu
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            document.getElementById('email-error').textContent = 'Lütfen geçerli bir e-posta adresi giriniz.';
            valid = false;
        } else {
            document.getElementById('email-error').textContent = '';
        }

        // Şifre validasyonu (Eğer şifre alanları doldurulmuşsa)
        if (newPassword || confirmPassword) {
            if (newPassword.length < 6) {
                document.getElementById('new-password-error').textContent = 'Şifre en az 6 karakter olmalıdır.';
                valid = false;
            } else {
                document.getElementById('new-password-error').textContent = '';
            }

            if (newPassword !== confirmPassword) {
                document.getElementById('confirm-password-error').textContent = 'Şifreler eşleşmiyor.';
                valid = false;
            } else {
                document.getElementById('confirm-password-error').textContent = '';
            }
        } else {
            document.getElementById('new-password-error').textContent = '';
            document.getElementById('confirm-password-error').textContent = '';
        }

        if (!valid) return;

        // Form verilerini sunucuya gönder
        const formData = {
            username,
            email,
            newPassword
        };

        fetch('/update-user-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Bilgileriniz başarıyla güncellendi.');
                    // Navbar'daki kullanıcı adını güncelle
                    const usernameSpan = document.querySelector('.username');
                    if (usernameSpan) {
                        usernameSpan.textContent = username;
                    }
                } else {
                    alert('Bilgiler güncellenirken hata: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Bilgiler güncellenirken hata:', error);
                alert('Bilgiler güncellenirken bir hata oluştu.');
            });
    });

    // Şifre Göster/Gizle Fonksiyonu
    const togglePasswords = document.querySelectorAll('.toggle-password');

    togglePasswords.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const passwordInput = toggle.previousElementSibling;
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            toggle.querySelector('i').classList.toggle('fa-eye');
            toggle.querySelector('i').classList.toggle('fa-eye-slash');
        });
    });

    // Yardımcı Fonksiyon: Sayıları Sıfırla Doldurma
    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    // Geçmiş Randevuları Yükleme Fonksiyonu
    function loadGeçmişRandevular() {
        fetch('/api/user/past-appointments', {
            method: 'GET',
            credentials: 'include'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderGeçmişRandevular(data.appointments);
                } else {
                    alert('Geçmiş randevular alınırken hata: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Geçmiş randevular alınırken hata:', error);
                alert('Geçmiş randevular alınırken bir hata oluştu.');
            });
    }

    // Geçmiş Randevuları Tabloya Ekleme Fonksiyonu
    function renderGeçmişRandevular(appointments) {
        const tbody = document.querySelector('#gecmis-randevular-table tbody');
        tbody.innerHTML = '';

        if (appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Geçmiş randevunuz bulunmamaktadır.</td></tr>';
            return;
        }

        appointments.forEach(app => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${app.appointment_date}</td>
                <td>${app.appointment_time.slice(0, 5)}</td>
                <td>${app.department_name}</td>
                <td>${app.doctor_name}</td>
                <td>${app.appointment_type}</td>
                <td>${app.is_treated ? 'Tedavi Edildi' : 'Tedavi Edilmedi'}</td>
            `;

            tbody.appendChild(tr);
        });
    }
});
