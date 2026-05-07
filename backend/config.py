import os
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend/.env is loaded even when the app is started from the repository root.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

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
