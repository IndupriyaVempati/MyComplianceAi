import os
from pathlib import Path

import orjson
import structlog
from fastapi import FastAPI, Form, UploadFile
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import app.storage as storage
from app.api import router as api_router
from app.auth.handlers import AuthedUser
from app.lifespan import lifespan
from app.upload import convert_ingestion_input_to_blob, ingest_runnable

logger = structlog.get_logger(__name__)

app = FastAPI(title="Surtn - the AI Assistant API", lifespan=lifespan)


# Get root of app, used to point to directory containing static files
ROOT = Path(__file__).parent.parent


app.include_router(api_router, prefix="/api")


@app.post("/api/ingest", description="Upload files to the given assistant.")
async def ingest_files(
    files: list[UploadFile], user: AuthedUser, config: str = Form(...)
) -> None:
    """Ingest a list of files."""
    config = orjson.loads(config)

    assistant_id = config["configurable"].get("assistant_id")
    if assistant_id is not None:
        assistant = await storage.get_assistant(user.user_id, assistant_id)
        if assistant is None:
            raise HTTPException(status_code=404, detail="Assistant not found.")

    thread_id = config["configurable"].get("thread_id")
    if thread_id is not None:
        thread = await storage.get_thread(user.user_id, thread_id)
        if thread is None:
            raise HTTPException(status_code=404, detail="Thread not found.")

    file_blobs = [convert_ingestion_input_to_blob(file) for file in files]
    # Only record KB history for assistant-scoped uploads (Knowledge Base).
    # Thread-scoped uploads are contextual to that chat only and should not appear in KB track.
    if assistant_id is not None:
        for file in files:
            await storage.record_kb_history(user.user_id, "file_uploaded", assistant_id, file.filename)
    result = await ingest_runnable.abatch(file_blobs, config)
    return result


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


ui_dir = ROOT / "ui"

if ui_dir.exists():
    # Serve static assets (JS, CSS, images) directly
    app.mount("/assets", StaticFiles(directory=str(ui_dir / "assets")), name="assets")

    # Catch-all: serve index.html for all non-API routes (enables React Router)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If a real file exists in ui_dir, serve it directly
        file_path = ui_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise return index.html and let React Router handle the route
        return FileResponse(ui_dir / "index.html")

else:
    logger.warn("No UI directory found, serving API only.")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8100)
