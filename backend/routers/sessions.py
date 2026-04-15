from fastapi import APIRouter, HTTPException
from database import get_supabase
from models.session import SessionCreate, SessionResponse
from typing import List

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# ── POST /sessions ──────────────────────────────────────
# Membuat recruitment session baru
@router.post("", response_model=dict)
def create_session(payload: SessionCreate):
    db = get_supabase()

    try:
        result = db.table("recruitment_sessions").insert({
            "title":       payload.title,
            "position":    payload.position,
            "description": payload.description,
            "status":      "active"
        }).execute()

        return {
            "success": True,
            "message": f"Session '{payload.title}' berhasil dibuat!",
            "data": result.data[0]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /sessions ───────────────────────────────────────
# Mengambil semua session (terbaru duluan)
@router.get("", response_model=dict)
def get_all_sessions():
    db = get_supabase()

    try:
        result = db.table("recruitment_sessions") \
            .select("*") \
            .order("created_at", desc=True) \
            .execute()

        return {
            "success": True,
            "total": len(result.data),
            "data": result.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /sessions/{session_id} ──────────────────────────
# Detail 1 session beserta jumlah kandidat di dalamnya
@router.get("/{session_id}", response_model=dict)
def get_session_detail(session_id: str):
    db = get_supabase()

    try:
        # Ambil data session
        session = db.table("recruitment_sessions") \
            .select("*") \
            .eq("id", session_id) \
            .single() \
            .execute()

        if not session.data:
            raise HTTPException(status_code=404, detail="Session tidak ditemukan")

        # Hitung jumlah kandidat di session ini
        candidates = db.table("candidates") \
            .select("id", count="exact") \
            .eq("session_id", session_id) \
            .execute()

        return {
            "success": True,
            "data": {
                **session.data,
                "total_candidates": candidates.count or 0
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))