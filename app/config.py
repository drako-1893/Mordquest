import os
from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATABASE = Path(os.environ.get("GAME_DATABASE", ROOT / "game.sqlite3"))
LEVEL_DATA = ROOT / "levels"
WEB = ROOT / "web"
STATIC = WEB / "static"


def static_prefix() -> str:
    revision = sha256()
    for path in sorted(STATIC.rglob("*")):
        if path.is_file():
            revision.update(path.relative_to(STATIC).as_posix().encode())
            revision.update(path.read_bytes())
    return f"/static/{revision.hexdigest()[:12]}"


STATIC_PREFIX = static_prefix()
