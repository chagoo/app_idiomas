from fastapi import APIRouter
from random import choice
from datetime import timedelta

from ..db.offline_store import OFFLINE_WORDS
from ..models.schemas import ReviewRequest, ReviewResponse, Word


router = APIRouter()


# Nota: Este endpoint implementa una logica SRS simplificada
# basada en la calificacion del usuario. Persistencia real y
# historiales deberian guardarse por usuario (p.ej., Supabase).

@router.post("/review", response_model=ReviewResponse)
def review_card(payload: ReviewRequest) -> ReviewResponse:
    # Mapea grade (0=Again,1=Hard,2=Good,3=Easy) a retrasos simples
    seconds_map = {0: 30, 1: 5 * 60, 2: 25 * 60, 3: 12 * 60 * 60}
    wait = seconds_map.get(payload.grade, 600)

    # Seleccionar la proxima palabra de forma simple: aleatoria
    next_word_raw = choice(OFFLINE_WORDS)
    next_word = Word(**next_word_raw)

    return ReviewResponse(
        word_id=payload.word_id,
        next_due_seconds=wait,
        next_word=next_word,
    )

