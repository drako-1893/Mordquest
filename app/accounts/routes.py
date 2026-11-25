import hmac
import secrets
import time
from contextlib import closing
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, StringConstraints

from ..levels.models import LevelId
from .store import (
    COOKIE, SESSION_SECONDS, connect, current_user, password_hash, profile,
    save_progress, session_hash,
)


router = APIRouter(prefix="/api")


class Credentials(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9_-]{3,24}$")
    password: str = Field(min_length=1)
    completed: list[LevelId] = Field(default_factory=list)


class Progress(BaseModel):
    username: str
    completed: list[LevelId]


class ProgressReset(BaseModel):
    username: str


class Preferences(BaseModel):
    username: str
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
    avatar_color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")


@router.get("/session")
def session(request: Request):
    with closing(connect()) as db:
        return profile(db, current_user(db, request))


@router.put("/profile")
def update_profile(data: Preferences, request: Request):
    with closing(connect()) as db, db:
        username = current_user(db, request)
        if username is None or username != data.username:
            raise HTTPException(401, "La sesión cambió. Vuelve a iniciar sesión.")
        db.execute(
            """INSERT INTO account_preferences (username, display_name, avatar_color) VALUES (?, ?, ?)
               ON CONFLICT (username) DO UPDATE SET display_name = excluded.display_name,
               avatar_color = excluded.avatar_color""",
            (username, data.display_name, data.avatar_color),
        )
        return profile(db, username)


@router.post("/auth/{action}")
def authenticate(action: Literal["register", "login"], data: Credentials, request: Request, response: Response):
    username = data.username.lower()
    with closing(connect()) as db, db:
        if action == "register":
            salt = secrets.token_bytes(16)
            result = db.execute(
                "INSERT OR IGNORE INTO accounts VALUES (?, ?, ?)",
                (username, salt, password_hash(data.password, salt)),
            )
            if result.rowcount == 0:
                raise HTTPException(409, "Ese usuario ya existe.")
        else:
            row = db.execute("SELECT salt, password_hash FROM accounts WHERE username = ?", (username,)).fetchone()
            salt, expected = row or (bytes(16), bytes(64))
            if not hmac.compare_digest(password_hash(data.password, salt), expected) or row is None:
                raise HTTPException(401, "Usuario o contraseña incorrectos.")

        old_token = request.cookies.get(COOKIE)
        if old_token:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (session_hash(old_token),))
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        db.execute("DELETE FROM sessions WHERE expires <= ?", (now,))
        db.execute("INSERT INTO sessions VALUES (?, ?, ?)", (session_hash(token), username, now + SESSION_SECONDS))
        save_progress(db, username, data.completed, request.app.state.levels)
        result = profile(db, username)

    response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, httponly=True,
                        samesite="lax", secure=request.url.scheme == "https")
    return result


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with closing(connect()) as db, db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (session_hash(token),))
    response.delete_cookie(COOKIE)


@router.put("/progress")
def update_progress(data: Progress, request: Request):
    with closing(connect()) as db, db:
        username = current_user(db, request)
        if username is None or username != data.username:
            raise HTTPException(401, "La sesión cambió. Vuelve a iniciar sesión.")
        save_progress(db, username, data.completed, request.app.state.levels)
        return profile(db, username)


@router.delete("/progress/{level_id}")
def reset_progress(level_id: LevelId, data: ProgressReset, request: Request):
    with closing(connect()) as db, db:
        username = current_user(db, request)
        if username is None or username != data.username:
            raise HTTPException(401, "La sesión cambió. Vuelve a iniciar sesión.")
        if level_id not in request.app.state.levels:
            raise HTTPException(404, "Ese nivel no existe.")
        db.execute("DELETE FROM progress WHERE username = ? AND level = ?", (username, level_id))
        return profile(db, username)
