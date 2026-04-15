from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Response setelah upload CV berhasil
class CandidateResponse(BaseModel):
    id: str
    session_id: str
    name: str
    email: Optional[str]
    cv_file_url: Optional[str]
    status: str
    uploaded_at: datetime

# Response skor kandidat (hasil Gemini)
class ScoreResponse(BaseModel):
    candidate_id: str
    education_score: int
    experience_score: int
    skill_score: int

# Response ranking (hasil SAW)
class RankingResponse(BaseModel):
    rank_position: int
    candidate_id: str
    name: str
    email: Optional[str]
    education_score: int
    experience_score: int
    skill_score: int
    norm_education: float
    norm_experience: float
    norm_skill: float
    preference_score: float