import os
from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_VERSION = "1.3.1"
FIRST_RELEASE = "1.0.0"
MIN_CATALOG_RELEASE = (1, 1, 0)
DATABASE = ROOT / Path(os.environ.get("GAME_DATABASE", "game.sqlite3")).expanduser()
GUEST_ONLY = os.environ.get("GAME_GUEST_ONLY") == "true"
LEVEL_DATA = ROOT / "levels"
WEB = ROOT / "web"
STATIC = WEB / "static"
RESOURCES = WEB / "resources"


def static_prefix() -> str:
    revision = sha256()
    for directory in (STATIC, RESOURCES):
        for path in sorted(directory.rglob("*")):
            if path.is_file():
                revision.update(path.relative_to(WEB).as_posix().encode())
                revision.update(path.read_bytes())
    return f"/static/{revision.hexdigest()[:12]}"


STATIC_PREFIX = static_prefix()
