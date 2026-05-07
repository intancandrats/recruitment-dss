from fastapi import APIRouter, HTTPException
from models.admin import AdminRegister, AdminLogin, AdminResponse, AdminSession
from services.auth_service import register_admin, login_admin, get_admin_by_id

router = APIRouter(prefix="/auth", tags=["Auth"])

# ──────────────────────────────────────────────────────
# POST /auth/register
# ──────────────────────────────────────────────────────
@router.post("/register", response_model=AdminSession)
def register(payload: AdminRegister):
    """Register admin user baru"""
    try:
        result = register_admin(
            name=payload.name,
            email=payload.email,
            password=payload.password
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ──────────────────────────────────────────────────────
# POST /auth/login
# ──────────────────────────────────────────────────────
@router.post("/login", response_model=AdminSession)
def login(payload: AdminLogin):
    """Login admin user"""
    try:
        result = login_admin(
            email=payload.email,
            password=payload.password
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ──────────────────────────────────────────────────────
# GET /auth/me
# ──────────────────────────────────────────────────────
@router.get("/me", response_model=AdminResponse)
def get_current_admin(token: str = None):
    """Get current logged in admin (gunakan header Authorization: Bearer <token>)"""
    # Untuk sekarang, endpoint ini bersifat informasional
    # Implementasi full bisa menambahkan dependency injection untuk token verification
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    
    from services.auth_service import verify_token
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    admin_id = payload.get("sub")
    admin = get_admin_by_id(admin_id)
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    return admin
