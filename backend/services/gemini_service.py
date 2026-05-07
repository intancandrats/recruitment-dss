import re
import random
from config import GEMINI_API_KEY
import json

# Gemini API is currently broken, using mock scorer for now
USE_MOCK_SCORER = True

PROMPT = """
You are an HR system that scores CV.

Return ONLY JSON:
{
  "name": "candidate name",
  "education_score": 0-100,
  "experience_score": 0-100,
  "skill_score": 0-100
}

CV:
{cv}
"""

def score_cv_with_gemini(cv_text: str):
    """Mock scorer that gives varied scores based on CV content"""

    if USE_MOCK_SCORER:
        print("[Gemini] Using MOCK scorer (Gemini API broken)")
        return mock_score_cv(cv_text)

    # Original Gemini code (currently broken)
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)

        print("[Gemini] Request ke Gemini...")
        print(f"[Gemini] CV text length: {len(cv_text)} characters")

        # Validasi input
        if not cv_text or len(cv_text.strip()) < 10:
            print("[Gemini] ERROR: CV text too short or empty")
            return get_fallback_scores("CV text too short")

        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(PROMPT.replace("{cv}", cv_text[:3000]))

        print("[Gemini] Response received from API")
        raw_text = response.text
        print(f"[Gemini] Raw response: {raw_text[:200]}...")

        text = raw_text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1

        if start == -1 or end == 0:
            print("[Gemini] ERROR: No JSON found in response")
            return get_fallback_scores("No JSON in response")

        json_text = text[start:end]
        print(f"[Gemini] Extracted JSON: {json_text}")

        result = json.loads(json_text)

        if not all(key in result for key in ["name", "education_score", "experience_score", "skill_score"]):
            print("[Gemini] ERROR: Missing required fields in JSON")
            return get_fallback_scores("Missing fields")

        result["education_score"] = int(result["education_score"])
        result["experience_score"] = int(result["experience_score"])
        result["skill_score"] = int(result["skill_score"])

        print(f"[Gemini] SUCCESS: {result['name']} - Edu:{result['education_score']}, Exp:{result['experience_score']}, Skill:{result['skill_score']}")
        return result

    except Exception as e:
        print(f"[Gemini] ERROR: {str(e)}")
        return get_fallback_scores(str(e))

def mock_score_cv(cv_text: str):
    """Mock CV scorer that analyzes text content and gives varied scores"""

    # Extract name (first line or look for name patterns)
    lines = cv_text.strip().split('\n')
    name = "Unknown Candidate"
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if line and len(line.split()) <= 4 and not any(word in line.lower() for word in ['education', 'experience', 'skill', 'cv', 'resume']):
            name = line
            break

    # Analyze education keywords
    education_keywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college', 'gpa', 'graduated']
    education_score = min(100, 30 + (cv_text.lower().count('education') * 10))
    for keyword in education_keywords:
        if keyword in cv_text.lower():
            education_score += random.randint(5, 15)

    # Analyze experience keywords
    experience_keywords = ['experience', 'worked', 'years', 'senior', 'junior', 'developer', 'engineer', 'manager']
    experience_score = min(100, 25 + (cv_text.lower().count('experience') * 8))
    for keyword in experience_keywords:
        if keyword in cv_text.lower():
            experience_score += random.randint(3, 10)

    # Analyze skill keywords
    skill_keywords = ['python', 'javascript', 'java', 'react', 'node', 'sql', 'git', 'docker', 'aws', 'linux']
    skill_score = min(100, 20 + (len(re.findall(r'\b(?:' + '|'.join(skill_keywords) + r')\b', cv_text.lower())) * 5))

    # Add some randomness to avoid identical scores
    education_score = max(0, min(100, education_score + random.randint(-10, 10)))
    experience_score = max(0, min(100, experience_score + random.randint(-10, 10)))
    skill_score = max(0, min(100, skill_score + random.randint(-10, 10)))

    result = {
        "name": name,
        "education_score": education_score,
        "experience_score": experience_score,
        "skill_score": skill_score
    }

    print(f"[Mock] Scored CV: {name} - Edu:{education_score}, Exp:{experience_score}, Skill:{skill_score}")
    return result

def get_fallback_scores(reason: str):
    """Return fallback scores with random variation to avoid same scores"""
    import random
    return {
        "name": f"Fallback ({reason})",
        "education_score": random.randint(45, 55),
        "experience_score": random.randint(45, 55),
        "skill_score": random.randint(35, 45)
    }