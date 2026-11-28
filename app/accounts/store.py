import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from contextlib import closing

from ..config import DATABASE, PUBLIC_ACCOUNTS, positive_setting

COOKIE = "archivo_session"
SESSION_SECONDS = 30 * 24 * 60 * 60
ADMIN_ROLE = "admin"
ADMIN_USERNAME = "admin"


def connect():
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA foreign_keys = ON")
    return db


def initialize_database():
    admin_password = os.environ.get("GAME_ADMIN_PASSWORD")
    if admin_password and admin_password.strip().casefold() == "admin":
        raise ValueError("GAME_ADMIN_PASSWORD debe sustituir la contraseña administrativa predeterminada.")
    if not admin_password or not admin_password.strip():
        if PUBLIC_ACCOUNTS:
            raise ValueError("GAME_ADMIN_PASSWORD debe configurarse en el modo público con cuentas.")
        admin_password = None
    positive_setting("GAME_LOGIN_LIMIT", 10)
    positive_setting("GAME_LOGIN_WINDOW", 300)
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as db, db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                username TEXT PRIMARY KEY,
                salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
                tutorial_seen INTEGER NOT NULL DEFAULT 0 CHECK (tutorial_seen IN (0, 1))
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                username TEXT NOT NULL REFERENCES accounts(username),
                expires INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS account_preferences (
                username TEXT PRIMARY KEY REFERENCES accounts(username),
                display_name TEXT NOT NULL,
                avatar_color TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS progress (
                username TEXT NOT NULL REFERENCES accounts(username),
                level TEXT NOT NULL,
                PRIMARY KEY (username, level)
            );
            CREATE TABLE IF NOT EXISTS login_attempts (
                address TEXT PRIMARY KEY,
                attempts INTEGER NOT NULL,
                expires INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS login_attempts_expiry ON login_attempts(expires);
        """)
        db.execute("BEGIN IMMEDIATE")
        columns = {column[1] for column in db.execute("PRAGMA table_info(accounts)")}
        if "role" not in columns:
            db.execute("""
                ALTER TABLE accounts
                ADD COLUMN role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin'))
            """)
        if "tutorial_seen" not in columns:
            db.execute("""
                ALTER TABLE accounts
                ADD COLUMN tutorial_seen INTEGER NOT NULL DEFAULT 0 CHECK (tutorial_seen IN (0, 1))
            """)
        admin = db.execute("SELECT salt, password_hash FROM accounts WHERE username = ?", (ADMIN_USERNAME,)).fetchone()
        if admin_password is None:
            if admin is None or not hmac.compare_digest(password_hash("admin", admin[0]), admin[1]):
                return
            admin_password = secrets.token_urlsafe(48)
        if admin is None or not hmac.compare_digest(password_hash(admin_password, admin[0]), admin[1]):
            salt = secrets.token_bytes(16)
            db.execute(
                """INSERT INTO accounts (username, salt, password_hash) VALUES (?, ?, ?)
                   ON CONFLICT (username) DO UPDATE SET salt = excluded.salt,
                   password_hash = excluded.password_hash""",
                (ADMIN_USERNAME, salt, password_hash(admin_password, salt)),
            )
            db.execute("DELETE FROM sessions WHERE username = ?", (ADMIN_USERNAME,))
        db.execute("UPDATE accounts SET role = ? WHERE username = ? AND role <> ?",
                   (ADMIN_ROLE, ADMIN_USERNAME, ADMIN_ROLE))


def reserve_login_attempt(address):
    now = int(time.time())
    limit = positive_setting("GAME_LOGIN_LIMIT", 10)
    window = positive_setting("GAME_LOGIN_WINDOW", 300)
    with closing(connect()) as db, db:
        db.execute("DELETE FROM login_attempts WHERE expires <= ?", (now,))
        result = db.execute(
            """INSERT INTO login_attempts (address, attempts, expires) VALUES (?, 1, ?)
               ON CONFLICT (address) DO UPDATE SET attempts = login_attempts.attempts + 1
               WHERE login_attempts.attempts < ?""",
            (address, now + window, limit),
        )
        if result.rowcount:
            return 0
        expires, = db.execute("SELECT expires FROM login_attempts WHERE address = ?", (address,)).fetchone()
        return expires - now


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
    db.executemany("INSERT OR IGNORE INTO progress VALUES (?, ?)", ((username, level) for level in completed))


def profile(db, username):
    rows = db.execute("SELECT level FROM progress WHERE username = ? ORDER BY level", (username,))
    account = db.execute("SELECT role, tutorial_seen FROM accounts WHERE username = ?", (username,)).fetchone()
    preferences = db.execute(
        "SELECT display_name, avatar_color FROM account_preferences WHERE username = ?", (username,)
    ).fetchone()
    return {
        "username": username,
        "role": account[0] if account else None,
        "completed": [row[0] for row in rows],
        "tutorial_seen": bool(account and account[1]),
        "display_name": preferences[0] if preferences else username,
        "avatar_color": preferences[1] if preferences else None,
    }
