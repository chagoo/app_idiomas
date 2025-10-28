from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import themes, srs


def create_app() -> FastAPI:
    app = FastAPI(title="App Idiomas API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(themes.router, prefix="/themes", tags=["themes"])
    app.include_router(srs.router, prefix="/srs", tags=["srs"])

    @app.get("/")
    def root():
        return {"ok": True, "name": "app_idiomas", "version": "0.1.0"}

    return app


app = create_app()

