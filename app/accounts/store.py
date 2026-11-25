import hashlib
import os
import secrets
import sqlite3
import time
from contextlib import closing

from ..config import DATABASE

COOKIE = "archivo_session"
SESSION_SECONDS = 30 * 24 * 60 * 60


def connect():
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA foreign_keys = ON")
    return db


def initialize_database():
    with closing(connect()) as db, db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY, salt BLOB NOT NULL, password_hash BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                username TEXT NOT NULL REFERENCES accounts(username),
                expires INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS progress (
                username TEXT NOT NULL REFERENCES accounts(username),
                level TEXT NOT NULL,
                PRIMARY KEY (username, level)
            );
        """)
        if db.execute("SELECT 1 FROM accounts WHERE username = 'admin'").fetchone() is None:
            salt = secrets.token_bytes(16)
            initial_password = os.environ.get("GAME_ADMIN_PASSWORD", "admin")
            db.execute(
                "INSERT OR IGNORE INTO accounts VALUES (?, ?, ?)",
                ("admin", salt, password_hash(initial_password, salt)),
            )


def session_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(db, request):
    token = request.cookies.get(COOKIE)
    if token:
        row = db.execute(
            "SELECT username FROM sessions WHERE token_hash = ? AND expires > ?",
            (session_hash(token), int(time.time())),
        ).fetchone()
        if row:
            return row[0]
    return None


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)


def save_progress(db, username, completed, catalog):
    completed = set(completed).intersection(catalog)
    db.executemany("INSERT OR IGNORE INTO progress VALUES (?, ?)", ((username, level) for level in completed))


def profile(db, username):
    rows = db.execute("SELECT level FROM progress WHERE username = ? ORDER BY level", (username,))
    return {"username": username, "completed": [row[0] for row in rows]}
