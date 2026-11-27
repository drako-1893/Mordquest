import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from contextlib import closing

from ..config import DATABASE, DATABASE_URL

COOKIE = "archivo_session"
SESSION_SECONDS = 30 * 24 * 60 * 60
ADMIN_ROLE = "admin"


def connect():
    if DATABASE_URL:
        from .postgres import connect as connect_postgres

        return connect_postgres(DATABASE_URL)
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA foreign_keys = ON")
    return db


def initialize_database():
    if not DATABASE_URL:
        if os.environ.get("RENDER") == "true" and not os.environ.get("GAME_DATABASE", "").strip():
            raise RuntimeError("Configura GAME_DATABASE_URL para guardar los datos en Render.")
        DATABASE.parent.mkdir(parents=True, exist_ok=True)
    blob_type = "BYTEA" if DATABASE_URL else "BLOB"
    with closing(connect()) as db, db:
        if DATABASE_URL:
            db.execute("SELECT pg_advisory_xact_lock(hashtext('assoku.schema'))")
        else:
            db.execute("BEGIN IMMEDIATE")
        db.execute(f"""
            CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY,
                salt {blob_type} NOT NULL,
                password_hash {blob_type} NOT NULL,
                role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin'))
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                username TEXT NOT NULL REFERENCES accounts(username),
                expires BIGINT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS account_preferences (
                username TEXT PRIMARY KEY REFERENCES accounts(username),
                display_name TEXT NOT NULL,
                avatar_color TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS progress (
                username TEXT NOT NULL REFERENCES accounts(username),
                level TEXT NOT NULL,
                PRIMARY KEY (username, level)
            )
        """)
        if not DATABASE_URL:
            columns = db.execute("PRAGMA table_info(accounts)")
            if not any(column[1] == "role" for column in columns):
                db.execute("""
                    ALTER TABLE accounts
                    ADD COLUMN role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin'))
                """)
        admin_password = os.environ.get("GAME_ADMIN_PASSWORD", "admin")
        admin = db.execute("SELECT salt, password_hash FROM accounts WHERE username = 'admin'").fetchone()
        if admin is None or not hmac.compare_digest(password_hash(admin_password, admin[0]), admin[1]):
            salt = secrets.token_bytes(16)
            db.execute(
                """INSERT INTO accounts (username, salt, password_hash) VALUES (?, ?, ?)
                   ON CONFLICT (username) DO UPDATE SET salt = excluded.salt,
                   password_hash = excluded.password_hash""",
                ("admin", salt, password_hash(admin_password, salt)),
            )
        db.execute("UPDATE accounts SET role = ? WHERE username = 'admin' AND role <> ?", (ADMIN_ROLE, ADMIN_ROLE))


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


def account_role(db, username):
    if username is None:
        return None
    row = db.execute("SELECT role FROM accounts WHERE username = ?", (username,)).fetchone()
    return row[0] if row else None


def save_progress(db, username, completed, catalog):
    completed = set(completed).intersection(catalog)
    with closing(db.cursor()) as cursor:
        cursor.executemany(
            "INSERT INTO progress (username, level) VALUES (?, ?) ON CONFLICT (username, level) DO NOTHING",
            ((username, level) for level in completed),
        )


def profile(db, username):
    rows = db.execute("SELECT level FROM progress WHERE username = ? ORDER BY level", (username,))
    preferences = db.execute(
        "SELECT display_name, avatar_color FROM account_preferences WHERE username = ?", (username,)
    ).fetchone()
    return {
        "username": username,
        "role": account_role(db, username),
        "completed": [row[0] for row in rows],
        "display_name": preferences[0] if preferences else username,
        "avatar_color": preferences[1] if preferences else None,
    }
