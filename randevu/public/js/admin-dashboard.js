document.addEventListener('DOMContentLoaded', async () => {
    const navLinks = document.querySelectorAll('header nav ul li a');
    const sections = document.querySelectorAll('main section');

    // Departman Modal
    const departmentModalEl = document.getElementById('departmentModal');
    const departmentModal = new bootstrap.Modal(departmentModalEl);
    const departmentNameInput = document.getElementById('departmentNameInput');
    const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');

    // Doktor Resim Yükleme Modal
    const doctorImageModalEl = document.getElementById('doctorImageModal');
    const doctorImageModal = new bootstrap.Modal(doctorImageModalEl);
    const uploadDoctorImageBtn = document.getElementById('uploadDoctorImageBtn');
    let currentDoctorIdForImage = null;

    const pond = FilePond.create(document.querySelector('.filepond'), {
        allowMultiple: false,
        maxFiles: 1,
        labelIdle: 'Sürükle-bırak veya <span class="filepond--label-action">Gözat</span>'
    });

    let editingDepartmentId = null;
    const headers = { 'X-Admin-Auth': 'secret_admin_key', 'Content-Type': 'application/json' };

    // SweetAlert2 Toast
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });

    // Sekme geçişleri
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const sectionId = link.getAttribute('data-section');
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(sectionId + 'Section').classList.add('active');
        });
    });

    function openDepartmentModal(departmentId = null, name = '') {
        editingDepartmentId = departmentId;
        departmentNameInput.value = name;
        departmentModal.show();
    }

    function closeDepartmentModal() {
        departmentModal.hide();
        editingDepartmentId = null;
    }

    async function loadData() {
        const [departmentsRes, doctorsRes, usersRes] = await Promise.all([
            fetch('/admin/departments', { headers }),
            fetch('/admin/doctors', { headers }),
            fetch('/admin/users', { headers })
        ]);

        const [departments, doctors, users] = await Promise.all([
            departmentsRes.json(),
            doctorsRes.json(),
            usersRes.json()
        ]);

        // Departmanlar
        const depBody = document.getElementById('departmentsTableBody');
        depBody.innerHTML = '';
        departments.forEach(dep => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dep.id}</td>
                <td>${dep.name}</td>
                <td>
                    <button class="btn btn-warning btn-sm edit-department" data-id="${dep.id}" data-name="${dep.name}">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-danger btn-sm delete-department" data-id="${dep.id}">
                        <span class="material-icons">delete</span>
                    </button>
                </td>
            `;
            depBody.appendChild(tr);
        });

        // Doktorlar
        const docBody = document.getElementById('doctorsTableBody');
        docBody.innerHTML = '';
        doctors.forEach(doc => {
            const tr = document.createElement('tr');
            const imgTag = doc.image ? `<img src="${doc.image}" class="doctor-thumb" alt="Doctor Image" />` : '';
            tr.innerHTML = `
                <td>${doc.id}</td>
                <td>${doc.first_name}</td>
                <td>${doc.last_name}</td>
                <td>${doc.specialization}</td>
                <td>${doc.department_name || ''}</td>
                <td>${imgTag}</td>
                <td>
                    <button class="btn btn-warning btn-sm edit-doctor" data-id="${doc.id}" data-user_id="${doc.user_id}" data-spec="${doc.specialization}" data-depid="${doc.department_id}">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn btn-danger btn-sm delete-doctor" data-id="${doc.id}">
                        <span class="material-icons">delete</span>
                    </button>
                    <button class="btn btn-primary btn-sm upload-image" data-id="${doc.id}">
                        <span class="material-icons">image</span>
                    </button>
                </td>
            `;
            docBody.appendChild(tr);
        });

        // Kullanıcılar
        const userBody = document.getElementById('usersTableBody');
        userBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.first_name}</td>
                <td>${user.last_name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.is_verified ? 'Evet' : 'Hayır'}</td>
                <td>
                    <button class="btn btn-warning btn-sm update-user-role" data-id="${user.id}">
                        <span class="material-icons">manage_accounts</span>
                    </button>
                    <button class="btn btn-danger btn-sm delete-user" data-id="${user.id}">
                        <span class="material-icons">delete</span>
                    </button>
                </td>
            `;
            userBody.appendChild(tr);
        });
    }

    await loadData();

    // Departman Ekle
    document.getElementById('addDepartmentBtn').addEventListener('click', () => {
        openDepartmentModal();
    });

    // Departman Kaydet
    saveDepartmentBtn.addEventListener('click', async () => {
        const name = departmentNameInput.value.trim();
        if (!name) {
            Swal.fire('Hata', 'Departman adı gerekli.', 'error');
            return;
        }

        if (editingDepartmentId) {
            await fetch('/admin/departments/' + editingDepartmentId, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ name })
            });
            Toast.fire({ icon: 'success', title: 'Departman güncellendi' });
        } else {
            await fetch('/admin/departments', {
                method: 'POST',
                headers,
                body: JSON.stringify({ name })
            });
            Toast.fire({ icon: 'success', title: 'Departman eklendi' });
        }
        closeDepartmentModal();
        await loadData();
    });

    // Departman Düzenle/Sil
    document.getElementById('departmentsTableBody').addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.getAttribute('data-id');
        if (target.classList.contains('delete-department')) {
            Swal.fire({
                title: 'Emin misiniz?',
                text: "Bu departmanı silmek istiyorsunuz.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, sil!',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await fetch('/admin/departments/' + id, { method: 'DELETE', headers });
                    await loadData();
                    Toast.fire({ icon: 'success', title: 'Departman silindi' });
                }
            });
        } else if (target.classList.contains('edit-department')) {
            const name = target.getAttribute('data-name');
            openDepartmentModal(id, name);
        }
    });

    // Kullanıcı Rol Güncelle / Sil
    document.getElementById('usersTableBody').addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.getAttribute('data-id');
        if (target.classList.contains('update-user-role')) {
            const { value: newRole } = await Swal.fire({
                title: 'Yeni rol (admin/doctor/patient):',
                input: 'text',
                inputValue: 'patient',
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value) return 'Rol giriniz.';
                }
            });
            if (newRole) {
                await fetch(`/admin/users/${id}/role`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ role: newRole })
                });
                await loadData();
                Toast.fire({ icon: 'success', title: 'Kullanıcı rolü güncellendi' });
            }
        } else if (target.classList.contains('delete-user')) {
            Swal.fire({
                title: 'Emin misiniz?',
                text: "Bu kullanıcıyı silmek istiyorsunuz.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, sil!',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await fetch('/admin/users/' + id, { method: 'DELETE', headers });
                    await loadData();
                    Toast.fire({ icon: 'success', title: 'Kullanıcı silindi' });
                }
            });
        }
    });

    // Doktor Ekle
    document.getElementById('addDoctorBtn').addEventListener('click', async () => {
        const { value: user_id } = await Swal.fire({
            title: 'Kullanıcı ID:',
            input: 'text',
            showCancelButton: true,
        });
        if (!user_id) return;

        const { value: specialization } = await Swal.fire({
            title: 'Uzmanlık:',
            input: 'text',
            showCancelButton: true,
        });
        if (!specialization) return;

        const { value: department_id } = await Swal.fire({
            title: 'Departman ID (boş bırakılabilir):',
            input: 'text',
            inputValue: '',
            showCancelButton: true,
        });

        if (user_id && specialization) {
            await fetch('/admin/doctors', {
                method: 'POST',
                headers,
                body: JSON.stringify({ user_id: parseInt(user_id), specialization, department_id: department_id ? parseInt(department_id) : null })
            });
            await loadData();
            Toast.fire({ icon: 'success', title: 'Doktor eklendi' });
        }
    });

    // Doktor Düzenle/Sil/Resim Ekle
    document.getElementById('doctorsTableBody').addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.getAttribute('data-id');
        if (target.classList.contains('delete-doctor')) {
            Swal.fire({
                title: 'Emin misiniz?',
                text: "Bu doktoru silmek istiyorsunuz.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Evet, sil!',
                cancelButtonText: 'İptal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await fetch('/admin/doctors/' + id, { method: 'DELETE', headers });
                    await loadData();
                    Toast.fire({ icon: 'success', title: 'Doktor silindi' });
                }
            });
        } else if (target.classList.contains('edit-doctor')) {
            const specOld = target.getAttribute('data-spec');
            const depidOld = target.getAttribute('data-depid');

            const { value: spec } = await Swal.fire({
                title: 'Yeni Uzmanlık:',
                input: 'text',
                inputValue: specOld,
                showCancelButton: true,
            });
            if (spec === null) return;

            const { value: depid } = await Swal.fire({
                title: 'Yeni Departman ID:',
                input: 'text',
                inputValue: depidOld || '',
                showCancelButton: true,
            });

            await fetch('/admin/doctors/' + id, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ specialization: spec, department_id: depid ? parseInt(depid) : null })
            });
            await loadData();
            Toast.fire({ icon: 'success', title: 'Doktor güncellendi' });
        } else if (target.classList.contains('upload-image')) {
            currentDoctorIdForImage = id;
            pond.removeFiles();
            doctorImageModal.show();
        }
    });

    // Doktor Resim Yükle
    uploadDoctorImageBtn.addEventListener('click', async () => {
        const files = pond.getFiles();
        if (files.length === 0) {
            Swal.fire('Hata', 'Lütfen bir resim seçin.', 'error');
            return;
        }

        const file = files[0].file;
        const formData = new FormData();
        formData.append('image', file);

        await fetch(`/admin/doctors/${currentDoctorIdForImage}/image`, {
            method: 'POST',
            headers: { 'X-Admin-Auth': 'secret_admin_key' },
            body: formData
        });
        Toast.fire({ icon: 'success', title: 'Resim yüklendi' });
        doctorImageModal.hide();
        await loadData();
    });
});
