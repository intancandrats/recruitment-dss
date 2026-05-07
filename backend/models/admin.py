from pydantic import BaseModel, EmailStr
from typing import Optional

# ────────────────────────────────────────────
# SCHEMA untuk Admin User
# ────────────────────────────────────────────

class AdminRegister(BaseModel):
    """Schema untuk registrasi admin"""
    name: str
    email: EmailStr
    password: str

class AdminLogin(BaseModel):
    """Schema untuk login admin"""
    email: EmailStr
    password: str

class AdminResponse(BaseModel):
    """Schema response untuk admin (tanpa password)"""
    id: str
    name: str
    email: str
    created_at: str

class AdminSession(BaseModel):
    """Schema untuk session admin yang disimpan di frontend"""
    id: str
    name: str
    email: str
    token: str  # JWT token
