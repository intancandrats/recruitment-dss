# Admin Authentication System

## Frontend - Register & Login

### Features
1. **Register (Daftar)**: Admin baru bisa mendaftar dengan:
   - Nama lengkap
   - Email
   - Password (minimal 8 karakter)

2. **Login (Masuk)**: Admin bisa login dengan:
   - Email
   - Password

3. **Tab Switching**: Mudah beralih antara form register dan login
4. **Password Toggle**: Bisa show/hide password dengan icon mata
5. **Session Management**: Session tersimpan di browser (sessionStorage)

### How It Works
- Saat pertama kali membuka aplikasi, user lihat halaman login
- Bisa pilih tab "Daftar" untuk register atau tetap di tab "Masuk" untuk login
- Input form dikirim ke backend API (`/auth/register` atau `/auth/login`)
- Jika berhasil, token JWT disimpan dan user langsung masuk ke dashboard
- Session tersimpan di sessionStorage, jadi user tetap login meski refresh page

---

## Backend - API Endpoints

### 1. POST /auth/register
**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid-here",
  "name": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- 400: Email sudah terdaftar atau password < 8 karakter
- 500: Server error

---

### 2. POST /auth/login
**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid-here",
  "name": "John Doe",
  "email": "john@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- 401: Email atau password salah
- 500: Server error

---

### 3. GET /auth/me (Optional)
Get info admin yang sedang login (gunakan token JWT di header)

---

## Database Schema

### admin_users Table
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `name`: Nama lengkap admin
- `email`: Email unik
- `password_hash`: Hash password menggunakan bcrypt
- `created_at`: Waktu pembuatan akun
- `updated_at`: Waktu update terakhir

---

## Technical Details

### Password Security
- Password di-hash menggunakan **bcrypt** sebelum disimpan di database
- Password tidak pernah disimpan plain text
- Saat login, password di-verify dengan hash yang tersimpan

### Token (JWT)
- Token dihasilkan saat login/register berhasil
- Token berisi: `admin_id`, `email`, `exp` (waktu kadaluarsa)
- Token di-set expire dalam **24 jam**
- Frontend menyimpan token di sessionStorage

### Frontend State
- `currentAdmin`: Objek berisi id, name, email, token
- `sessionStorage["adminSession"]`: JSON string dari currentAdmin (untuk persist)

---

## Flow Diagram

### Register Flow
```
User Input (name, email, password)
  ↓
Form Submit → POST /auth/register
  ↓
Backend Hash Password → Save to DB
  ↓
Generate JWT Token → Return response
  ↓
Frontend Save Session → Show Dashboard
```

### Login Flow
```
User Input (email, password)
  ↓
Form Submit → POST /auth/login
  ↓
Backend Find User → Verify Password
  ↓
Generate JWT Token → Return response
  ↓
Frontend Save Session → Show Dashboard
```

---

## Files Created/Modified

### Backend
- `backend/models/admin.py` - Pydantic schemas
- `backend/services/auth_service.py` - Password hashing, JWT, DB operations
- `backend/routers/auth.py` - API endpoints
- `backend/supabase/migrations/20260506040000_create_admin_users.sql` - Database migration
- `backend/main.py` - Register auth router
- `backend/requirements.txt` - Add bcrypt, pyjwt, email-validator

### Frontend
- `frontend/index.html` - Add register form & auth tabs
- `frontend/app.js` - Add submitRegister, submitLogin, switchAuthTab, togglePassword
- `frontend/style.css` - Add auth-tabs styling, login-logo-img

---

## Next Steps (Optional Enhancements)

1. **Email Verification**: Kirim email verification link saat register
2. **Password Reset**: Buat endpoint untuk reset password
3. **Logout Endpoint**: Backend endpoint untuk invalidate token
4. **Admin Profiles**: Tambah fitur edit profil admin
5. **Role Management**: Jika ada multiple admin levels
6. **2FA (Two-Factor Authentication)**: Untuk security lebih tinggi

---

## Testing

### Test Register
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin Test","email":"admin@test.com","password":"password123"}'
```

### Test Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'
```

---

## Important Notes

1. **SECRET_KEY**: Di `auth_service.py` harus di-update ke environment variable di production
2. **CORS**: Frontend di port 3000+, Backend di port 8000 - CORS sudah enabled
3. **Database Migration**: Jalankan migration di Supabase untuk create admin_users table
4. **Email Validation**: Menggunakan `pydantic.EmailStr` untuk validate email format

## ⚠️ Gemini AI Scoring Issue

**Problem**: Google Gemini API sedang bermasalah - semua model return 404 error.

**Current Solution**: Menggunakan **mock scorer** yang menganalisis konten CV berdasarkan:
- **Education**: Keywords seperti "bachelor", "master", "university", "gpa"
- **Experience**: Keywords seperti "experience", "worked", "senior", "years"
- **Skills**: Technical skills seperti "python", "javascript", "react", "aws", dll.

**Mock Scorer Features**:
- Memberikan skor bervariasi (bukan fixed values)
- Menganalisis panjang teks dan keyword matching
- Menambahkan randomness untuk menghindari skor identik
- Skor berkisar 0-100 sesuai konten CV

**To Fix Gemini API**:
1. Update `google-generativeai` library ke versi terbaru
2. Pastikan GEMINI_API_KEY valid dan memiliki quota
3. Atau switch ke AI service lain (OpenAI, Claude, etc.)
4. Set `USE_MOCK_SCORER = False` di `gemini_service.py` untuk enable real AI

**Testing**: Jalankan `python test_gemini.py` untuk test scoring dengan CV berbeda.
