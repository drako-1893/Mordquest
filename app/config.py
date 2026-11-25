import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATABASE = Path(os.environ.get("GAME_DATABASE", ROOT / "game.sqlite3"))
LEVEL_DATA = ROOT / "levels"
WEB = ROOT / "web"
