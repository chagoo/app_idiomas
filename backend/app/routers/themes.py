from fastapi import APIRouter, HTTPException

from ..db.offline_store import OFFLINE_WORDS
from ..models.schemas import Theme, Word


router = APIRouter()


@router.get("/", response_model=list[Theme])
def list_themes() -> list[Theme]:
    counts: dict[str, int] = {}
    for w in OFFLINE_WORDS:
        counts[w["theme"]] = counts.get(w["theme"], 0) + 1
    return [Theme(name=name, count=count) for name, count in sorted(counts.items())]


@router.get("/{theme}/words", response_model=list[Word])
def words_by_theme(theme: str) -> list[Word]:
    items = [w for w in OFFLINE_WORDS if w["theme"].lower() == theme.lower()]
    if not items:
        raise HTTPException(status_code=404, detail="Theme not found or empty")
    return [Word(**w) for w in items]

