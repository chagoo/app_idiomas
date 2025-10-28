import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "base_words.json"

try:
    OFFLINE_WORDS: list[dict] = json.loads(DATA_PATH.read_text(encoding="utf-8"))
except Exception:
    OFFLINE_WORDS = []

