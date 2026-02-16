from pydantic import BaseModel
from typing import List, Literal
from uuid import UUID

class WebSearchIn(BaseModel):
    query: str
    max_results: int = 6


class Source(BaseModel):
    id: str
    url: str
    title: str
    summary: str


class WebSearchOut(BaseModel):
    sources: List[Source]


class SourceLLM(BaseModel):
    page_title: str
    canonical_url: str
    summary: str
    relevance: Literal["High", "Medium", "Low"]


class WebSearchResultLLM(BaseModel):
    query: str
    sources: List[SourceLLM]


class DbSource(BaseModel):
    flow_id: UUID
    id: UUID
    source_id: str
    url: str
    title: str
    summary: str
    include_in_result: bool


class DBWebSearchOut(BaseModel):
    sources: List[DbSource]


class DownloadLinksIn(BaseModel):
    urls: List[str]