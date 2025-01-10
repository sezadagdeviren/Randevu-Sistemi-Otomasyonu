// public/js/script.js

let currentSlideIndex = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
const totalSlides = slides.length;
let slideInterval;

// Slayt Gösterisini Göster
function showSlide(index) {
    // Sınırları kontrol et
    if (index >= totalSlides) currentSlideIndex = 0;
    if (index < 0) currentSlideIndex = totalSlides - 1;

    // Tüm slaytları gizle
    slides.forEach((slide, i) => {
        slide.style.display = (i === currentSlideIndex) ? 'block' : 'none';
        slide.setAttribute('aria-hidden', i !== currentSlideIndex);
    });

    // Daire göstergelerini güncelle
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlideIndex);
        dot.setAttribute('aria-selected', i === currentSlideIndex);
    });
}

// Slaytı değiştir
function changeSlide(n) {
    currentSlideIndex += n;
    showSlide(currentSlideIndex);
    resetInterval();
}

// Belirli slayta geç
function goToSlide(n) {
    currentSlideIndex = n - 1;
    showSlide(currentSlideIndex);
    resetInterval();
}

// Otomatik Slayt Gösterisi
function startSlideShow() {
    slideInterval = setInterval(() => {
        changeSlide(1);
    }, 5000); // 5 saniye
}

// Otomatik slaytı sıfırla
function resetInterval() {
    clearInterval(slideInterval);
    startSlideShow();
}

// Navbar Menüsünü Aç/Kapat
const menuToggle = document.querySelector('.menu-toggle');
const navbarMenu = document.getElementById('navbar-menu');

if (menuToggle && navbarMenu) {
    menuToggle.addEventListener('click', () => {
        navbarMenu.classList.toggle('active');
        const expanded = menuToggle.getAttribute('aria-expanded') === 'true' || false;
        menuToggle.setAttribute('aria-expanded', !expanded);
    });
}

// Slayt Gösterisini ve Diğer İşlevleri Başlat
document.addEventListener('DOMContentLoaded', () => {
    showSlide(currentSlideIndex);
    startSlideShow();

    // AOS Başlatma
    AOS.init({
        duration: 1000, // Animasyon süresi (ms)
        once: true,     // Animasyon sadece bir kez çalışsın
    });

    // Sağlık Grubu İstatistikleri Canlı Sayımı
    const counters = document.querySelectorAll('.grup-content p');
    const speed = 200; // Sayma hızı (milisaniye)

    counters.forEach(counter => {
        const updateCount = () => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText;

            const increment = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + increment);
                setTimeout(updateCount, 1);
            } else {
                counter.innerText = target;
            }
        };

        updateCount();
    });

    // Kullanıcı Durumunu Kontrol Etme ve Navbar'ı Güncelleme
    fetch('/current-user', { // Endpoint'i '/current-user' olarak değiştirdik
        method: 'GET',
        credentials: 'include' // Oturum çerezlerini dahil etmek için
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            // Oturum açılmamış veya hata
            return null;
        }
    })
    .then(data => {
        const guestMenu = document.querySelector('.guest-menu');
        const userMenu = document.querySelector('.user-menu');

        if (data && data.username) {
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
    .catch(error => console.error('Kullanıcı durumu kontrol edilirken hata:', error));

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
                location.reload(); // Sayfayı yenileyerek menüyü güncelle
            })
            .catch(error => console.error('Çıkış yapma sırasında hata:', error));
        });
    }
});
