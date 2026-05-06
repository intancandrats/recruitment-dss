from config import SAW_WEIGHTS

def calculate_saw(candidates: list, weights: dict = None) -> list:
    """
    weights: dict opsional, misal {"education": 0.25, "experience": 0.50, "skill": 0.25}
    Jika tidak diisi, pakai bobot default dari config.
    """

    # Pakai bobot AHP jika ada, fallback ke config
    w = weights if weights else SAW_WEIGHTS

    # ... sisa kode sama persis seperti sebelumnya, 
    # tapi ganti baris ini:
    #   w = settings.SAW_WEIGHTS
    # menjadi sudah pakai variabel w di atas

    # ── VALIDASI INPUT ─────────────────────────────────
    if not candidates or len(candidates) < 2:
        raise ValueError("Minimal 2 kandidat dibutuhkan untuk menghitung ranking SAW")

    # ── LANGKAH 1: BENTUK MATRIKS KEPUTUSAN ───────────
    # Ekstrak skor dari struktur nested Supabase
    matrix = []

    for candidate in candidates:
        scores = candidate.get("candidate_scores", [])

        # candidate_scores adalah list (hasil join Supabase)
        # ambil elemen pertama
        if not scores or len(scores) == 0:
            print(f"[SAW] Warning: kandidat {candidate.get('name')} tidak punya skor, skip.")
            continue

        score_data = scores[0]

        matrix.append({
            "candidate_id":     candidate["id"],
            "name":             candidate.get("name", "Unknown"),
            "email":            candidate.get("email", ""),
            "education_score":  score_data.get("education_score", 50),
            "experience_score": score_data.get("experience_score", 50),
            "skill_score":      score_data.get("skill_score", 40),
        })

    if len(matrix) < 2:
        raise ValueError("Tidak cukup kandidat dengan skor valid untuk ranking")

    print(f"[SAW] Matriks keputusan ({len(matrix)} kandidat):")
    for row in matrix:
        print(f"  {row['name']}: edu={row['education_score']}, "
              f"exp={row['experience_score']}, skill={row['skill_score']}")

    # ── LANGKAH 2: NORMALISASI MATRIKS ────────────────
    # Semua kriteria adalah BENEFIT → r_ij = x_ij / max(x_j)
    max_education  = max(row["education_score"]  for row in matrix)
    max_experience = max(row["experience_score"] for row in matrix)
    max_skill      = max(row["skill_score"]      for row in matrix)

    print(f"[SAW] Nilai maksimum: edu={max_education}, "
          f"exp={max_experience}, skill={max_skill}")

    # Hindari pembagian dengan nol (edge case)
    max_education  = max_education  if max_education  > 0 else 1
    max_experience = max_experience if max_experience > 0 else 1
    max_skill      = max_skill      if max_skill      > 0 else 1

    for row in matrix:
        row["norm_education"]  = round(row["education_score"]  / max_education,  6)
        row["norm_experience"] = round(row["experience_score"] / max_experience, 6)
        row["norm_skill"]      = round(row["skill_score"]      / max_skill,      6)

    # ── LANGKAH 3 & 4: KALIKAN BOBOT + HITUNG PREFERENSI
    # V_i = w_edu * r_edu + w_exp * r_exp + w_skill * r_skill

    for row in matrix:
        preference = (
            w["education"]  * row["norm_education"]  +
            w["experience"] * row["norm_experience"] +
            w["skill"]      * row["norm_skill"]
        )
        row["preference_score"] = round(preference, 6)

    # ── LANGKAH 5: RANKING ────────────────────────────
    # Urutkan dari preference_score terbesar ke terkecil
    matrix.sort(key=lambda x: x["preference_score"], reverse=True)

    # Tambahkan nomor ranking
    for i, row in enumerate(matrix, start=1):
        row["rank_position"] = i

    print(f"[SAW] Hasil ranking:")
    for row in matrix:
        print(f"  #{row['rank_position']} {row['name']} "
              f"→ preference={row['preference_score']}")

    return matrix