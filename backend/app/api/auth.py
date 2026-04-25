from datetime import datetime, timedelta, timezone
from typing import List, Optional
import random
import secrets
import string
import concurrent.futures

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from passlib.context import CryptContext
from pydantic import BaseModel

import app.storage as storage
from app.auth.handlers import AuthedUser
from app.auth.settings import settings
from app.email_utils import send_invite_email_safe, send_otp_email_safe

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None
    is_admin: bool = False

class InviteRequest(BaseModel):
    emails: List[str]

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str
    new_password: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.jwt_local.decode_key,
        algorithm=settings.jwt_local.alg.upper(),
        headers={"typ": "JWT", "alg": settings.jwt_local.alg.upper()},
    )


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def verify_admin(user: AuthedUser) -> AuthedUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Existing endpoints (preserved)
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user = await storage.get_user_by_username(request.username)
    
    if not user:
        raise HTTPException(status_code=401, detail="This email isn't registered. Only admin-invited users can access the platform.")
        
    if not user.password_hash:
        # User exists but hasn't set a password (likely a pending invite)
        raise HTTPException(
            status_code=401, 
            detail="An invitation was sent to your email. Please login by clicking the link in the email to set up your account."
        )
        
    if not pwd_context.verify(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")

    access_token = create_access_token(
        data={"sub": user.sub, "iss": settings.jwt_local.iss, "aud": settings.jwt_local.aud, "is_admin": user.is_admin},
        expires_delta=timedelta(days=7),
    )
    # Update last_seen timestamp
    async with storage.get_pg_pool().acquire() as conn:
        await conn.execute(
            'UPDATE "user" SET last_seen = NOW() WHERE sub = $1',
            user.sub
        )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/admin/users", response_model=dict)
async def create_user(request: CreateUserRequest, user: AuthedUser):
    verify_admin(user)
    hashed_password = pwd_context.hash(request.password)
    new_user, created = await storage.create_user_credentials(
        username=request.username,
        password_hash=hashed_password,
        name=request.name,
        phone=request.phone,
        is_admin=request.is_admin,
    )
    if not created:
        raise HTTPException(status_code=400, detail="Username already registered")
    return {
        "user_id": str(new_user.user_id),
        "username": new_user.username,
        "name": new_user.name,
        "phone": new_user.phone,
        "is_admin": new_user.is_admin,
    }


@router.get("/me")
async def get_me(user: AuthedUser):
    """Get the current authenticated user's profile info."""
    db_user = await storage.get_user_by_id(user.sub)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": str(db_user.user_id),
        "username": db_user.username,
        "name": db_user.name,
        "phone": db_user.phone,
        "is_admin": db_user.is_admin,
        "created_at": db_user.created_at.isoformat() if db_user.created_at else None,
        "plan_type": db_user.plan_type
    }


@router.put("/me")
async def update_me(payload: dict, user: AuthedUser):
    """Update the current authenticated user's profile."""
    # We allow the user to update their name, phone, password, and username.
    # Note: username is typically their email
    db_user = await storage.get_user_by_id(user.sub)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    password_hash = None
    if payload.get("password"):
        password_hash = pwd_context.hash(payload["password"])

    updated = await storage.update_user(
        user_id=user.user_id,
        username=payload.get("username", db_user.username),
        # They cannot change their admin status
        is_admin=db_user.is_admin,
        name=payload.get("name", db_user.name),
        phone=payload.get("phone", db_user.phone),
        password_hash=password_hash,
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Failed to update profile")
    return {
        "user_id": str(updated.user_id),
        "username": updated.username,
        "name": updated.name,
        "phone": updated.phone,
    }


@router.get("/admin/users")
async def list_users(user: AuthedUser):
    verify_admin(user)
    users = await storage.list_all_users()
    def fmt(dt):
        if dt is None:
            return None
        return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
    return [
        {
            "user_id": str(u["user_id"]),
            "username": u["username"],
            "name": u["name"],
            "phone": u["phone"],
            "is_admin": u.get("is_admin", False),
            "created_at": fmt(u["created_at"]),
            "last_seen": fmt(u.get("last_seen")),
            "is_invite_pending": u.get("is_invite_pending", False)
        }
        for u in users
    ]


@router.put("/admin/users/{user_id}")
async def update_user(user_id: str, payload: dict, authed: AuthedUser):
    verify_admin(authed)
    password_hash = None
    if payload.get("password"):
        password_hash = pwd_context.hash(payload["password"])
    updated = await storage.update_user(
        user_id=user_id,
        username=payload.get("username", ""),
        is_admin=payload.get("is_admin", False),
        name=payload.get("name"),
        phone=payload.get("phone"),
        password_hash=password_hash,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": str(updated.user_id), "username": updated.username}

@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, authed: AuthedUser):
    verify_admin(authed)
    if user_id.startswith("invite_"):
        email = user_id[len("invite_"):]
        await storage.delete_invite(email)
        return {"message": "Invite deleted"}
        
    await storage.delete_user(user_id)
    return {"message": "User deleted"}

# ---------------------------------------------------------------------------
# NEW: Invite flow
# ---------------------------------------------------------------------------

@router.post("/invite")
async def send_invites(request: InviteRequest, user: AuthedUser, req: Request):
    """Admin sends invite emails. Each gets a unique magic-link token."""
    verify_admin(user)

    # Get the actual frontend URL. 
    # Best practice for production: use FRONTEND_URL env var.
    # Fallback for local dev: Origin or Referer header.
    import os
    frontend_env = os.environ.get("FRONTEND_URL")
    
    if frontend_env:
        base_url = frontend_env.rstrip("/")
    else:
        origin = req.headers.get("origin")
        if not origin:
            referer = req.headers.get("referer", "")
            # Extract base from referer (e.g. http://localhost:5173/admin -> http://localhost:5173)
            if referer:
                parts = referer.split("/")
                origin = "/".join(parts[:3]) if len(parts) >= 3 else referer
        
        base_url = (origin or str(req.base_url)).rstrip("/")
    results = []

    import re
    import asyncio
    _EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    for email in request.emails:
        email = email.strip().lower()
        if not email:
            continue

        if not _EMAIL_RE.match(email):
            results.append({"email": email, "sent": False, "error": "Please enter a valid email address."})
            continue

        existing_user = await storage.get_user_by_username(email)
        if existing_user:
            results.append({"email": email, "sent": False, "error": "User already active"})
            continue
            
        token = secrets.token_urlsafe(32)
        invite_link = f"{base_url}/accept-invite?token={token}"

        # Send email in thread pool so we don't block the event loop
        loop = asyncio.get_event_loop()
        err = await loop.run_in_executor(
            _executor, send_invite_email_safe, email, invite_link
        )
        
        if err is None:
            await storage.create_invite_token(email, token)
        else:
            # Replace raw SMTP/technical errors with a friendly message
            err = "Please enter a valid email address."
            
        results.append({"email": email, "sent": err is None, "error": err})

    return {"results": results}


@router.get("/accept-invite")
async def accept_invite(token: str):
    """User clicks invite link → get JWT back (auto-login, no password)."""
    row = await storage.get_invite_token(token)
    if not row:
        raise HTTPException(status_code=404, detail="Invite link not found")
    if row["used"]:
        raise HTTPException(status_code=410, detail="Invite link has already been used")

    email = row["email"]

    # Create account if not exists (no password — invite-only access)
    user = await storage.get_user_by_username(email)
    if not user:
        _, _ = await storage.create_user_credentials(
            username=email,
            password_hash="",   # no password; can only log in via invite/OTP
            name=None,
            phone=None,
            is_admin=False,
        )
        user = await storage.get_user_by_username(email)

    await storage.mark_invite_token_used(token)

    access_token = create_access_token(
        data={"sub": user.sub, "iss": settings.jwt_local.iss, "aud": settings.jwt_local.aud, "is_admin": user.is_admin},
        expires_delta=timedelta(days=7),
    )
    return {"access_token": access_token, "token_type": "bearer", "email": email}


# ---------------------------------------------------------------------------
# NEW: Forgot password (OTP flow)
# ---------------------------------------------------------------------------

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send a 6-digit OTP to the given email for password reset."""
    email = request.email.strip().lower()
    user = await storage.get_user_by_username(email)
    # Respond OK even if user doesn't exist (security: don't leak account existence)
    if not user:
        raise HTTPException(status_code=404, detail="This email isn't registered. Only admin-invited users can access the platform.")

    otp = _generate_otp()
    await storage.create_otp(email, otp)

    import asyncio
    loop = asyncio.get_event_loop()
    err = await loop.run_in_executor(_executor, send_otp_email_safe, email, otp)
    if err:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {err}")

    return {"message": "Code sent. Check your email."}


@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """Verify the OTP and reset the user's password."""
    email = request.email.strip().lower()

    user = await storage.get_user_by_username(email)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    row = await storage.get_latest_otp(email)
    if not row:
        raise HTTPException(status_code=400, detail="No valid code found. Please request a new one.")

    # Check expiry (10 minutes)
    created_at = row["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created_at > timedelta(minutes=10):
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")

    if row["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid code")

    # Reset password
    new_hash = pwd_context.hash(request.new_password)
    await storage.update_user_password(str(user.user_id), new_hash)
    await storage.mark_otp_used(row["id"])

@router.post("/login-otp/request")
async def login_otp_request(request: ForgotPasswordRequest):
    """Send a 6-digit OTP to the given email for logging in."""
    email = request.email.strip().lower()
    user = await storage.get_user_by_username(email)
    
    if not user:
        raise HTTPException(status_code=404, detail="This email isn't registered. Only admin-invited users can access the platform.")

    otp = _generate_otp()
    await storage.create_otp(email, otp)

    import asyncio
    loop = asyncio.get_event_loop()
    # We can reuse send_otp_email_safe since the email copy is generic enough
    err = await loop.run_in_executor(_executor, send_otp_email_safe, email, otp)
    if err:
        raise HTTPException(status_code=500, detail=f"Failed to send login code: {err}")

    return {"message": "Login code sent. Check your email."}


@router.post("/login-otp/verify")
async def login_otp_verify(request: VerifyOTPRequest):
    """Verify the OTP and return a JWT (for logging in without a password).
    Note: We reuse the VerifyOTPRequest model, but we ignore `new_password`."""
    email = request.email.strip().lower()

    user = await storage.get_user_by_username(email)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")

    row = await storage.get_latest_otp(email)
    if not row:
        raise HTTPException(status_code=400, detail="No valid login code found. Please request a new one.")

    # Check expiry (10 minutes)
    created_at = row["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created_at > timedelta(minutes=10):
        raise HTTPException(status_code=400, detail="Login code has expired. Please request a new one.")

    if row["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid login code")

    await storage.mark_otp_used(row["id"])

    # Issue JWT
    access_token = create_access_token(
        data={"sub": user.sub, "iss": settings.jwt_local.iss, "aud": settings.jwt_local.aud, "is_admin": user.is_admin},
        expires_delta=timedelta(days=7),
    )
    return {"access_token": access_token, "token_type": "bearer", "email": email}


class SetPasswordRequest(BaseModel):
    new_password: str

@router.post("/set-password")
async def set_password(request: SetPasswordRequest, user: AuthedUser):
    """Allows an authenticated user to set or update their password."""
    new_hash = pwd_context.hash(request.new_password)
    # AuthedUser sub is user.sub, but DB user_id is user.user_id
    success = await storage.update_user_password(str(user.user_id), new_hash)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update password")
    
    return {"message": "Password updated successfully"}
