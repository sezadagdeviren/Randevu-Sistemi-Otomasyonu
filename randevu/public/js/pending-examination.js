// public/js/pending-examination.js

document.addEventListener('DOMContentLoaded', () => {
    const examinationAppointmentsTableBody = document.querySelector('#examinationAppointmentsTable tbody');

    // SweetAlert2 Toast
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });

    // Randevuları Yükle
    async function loadExaminationAppointments() {
        try {
            const response = await fetch('/appointments?type=Muayene%20Randevusu&status=confirmed', {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Randevular yüklenemedi.');
            const appointments = await response.json();

            // Tabloyu Temizle
            examinationAppointmentsTableBody.innerHTML = '';

            // Randevuları Doldur
            appointments.forEach(appointment => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${appointment.id}</td>
                    <td>${appointment.doctor_first_name} ${appointment.doctor_last_name}</td>
                    <td>${formatDate(appointment.appointment_date)}</td>
                    <td>${formatTime(appointment.appointment_time)}</td>
                    <td>${translateStatus(appointment.status)}</td>
                    <td>
                        <button class="btn btn-danger btn-sm cancel-appointment-btn" data-id="${appointment.id}">
                            <i class="fas fa-trash-alt"></i> İptal Et
                        </button>
                    </td>
                `;
                examinationAppointmentsTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', 'Randevular yüklenirken bir sorun oluştu.', 'error');
        }
    }

    // Durumu Türkçe'ye Çevir
    function translateStatus(status) {
        switch (status) {
            case 'pending':
                return 'Beklemede';
            case 'confirmed':
                return 'Onaylandı';
            case 'cancelled':
                return 'İptal Edildi';
            case 'completed':
                return 'Tamamlandı';
            default:
                return status;
        }
    }

    // Tarihi Formatla (YYYY-MM-DD -> DD.MM.YYYY)
    function formatDate(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${day}.${month}.${year}`;
    }

    // Saati Formatla (HH:MM:SS -> HH:MM)
    function formatTime(timeStr) {
        return timeStr.slice(0, 5);
    }

    // Randevuyu İptal Etme
    examinationAppointmentsTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('.cancel-appointment-btn');
        if (!target) return;

        const appointmentId = target.getAttribute('data-id');

        Swal.fire({
            title: 'Randevuyu İptal Et',
            text: 'Randevuyu iptal etmek istediğinize emin misiniz?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, iptal et',
            cancelButtonText: 'Hayır, vazgeç'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/doctor/appointments/${appointmentId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: 'cancelled' })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Randevu iptal edilemedi.');
                    }

                    Toast.fire({ icon: 'success', title: data.message });
                    // Randevuları yeniden yükle
                    await loadExaminationAppointments();
                } catch (error) {
                    console.error('Randevu İptal Etme Hatası:', error);
                    Swal.fire('Hata', 'Randevu iptal edilirken bir sorun oluştu.', 'error');
                }
            }
        });
    });

    // İlk Yükleme
    loadExaminationAppointments();
});
