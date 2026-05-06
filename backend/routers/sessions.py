from fastapi import APIRouter, HTTPException
from database import get_supabase
from models.session import SessionCreate, SessionResponse
from typing import List

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# ── POST /sessions ──────────────────────────────────────
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


# ══════════════════════════════════════════════════════
# PENTING: /stats/summary HARUS di atas /{session_id}
# Kalau di bawah, FastAPI salah baca jadi /{session_id}
# ══════════════════════════════════════════════════════

# ── GET /sessions/stats/summary ─────────────────────────
@router.get("/stats/summary", response_model=dict)
def get_dashboard_stats():
    db = get_supabase()
    try:
        sessions_result = db.table("recruitment_sessions").select("*").execute()
        all_sessions = sessions_result.data or []

        active_sessions = [s for s in all_sessions if s.get("status") == "active"]
        closed_sessions = [s for s in all_sessions if s.get("status") == "closed"]

        candidates_result = db.table("candidates").select("id, status").execute()
        all_candidates = candidates_result.data or []
        scored_candidates = [c for c in all_candidates if c.get("status") == "scored"]

        return {
            "success": True,
            "data": {
                "total_sessions":      len(all_sessions),
                "active_sessions":     len(active_sessions),
                "closed_sessions":     len(closed_sessions),
                "total_candidates":    len(all_candidates),
                "scored_candidates":   len(scored_candidates),
                "active_session_list": active_sessions  # semua session aktif, bukan slice
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /sessions/{session_id} ──────────────────────────
# Harus di BAWAH /stats/summary
@router.get("/{session_id}", response_model=dict)
def get_session_detail(session_id: str):
    db = get_supabase()
    try:
        session = db.table("recruitment_sessions") \
            .select("*") \
            .eq("id", session_id) \
            .single() \
            .execute()

        if not session.data:
            raise HTTPException(status_code=404, detail="Session tidak ditemukan")

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


# ── PATCH /sessions/{session_id}/status ─────────────────
@router.patch("/{session_id}/status", response_model=dict)
def toggle_session_status(session_id: str):
    db = get_supabase()
    try:
        session = db.table("recruitment_sessions") \
            .select("id, status") \
            .eq("id", session_id) \
            .single() \
            .execute()

        if not session.data:
            raise HTTPException(status_code=404, detail="Session tidak ditemukan")

        new_status = "closed" if session.data["status"] == "active" else "active"

        db.table("recruitment_sessions") \
            .update({"status": new_status}) \
            .eq("id", session_id) \
            .execute()

        return {
            "success": True,
            "message": f"Status session berhasil diubah ke {new_status}",
            "new_status": new_status
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))