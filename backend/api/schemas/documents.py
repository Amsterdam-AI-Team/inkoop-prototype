from pydantic import BaseModel, Field
from typing import List
from uuid import UUID
from datetime import datetime


class DocumentUploadRequest(BaseModel):
    flow_id: UUID  # ID van de flow waaraan het document gekoppeld is


class DocumentResponse(BaseModel):
    id: UUID
    flow_id: UUID
    title: str
    original_filename: str
    mime_type: str
    original_size_bytes: int
    text_bytes: int
    sha256: str
    tags: List[str] = Field(default_factory=list)
    storage_path: str
    created_at: datetime
    updated_at: datetime
