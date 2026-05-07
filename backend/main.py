from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import get_supabase

# Import semua router
from routers.auth       import router as auth_router
from routers.sessions   import router as sessions_router
from routers.candidates import router as candidates_router
from routers.ranking    import router as ranking_router
from routers.ahp import router as ahp_router

app = FastAPI(
    title="AI Recruitment DSS",
    description="Decision Support System untuk Rekrutmen berbasis SAW",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Daftarkan semua router
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(candidates_router)
app.include_router(ranking_router)
app.include_router(ahp_router)

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Recruitment DSS berjalan!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/test-db")
def test_database():
    try:
        db = get_supabase()
        result = db.table("recruitment_sessions").select("*").execute()
        return {"status": "connected", "total_sessions": len(result.data)}
    except Exception as e:
        return {"status": "error", "message": str(e)}