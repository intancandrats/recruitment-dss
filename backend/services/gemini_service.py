from google import genai
from config import GEMINI_API_KEY
import json

client = genai.Client(api_key=GEMINI_API_KEY)

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
    try:
        print("[Gemini] Request ke Gemini...")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=PROMPT.replace("{cv}", cv_text[:3000])
        )

        
        text = response.candidates[0].content.parts[0].text.strip()

        # ambil JSON saja
        start = text.find("{")
        end = text.rfind("}") + 1
        json_text = text[start:end]

        result = json.loads(json_text)

        print("[Gemini] Response diterima ✔")
        return result

    except Exception as e:
        print("[Gemini ERROR]", e)
        return {
            "name": "Error",
            "education_score": 50,
            "experience_score": 50,
            "skill_score": 40
        }