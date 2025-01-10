// public/js/patient-dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const departmentSearch = document.getElementById('departmentSearch');
    const doctorSearch = document.getElementById('doctorSearch');
    const departmentsList = document.getElementById('departmentsList');
    const departmentsPagination = document.getElementById('departmentsPagination');
    const doctorsList = document.getElementById('doctorsList');
    const doctorsPagination = document.getElementById('doctorsPagination');
    const doctorDetailModal = new bootstrap.Modal(document.getElementById('doctorDetailModal'), {});
    const appointmentModal = new bootstrap.Modal(document.getElementById('appointmentModal'), {});
    const appointmentForm = document.getElementById('appointmentForm');
    const appointmentsList = document.getElementById('appointmentsList');
    const weekDaysContainer = document.getElementById('weekDaysContainer');
    const appointmentTimesContainer = document.getElementById('appointmentTimes');
    const liveToast = new bootstrap.Toast(document.getElementById('liveToast'));
    const toastBody = document.getElementById('toastBody');
    const toastIcon = document.getElementById('toastIcon');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const appointmentDatePicker = document.getElementById('appointmentDatePicker');
    const appointmentTypeSelect = document.getElementById('appointmentType'); // Randevu tipi seçimi
    const appointmentDoctorId = document.getElementById('appointmentDoctorId');
  
    // Yardımcı fonksiyonlar
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
  
    // Başlangıç değişkenleri
    let currentIndex = 0; // Haftanın günleri için başlangıç indeksi
    let futureDates = [];
  
    // Debounce fonksiyonu
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
  
    // Yükleme spinner'ını göster
    function showLoadingSpinner() {
        document.getElementById('loadingSpinner').classList.remove('d-none');
    }
  
    // Yükleme spinner'ını gizle
    function hideLoadingSpinner() {
        document.getElementById('loadingSpinner').classList.add('d-none');
    }
  
    // Departmanları çek ve göster
    async function fetchDepartments(query = '') {
        showLoadingSpinner();
        try {
            const response = await fetch(`/search/departments?query=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Departmanlar alınamadı.');
            const departments = await response.json();
            displayDepartments(departments);
        } catch (error) {
            console.error('Departmanlar yüklenirken hata:', error);
            showToast('Hata', error.message, 'error');
        } finally {
            hideLoadingSpinner();
        }
    }
  
    // Departmanları listeye ekle
    function displayDepartments(departments) {
        departmentsList.innerHTML = '';
        if (departments.length === 0) {
            const li = document.createElement('li');
            li.classList.add('list-group-item');
            li.textContent = 'Bulunamadı';
            departmentsList.appendChild(li);
            return;
        }
        departments.forEach(department => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'list-group-item-action');
            li.textContent = department.name;
            li.setAttribute('tabindex', '0'); // Odaklanabilir yap
            li.addEventListener('click', () => {
                // Tüm departmanlardan active sınıfını kaldır
                Array.from(departmentsList.children).forEach(child => child.classList.remove('active'));
                li.classList.add('active');
                // Seçilen departmana ait doktorları yükle
                loadDoctors(department.id);
                // Haftanın günlerini sıfırla ve yeniden render et
                currentIndex = 0;
                renderWeekDays();
                // Randevu saatlerini ve mevcut randevuları temizle
                appointmentTimesContainer.innerHTML = '';
                appointmentsList.innerHTML = '';
                // Tarih seçimini sıfırla
                setDatePicker('');
                // Randevu tipini sıfırla
                appointmentTypeSelect.value = '';
                document.getElementById('appointmentTypeIcon').innerHTML = '';
                // Kullanıcının aktif randevusu var mı kontrol et
                checkActiveAppointments();
            });
            departmentsList.appendChild(li);
        });
    }
  
    // Doktorları çek ve göster
    async function fetchDoctors(query = '') {
        showLoadingSpinner();
        try {
            const response = await fetch(`/search/doctors?query=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Doktorlar alınamadı.');
            const doctors = await response.json();
            displayDoctors(doctors);
        } catch (error) {
            console.error('Doktorlar yüklenirken hata:', error);
            showToast('Hata', error.message, 'error');
        } finally {
            hideLoadingSpinner();
        }
    }
  
    // Doktorları listeye ekle
    function displayDoctors(doctors) {
        doctorsList.innerHTML = '';
        if (doctors.length === 0) {
            const div = document.createElement('div');
            div.classList.add('col-12', 'text-center');
            div.textContent = 'Doktor bulunamadı.';
            doctorsList.appendChild(div);
            return;
        }
        doctors.forEach(doctor => {
            const card = document.createElement('div');
            card.classList.add('col-md-4');
            card.innerHTML = `
                <div class="card doctor-card h-100">
                    <img src="${doctor.image || '/images/doctors/default-avatar.png'}" class="card-img-top doctor-image" alt="Doktor Resmi" loading="lazy">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${doctor.first_name} ${doctor.last_name}</h5>
                        <p class="card-text specialization"><strong>Uzmanlık:</strong> ${doctor.specialization}</p>
                        <p class="card-text department"><strong>Departman:</strong> ${doctor.department_name || 'Belirtilmedi'}</p>
                        <div class="mt-auto">
                            <button class="btn btn-primary view-details-btn me-2" data-doctor-id="${doctor.id}">
                                <i class="fas fa-info-circle"></i> Detayları Gör
                            </button>
                            <button class="btn btn-success make-appointment-btn" data-doctor-id="${doctor.id}">
                                <i class="fas fa-calendar-plus"></i> Randevu Al
                            </button>
                        </div>
                    </div>
                </div>
            `;
            doctorsList.appendChild(card);
        });
    }
  
    // Arama alanları için debounced event listener'lar
    departmentSearch.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim();
        fetchDepartments(query);
    }, 300));
  
    doctorSearch.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim();
        fetchDoctors(query);
    }, 300));
  
    // Başlangıçta departmanları ve doktorları yükle
    fetchDepartments();
    fetchDoctors();
  
    // Dinamik butonlar için event delegation
    doctorsList.addEventListener('click', async (e) => {
        if (e.target.closest('.view-details-btn')) {
            const button = e.target.closest('.view-details-btn');
            const doctorId = button.getAttribute('data-doctor-id');
            try {
                const response = await fetch(`/doctors/${doctorId}`, {
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Doktor detayları alınamadı.');
                const doctor = await response.json();
                populateDoctorDetailModal(doctor);
                doctorDetailModal.show();
            } catch (error) {
                console.error('Doktor detayları alınırken hata:', error);
                showToast('Hata', 'Doktor detayları alınamadı.', 'error');
            }
        }
  
        if (e.target.closest('.make-appointment-btn')) {
            const button = e.target.closest('.make-appointment-btn');
            const doctorId = button.getAttribute('data-doctor-id');
            openAppointmentForm(doctorId);
        }
    });
  
    // Doktor detay modalını doldurma fonksiyonu
    function populateDoctorDetailModal(doctor) {
        document.getElementById('detailDoctorName').textContent = `${doctor.first_name} ${doctor.last_name}`;
        document.getElementById('detailDoctorSpecialization').textContent = doctor.specialization;
        document.getElementById('detailDoctorDepartment').textContent = doctor.department_name || 'Belirtilmedi';
        document.getElementById('detailDoctorImage').src = doctor.image || '/images/doctors/default-avatar.png';
    }
  
    // Randevu alma formunu açma fonksiyonu
    function openAppointmentForm(doctorId) {
        document.getElementById('appointmentDoctorId').value = doctorId;
        // Formu sıfırla
        appointmentForm.reset();
        document.getElementById('appointmentTypeIcon').innerHTML = '';
        // Tarih seçici için minimum tarihi ayarla
        const today = new Date().toISOString().split('T')[0];
        appointmentDatePicker.setAttribute('min', today);
        // Haftanın gün butonlarını temizle
        document.querySelectorAll('.week-day-btn').forEach(btn => btn.classList.remove('active'));
        // Randevu saatlerini ve mevcut randevuları temizle
        appointmentTimesContainer.innerHTML = '';
        appointmentsList.innerHTML = '';
        // Randevu tipini sıfırla
        appointmentTypeSelect.value = '';
        document.getElementById('appointmentTypeIcon').innerHTML = '';
        // Kullanıcının aktif randevusu var mı kontrol et
        checkActiveAppointments();
        // Randevu modalını aç
        appointmentModal.show();
    }
  
    // Toast bildirimleri için fonksiyon
    function showToast(type, message, iconType = 'info') {
        // Türüne göre ikon ve arka plan rengini ayarla
        switch (type) {
            case 'success':
                toastIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
                document.getElementById('liveToast').classList.remove('bg-primary', 'bg-danger', 'bg-info');
                document.getElementById('liveToast').classList.add('bg-success');
                break;
            case 'error':
                toastIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                document.getElementById('liveToast').classList.remove('bg-primary', 'bg-success', 'bg-info');
                document.getElementById('liveToast').classList.add('bg-danger');
                break;
            case 'info':
                toastIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
                document.getElementById('liveToast').classList.remove('bg-success', 'bg-danger', 'bg-primary');
                document.getElementById('liveToast').classList.add('bg-primary');
                break;
            default:
                toastIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
                document.getElementById('liveToast').classList.remove('bg-success', 'bg-danger', 'bg-primary');
                document.getElementById('liveToast').classList.add('bg-primary');
        }
  
        toastBody.textContent = message;
  
        liveToast.show();
    }
  
    // Randevu formu gönderimi
    appointmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            doctor_id: appointmentDoctorId.value,
            appointment_type: appointmentTypeSelect.value,
            appointment_date: appointmentDatePicker.value,
            appointment_time: document.querySelector('.appointment-time-btn.active') ? document.querySelector('.appointment-time-btn.active').dataset.time : ''
        };
  
        // Gerekli alanların doldurulup doldurulmadığını kontrol et
        if (!formData.appointment_type || !formData.appointment_date || !formData.appointment_time) {
            showToast('Hata', 'Lütfen tüm alanları doldurun.', 'error');
            return;
        }
  
        try {
            const response = await fetch('/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (response.ok) {
                showToast('Başarılı', 'Randevu başarıyla oluşturuldu.', 'success');
                appointmentForm.reset();
                // Aktif saat butonlarını temizle
                document.querySelectorAll('.appointment-time-btn').forEach(btn => btn.classList.remove('active'));
                // Uygun saatleri yeniden yükle
                loadAvailableSlots(formData.doctor_id, formData.appointment_date, formData.appointment_type);
                // Mevcut randevuları yeniden yükle
                loadAppointments(formData.doctor_id);
                // Kullanıcının artık aktif randevusu olduğu için randevu butonlarını devre dışı bırak
                checkActiveAppointments();
            } else {
                showToast('Hata', result.message || 'Randevu oluşturulamadı.', 'error');
            }
        } catch (error) {
            console.error('Randevu oluştururken hata:', error);
            showToast('Hata', 'Randevu oluşturulurken bir hata oluştu.', 'error');
        }
    });
  
    // Randevu tipi değiştiğinde ikon ve uygun saatleri güncelle
    appointmentTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        switch (type) {
            case 'Görüntülü Görüşme':
                document.getElementById('appointmentTypeIcon').innerHTML = '<i class="fas fa-video"></i>';
                break;
            case 'Muayene Randevusu':
                document.getElementById('appointmentTypeIcon').innerHTML = '<i class="fas fa-user-md"></i>';
                break;
            default:
                document.getElementById('appointmentTypeIcon').innerHTML = '';
        }
  
        const selectedDate = appointmentDatePicker.value;
        const doctorId = appointmentDoctorId.value;
  
        // Doktor ve randevu tipi seçiliyse uygun saatleri yükle
        if (doctorId && selectedDate && type) {
            loadAvailableSlots(doctorId, selectedDate, type);
        } else {
            appointmentTimesContainer.innerHTML = '';
        }
    });
  
    // Gelecekteki tarihleri oluşturma (Pazar günleri hariç)
    function generateFutureDates(startDate, daysAhead = 60) {
        futureDates = [];
        const date = new Date(startDate);
        for (let i = 0; i < daysAhead; i++) {
            if (date.getDay() !== 0) { // Pazar günlerini hariç tut
                futureDates.push(new Date(date));
            }
            date.setDate(date.getDate() + 1);
        }
    }
  
    // Tarihi YYYY-MM-DD formatına çevirme
    function formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
  
    // Haftanın günlerini render etme
    function renderWeekDays() {
        weekDaysContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const date = futureDates[currentIndex + i];
            if (!date) break; // Daha fazla tarih yoksa çık
            const dayName = date.toLocaleDateString('tr-TR', { weekday: 'long' });
            const displayDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
            const dateStr = formatDateLocal(date);
            const dayBtn = document.createElement('button');
            dayBtn.type = 'button';
            dayBtn.classList.add('btn', 'btn-outline-secondary', 'week-day-btn');
            dayBtn.dataset.date = dateStr;
            dayBtn.innerHTML = `<i class="fas fa-calendar-alt"></i> ${displayDate} ${dayName}`;
            dayBtn.addEventListener('click', () => {
                // Tüm butonlardan active sınıfını kaldır
                document.querySelectorAll('.week-day-btn').forEach(btn => btn.classList.remove('active'));
                dayBtn.classList.add('active');
                // Doktor ve randevu tipi seçiliyse uygun saatleri yükle
                if (appointmentDoctorId.value && appointmentTypeSelect.value) {
                    loadAvailableSlots(appointmentDoctorId.value, dateStr, appointmentTypeSelect.value);
                }
                // Tarih seçiciyi güncelle
                setDatePicker(dateStr);
            });
            weekDaysContainer.appendChild(dayBtn);
        }
  
        // Navigasyon butonlarını etkinleştir veya devre dışı bırak
        prevWeekBtn.disabled = currentIndex === 0;
        nextWeekBtn.disabled = currentIndex + 3 >= futureDates.length;
    }
  
    // Önceki haftaya git
    prevWeekBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex -= 3;
            renderWeekDays();
        }
    });
  
    // Sonraki haftaya git
    nextWeekBtn.addEventListener('click', () => {
        if (currentIndex + 3 < futureDates.length) {
            currentIndex += 3;
            renderWeekDays();
        }
    });
  
    // Doktor için uygun saatleri yükleme
    async function loadAvailableSlots(doctorId, date, appointmentType) {
        if (!date || !appointmentType) {
            appointmentTimesContainer.innerHTML = '';
            return;
        }
        showLoadingSpinner();
        try {
            const response = await fetch(`/doctors/${doctorId}/available-slots?date=${date}&appointment_type=${encodeURIComponent(appointmentType)}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Uygun saatleri yüklerken bir hata oluştu.');
            }
            const data = await response.json();
            renderAvailableSlots(data.availableSlots, appointmentType);
        } catch (error) {
            console.error('Uygun Saatleri Yükleme Hatası:', error);
            showToast('Hata', error.message, 'error');
        } finally {
            hideLoadingSpinner();
        }
    }
  
    // Uygun saatleri buton olarak render etme
    function renderAvailableSlots(slots, appointmentType) {
        appointmentTimesContainer.innerHTML = '';
        let allSlots = [];
  
        if (appointmentType === 'Muayene Randevusu') {
            allSlots = ['08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00'];
        } else if (appointmentType === 'Görüntülü Görüşme') {
            allSlots = ['13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00'];
        }
  
        allSlots.forEach(time => {
            const isAvailable = slots.includes(time);
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('btn', 'btn-outline-primary', 'appointment-time-btn');
            button.textContent = time.slice(0, 5); // Sadece HH:MM göstermek için
            button.dataset.time = time;
  
            if (!isAvailable) {
                button.classList.add('disabled');
                button.disabled = true;
                button.title = 'Bu saat dolu';
            }
  
            button.addEventListener('click', () => {
                // Tüm saat butonlarından active sınıfını kaldır
                document.querySelectorAll('.appointment-time-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
  
            appointmentTimesContainer.appendChild(button);
        });
    }
  
    // Tarih seçiciyi güncelleme
    function setDatePicker(dateStr) {
        appointmentDatePicker.value = dateStr;
    }
  
    // Randevuları yükleme
    async function loadAppointments(doctorId) {
        showLoadingSpinner();
        try {
            const response = await fetch(`/appointments`, {
                credentials: 'include'
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Randevuları yüklerken bir hata oluştu.');
            }
            const appointments = await response.json();
            renderAppointments(appointments);
        } catch (error) {
            console.error('Randevuları Yükleme Hatası:', error);
            showToast('Hata', error.message, 'error');
        } finally {
            hideLoadingSpinner();
        }
    }
  
    // Randevuları listeye ekleme
    function renderAppointments(appointments) {
        appointmentsList.innerHTML = '';
        const filteredAppointments = appointments.filter(app => app.doctor_id == appointmentDoctorId.value && (app.status === 'pending'));
        if (filteredAppointments.length === 0) {
            appointmentsList.innerHTML = `<li class="list-group-item">Hiç aktif randevu bulunamadı.</li>`;
            return;
        }
        filteredAppointments.forEach(app => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            li.innerHTML = `
                <div>
                    <strong>${app.appointment_type}</strong><br>
                    ${app.appointment_date.split('-').reverse().join('.')} - ${formatTime(app.appointment_time)} (${app.doctor_first_name} ${app.doctor_last_name}, ${app.specialization})<br>
                    Durum: ${capitalizeFirstLetter(app.status)}
                </div>
                <button class="btn btn-sm btn-danger delete-appointment-btn" data-id="${app.id}" data-doctor-id="${app.doctor_id}" data-datetime="${app.appointment_date}T${app.appointment_time}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            // İptal butonu için event listener ekle
            const deleteBtn = li.querySelector('.delete-appointment-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function () {
                    const appointmentId = this.getAttribute('data-id');
                    const doctorId = this.getAttribute('data-doctor-id');
                    const appointmentDateTime = this.getAttribute('data-datetime');
                    deleteAppointment(appointmentId, doctorId, appointmentDateTime);
                });
            }
            appointmentsList.appendChild(li);
        });
    }
  
    // Randevu iptal etme fonksiyonu
    async function deleteAppointment(appointmentId, doctorId, appointmentDateTime) {
        const now = new Date();
        if (new Date(appointmentDateTime) <= now) {
            showToast('Hata', 'Geçmiş randevuları iptal edemezsiniz.', 'error');
            return;
        }
  
        const confirmed = await Swal.fire({
            title: 'Randevuyu İptal Et',
            text: 'Randevuyu iptal etmek istediğinize emin misiniz?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Evet, iptal et',
            cancelButtonText: 'Hayır, vazgeç'
        });
  
        if (!confirmed.isConfirmed) return;
  
        showLoadingSpinner();
        try {
            const response = await fetch(`/appointments/${appointmentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
  
            const data = await response.json();
  
            if (!response.ok) {
                throw new Error(data.message || 'Randevu iptal edilirken bir hata oluştu.');
            }
  
            showToast('Başarılı', 'Randevunuz başarıyla iptal edildi.', 'success');
            // Randevuları yeniden yükle
            loadAppointments(doctorId);
            // Uygun saatleri yeniden yükle
            const selectedDate = appointmentDatePicker.value;
            const selectedType = appointmentTypeSelect.value;
            if (selectedDate && selectedType) {
                loadAvailableSlots(doctorId, selectedDate, selectedType);
            }
            // Kullanıcının artık aktif randevusu olduğu için randevu butonlarını devre dışı bırak
            checkActiveAppointments();
        } catch (error) {
            console.error('Randevu İptal Etme Hatası:', error);
            showToast('Hata', error.message, 'error');
        } finally {
            hideLoadingSpinner();
        }
    }
  
    // Zaman formatını ayarlama
    function formatTime(timeStr) {
        return timeStr.slice(0, 5); // Sadece HH:MM göstermek için
    }
  
    // Randevu saat butonlarına event listener ekleme (Alternatif yaklaşım)
    appointmentTimesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('appointment-time-btn') && !e.target.classList.contains('disabled')) {
            document.querySelectorAll('.appointment-time-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
        }
    });
  
    // Gelecekteki tarihleri oluştur ve haftanın günlerini render et
    generateFutureDates(new Date(), 60); // 60 gün ileriye
    renderWeekDays();
  
    // Randevu modalı gösterildiğinde randevuları yükle
    document.getElementById('appointmentModal').addEventListener('shown.bs.modal', function () {
        const doctorId = appointmentDoctorId.value;
        if (doctorId) {
            loadAppointments(doctorId);
        }
    });
  
    // Tarih seçici için minimum tarihi ayarla
    setDatePickerMin();
  
    function setDatePickerMin() {
        const todayStr = formatDateLocal(new Date());
        appointmentDatePicker.setAttribute('min', todayStr);
    }
  
    // Kullanıcının aktif randevusu var mı kontrol etme fonksiyonu
    async function checkActiveAppointments() {
        try {
            const response = await fetch(`/appointments`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Randevular alınamadı.');
            const appointments = await response.json();
            const activeAppointments = appointments.filter(app => (app.status === 'pending') && new Date(`${app.appointment_date}T${app.appointment_time}`) > new Date());
            
            // Randevu tiplerine göre say
            const videoConsultations = activeAppointments.filter(app => app.appointment_type === 'Görüntülü Görüşme');
            const physicalAppointments = activeAppointments.filter(app => app.appointment_type === 'Muayene Randevusu');
  
            // Randevu alma butonlarını duruma göre yönet
            if (videoConsultations.length >= 1 && physicalAppointments.length >= 1) {
                // Her iki türden de aktif randevu varsa, randevu alma butonlarını devre dışı bırak
                document.querySelectorAll('.make-appointment-btn').forEach(btn => {
                    btn.disabled = true;
                    btn.title = 'Mevcut aktif randevularınız var. Önce mevcut randevularınızı iptal edin.';
                    btn.classList.add('disabled');
                });
                showToast('Bilgi', 'Mevcut aktif randevularınız var. Önce mevcut randevularınızı iptal edin.', 'info');
            } else if (videoConsultations.length >= 1 || physicalAppointments.length >= 1) {
                // Sadece bir türden aktif randevu varsa, aynı türde yeni randevu alınmasını engelle
                document.querySelectorAll('.make-appointment-btn').forEach(btn => {
                    const btnDoctorId = btn.getAttribute('data-doctor-id');
                    // Randevu tipine göre butonları kontrol et
                    btn.addEventListener('click', async () => {
                        // Seçilen doktorun id'sine göre aktif randevuları kontrol et
                        const appointmentType = await getDoctorAppointmentType(btnDoctorId);
                        if ((appointmentType === 'Görüntülü Görüşme' && videoConsultations.length >= 1) ||
                            (appointmentType === 'Muayene Randevusu' && physicalAppointments.length >= 1)) {
                            showToast('Hata', `Mevcut aktif bir ${appointmentType} randevunuz var. Önce mevcut randevunuzu iptal edin.`, 'error');
                            btn.disabled = true;
                            btn.title = 'Mevcut aktif randevunuz var. Önce mevcut randevunuzu iptal edin.';
                            btn.classList.add('disabled');
                        }
                    });
                });
            } else {
                // Her iki türden de aktif randevu yoksa, randevu alma butonlarını etkinleştir
                document.querySelectorAll('.make-appointment-btn').forEach(btn => {
                    btn.disabled = false;
                    btn.title = '';
                    btn.classList.remove('disabled');
                });
            }
        } catch (error) {
            console.error('Aktif randevu kontrolü sırasında hata:', error);
            showToast('Hata', 'Aktif randevu kontrolü yapılamadı.', 'error');
        }
    }
  
    // Doktorun randevu tipini alma fonksiyonu
    async function getDoctorAppointmentType(doctorId) {
        try {
            const response = await fetch(`/doctors/${doctorId}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Doktor detayları alınamadı.');
            const doctor = await response.json();
            return doctor.appointment_type || '';
        } catch (error) {
            console.error('Doktor randevu tipi alınırken hata:', error);
            return '';
        }
    }
  
  });
  