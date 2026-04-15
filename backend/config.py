import os
from dotenv import load_dotenv

load_dotenv()

# =========================
# SUPABASE CONFIG
# =========================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# =========================
# GEMINI CONFIG
# =========================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# SAW WEIGHTS
SAW_WEIGHTS = {
    "education": 0.3,
    "experience": 0.4,
    "skill": 0.3
}
