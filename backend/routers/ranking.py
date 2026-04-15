from fastapi import APIRouter, HTTPException
from database import get_supabase

router = APIRouter(prefix="/ranking", tags=["Ranking"])

# ── POST /ranking/calculate/{session_id} ───────────────
# Jalankan algoritma SAW untuk session ini
@router.post("/calculate/{session_id}", response_model=dict)
def calculate_ranking(session_id: str):
    db = get_supabase()

    # Validasi session ada
    session = db.table("recruitment_sessions") \
        .select("id, title") \
        .eq("id", session_id) \
        .single() \
        .execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    # Ambil semua kandidat yang sudah diskor di session ini
    result = db.table("candidates") \
        .select("id, name, email, candidate_scores(*)") \
        .eq("session_id", session_id) \
        .eq("status", "scored") \
        .execute()

    candidates = result.data

    if len(candidates) < 2:
        raise HTTPException(
            status_code=400,
            detail="Minimal 2 kandidat yang sudah diskor untuk menghitung ranking"
        )

    # Panggil SAW Engine (akan kita bangun di Phase 6)
    from services.saw_engine import calculate_saw
    rankings = calculate_saw(candidates)

    # Hapus ranking lama untuk session ini (kalau ada)
    db.table("candidate_rankings") \
        .delete() \
        .eq("session_id", session_id) \
        .execute()

    # Simpan ranking baru ke database
    rows_to_insert = []
    for r in rankings:
        rows_to_insert.append({
            "candidate_id":    r["candidate_id"],
            "session_id":      session_id,
            "norm_education":  r["norm_education"],
            "norm_experience": r["norm_experience"],
            "norm_skill":      r["norm_skill"],
            "preference_score": r["preference_score"],
            "rank_position":   r["rank_position"]
        })

    db.table("candidate_rankings").insert(rows_to_insert).execute()

    return {
        "success": True,
        "message": f"Ranking untuk session '{session.data['title']}' berhasil dihitung!",
        "total_ranked": len(rankings),
        "data": rankings
    }


# ── GET /ranking/{session_id} ───────────────────────────
# Ambil hasil ranking yang sudah tersimpan
@router.get("/{session_id}", response_model=dict)
def get_ranking(session_id: str):
    db = get_supabase()

    try:
        result = db.table("candidate_rankings") \
            .select("""
                rank_position,
                preference_score,
                norm_education,
                norm_experience,
                norm_skill,
                candidate_id,
                candidates(name, email, candidate_scores(*))
            """) \
            .eq("session_id", session_id) \
            .order("rank_position", desc=False) \
            .execute()

        if not result.data:
            return {
                "success": True,
                "message": "Ranking belum dihitung untuk session ini",
                "data": []
            }

        return {
            "success": True,
            "session_id": session_id,
            "total": len(result.data),
            "data": result.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))