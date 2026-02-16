from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class FlowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_name: str
    template_content: str


class FlowOut(BaseModel):
    id: str
    collection_id: str
    name: str
    status: str
    description: Optional[str] = None
    template_name: str
    template_content: str
    created_at: str
    updated_at: str
    context_content: Optional[str] = None


class FlowCheckbox(BaseModel):
    id: UUID
    flow_id: UUID
    name: str
    created_at: str
    checked: bool


class CheckboxCreate(BaseModel):
    name: str


class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_name: Optional[str] = None
    template_content: Optional[str] = None
    status: Optional[str] = None
    context_content: Optional[str] = None
