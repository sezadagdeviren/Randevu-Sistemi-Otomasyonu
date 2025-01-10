// public/js/doctor-dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    const appointmentsTableBody = document.querySelector('#appointmentsTable tbody');
    const updateProfileForm = document.getElementById('updateProfileForm');
    const doctorFirstNameInput = document.getElementById('doctorFirstName');
    const doctorLastNameInput = document.getElementById('doctorLastName');
    const doctorEmailInput = document.getElementById('doctorEmail');
    const appointmentResultsForm = document.getElementById('appointmentResultsForm');
    const appointmentResultsModal = new bootstrap.Modal(document.getElementById('appointmentResultsModal'), {});
    const resultAppointmentIdInput = document.getElementById('resultAppointmentId');
    const diagnosisInput = document.getElementById('diagnosis');
    const medicationInput = document.getElementById('medication');

    // SweetAlert2 Toast
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });

    // Randevuları Yükle
    async function loadAppointments() {
        try {
            const response = await fetch('/doctor/appointments', {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Randevular yüklenemedi.');
            const appointments = await response.json();

            // Tabloyu Temizle
            appointmentsTableBody.innerHTML = '';

            // Randevuları Doldur
            appointments.forEach(appointment => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${appointment.id}</td>
                    <td>${appointment.patient_first_name} ${appointment.patient_last_name}</td>
                    <td>${appointment.appointment_type}</td>
                    <td>${appointment.appointment_date}</td>
                    <td>${appointment.appointment_time}</td>
                    <td>${translateStatus(appointment.status)}</td>
                    <td>
                        ${generateActionButtons(appointment.status, appointment.google_meet_link, appointment.id)}
                    </td>
                `;
                appointmentsTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', 'Randevular yüklenirken bir sorun oluştu.', 'error');
        }
    }

    // Durumu Türkçe'ye Çevir
    function translateStatus(status) {
        switch(status) {
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

    // İşlem Butonlarını Oluştur
    function generateActionButtons(status, google_meet_link, appointmentId) {
        let buttons = '';
        if (status === 'pending') {
            buttons += `
                <button class="btn btn-success btn-sm confirm-appointment" data-id="${appointmentId}">
                    <i class="fas fa-check"></i> Onayla
                </button>
                <button class="btn btn-danger btn-sm cancel-appointment" data-id="${appointmentId}">
                    <i class="fas fa-times"></i> İptal Et
                </button>
            `;
        } else if (status === 'confirmed') {
            buttons += `
                <button class="btn btn-secondary btn-sm complete-appointment" data-id="${appointmentId}">
                    <i class="fas fa-check-double"></i> Tamamla
                </button>
                <button class="btn btn-info btn-sm view-meet" data-link="${google_meet_link}">
                    <i class="fas fa-video"></i> Görüntülü Görüşme
                </button>
            `;
        } else if (status === 'completed') {
            // Sonuçları Görüntüle Butonu
            buttons += `
                <button class="btn btn-primary btn-sm view-results" data-id="${appointmentId}">
                    <i class="fas fa-eye"></i> Sonuçları Gör
                </button>
            `;
        }
        // Diğer durumlar için ek butonlar eklenebilir
        return buttons;
    }

    // Profil Bilgilerini Yükle
    async function loadProfile() {
        try {
            const response = await fetch('/doctor/profile', {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Profil bilgileri yüklenemedi.');
            const profile = await response.json();

            doctorFirstNameInput.value = profile.first_name;
            doctorLastNameInput.value = profile.last_name;
            doctorEmailInput.value = profile.email;
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', 'Profil bilgileri yüklenirken bir sorun oluştu.', 'error');
        }
    }

    // Profil Güncelle
    updateProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const first_name = doctorFirstNameInput.value.trim();
        const last_name = doctorLastNameInput.value.trim();
        const email = doctorEmailInput.value.trim();

        if (!first_name || !last_name || !email) {
            Swal.fire('Hata', 'Tüm alanları doldurmanız gerekiyor.', 'error');
            return;
        }

        try {
            const response = await fetch('/doctor/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ first_name, last_name, email })
            });
            if (!response.ok) throw new Error('Profil güncellenemedi.');
            const data = await response.json();
            Toast.fire({ icon: 'success', title: data.message });
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', 'Profil güncellenirken bir sorun oluştu.', 'error');
        }
    });

    // Randevu Sonuçlarını Gösterme
    appointmentsTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const appointmentId = target.getAttribute('data-id');

        if (target.classList.contains('confirm-appointment')) {
            // Randevuyu Onayla ve Google Meet Linki Al
            const { value: meetLink } = await Swal.fire({
                title: 'Google Meet Linki',
                input: 'url',
                inputLabel: 'Google Meet toplantı linkini giriniz.',
                inputPlaceholder: 'https://meet.google.com/xxx-xxxx-xxx',
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value) return 'Toplantı linki gerekli.';
                    const urlPattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
                        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
                        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
                        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
                        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
                        '(\\#[-a-z\\d_]*)?$','i');
                    if (!urlPattern.test(value)) {
                        return 'Geçerli bir URL giriniz.';
                    }
                }
            });

            if (meetLink) {
                try {
                    const response = await fetch(`/appointments/${appointmentId}/status`, { // Endpoint'in doğru olduğundan emin olun
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: 'confirmed', google_meet_link: meetLink })
                    });
                    if (!response.ok) throw new Error('Randevu onaylanamadı.');
                    const data = await response.json();
                    Toast.fire({ icon: 'success', title: data.message });
                    await loadAppointments();
                } catch (error) {
                    console.error(error);
                    Swal.fire('Hata', 'Randevu onaylanırken bir sorun oluştu.', 'error');
                }
            }
        }

        if (target.classList.contains('cancel-appointment')) {
            // Randevuyu İptal Et
            Swal.fire({
                title: 'Emin misiniz?',
                text: "Bu randevuyu iptal etmek istiyor musunuz?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, iptal et!',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`/appointments/${appointmentId}/status`, { // Endpoint'in doğru olduğundan emin olun
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ status: 'cancelled' })
                        });
                        if (!response.ok) throw new Error('Randevu iptal edilemedi.');
                        const data = await response.json();
                        Toast.fire({ icon: 'success', title: data.message });
                        await loadAppointments();
                    } catch (error) {
                        console.error(error);
                        Swal.fire('Hata', 'Randevu iptal edilirken bir sorun oluştu.', 'error');
                    }
                }
            });
        }

        if (target.classList.contains('complete-appointment')) {
            // Randevuyu Tamamla ve Sonuçları Gir
            // Sonuçları girmek için modalı aç
            resultAppointmentIdInput.value = appointmentId;
            diagnosisInput.value = '';
            medicationInput.value = '';
            appointmentResultsModal.show();
        }

        if (target.classList.contains('view-meet')) {
            // Görüntülü Görüşme Linkini Aç
            const meetLink = target.getAttribute('data-link');
            if (meetLink) {
                window.open(meetLink, '_blank');
            } else {
                Swal.fire('Bilgi', 'Google Meet linki mevcut değil.', 'info');
            }
        }

        if (target.classList.contains('view-results')) {
            // Randevu Sonuçlarını Görüntüle
            try {
                const response = await fetch(`/doctor/appointments/${appointmentId}/results`, {
                    method: 'GET',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Randevu sonuçları alınamadı.');
                const data = await response.json();
                if (data.results.length === 0) {
                    Swal.fire('Bilgi', 'Bu randevunun henüz sonucu yok.', 'info');
                } else {
                    let resultsHtml = '<ul class="list-group">';
                    data.results.forEach(result => {
                        resultsHtml += `
                            <li class="list-group-item">
                                <strong>Teşhis:</strong> ${result.diagnosis}<br>
                                <strong>İlaç:</strong> ${result.medication}<br>
                                <strong>Kaydedildi:</strong> ${new Date(result.created_at).toLocaleString('tr-TR')}
                            </li>
                        `;
                    });
                    resultsHtml += '</ul>';
                    Swal.fire({
                        title: 'Randevu Sonuçları',
                        html: resultsHtml,
                        icon: 'info'
                    });
                }
            } catch (error) {
                console.error(error);
                Swal.fire('Hata', 'Randevu sonuçları alınırken bir sorun oluştu.', 'error');
            }
        }
    });

    // Randevu Sonuçlarını Kaydetme
    appointmentResultsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const appointmentId = resultAppointmentIdInput.value;
        const diagnosis = diagnosisInput.value.trim();
        const medication = medicationInput.value.trim();

        if (!diagnosis || !medication) {
            Swal.fire('Hata', 'Tüm alanları doldurmanız gerekiyor.', 'error');
            return;
        }

        try {
            // İlk olarak, randevunun durumunu 'completed' olarak güncelleyin
            const updateStatusResponse = await fetch(`/appointments/${appointmentId}/status`, { // Endpoint'in doğru olduğundan emin olun
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: 'completed' })
            });
            if (!updateStatusResponse.ok) throw new Error('Randevu durumu güncellenemedi.');

            // Sonra, randevu sonuçlarını ekleyin
            const response = await fetch(`/doctor/appointments/${appointmentId}/results`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ diagnosis, medication })
            });
            if (!response.ok) throw new Error('Randevu sonuçları kaydedilemedi.');
            const data = await response.json();
            Toast.fire({ icon: 'success', title: data.message });
            appointmentResultsModal.hide();
            await loadAppointments();
        } catch (error) {
            console.error(error);
            Swal.fire('Hata', 'Randevu sonuçları kaydedilirken bir sorun oluştu.', 'error');
        }
    });

    // İlk Yükleme
    await loadAppointments();
    await loadProfile();
});
