from pathlib import Path

from pydantic import ValidationError

from ..config import LEVEL_DATA, MIN_CATALOG_RELEASE
from .models import Level, LevelId


def is_catalog_visible(level: Level) -> bool:
    return tuple(map(int, level.release.split("."))) >= MIN_CATALOG_RELEASE


def load_levels(directory: Path = LEVEL_DATA) -> dict[LevelId, Level]:
    levels: dict[LevelId, Level] = {}
    orders: set[int] = set()
    paths = sorted([*directory.glob("*.json"), *directory.glob("*/*.json")])
    for path in paths:
        relative = path.relative_to(directory)
        try:
            level = Level.model_validate_json(path.read_text(encoding="utf-8"))
        except ValidationError as exc:
            raise ValueError(f"Nivel inválido en {relative}: {exc}") from exc
        if path.parent != directory and path.parent.name != level.type:
            raise ValueError(f"El tipo '{level.type}' de {relative} debe coincidir con su carpeta.")
        if path.stem != level.id or level.id in levels or level.order in orders:
            raise ValueError(f"Nombre, identificador u orden en conflicto en {relative}.")
        levels[level.id] = level
        orders.add(level.order)
    if not levels:
        raise ValueError(f"El catálogo está vacío en {directory}.")
    return dict(sorted(levels.items(), key=lambda item: item[1].order))
