from fastapi import APIRouter, HTTPException
from database import get_supabase
from typing import List

router = APIRouter(prefix="/ranking", tags=["Ranking"])

# ── POST /ranking/calculate/{session_id} ───────────────
# Menghitung ranking menggunakan metode SAW dengan bobot dari AHP atau Default
@router.post("/calculate/{session_id}", response_model=dict)
def calculate_ranking(session_id: str):
    db = get_supabase()

    # 1. Validasi bahwa session rekrutmen ada
    session_res = db.table("recruitment_sessions") \
        .select("id, title") \
        .eq("id", session_id) \
        .single() \
        .execute()

    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    # 2. Ambil semua kandidat yang sudah memiliki skor di session ini
    # Ini mendefinisikan variabel 'candidates' yang tadi error
    result = db.table("candidates") \
        .select("id, name, email, candidate_scores(*)") \
        .eq("session_id", session_id) \
        .eq("status", "scored") \
        .execute()

    candidates = result.data

    # Validasi jumlah kandidat
    if not candidates or len(candidates) < 2:
        raise HTTPException(
            status_code=400, 
            detail="Minimal 2 kandidat yang sudah diskor untuk menghitung ranking"
        )

    # 3. Tentukan Bobot: Cek apakah ada hasil perhitungan AHP untuk session ini
    ahp_result = db.table("ahp_weights") \
        .select("weight_education, weight_experience, weight_skill") \
        .eq("session_id", session_id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if ahp_result.data:
        # Jika ada, gunakan bobot dari tabel AHP
        ahp = ahp_result.data[0]
        weights = {
            "education":  ahp["weight_education"],
            "experience": ahp["weight_experience"],
            "skill":      ahp["weight_skill"]
        }
        weight_source = "AHP"
    else:
        # Jika tidak ada, gunakan bobot default dari config
        from config import SAW_WEIGHTS
        weights = SAW_WEIGHTS
        weight_source = "default"

    # 4. Jalankan Algoritma SAW
    # Mengimpor di dalam fungsi untuk menghindari circular import jika ada
    from services.saw_engine import calculate_saw
    
    try:
        # Memasukkan data candidates dan weights ke engine
        rankings = calculate_saw(candidates, weights=weights)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghitung SAW: {str(e)}")

    # 5. Sinkronisasi ke Database (Hapus lama, Simpan baru)
    db.table("candidate_rankings").delete().eq("session_id", session_id).execute()

    rows_to_insert = []
    for r in rankings:
        rows_to_insert.append({
            "candidate_id":     r["candidate_id"],
            "session_id":       session_id,
            "norm_education":   r["norm_education"],
            "norm_experience":  r["norm_experience"],
            "norm_skill":       r["norm_skill"],
            "preference_score": r["preference_score"],
            "rank_position":    r["rank_position"]
        })

    if rows_to_insert:
        db.table("candidate_rankings").insert(rows_to_insert).execute()

    return {
        "success": True,
        "message": f"Ranking untuk session '{session_res.data['title']}' berhasil dihitung!",
        "weight_source": weight_source,
        "weights_used": weights,
        "total_ranked": len(rankings),
        "data": rankings
    }


# ── GET /ranking/{session_id} ───────────────────────────
# Mengambil hasil ranking yang sudah tersimpan di database
@router.get("/{session_id}", response_model=dict)
def get_ranking(session_id: str):
    db = get_supabase()

    try:
        # Query dengan join ke tabel candidates dan scores
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