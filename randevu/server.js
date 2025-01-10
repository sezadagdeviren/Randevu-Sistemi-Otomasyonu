// server.js

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pool = require('./db'); // db.js dosyasını içeri aktar
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
require('dotenv').config();
const morgan = require('morgan');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer'); // Nodemailer'ı içeri aktar



const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------- Middleware Configuration ----------------------

// Güvenlik HTTP başlıkları
app.use(helmet());

// CORS Yapılandırması
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Yerel geliştirme için localhost
    credentials: true
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Store
const sessionStore = new MySQLStore({}, pool);

// Oturum Yapılandırması
app.use(session({
    key: 'session_cookie_name',
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Yerel geliştirme için HTTPS kullanmıyorsanız 'false' olarak ayarlayın
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 2 // 2 saat
    }
}));

// Rate Limiter - Giriş ve Kayıt rotaları için
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100,
    message: 'Bu IP adresinden çok fazla istek yapıldı, lütfen 15 dakika sonra tekrar deneyin.'
});
app.use('/login', apiLimiter);
app.use('/register', apiLimiter);

// HTTP Request Logging (morgan)
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// Statik Dosyaları Servis Et
app.use(express.static(path.join(__dirname, 'public')));
const transporter = nodemailer.createTransport({
    service: 'Gmail', // Kullandığınız e-posta hizmetine göre değiştirin
    auth: {
        user: process.env.EMAIL_USER, // .env dosyanızdaki EMAIL_USER
        pass: process.env.EMAIL_PASS  // .env dosyanızdaki EMAIL_PASS
    }
});

// ---------------------- Authentication Middleware ----------------------

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Oturum açmanız gerekiyor.' });
    }
}

// Role-Based Access Middleware
function hasRole(role) {
    return (req, res, next) => {
        if (req.session && req.session.role === role) {
            next();
        } else {
            res.status(403).json({ message: 'Bu işlemi yapma yetkiniz yok.' });
        }
    };
}

// Role-Based Access Middleware for Patient
function hasRolePatient(req, res, next) {
    if (req.session && req.session.role === 'patient') {
        next();
    } else {
        res.status(403).json({ message: 'Bu sayfayı görüntüleme yetkiniz yok.' });
    }
}

// Role-Based Access Middleware for Doctor
function hasRoleDoctor(req, res, next) {
    if (req.session && req.session.role === 'doctor') {
        next();
    } else {
        res.status(403).json({ message: 'Bu sayfayı görüntüleme yetkiniz yok.' });
    }
}

// Anasayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



// ---------------------- Authentication Routes ----------------------
const crypto = require('crypto'); // Güvenli rastgele kodlar için
// Kullanıcı Kayıt
app.post('/register', [
    body('first_name').notEmpty().withMessage('İsim gerekli.'),
    body('last_name').notEmpty().withMessage('Soyisim gerekli.'),
    body('tc_kimlik').isLength({ min: 11, max: 11 }).withMessage('TC Kimlik numarası 11 haneli olmalı.'),
    body('username').notEmpty().withMessage('Kullanıcı adı gerekli.'),
    body('email').isEmail().withMessage('Geçerli bir email gerekli.'),
    body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Hatalı giriş.', errors: errors.array() });
    }

    const { first_name, last_name, tc_kimlik, username, email, password } = req.body;

    try {
        // Kullanıcı adını, email'i veya TC Kimlik numarasını kontrol et
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ? OR tc_kimlik = ?', [username, email, tc_kimlik]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Kullanıcı adı, email veya TC Kimlik numarası zaten kullanılıyor.' });
        }

        // Şifreyi hash'le
        const hashedPassword = await bcrypt.hash(password, 10);

        // Doğrulama kodu oluştur (6 haneli rastgele sayı)
        const verification_code = Math.floor(100000 + Math.random() * 900000).toString();

        // Doğrulama kodunun geçerlilik süresini ayarla (24 saat)
        const verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat sonrası

        // Kullanıcıyı veritabanına ekle
        const [result] = await pool.query(
            'INSERT INTO users (first_name, last_name, tc_kimlik, username, email, password, role, is_verified, verification_code, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [first_name, last_name, tc_kimlik, username, email, hashedPassword, 'patient', 0, verification_code, verification_expires]
        );

        // Doğrulama kodunu içeren e-posta gönder
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Hesap Doğrulama Kodu',
            text: `Merhaba ${first_name},\n\nHesabınızı doğrulamak için aşağıdaki doğrulama kodunu giriniz:\n\n${verification_code}\n\nBu kod 24 saat boyunca geçerlidir.\n\nSaygılarımızla,\nUygulama Ekibi`
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: 'Kullanıcı kaydedildi. Lütfen emailinize gönderilen doğrulama kodunu giriniz.' });
    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ message: 'Kayıt başarısız oldu.', error: err.message });
    }
});
// Kullanıcı Email Doğrulama
app.post('/verify-email', [
    body('email').isEmail().withMessage('Geçerli bir email gerekli.'),
    body('verification_code').isLength({ min: 6, max: 6 }).withMessage('Doğrulama kodu 6 haneli olmalı.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Hatalı giriş.', errors: errors.array() });
    }

    const { email, verification_code } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const user = users[0];

        if (user.is_verified) {
            return res.status(400).json({ message: 'Hesap zaten doğrulanmış.' });
        }

        if (user.verification_code !== verification_code) {
            return res.status(400).json({ message: 'Doğrulama kodu yanlış.' });
        }

        const now = new Date();
        if (user.verification_expires < now) {
            return res.status(400).json({ message: 'Doğrulama kodu süresi doldu.' });
        }

        // Kullanıcının doğrulamasını tamamla
        await pool.query('UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?', [user.id]);

        res.json({ message: 'Hesap başarıyla doğrulandı. Giriş yapabilirsiniz.' });
    } catch (err) {
        console.error('Verify Email Error:', err);
        res.status(500).json({ message: 'Doğrulama işlemi başarısız oldu.', error: err.message });
    }
});
// Doğrulama Kodunu Yeniden Gönderme
app.post('/resend-verification', [
    body('email').isEmail().withMessage('Geçerli bir email gerekli.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Hatalı giriş.', errors: errors.array() });
    }

    const { email } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const user = users[0];

        if (user.is_verified) {
            return res.status(400).json({ message: 'Hesap zaten doğrulanmış.' });
        }

        // Yeni doğrulama kodu oluştur
        const new_verification_code = Math.floor(100000 + Math.random() * 900000).toString();
        const new_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

        // Kullanıcıyı güncelle
        await pool.query('UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?', [new_verification_code, new_verification_expires, user.id]);

        // Doğrulama kodunu içeren e-posta gönder
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Yeni Hesap Doğrulama Kodu',
            text: `Merhaba ${user.first_name},\n\nHesabınızı doğrulamak için aşağıdaki yeni doğrulama kodunu giriniz:\n\n${new_verification_code}\n\nBu kod 24 saat boyunca geçerlidir.\n\nSaygılarımızla,\nUygulama Ekibi`
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: 'Yeni doğrulama kodu gönderildi. Lütfen emailinizi kontrol ediniz.' });
    } catch (err) {
        console.error('Resend Verification Error:', err);
        res.status(500).json({ message: 'Doğrulama kodu gönderilemedi.', error: err.message });
    }
});

// Kullanıcı Girişi
app.post('/login', [
    body('username').notEmpty().withMessage('Kullanıcı adı gerekli.'),
    body('password').notEmpty().withMessage('Şifre gerekli.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Hatalı giriş.', errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Geçersiz kullanıcı adı veya şifre.' });
        }

        const user = users[0];

        // Kullanıcının doğrulanıp doğrulanmadığını kontrol et
        if (!user.is_verified) {
            return res.status(400).json({ message: 'Hesabınızı doğrulamanız gerekiyor. Lütfen emailinize gönderilen doğrulama kodunu giriniz.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Geçersiz kullanıcı adı veya şifre.' });
        }

        // Oturumu başlat
        req.session.userId = user.id;
        req.session.role = user.role;

        res.json({ message: 'Başarıyla giriş yapıldı.', role: user.role });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Giriş başarısız oldu.', error: err.message });
    }
});
// **/current-user Endpoint'i**
app.get('/current-user', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [users] = await pool.query('SELECT first_name, last_name, username FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        res.json({ first_name: users[0].first_name, last_name: users[0].last_name, username: users[0].username });
    } catch (err) {
        console.error('Get Current User Error:', err);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});
// server.js

// server.js

// Kullanıcı Çıkışı
app.post('/logout', isAuthenticated, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout Error:', err);
            return res.status(500).json({ message: 'Çıkış yapılamadı.' });
        }
        res.clearCookie('connect.sid'); // Oturum çerezinin adı 'connect.sid' ise
        res.json({ message: 'Başarıyla çıkış yapıldı.' });
    });
});
// ---------------------------------------------------
// Kullanıcı Bilgilerini Getirme (profile.html için)
// ---------------------------------------------------
app.get('/get-user-info', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [rows] = await pool.query(`
            SELECT 
              u.id,
              u.first_name,
              u.last_name,
              u.username,
              u.email,
              u.tc_kimlik,
              up.gender,
              up.dob,
              up.city,
              up.address,
              up.phone,
              up.blood_type,
              up.height,
              up.weight,
              up.iban
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = ?
        `, [userId]);

        if (rows.length === 0) {
            return res.json({ success: false, message: 'Kullanıcı bilgisi bulunamadı.' });
        }
        return res.json({ success: true, user: rows[0] });
    } catch (error) {
        console.error('get-user-info error:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
});

// ---------------------------------------------------
// Genel Bilgileri Güncelleme
// ---------------------------------------------------
app.post('/update-general-info', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const {
            gender,
            dob,
            city,
            address,
            phone,
            bloodType,
            height,
            weight,
            iban
        } = req.body;

        // user_profiles tablosunda kayıt var mı kontrol
        const [profileResult] = await pool.query(
            'SELECT user_id FROM user_profiles WHERE user_id = ?',
            [userId]
        );

        if (profileResult.length > 0) {
            // Güncelle
            await pool.query(`
                UPDATE user_profiles
                SET gender = ?, dob = ?, city = ?, address = ?, phone = ?, blood_type = ?, height = ?, weight = ?, iban = ?
                WHERE user_id = ?
            `, [gender, dob, city, address, phone, bloodType, height, weight, iban, userId]);
        } else {
            // Ekle
            await pool.query(`
                INSERT INTO user_profiles 
                    (user_id, gender, dob, city, address, phone, blood_type, height, weight, iban)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, gender, dob, city, address, phone, bloodType, height, weight, iban]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Genel bilgiler güncellenirken hata:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
});

// ---------------------------------------------------
// Kullanıcı Bilgilerini Güncelleme
// ---------------------------------------------------
app.post('/update-user-info', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { username, email, newPassword } = req.body;

        // Kullanıcı adı/email çakışma kontrolü
        const [existingUser] = await pool.query(`
            SELECT id FROM users 
            WHERE (username = ? OR email = ?) AND id != ?
        `, [username, email, userId]);

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Kullanıcı adı veya e-posta başka bir kullanıcı tarafından kullanılıyor.'
            });
        }

        // Şifre güncellemesi (opsiyonel)
        let hashedPassword = null;
        if (newPassword) {
            hashedPassword = await bcrypt.hash(newPassword, 10);
        }

        // Kullanıcı bilgilerini güncelle
        await pool.query(`
            UPDATE users
            SET username = ?, email = ?, password = IFNULL(?, password)
            WHERE id = ?
        `, [username, email, hashedPassword, userId]);

        // Oturumdaki verileri de güncellemek isterseniz:
        req.session.username = username;
        req.session.email = email;

        res.json({ success: true });
    } catch (error) {
        console.error('Kullanıcı bilgileri güncellenirken hata:', error);
        res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
});


// ---------------------- Department Management ----------------------

// Departmanları Al
app.get('/departments', isAuthenticated, async (req, res) => {
    try {
        const [departments] = await pool.query('SELECT * FROM departments');
        res.json(departments);
    } catch (err) {
        console.error('Get Departments Error:', err);
        res.status(500).json({ message: 'Departmanlar alınamadı.', error: err.message });
    }
});

// Departmanları Ara
app.get('/search/departments', isAuthenticated, async (req, res) => {
    const query = req.query.query || '';
    try {
        const [departments] = await pool.query('SELECT * FROM departments WHERE name LIKE ?', [`%${query}%`]);
        res.json(departments);
    } catch (err) {
        console.error('Search Departments Error:', err);
        res.status(500).json({ message: 'Departmanlar aranamadı.', error: err.message });
    }
});



// Doktorları Al
app.get('/doctors', isAuthenticated, async (req, res) => {
    const query = req.query.query || '';
    try {
        const [doctors] = await pool.query(`
            SELECT doctors.*, users.first_name, users.last_name, departments.name as department_name 
            FROM doctors 
            JOIN users ON doctors.user_id = users.id 
            LEFT JOIN departments ON doctors.department_id = departments.id
            WHERE users.first_name LIKE ? OR users.last_name LIKE ? OR departments.name LIKE ?
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);

        res.json(doctors);
    } catch (err) {
        console.error('Get Doctors Error:', err);
        res.status(500).json({ message: 'Doktorlar alınamadı.', error: err.message });
    }
});

// Doktorları Ara
app.get('/search/doctors', isAuthenticated, async (req, res) => {
    const query = req.query.query || '';
    try {
        const [doctors] = await pool.query(`
            SELECT doctors.*, users.first_name, users.last_name, departments.name as department_name 
            FROM doctors 
            JOIN users ON doctors.user_id = users.id 
            LEFT JOIN departments ON doctors.department_id = departments.id
            WHERE users.first_name LIKE ? OR users.last_name LIKE ? OR departments.name LIKE ?
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);

        res.json(doctors);
    } catch (err) {
        console.error('Search Doctors Error:', err);
        res.status(500).json({ message: 'Doktorlar aranamadı.', error: err.message });
    }
});

// Doktor Detaylarını Getirme
app.get('/doctors/:id', isAuthenticated, async (req, res) => {
    const doctorId = req.params.id;
    try {
        const [doctors] = await pool.query(`
            SELECT d.*, u.first_name, u.last_name, u.email, d.specialization, d.department_id
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
        `, [doctorId]);

        if (doctors.length === 0) {
            return res.status(404).json({ message: 'Doktor bulunamadı.' });
        }

        const doctor = doctors[0];

        // Departman adı ekleme
        const [departments] = await pool.query('SELECT name FROM departments WHERE id = ?', [doctor.department_id]);
        doctor.department_name = departments.length > 0 ? departments[0].name : null;

        res.json(doctor);
    } catch (error) {
        console.error('Get Doctor Details Error:', error);
        res.status(500).json({ message: 'Doktor detayları alınamadı.', error: error.message });
    }
});

// Randevu Durumunu Güncelleme
app.put('/appointments/:id/status', isAuthenticated, async (req, res) => {
    const appointmentId = req.params.id;
    const { status, google_meet_link } = req.body;

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Geçersiz durum.' });
    }

    try {
        // Kullanıcının doktor olup olmadığını kontrol et
        const userId = req.session.userId;
        const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        const isDoctor = doctorRows.length > 0;
        let doctorId = null;
        if (isDoctor) {
            doctorId = doctorRows[0].id;
        }

        // Randevuyu bul
        const [appointments] = await pool.query('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
        if (appointments.length === 0) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }
        const appointment = appointments[0];

        // Randevunun sahibi ile eşleşip eşleşmediğini kontrol et
        if (isDoctor && appointment.doctor_id !== doctorId) {
            return res.status(403).json({ message: 'Bu randevuyu güncelleme yetkiniz yok.' });
        }

        if (!isDoctor && appointment.patient_id !== userId) {
            return res.status(403).json({ message: 'Bu randevuyu güncelleme yetkiniz yok.' });
        }

        // Randevu güncelleme
        await pool.query('UPDATE appointments SET status = ?, google_meet_link = ? WHERE id = ?', [status, google_meet_link || null, appointmentId]);
        res.json({ message: 'Randevu durumu güncellendi.' });
    } catch (error) {
        console.error('Update Appointment Status Error:', error);
        res.status(500).json({ message: 'Randevu durumu güncellenemedi.', error: error.message });
    }
});


// Doktor için Uygun Randevu Saatlerini Al
app.get('/doctors/:id/available-slots', isAuthenticated, async (req, res) => {
    const doctorId = req.params.id;
    const date = req.query.date;
    const appointmentType = req.query.appointment_type;

    if (!date || !appointmentType) {
        return res.status(400).json({ message: 'Gerekli parametreler eksik.' });
    }

    try {
        let availableHours = [];
        if (appointmentType === 'Görüntülü Görüşme') {
            availableHours = ['13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00'];
        } else if (appointmentType === 'Muayene Randevusu') {
            availableHours = ['08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00'];
        } else {
            return res.status(400).json({ message: 'Geçersiz randevu tipi.' });
        }

        const [existingAppointments] = await pool.query(`
            SELECT appointment_time FROM appointments 
            WHERE doctor_id = ? AND appointment_date = ? AND status IN ('pending', 'confirmed')
        `, [doctorId, date]);

        const bookedTimes = existingAppointments.map(app => app.appointment_time);
        const availableSlots = availableHours.filter(time => !bookedTimes.includes(time));

        res.json({ availableSlots });
    } catch (err) {
        console.error('Get Available Slots Error:', err);
        res.status(500).json({ message: 'Uygun saatler alınamadı.', error: err.message });
    }
});

// Randevu Oluştur
app.post('/appointments', isAuthenticated, [
    body('doctor_id').isInt().withMessage('Doktor ID geçerli olmalıdır.'),
    body('appointment_type').isIn(['Görüntülü Görüşme', 'Muayene Randevusu']).withMessage('Geçerli bir randevu tipi seçmelisiniz.'),
    body('appointment_date').isISO8601().withMessage('Geçerli bir tarih formatı kullanın.'),
    body('appointment_time').matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/).withMessage('Geçerli bir saat formatı kullanın (HH:MM:SS).')
], async (req, res) => {
    const { doctor_id, appointment_type, appointment_date, appointment_time } = req.body;
    const patient_id = req.session.userId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Hatalı giriş.', errors: errors.array() });
    }

    const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
    const now = new Date();
    if (appointmentDateTime < now) {
        return res.status(400).json({ message: 'Geçmiş bir tarih seçemezsiniz.' });
    }

    try {
        const [doctors] = await pool.query('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
        if (doctors.length === 0) {
            return res.status(404).json({ message: 'Doktor bulunamadı.' });
        }

        let validTimes = [];
        if (appointment_type === 'Görüntülü Görüşme') {
            validTimes = ['13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00', '16:30:00'];
        } else if (appointment_type === 'Muayene Randevusu') {
            validTimes = ['08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', '11:30:00'];
        }

        if (!validTimes.includes(appointment_time)) {
            return res.status(400).json({ message: 'Seçilen saat, randevu tipine uygun değil.' });
        }

        const [activeAppointments] = await pool.query(
            'SELECT * FROM appointments WHERE patient_id = ? AND status IN (?, ?) AND appointment_date >= ?',
            [patient_id, 'pending', 'confirmed', new Date().toISOString().split('T')[0]]
        );

        const videoConsultations = activeAppointments.filter(app => app.appointment_type === 'Görüntülü Görüşme');
        const physicalAppointments = activeAppointments.filter(app => app.appointment_type === 'Muayene Randevusu');

        if (videoConsultations.length >= 1 && physicalAppointments.length >= 1) {
            return res.status(400).json({ message: 'Mevcut aktif randevularınız var. Önce mevcut randevularınızı iptal edin.' });
        }

        if (appointment_type === 'Görüntülü Görüşme' && videoConsultations.length >= 1) {
            return res.status(400).json({ message: 'Mevcut aktif bir görüntülü görüşme randevunuz var. Önce mevcut randevunuzu iptal edin.' });
        }

        if (appointment_type === 'Muayene Randevusu' && physicalAppointments.length >= 1) {
            return res.status(400).json({ message: 'Mevcut aktif bir muayene randevunuz var. Önce mevcut randevunuzu iptal edin.' });
        }

        const [existingAppointments] = await pool.query(
            'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != ?',
            [doctor_id, appointment_date, appointment_time, 'cancelled']
        );
        if (existingAppointments.length > 0) {
            return res.status(400).json({ message: 'Seçilen saat dolu.' });
        }

        const [userSameTypeAppointments] = await pool.query(
            'SELECT * FROM appointments WHERE patient_id = ? AND appointment_type = ? AND appointment_date = ? AND appointment_time = ? AND status != ?',
            [patient_id, appointment_type, appointment_date, appointment_time, 'cancelled']
        );
        if (userSameTypeAppointments.length > 0) {
            return res.status(400).json({ message: 'Aynı tarih ve saatte aynı türde başka bir randevunuz var.' });
        }

        const [result] = await pool.query(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status) VALUES (?, ?, ?, ?, ?, ?)',
            [patient_id, doctor_id, appointment_date, appointment_time, appointment_type, 'pending']
        );

        // Randevu başarıyla oluşturulduktan sonra e-posta gönderimi
        // Kullanıcının email adresini al
        const [users] = await pool.query('SELECT email, first_name, last_name FROM users WHERE id = ?', [patient_id]);
        if (users.length > 0) {
            const user = users[0];
            const [doctorRows] = await pool.query('SELECT u.first_name, u.last_name, d.specialization, dep.name AS department_name FROM doctors d JOIN users u ON d.user_id = u.id LEFT JOIN departments dep ON d.department_id = dep.id WHERE d.id = ?', [doctor_id]);
            if (doctorRows.length > 0) {
                const doctor = doctorRows[0];
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: 'Randevu Onayı',
                    html: `
                        <p>Merhaba ${user.first_name} ${user.last_name},</p>
                        <p>Randevunuz başarıyla oluşturuldu.</p>
                        <ul>
                            <li><strong>Departman:</strong> ${doctor.department_name || 'Belirtilmedi'}</li>
                            <li><strong>Doktor:</strong> Dr. ${doctor.first_name} ${doctor.last_name}</li>
                            <li><strong>Tarih:</strong> ${appointment_date.split('-').reverse().join('.')}</li>
                            <li><strong>Saat:</strong> ${appointment_time.slice(0, 5)}</li>
                            <li><strong>Randevu Tipi:</strong> ${appointment_type}</li>
                        </ul>
                        <p>Randevunuzun durumunu <a href="https://www.yourdomain.com/patient-dashboard.html">hasta panelinizden</a> kontrol edebilirsiniz.</p>
                        <p>İyi günler dileriz!</p>
                        <p>Sağlık Merkezi</p>
                    `
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Randevu onayı e-postası gönderilemedi:', error);
                    } else {
                        console.log('Randevu onayı e-postası gönderildi:', info.response);
                    }
                });
            }
        }

        res.status(201).json({ message: 'Randevu başarıyla oluşturuldu.', appointmentId: result.insertId });
    } catch (err) {
        console.error('Create Appointment Error:', err);
        res.status(500).json({ message: 'Randevu oluşturulamadı.', error: err.message });
    }
});

// **Randevu İptal Etme ve E-posta Gönderimi**
app.delete('/appointments/:appointmentId', isAuthenticated, async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.session.userId;

    try {
        // Randevuyu ve gerekli bilgileri bul
        const [appointments] = await pool.query(`
            SELECT a.*, u.email, u.first_name, u.last_name, 
                   d.first_name AS doctor_first_name, 
                   d.last_name AS doctor_last_name, 
                   dep.name AS department_name,
                   doc.specialization
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            JOIN doctors doc ON a.doctor_id = doc.id
            JOIN users d ON doc.user_id = d.id
            LEFT JOIN departments dep ON doc.department_id = dep.id
            WHERE a.id = ? AND a.patient_id = ?
        `, [appointmentId, userId]);

        if (appointments.length === 0) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }

        const appointment = appointments[0];

        // Randevunun iptal edilebilir olup olmadığını kontrol et (şu anki zamanla karşılaştırma)
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        const now = new Date();
        if (appointmentDateTime <= now) {
            return res.status(400).json({ message: 'Geçmiş randevuları iptal edemezsiniz.' });
        }

        // Randevuyu iptal et (status'u 'cancelled' olarak güncelle)
        await pool.query(`
            UPDATE appointments SET status = 'cancelled' WHERE id = ?
        `, [appointmentId]);

        // Kullanıcının e-posta adresi ve diğer bilgileri
        const userEmail = appointment.email;
        const userName = `${appointment.first_name} ${appointment.last_name}`;
        const doctorName = `Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}`;
        const specialization = appointment.specialization;
        const department = appointment.department_name || 'Belirtilmedi';
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('tr-TR');
        const formattedTime = appointment.appointment_time.slice(0,5); // HH:MM formatı

        // E-posta içeriği
        const mailOptions = {
            from: process.env.EMAIL_USER, // Gönderen e-posta adresi
            to: userEmail, // Alıcı e-posta adresi
            subject: 'Randevu İptali Bildirimi',
            html: `
                <p>Merhaba ${userName},</p>
                <p>Randevunuz başarıyla iptal edildi.</p>
                <ul>
                    <li><strong>Departman:</strong> ${department}</li>
                    <li><strong>Doktor:</strong> ${doctorName}</li>
                    <li><strong>Tarih:</strong> ${formattedDate}</li>
                    <li><strong>Saat:</strong> ${formattedTime}</li>
                    <li><strong>Randevu Tipi:</strong> ${appointment.appointment_type}</li>
                </ul>
                <p>Yeni bir randevu almak için <a href="http://localhost:3000/patient-dashboard.html">hasta panelinizi</a> ziyaret edebilirsiniz.</p>
                <p>İyi günler dileriz!</p>
                <p>Sağlık Merkezi</p>
            `
        };

        // E-postayı gönder
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('E-posta gönderim hatası:', error);
                // E-posta gönderimi başarısız olsa bile randevu iptal edildiğini bildirmek önemlidir
                return res.status(200).json({ message: 'Randevu başarıyla iptal edildi, ancak e-posta gönderilirken bir hata oluştu.' });
            } else {
                console.log('E-posta gönderildi:', info.response);
                return res.json({ message: 'Randevu başarıyla iptal edildi ve e-posta bildirimi gönderildi.' });
            }
        });

    } catch (error) {
        console.error('Randevu iptal etme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});


// Randevuları Getirme
app.get('/appointments', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { type, status, doctor_id } = req.query;

        let query = `
            SELECT a.*, 
                   u.first_name AS doctor_first_name, 
                   u.last_name AS doctor_last_name,
                   d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE a.patient_id = ?
        `;
        const params = [userId];

        if (type) {
            query += ' AND a.appointment_type = ?';
            params.push(type);
        }

        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        if (doctor_id) {
            query += ' AND a.doctor_id = ?';
            params.push(doctor_id);
        }

        const [appointments] = await pool.query(query, params);

        res.json(appointments);
    } catch (error) {
        console.error('Get Appointments Error:', error);
        res.status(500).json({ message: 'Randevular alınamadı.', error: error.message });
    }
});


// Admin Dashboard
app.get('/admin-dashboard.html', isAuthenticated, hasRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Doctor Dashboard
app.get('/doctor-dashboard.html', isAuthenticated, hasRole('doctor'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'doctor-dashboard.html'));
});

// Patient Dashboard
app.get('/patient-dashboard.html', isAuthenticated, hasRole('patient'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient-dashboard.html'));
});

// Admin Departmanları Al
app.get('/admin/departments', isAuthenticated, hasRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM departments');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Admin Doktorları Al
app.get('/admin/doctors', isAuthenticated, hasRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.id, d.user_id, d.specialization, d.department_id, d.image, u.first_name, u.last_name, dep.name AS department_name
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN departments dep ON d.department_id = dep.id
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Admin Kullanıcıları Al
app.get('/admin/users', isAuthenticated, hasRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, first_name, last_name, email, role, is_verified FROM users');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Departman CRUD
app.post('/admin/departments', isAuthenticated, hasRole('admin'), async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Departman adı gerekli' });
    try {
        const [result] = await pool.query('INSERT INTO departments (name) VALUES (?)', [name]);
        res.json({ message: 'Departman eklendi', departmentId: result.insertId });
    } catch (err) {
        console.error('Department create error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.put('/admin/departments/:id', isAuthenticated, hasRole('admin'), async (req, res) => {
    const departmentId = req.params.id;
    const { name } = req.body;
    try {
        await pool.query('UPDATE departments SET name = ? WHERE id = ?', [name, departmentId]);
        res.json({ message: 'Departman güncellendi' });
    } catch (err) {
        console.error('Department update error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.delete('/admin/departments/:id', isAuthenticated, hasRole('admin'), async (req, res) => {
    const departmentId = req.params.id;
    try {
        await pool.query('DELETE FROM departments WHERE id = ?', [departmentId]);
        res.json({ message: 'Departman silindi' });
    } catch (err) {
        console.error('Department delete error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kullanıcı CRUD (rol güncelleme, silme)
app.put('/admin/users/:id/role', isAuthenticated, hasRole('admin'), async (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;
    try {
        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
        res.json({ message: 'Kullanıcı rolü güncellendi' });
    } catch (err) {
        console.error('User role update error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.delete('/admin/users/:id', isAuthenticated, hasRole('admin'), async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ message: 'Kullanıcı silindi' });
    } catch (err) {
        console.error('User delete error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Doktor CRUD
app.post('/admin/doctors', isAuthenticated, hasRole('admin'), async (req, res) => {
    const { user_id, specialization, department_id } = req.body;
    if (!user_id || !specialization) return res.status(400).json({ message: 'Gerekli alanlar eksik' });
    try {
        await pool.query('INSERT INTO doctors (user_id, specialization, department_id) VALUES (?, ?, ?)',
            [user_id, specialization, department_id || null]);
        res.json({ message: 'Doktor eklendi' });
    } catch (err) {
        console.error('Doctor create error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.put('/admin/doctors/:id', isAuthenticated, hasRole('admin'), async (req, res) => {
    const doctorId = req.params.id;
    const { specialization, department_id } = req.body;
    try {
        await pool.query('UPDATE doctors SET specialization = ?, department_id = ? WHERE id = ?',
            [specialization, department_id || null, doctorId]);
        res.json({ message: 'Doktor güncellendi' });
    } catch (err) {
        console.error('Doctor update error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

app.delete('/admin/doctors/:id', isAuthenticated, hasRole('admin'), async (req, res) => {
    const doctorId = req.params.id;
    try {
        await pool.query('DELETE FROM doctors WHERE id = ?', [doctorId]);
        res.json({ message: 'Doktor silindi' });
    } catch (err) {
        console.error('Doctor delete error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Doktor resim yükleme
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/doctors');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now();
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const uploadImage = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Sadece JPEG, JPG ve PNG formatında dosyalar yüklenebilir.'));
    }
});

app.post('/admin/doctors/:id/image', isAuthenticated, hasRole('admin'), uploadImage.single('image'), async (req, res) => {
    const doctorId = req.params.id;
    if (!req.file) return res.status(400).json({ message: 'Resim yüklenmedi' });

    const imagePath = '/images/doctors/' + req.file.filename;
    try {
        await pool.query('UPDATE doctors SET image = ? WHERE id = ?', [imagePath, doctorId]);
        res.json({ message: 'Doktor resmi güncellendi', image: imagePath });
    } catch (err) {
        console.error('Doctor image update error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Doktor Endpointleri

// Randevuların Getirilmesi (Doktor için)
app.get('/doctor/appointments', isAuthenticated, hasRole('doctor'), async (req, res) => {
    try {
        const userId = req.session.userId; // Doğru kullanım
        // Doktorun doctor_id'sini al
        const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doktor bulunamadı.' });
        }
        const doctorId = doctorRows[0].id;

        const [appointments] = await pool.query(`
            SELECT a.id, a.appointment_type, a.appointment_date, a.appointment_time, a.status, a.google_meet_link,
                   u.first_name AS patient_first_name, u.last_name AS patient_last_name
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.doctor_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [doctorId]);
        res.json(appointments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// Doktor Profilini Güncelleme
app.put('/doctor/profile', isAuthenticated, hasRole('doctor'), async (req, res) => {
    try {
        const userId = req.session.userId; // Doğru kullanım
        const { first_name, last_name, email } = req.body;
        if (!first_name || !last_name || !email) {
            return res.status(400).json({ message: 'Tüm alanlar gereklidir.' });
        }

        // Email'in benzersizliğini kontrol et
        const [existingEmails] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (existingEmails.length > 0) {
            return res.status(400).json({ message: 'Bu email zaten kullanılıyor.' });
        }

        await pool.query('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?', [first_name, last_name, email, userId]);
        res.json({ message: 'Profil güncellendi.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});

// Doktor Randevu Durumunu Güncelleme
app.put('/doctor/appointments/:id/status', isAuthenticated, hasRole('doctor'), async (req, res) => {
    try {
        const userId = req.session.userId; // Kullanıcının ID'sini al
        const appointmentId = req.params.id;
        const { status, google_meet_link } = req.body;

        // Geçerli durumları tanımla
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Geçersiz durum.' });
        }

        // Doktorun doctor_id'sini al
        const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doktor bulunamadı.' });
        }
        const doctorId = doctorRows[0].id;

        // Randevunun doktoruna ait olup olmadığını kontrol et
        const [appointments] = await pool.query('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?', [appointmentId, doctorId]);
        if (appointments.length === 0) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }

        if (status === 'cancelled') {
            // Doktor tarafından iptal edilen randevuyu sil
            await pool.query('DELETE FROM appointments WHERE id = ?', [appointmentId]);
            return res.json({ message: 'Randevu başarıyla iptal edildi ve silindi.' });
        } else {
            // Diğer durumlar için randevuyu güncelle
            await pool.query('UPDATE appointments SET status = ?, google_meet_link = ? WHERE id = ?', [status, google_meet_link || null, appointmentId]);
            return res.json({ message: 'Randevu durumu güncellendi.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});


// Doktor Profilini Getirme
app.get('/doctor/profile', isAuthenticated, hasRole('doctor'), async (req, res) => {
    try {
        const userId = req.session.userId; // Doğru kullanım
        const [users] = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Sunucu Hatası' });
    }
});
// ---------------------- Randevu Sonuçlarını Ekleme ve Alma ----------------------

// server.js

// ... [Mevcut kodunuzun diğer bölümleri] ...

// Randevu Sonuçlarını Ekleme (Doktor Tarafı)
app.post('/doctor/appointments/:id/results', isAuthenticated, hasRole('doctor'), [
    body('diagnosis').notEmpty().withMessage('Teşhis gerekli.'),
    body('medication').notEmpty().withMessage('İlaç bilgisi gerekli.')
], async (req, res) => {
    const appointmentId = req.params.id;
    const { diagnosis, medication } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Hatalı giriş.', errors: errors.array() });
    }

    try {
        // Doktorun bu randevuyla ilişkili olup olmadığını kontrol et
        const userId = req.session.userId;
        const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doktor bulunamadı.' });
        }
        const doctorId = doctorRows[0].id;

        const [appointmentRows] = await pool.query('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?', [appointmentId, doctorId]);
        if (appointmentRows.length === 0) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }

        // Randevunun 'completed' durumda olup olmadığını kontrol et
        const appointment = appointmentRows[0];
        if (appointment.status !== 'completed') {
            return res.status(400).json({ message: 'Randevu tamamlanmamış.' });
        }

        // Randevu sonuçlarını ekle
        await pool.query(
            'INSERT INTO appointment_results (appointment_id, diagnosis, medication) VALUES (?, ?, ?)',
            [appointmentId, diagnosis, medication]
        );

        res.json({ message: 'Randevu sonuçları başarıyla eklendi.' });
    } catch (error) {
        console.error('Add Appointment Results Error:', error);
        res.status(500).json({ message: 'Randevu sonuçları eklenemedi.', error: error.message });
    }
});


// ... [Mevcut kodunuzun diğer bölümleri] ...


// Randevu Sonuçlarını Alma (Doktor Tarafı)
app.get('/doctor/appointments/:id/results', isAuthenticated, hasRole('doctor'), async (req, res) => {
    const appointmentId = req.params.id;

    try {
        // Doktorun bu randevuyla ilişkili olup olmadığını kontrol et
        const userId = req.session.userId;
        const [doctorRows] = await pool.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Doktor bulunamadı.' });
        }
        const doctorId = doctorRows[0].id;

        const [appointmentRows] = await pool.query('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?', [appointmentId, doctorId]);
        if (appointmentRows.length === 0) {
            return res.status(404).json({ message: 'Randevu bulunamadı.' });
        }

        // Randevu sonuçlarını al
        const [results] = await pool.query('SELECT * FROM appointment_results WHERE appointment_id = ?', [appointmentId]);

        res.json({ results });
    } catch (error) {
        console.error('Get Appointment Results Error:', error);
        res.status(500).json({ message: 'Randevu sonuçları alınamadı.', error: error.message });
    }
});
app.get('/patient/appointments/results', isAuthenticated, hasRolePatient, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Hastanın tüm randevularını ve sonuçlarını almak için JOIN sorgusu
        const [results] = await pool.query(`
            SELECT 
                a.id AS appointment_id, 
                d.name AS department_name,
                CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
                a.appointment_date, 
                a.appointment_time, 
                a.appointment_type, 
                ar.diagnosis, 
                ar.medication, 
                ar.created_at
            FROM appointments a
            JOIN doctors doc ON a.doctor_id = doc.id
            JOIN departments d ON doc.department_id = d.id
            JOIN users u ON doc.user_id = u.id
            LEFT JOIN appointment_results ar ON a.id = ar.appointment_id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [userId]);

        res.json({ results });
    } catch (error) {
        console.error('Get Patient Appointment Results Error:', error);
        res.status(500).json({ message: 'Randevu sonuçları alınamadı.', error: error.message });
    }
});




// ---------------------- Real-Time Data Validation Routes ----------------------

// Email Benzersizliğini Kontrol Etme (Herkes Erişebilir)
app.post('/check-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email gerekli.' });

    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        res.json({ isUnique: rows.length === 0 });
    } catch (err) {
        console.error('Check Email Error:', err);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcı Adı Benzersizliğini Kontrol Etme (Herkes Erişebilir)
app.post('/check-username', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Kullanıcı adı gerekli.' });

    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        res.json({ isUnique: rows.length === 0 });
    } catch (err) {
        console.error('Check Username Error:', err);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// TC Kimlik Benzersizliğini Kontrol Etme (Herkes Erişebilir)
// server.js
// TC Kimlik Benzersizliğini Kontrol Etme (Herkes Erişebilir)
app.post('/check-tc', async (req, res) => {
    console.log('--- /check-tc Endpoint Hit ---');
    console.log('Received /check-tc request:', req.body);
    const { tc_kimlik } = req.body;
    if (!tc_kimlik) {
        console.log('TC Kimlik Numarası Eksik!');
        return res.status(400).json({ message: 'TC Kimlik gerekli.' });
    }

    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE tc_kimlik = ?', [tc_kimlik]);
        console.log(`Found ${rows.length} user(s) with TC Kimlik Numarası: ${tc_kimlik}`);
        res.json({ isUnique: rows.length === 0 });
    } catch (err) {
        console.error('Check TC Kimlik Error:', err);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});
// Hasta Randevu Sonuçlarını Alma Endpoint'i
app.get('/patient/appointments/results', isAuthenticated, hasRolePatient, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Hastanın tüm randevularını ve sonuçlarını almak için JOIN sorgusu
        const [results] = await pool.query(`
            SELECT a.id AS appointment_id, a.appointment_date, a.appointment_time, a.appointment_type, ar.diagnosis, ar.medication, ar.created_at
            FROM appointments a
            LEFT JOIN appointment_results ar ON a.id = ar.appointment_id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [userId]);

        res.json({ results });
    } catch (error) {
        console.error('Get Patient Appointment Results Error:', error);
        res.status(500).json({ message: 'Randevu sonuçları alınamadı.', error: error.message });
    }
});





// ---------------------- 404 ve Genel Hata Yakalama ----------------------

// Belirlenmemiş rotalar için 404 hatası
app.use((req, res, next) => {
    res.status(404).json({ message: 'İstenen kaynak bulunamadı.' });
});

// Genel Hata Yakalama
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ---------------------- Sunucuyu Başlat ----------------------
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});