// public/js/esonuc.js

document.addEventListener('DOMContentLoaded', async () => {
    const resultsTableBody = document.querySelector('#resultsTable tbody');

    // SweetAlert2 Toast Ayarları
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });

    // Randevu Sonuçlarını Yükleme Fonksiyonu
    async function loadAppointmentResults() {
        try {
            const response = await fetch('/patient/appointments/results', {
                method: 'GET',
                credentials: 'include' // Oturum çerezlerini dahil et
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Yetkisiz erişim. Lütfen giriş yapınız.');
                } else {
                    throw new Error('Randevu sonuçları alınamadı.');
                }
            }

            const data = await response.json();

            // Tabloyu Temizle
            resultsTableBody.innerHTML = '';

            if (data.results.length === 0) {
                resultsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">Hiç randevu sonucunuz bulunmamaktadır.</td>
                    </tr>
                `;
                return;
            }

            // Randevu Sonuçlarını Tabloya Ekle
            data.results.forEach(result => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${result.appointment_id}</td>
                    <td>${formatDate(result.appointment_date)}</td>
                    <td>${formatTime(result.appointment_time)}</td>
                    <td>${result.appointment_type}</td>
                    <td>${result.diagnosis || 'Henüz girilmedi'}</td>
                    <td>${result.medication || 'Henüz girilmedi'}</td>
                    <td>${formatDateTime(result.created_at)}</td>
                `;
                resultsTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', error.message, 'error');
        }
    }

    // Tarihi Formatlama Fonksiyonu
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', options);
    }

    // Saati Formatlama Fonksiyonu
    function formatTime(timeString) {
        const time = new Date(`1970-01-01T${timeString}Z`);
        return time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    // Tarih ve Saati Formatlama Fonksiyonu
    function formatDateTime(dateTimeString) {
        const date = new Date(dateTimeString);
        return date.toLocaleString('tr-TR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // İlk Yükleme
    await loadAppointmentResults();
});
