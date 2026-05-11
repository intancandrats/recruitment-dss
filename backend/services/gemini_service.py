import re
import random
import json
from config import GEMINI_API_KEY

# ─── PROMPT: dengan job description ──────────────────────────────────────────
PROMPT_WITH_JD = """
You are an expert HR recruiter. Score this CV based on how relevant the candidate is for the specific role below.

JOB ROLE & REQUIREMENTS:
{job_description}

SCORING RULES:
- education_score (0-100): How relevant is their educational background for THIS role?
- experience_score (0-100): How relevant is their work experience for THIS role specifically?
- skill_score (0-100): How relevant are their skills/tools for THIS role?

IMPORTANT:
- Someone with 10 years experience in a completely different field = LOW experience_score.
- Someone with 2 years experience directly in this role = HIGH experience_score.
- Focus on RELEVANCE to the role, not just quantity of experience.

Return ONLY valid JSON, no markdown, no explanation:
{{
  "name": "candidate full name from CV",
  "education_score": <number 0-100>,
  "experience_score": <number 0-100>,
  "skill_score": <number 0-100>,
  "reasoning": "one sentence explaining the fit"
}}

CV TEXT:
{cv}
"""

# ─── PROMPT: tanpa job description ───────────────────────────────────────────
PROMPT_NO_JD = """
You are an HR system. Score this CV on general quality.

- education_score (0-100): quality and level of education
- experience_score (0-100): depth and relevance of work experience
- skill_score (0-100): breadth of technical and professional skills

Return ONLY valid JSON, no markdown, no explanation:
{{
  "name": "candidate full name from CV",
  "education_score": <number 0-100>,
  "experience_score": <number 0-100>,
  "skill_score": <number 0-100>,
  "reasoning": "one sentence general assessment"
}}

CV TEXT:
{cv}
"""


def score_cv_with_gemini(cv_text: str, job_description: str = None):
    """
    Score a CV using Gemini AI (google-genai SDK).
    If job_description is provided, scores based on role fit.
    Falls back to mock scorer if API call fails.
    """

    if not GEMINI_API_KEY or GEMINI_API_KEY.strip() == "":
        print("[Gemini] No API key set, using mock scorer")
        return mock_score_cv(cv_text, job_description)

    # Pilih prompt
    if job_description and job_description.strip():
        prompt = PROMPT_WITH_JD \
            .replace("{job_description}", job_description[:1500]) \
            .replace("{cv}", cv_text[:3000])
        print(f"[Gemini] Scoring WITH job description: {job_description[:80]}...")
    else:
        prompt = PROMPT_NO_JD.replace("{cv}", cv_text[:3000])
        print("[Gemini] Scoring WITHOUT job description (general)")

    try:
        from google import genai  # pip install google-genai

        client = genai.Client(api_key=GEMINI_API_KEY)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )

        raw_text = response.text.strip()
        print(f"[Gemini] Raw response: {raw_text[:200]}")

        # Ekstrak JSON dari response
        start = raw_text.find("{")
        end   = raw_text.rfind("}") + 1
        if start == -1 or end == 0:
            print("[Gemini] No JSON found, falling back to mock")
            return mock_score_cv(cv_text, job_description)

        result = json.loads(raw_text[start:end])

        # Validasi field wajib
        required = ["name", "education_score", "experience_score", "skill_score"]
        if not all(k in result for k in required):
            print("[Gemini] Missing fields, falling back to mock")
            return mock_score_cv(cv_text, job_description)

        result["education_score"]  = max(0, min(100, int(result["education_score"])))
        result["experience_score"] = max(0, min(100, int(result["experience_score"])))
        result["skill_score"]      = max(0, min(100, int(result["skill_score"])))
        result.setdefault("reasoning", "")

        print(f"[Gemini] OK: {result['name']} — Edu:{result['education_score']}, Exp:{result['experience_score']}, Skill:{result['skill_score']}")
        print(f"[Gemini] Reasoning: {result['reasoning']}")
        return result

    except Exception as e:
        print(f"[Gemini] ERROR: {e}")
        print("[Gemini] Falling back to mock scorer")
        return mock_score_cv(cv_text, job_description)


# ─── MOCK SCORER (fallback kalau Gemini gagal) ───────────────────────────────

def mock_score_cv(cv_text: str, job_description: str = None):
    """Fallback scorer berbasis keyword overlap dengan job description."""

    name = _extract_name(cv_text)

    if job_description and job_description.strip():
        jd_words      = set(re.findall(r'\b\w{4,}\b', job_description.lower()))
        cv_words      = set(re.findall(r'\b\w{4,}\b', cv_text.lower()))
        overlap       = len(jd_words & cv_words)
        overlap_pct   = min(overlap / max(len(jd_words), 1), 1.0)
        base          = int(overlap_pct * 100)

        edu_kws = ['bachelor', 'master', 'phd', 'degree', 'university', 'college', 'gpa']
        education_score  = 25 + (base // 3)
        for kw in edu_kws:
            if kw in cv_text.lower():
                education_score += random.randint(4, 10)

        experience_score = 20 + (base // 2)
        if 'experience' in cv_text.lower():
            experience_score += random.randint(5, 12)

        skill_score = 20 + (base // 2)

        education_score  = max(0, min(100, education_score  + random.randint(-5, 5)))
        experience_score = max(0, min(100, experience_score + random.randint(-5, 5)))
        skill_score      = max(0, min(100, skill_score      + random.randint(-5, 5)))
        reasoning = f"Mock: {overlap} keyword overlaps ({int(overlap_pct*100)}% relevance to job description)"
    else:
        edu_kws = ['bachelor', 'master', 'phd', 'degree', 'university', 'college', 'gpa']
        education_score = 30 + cv_text.lower().count('education') * 8
        for kw in edu_kws:
            if kw in cv_text.lower():
                education_score += random.randint(5, 12)

        exp_kws = ['experience', 'worked', 'years', 'senior', 'junior', 'developer', 'engineer', 'manager']
        experience_score = 25 + cv_text.lower().count('experience') * 6
        for kw in exp_kws:
            if kw in cv_text.lower():
                experience_score += random.randint(3, 8)

        skl_kws = ['python', 'javascript', 'java', 'react', 'sql', 'git', 'docker', 'aws', 'figma', 'analytics']
        skill_score = 20 + len(re.findall(r'\b(?:' + '|'.join(skl_kws) + r')\b', cv_text.lower())) * 5

        education_score  = max(0, min(100, education_score  + random.randint(-8, 8)))
        experience_score = max(0, min(100, experience_score + random.randint(-8, 8)))
        skill_score      = max(0, min(100, skill_score      + random.randint(-8, 8)))
        reasoning = "Mock: general assessment (no job description provided)"

    print(f"[Mock] {name} — Edu:{education_score}, Exp:{experience_score}, Skill:{skill_score}")
    return {
        "name":             name,
        "education_score":  education_score,
        "experience_score": experience_score,
        "skill_score":      skill_score,
        "reasoning":        reasoning,
    }


def _extract_name(cv_text: str) -> str:
    skip = ['education','experience','skill','cv','resume','curriculum','vitae',
            'email','phone','address','linkedin','github','objective','summary','profile']
    for line in cv_text.strip().split('\n')[:8]:
        line = line.strip()
        if (line and 2 <= len(line.split()) <= 4
                and not any(w in line.lower() for w in skip)
                and not re.search(r'[@\d:/\\|]', line)):
            return line
    return "Unknown Candidate"
