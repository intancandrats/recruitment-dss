from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Model untuk membuat session baru (data yang dikirim frontend)
class SessionCreate(BaseModel):
    title: str
    position: str
    description: Optional[str] = None

# Model untuk response session (data yang dikembalikan ke frontend)
class SessionResponse(BaseModel):
    id: str
    title: str
    position: str
    description: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True