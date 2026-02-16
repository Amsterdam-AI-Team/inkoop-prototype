from typing import Optional
from pydantic import BaseModel


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_content: Optional[str] = None


class CollectionOut(BaseModel):
    id: str
    user_id: str
    name: str
    status: str
    description: Optional[str] = None
    created_at: str
    updated_at: str


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
