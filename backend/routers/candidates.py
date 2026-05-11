from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from database import get_supabase
from typing import List
import uuid

router = APIRouter(prefix="/candidates", tags=["Candidates"])

# ── POST /candidates/upload ─────────────────────────────
# Upload 1 CV, extract teks, scoring dengan Gemini, simpan ke DB
@router.post("/upload", response_model=dict)
async def upload_cv(
    session_id: str = Form(...),      
    name:       str = Form(...),      
    email:      str = Form(None),     
    cv_file: UploadFile = File(...)   
):
    db = get_supabase()

    # Validasi: hanya terima file PDF
    if not cv_file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Hanya file PDF yang diterima!"
        )

    # ── Validasi: session harus ada + ambil job description ──
    # PERUBAHAN: sekarang kita select "id, position, description" bukan hanya "id"
    session = db.table("recruitment_sessions") \
        .select("id, position, description") \
        .eq("id", session_id) \
        .single() \
        .execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    # ── Siapkan job description untuk Gemini ──
    # Gabungkan position title + description supaya konteks lebih lengkap
    session_position    = session.data.get("position", "") or ""
    session_description = session.data.get("description", "") or ""
    
    if session_position or session_description:
        job_description = f"Role: {session_position}\n\nJob Requirements:\n{session_description}"
    else:
        job_description = None  # tidak ada job description, pakai scoring umum

    print(f"[Candidates] Session position: {session_position}")
    print(f"[Candidates] Job description available: {bool(job_description)}")

    try:
        # ── LANGKAH 1: Upload PDF ke Supabase Storage ──
        file_bytes = await cv_file.read()
        file_name  = f"{session_id}/{uuid.uuid4()}_{cv_file.filename}"

        storage_response = db.storage \
            .from_("cv-files") \
            .upload(file_name, file_bytes, {"content-type": "application/pdf"})

        # Ambil URL publik file
        cv_url = db.storage \
            .from_("cv-files") \
            .get_public_url(file_name)

        # ── LANGKAH 2: Ekstrak teks dari PDF ──
        from services.pdf_extractor import extract_text_from_bytes
        cv_text = extract_text_from_bytes(file_bytes)

        if not cv_text or len(cv_text.strip()) < 50:
            raise HTTPException(
                status_code=422,
                detail="Gagal membaca teks dari CV. Pastikan PDF bukan hasil scan."
            )

        # ── LANGKAH 3: Simpan kandidat ke database ──
        candidate_result = db.table("candidates").insert({
            "session_id":  session_id,
            "name":        name,
            "email":       email,
            "cv_file_url": cv_url,
            "cv_text":     cv_text,
            "status":      "pending"
        }).execute()

        candidate = candidate_result.data[0]
        candidate_id = candidate["id"]

        # ── LANGKAH 4: Scoring dengan Gemini AI ──
        # PERUBAHAN: sekarang kirim juga job_description ke Gemini!
        from services.gemini_service import score_cv_with_gemini
        scores = score_cv_with_gemini(cv_text, job_description=job_description)

        # ── LANGKAH 5: Simpan skor ke database ──
        db.table("candidate_scores").insert({
            "candidate_id":     candidate_id,
            "education_score":  scores["education_score"],
            "experience_score": scores["experience_score"],
            "skill_score":      scores["skill_score"]
        }).execute()

        # Update status kandidat jadi 'scored'
        db.table("candidates") \
            .update({"status": "scored"}) \
            .eq("id", candidate_id) \
            .execute()

        return {
            "success": True,
            "message": f"CV {name} berhasil diproses dan diskor!",
            "data": {
                "candidate_id":   candidate_id,
                "name":           name,
                "cv_url":         cv_url,
                "scores":         scores,
                "scored_for_role": session_position  # info role untuk transparansi
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        # Jika error, update status kandidat jadi 'error'
        try:
            db.table("candidates") \
                .update({"status": "error"}) \
                .eq("id", candidate_id) \
                .execute()
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /candidates/{session_id} ────────────────────────
# Ambil semua kandidat di session beserta skornya
@router.get("/{session_id}", response_model=dict)
def get_candidates_by_session(session_id: str):
    db = get_supabase()

    try:
        # Join candidates dengan candidate_scores
        result = db.table("candidates") \
            .select("*, candidate_scores(*)") \
            .eq("session_id", session_id) \
            .order("uploaded_at", desc=False) \
            .execute()

        return {
            "success": True,
            "session_id": session_id,
            "total": len(result.data),
            "data": result.data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
