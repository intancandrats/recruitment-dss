from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from database import get_supabase
from services.ahp_engine import calculate_ahp

router = APIRouter(prefix="/ahp", tags=["AHP"])


class AHPInput(BaseModel):
    session_id:   str
    edu_vs_exp:   float = Field(..., ge=1/9, le=9,
                    description="Education vs Experience (skala Saaty)")
    edu_vs_skill: float = Field(..., ge=1/9, le=9,
                    description="Education vs Skill (skala Saaty)")
    exp_vs_skill: float = Field(..., ge=1/9, le=9,
                    description="Experience vs Skill (skala Saaty)")


# ── POST /ahp/calculate ─────────────────────────────────
# Hitung AHP dan simpan hasilnya
@router.post("/calculate", response_model=dict)
def calculate_and_save_ahp(payload: AHPInput):
    db = get_supabase()

    # Validasi session ada
    session = db.table("recruitment_sessions") \
        .select("id, title") \
        .eq("id", payload.session_id) \
        .single() \
        .execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    # Hitung AHP
    result = calculate_ahp(
        edu_vs_exp=payload.edu_vs_exp,
        edu_vs_skill=payload.edu_vs_skill,
        exp_vs_skill=payload.exp_vs_skill
    )

    # Hapus AHP lama untuk session ini (kalau ada)
    db.table("ahp_weights") \
        .delete() \
        .eq("session_id", payload.session_id) \
        .execute()

    # Simpan hasil AHP ke database
    db.table("ahp_weights").insert({
        "session_id":         payload.session_id,
        "edu_vs_exp":         payload.edu_vs_exp,
        "edu_vs_skill":       payload.edu_vs_skill,
        "exp_vs_skill":       payload.exp_vs_skill,
        "weight_education":   result["weight_education"],
        "weight_experience":  result["weight_experience"],
        "weight_skill":       result["weight_skill"],
        "consistency_ratio":  result["consistency_ratio"],
        "is_consistent":      result["is_consistent"]
    }).execute()

    return {
        "success": True,
        "session_id": payload.session_id,
        "weights": {
            "education":  result["weight_education"],
            "experience": result["weight_experience"],
            "skill":      result["weight_skill"]
        },
        "consistency_ratio": result["consistency_ratio"],
        "is_consistent":     result["is_consistent"],
        "warning": None if result["is_consistent"] else
                   "CR ≥ 0.1 — Jawaban tidak konsisten, pertimbangkan untuk mengisi ulang."
    }


# ── GET /ahp/{session_id} ────────────────────────────────
# Ambil hasil AHP tersimpan untuk session ini
@router.get("/{session_id}", response_model=dict)
def get_ahp_weights(session_id: str):
    db = get_supabase()

    result = db.table("ahp_weights") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if not result.data:
        return {
            "success": False,
            "message": "AHP belum dihitung untuk session ini",
            "data": None
        }

    return {
        "success": True,
        "data": result.data[0]
    }