import os
from typing import Any, Optional

from dotenv import load_dotenv


load_dotenv()


class SupabaseClientWrapper:
    def __init__(self) -> None:
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_ANON_KEY")
        self._client = None

        if self.url and self.key:
            try:
                from supabase import create_client

                self._client = create_client(self.url, self.key)
            except Exception:
                # Libreria no instalada o mal configurada
                self._client = None

    @property
    def configured(self) -> bool:
        return self._client is not None

    def table(self, name: str) -> Optional[Any]:
        if not self.configured:
            return None
        return self._client.table(name)


supabase_client = SupabaseClientWrapper()

