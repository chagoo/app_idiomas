from pydantic import BaseModel, Field
from typing import Optional


class Word(BaseModel):
    id: str
    theme: str
    en: str = Field(description="English term")
    es: str = Field(description="Spanish translation")
    image: Optional[str] = Field(default=None, description="Image URL or emoji")
    example: Optional[str] = None


class Theme(BaseModel):
    name: str
    count: int


class ReviewRequest(BaseModel):
    word_id: str
    grade: int = Field(ge=0, le=3, description="0 again, 1 hard, 2 good, 3 easy")


class ReviewResponse(BaseModel):
    word_id: str
    next_due_seconds: int
    next_word: Word

