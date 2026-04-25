from typing import Optional
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import app.storage as storage
from app.auth.handlers import AuthedUser
from app.api.auth import pwd_context, verify_admin
from app.lifespan import GOVERNMENT_DOCS_DIR

router = APIRouter()

class UpdateUserRequest(BaseModel):
    username: str
    is_admin: bool
    name: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

@router.get("/chats")
async def admin_list_chats(user: AuthedUser):
    """List all threads with feedback summary for admin view."""
    verify_admin(user)
    return await storage.list_all_threads_for_admin()

@router.get("/kb-history")
async def admin_list_kb_history(user: AuthedUser):
    """List all knowledge base history for admin view."""
    verify_admin(user)
    return await storage.list_all_kb_history()

@router.get("/default-files")
async def admin_list_default_files(user: AuthedUser):
    """List all default government documents recursively."""
    verify_admin(user)
    try:
        from pathlib import Path
        govt_dir = Path(GOVERNMENT_DOCS_DIR)
        if not govt_dir.is_dir():
            return []
            
        res = []
        for p in govt_dir.rglob("*"):
            if p.is_file() and "__MACOSX" not in p.parts and not p.name.startswith("._"):
                stat = p.stat()
                # Use relative path so we see the folder structure in the name
                rel_name = str(p.relative_to(govt_dir))
                res.append({
                    "name": rel_name,
                    "created_at": stat.st_mtime * 1000  # ms since epoch
                })
        return res
    except Exception as e:
        return []

@router.get("/chats/{tid}/state")
async def admin_get_thread_state(tid: str, user: AuthedUser):
    """Get thread state for any user's thread (admin only, no ownership check)."""
    verify_admin(user)
    # Fetch thread without user_id restriction
    thread = await storage.get_thread_by_id(tid)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    assistant = await storage.get_assistant(user.user_id, thread.assistant_id)
    if not assistant:
        raise HTTPException(status_code=400, detail="Thread has no assistant")
    return await storage.get_thread_state(
        user_id=thread.user_id,
        thread_id=tid,
        assistant=assistant,
    )

@router.get("/users")
async def admin_list_users(user: AuthedUser):
    """List all users for admin view."""
    verify_admin(user)
    users = await storage.list_all_users()
    return [{
        "user_id": str(u.user_id),
        "username": u.username,
        "name": u.name,
        "phone": u.phone,
        "is_admin": u.is_admin,
        "created_at": u.created_at
    } for u in users]

@router.put("/users/{user_id}")
async def admin_update_user(user_id: str, request: UpdateUserRequest, user: AuthedUser):
    """Admin endpoint to update a user."""
    verify_admin(user)
    
    hashed_password = pwd_context.hash(request.password) if request.password else None
    
    updated_user = await storage.update_user(
        user_id=user_id,
        username=request.username,
        is_admin=request.is_admin,
        name=request.name,
        phone=request.phone,
        password_hash=hashed_password
    )
    
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "user_id": str(updated_user.user_id),
        "username": updated_user.username,
        "name": updated_user.name,
        "phone": updated_user.phone,
        "is_admin": updated_user.is_admin
    }
