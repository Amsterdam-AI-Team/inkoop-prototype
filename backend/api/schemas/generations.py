from pydantic import BaseModel


class GenerationEditIn(BaseModel):
    edited_text: str
