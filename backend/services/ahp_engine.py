"""
AHP Engine — Analytical Hierarchy Process
Menghitung bobot kriteria dari matriks perbandingan berpasangan.

Untuk 3 kriteria: Education (C1), Experience (C2), Skill (C3)
"""

# Nilai Random Index untuk n=3 kriteria (nilai standar Saaty)
RI = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12}


def calculate_ahp(edu_vs_exp: float, edu_vs_skill: float, exp_vs_skill: float) -> dict:
    """
    Hitung bobot AHP dari 3 nilai perbandingan berpasangan.

    Parameter (skala Saaty 1-9):
        edu_vs_exp   : seberapa penting Education dibanding Experience
        edu_vs_skill : seberapa penting Education dibanding Skill
        exp_vs_skill : seberapa penting Experience dibanding Skill

    Return:
        dict berisi bobot dan hasil uji konsistensi
    """

    # ── LANGKAH 1: Bentuk Matriks Perbandingan ──────────
    #
    # Format matriks 3x3:
    #         Edu          Exp              Skill
    # Edu  [  1         edu_vs_exp      edu_vs_skill  ]
    # Exp  [1/edu_vs_exp   1            exp_vs_skill  ]
    # Skill[1/edu_vs_skill 1/exp_vs_skill     1       ]
    #
    # Nilai diagonal selalu 1 (kriteria dibanding dirinya sendiri)
    # Nilai bawah diagonal = kebalikan (1/nilai)

    matrix = [
        [1,                 edu_vs_exp,         edu_vs_skill],
        [1 / edu_vs_exp,    1,                  exp_vs_skill],
        [1 / edu_vs_skill,  1 / exp_vs_skill,   1           ]
    ]

    n = 3  # jumlah kriteria

    # ── LANGKAH 2: Jumlahkan tiap KOLOM ─────────────────
    col_sums = []
    for col in range(n):
        total = sum(matrix[row][col] for row in range(n))
        col_sums.append(total)

    # ── LANGKAH 3: Normalisasi matriks ──────────────────
    # Bagi setiap elemen dengan jumlah kolomnya
    normalized = []
    for row in range(n):
        norm_row = []
        for col in range(n):
            norm_row.append(matrix[row][col] / col_sums[col])
        normalized.append(norm_row)

    # ── LANGKAH 4: Hitung Priority Vector (bobot) ───────
    # Rata-rata tiap BARIS dari matriks normalisasi
    weights = []
    for row in range(n):
        avg = sum(normalized[row]) / n
        weights.append(avg)

    weight_education  = weights[0]
    weight_experience = weights[1]
    weight_skill      = weights[2]

    # ── LANGKAH 5: Uji Konsistensi ───────────────────────
    # Hitung λ_max (lambda max)
    weighted_sum = []
    for row in range(n):
        total = sum(matrix[row][col] * weights[col] for col in range(n))
        weighted_sum.append(total)

    lambda_values = [weighted_sum[i] / weights[i] for i in range(n)]
    lambda_max = sum(lambda_values) / n

    # CI = Consistency Index
    ci = (lambda_max - n) / (n - 1)

    # CR = Consistency Ratio (harus < 0.1 agar konsisten)
    cr = ci / RI[n]

    is_consistent = cr < 0.1

    return {
        "weight_education":  round(weight_education,  6),
        "weight_experience": round(weight_experience, 6),
        "weight_skill":      round(weight_skill,      6),
        "lambda_max":        round(lambda_max,        6),
        "ci":                round(ci,                6),
        "consistency_ratio": round(cr,                6),
        "is_consistent":     is_consistent,
        # Kembalikan juga matrix untuk keperluan tampilan
        "matrix": matrix,
        "normalized": normalized
    }