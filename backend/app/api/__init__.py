from fastapi import APIRouter

from app.api.assistants import router as assistants_router
from app.api.runs import router as runs_router
from app.api.threads import router as threads_router
from app.api.feedback import router as feedback_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.billing import router as billing_router
from app.api.support import router as support_router

router = APIRouter()


@router.get("/ok")
async def ok():
    return {"ok": True}


router.include_router(
    assistants_router,
    prefix="/assistants",
    tags=["assistants"],
)
router.include_router(
    runs_router,
    prefix="/runs",
    tags=["runs"],
)
router.include_router(
    threads_router,
    prefix="/threads",
    tags=["threads"],
)
router.include_router(
    feedback_router,
    prefix="/feedback",
    tags=["feedback"],
)
router.include_router(
    admin_router,
    prefix="/admin",
    tags=["admin"],
)
router.include_router(
    auth_router,
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    billing_router,
    prefix="/billing",
    tags=["billing"],
)
router.include_router(
    support_router,
    prefix="/support",
    tags=["support"],
)
