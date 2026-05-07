import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional
from config import SUPABASE_URL, SUPABASE_KEY
from database import get_supabase

# ────────────────────────────────────────────
# AUTH SERVICE untuk Admin Users
# ────────────────────────────────────────────

SECRET_KEY = "your-secret-key-change-this-in-production"  # Ganti dengan env variable
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

def hash_password(password: str) -> str:
    """Hash password menggunakan bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password dengan hash"""
    return bcrypt.checkpw(password.encode(), password_hash.encode())

def create_access_token(admin_id: str, email: str) -> str:
    """Buat JWT token untuk admin"""
    payload = {
        "sub": admin_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def verify_token(token: str) -> Optional[dict]:
    """Verifikasi JWT token dan return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# ────────────────────────────────────────────
# DATABASE OPERATIONS
# ────────────────────────────────────────────

def register_admin(name: str, email: str, password: str) -> dict:
    """Register admin user baru"""
    db = get_supabase()
    
    # Cek apakah email sudah terdaftar
    result = db.table("admin_users") \
        .select("id") \
        .eq("email", email) \
        .execute()
    
    if result.data and len(result.data) > 0:
        raise ValueError("Email sudah terdaftar")
    
    # Hash password
    password_hash = hash_password(password)
    
    # Insert ke database
    response = db.table("admin_users").insert({
        "name": name,
        "email": email,
        "password_hash": password_hash
    }).execute()
    
    if not response.data or len(response.data) == 0:
        raise ValueError("Gagal menyimpan admin user")
    
    admin = response.data[0]
    
    # Buat token
    token = create_access_token(admin["id"], admin["email"])
    
    return {
        "id": admin["id"],
        "name": admin["name"],
        "email": admin["email"],
        "token": token
    }

def login_admin(email: str, password: str) -> dict:
    """Login admin user"""
    db = get_supabase()
    
    # Cari admin by email
    result = db.table("admin_users") \
        .select("id, name, email, password_hash") \
        .eq("email", email) \
        .execute()
    
    if not result.data or len(result.data) == 0:
        raise ValueError("Email atau password salah")
    
    admin = result.data[0]
    
    # Verifikasi password
    if not verify_password(password, admin["password_hash"]):
        raise ValueError("Email atau password salah")
    
    # Buat token
    token = create_access_token(admin["id"], admin["email"])
    
    return {
        "id": admin["id"],
        "name": admin["name"],
        "email": admin["email"],
        "token": token
    }

def get_admin_by_id(admin_id: str) -> Optional[dict]:
    """Get admin user by ID"""
    db = get_supabase()
    
    result = db.table("admin_users") \
        .select("id, name, email, created_at") \
        .eq("id", admin_id) \
        .execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]
    
    return None
