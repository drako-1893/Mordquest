import json
from functools import cached_property
from hashlib import sha256
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field, model_validator

from ..config import FIRST_RELEASE, RESOURCES, STATIC


DEFAULT_LEVEL_TYPE = "clasico"
LEVEL_SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
LevelId = str
SupportTile = Literal["S", "A", "B", "P", "T", "C"]
catalog = json.loads((STATIC / "data" / "scenery.json").read_text(encoding="utf-8"))
SCENERY_ASSETS = {asset["id"]: asset for group in catalog["assetRooms"].values() for asset in group}
PORTRAIT_OUTFITS = frozenset(path.stem.removeprefix("outfit-")
                            for path in (RESOURCES / "personajes").glob("outfit-*.svg"))


def scenery_symbol(asset: dict) -> str:
    return {"obstacle": "~" if asset.get("waterOnly") else "#",
            "support": asset.get("tile"), "decor": "."}[asset["role"]]


SEATED_TILES = frozenset("SBPT")
RoomId = Annotated[str, Field(pattern=r"^[A-Z]$")]
RoomTypeId = Annotated[str, Field(pattern=LEVEL_SLUG)]
Difficulty = Literal["very_easy", "easy", "medium", "hard", "expert"]
BOARD_SIZES = {"very_easy": 6, "easy": 8, "medium": 10, "hard": 12, "expert": 16}
BLOCKED_TILES = frozenset("#~")
DIRECTION_ORDER = {
    "north": ((0, True),),
    "south": ((0, False),),
    "west": ((1, True),),
    "east": ((1, False),),
    "northeast": ((0, True), (1, False)),
    "northwest": ((0, True), (1, True)),
    "southeast": ((0, False), (1, False)),
    "southwest": ((0, False), (1, True)),
}


class LevelModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LevelSummary(LevelModel):
    id: LevelId = Field(pattern=LEVEL_SLUG)
    type: str = Field(default=DEFAULT_LEVEL_TYPE, pattern=LEVEL_SLUG)
    theme: Literal["archive", "greenhouse", "museum", "arcade", "repair"] = "archive"
    order: int = Field(ge=1)
    release: str = Field(default=FIRST_RELEASE, pattern=r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    difficulty: Difficulty
    size: int = Field(ge=min(BOARD_SIZES.values()), le=max(BOARD_SIZES.values()))
    cover: str = Field(pattern=r"^[a-z0-9-]+\.svg$")

    @computed_field
    @property
    def url(self) -> str:
        return f"/level/{self.id}/"

    @model_validator(mode="after")
    def validate_size(self):
        expected = BOARD_SIZES[self.difficulty]
        if self.size != expected:
            raise ValueError(f"La dificultad {self.difficulty} requiere un tablero de {expected} × {expected}.")
        return self


class RoomType(LevelModel):
    id: RoomTypeId
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Room(LevelModel):
    id: RoomId
    name: str = Field(min_length=1)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    room_type: RoomTypeId | None = None
    floor: Literal[
        "arena", "piedra", "cesped", "madera", "baldosa", "asfalto", "agua", "pista", "parquet", "adoquin",
    ] = "baldosa"
    obstacle_asset: str = "caja"
    rug_asset: Literal["alfombra", "alfombra-cuadros"] = "alfombra"

    @model_validator(mode="after")
    def validate_obstacle(self):
        asset = SCENERY_ASSETS.get(self.obstacle_asset)
        if (not asset or asset["role"] != "obstacle" or asset.get("waterOnly")
                or asset.get("shape", ["#"]) != ["#"] or asset.get("size", [1, 1]) != [1, 1]):
            raise ValueError("obstacle_asset debe ser un obstáculo de una casilla. Usa scenery para los demás.")
        return self


class SceneryPlacement(LevelModel):
    asset: str
    row: int = Field(ge=1)
    column: int = Field(ge=1)
    shape: list[Annotated[str, Field(pattern=r"^[.#]+$")]] | None = Field(default=None, min_length=1)

    def footprint(self):
        asset = SCENERY_ASSETS[self.asset]
        width, height = asset.get("size", [1, 1])
        shape = self.shape or asset.get("shape", ["#" * width] * height)
        return [(self.row - 1 + y, self.column - 1 + x)
                for y, line in enumerate(shape) for x, tile in enumerate(line) if tile == "#"]

    @model_validator(mode="after")
    def validate_asset(self):
        asset = SCENERY_ASSETS.get(self.asset)
        if not asset:
            raise ValueError(f"El recurso {self.asset} no existe en Recursos.")
        if self.shape is not None and (not asset.get("modular") or not self.footprint()):
            raise ValueError("La forma personalizada exige un recurso modular y al menos una casilla ocupada.")
        return self


class ArchitecturalEdge(LevelModel):
    row: int = Field(ge=1)
    column: int = Field(ge=1)
    side: Literal["east", "south"]
    kind: Literal["door", "window", "railing", "opening"]


class RoomBoundary(LevelModel):
    rooms: tuple[RoomId, RoomId]
    kind: Literal["railing", "rim", "line"]


class AxisClue(LevelModel):
    kind: Literal["row", "column"]
    number: int = Field(ge=1)


class ObjectClue(LevelModel):
    kind: Literal["on", "next_to"]
    object: SupportTile | Literal["#", "~"]
    asset: str | None = None

    @model_validator(mode="after")
    def validate_object(self):
        if self.kind == "on" and self.object in BLOCKED_TILES:
            raise ValueError("Una persona no puede colocarse sobre un obstáculo ni sobre el agua.")
        if self.object == "#" and self.asset is None:
            raise ValueError("La pista debe identificar el objeto con asset.")
        if self.asset is not None:
            asset = SCENERY_ASSETS.get(self.asset)
            if not asset or scenery_symbol(asset) != self.object:
                raise ValueError("asset debe identificar un objeto que corresponda al símbolo indicado.")
        return self


class RoomClue(LevelModel):
    kind: Literal["room"]
    room: RoomId


class RoomTypeClue(LevelModel):
    kind: Literal["room_type"]
    room_type: RoomTypeId


class RoomCornerClue(LevelModel):
    kind: Literal["room_corner"]


class PersonClue(LevelModel):
    person: RoomId


class DirectionClue(PersonClue):
    kind: Literal["north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"]


class CompanyClue(PersonClue):
    kind: Literal["same_room", "alone_with"]


class ColumnDistanceClue(PersonClue):
    kind: Literal["column_distance"]
    distance: int = Field(ge=1)


PositionClue = AxisClue | ObjectClue | RoomClue | RoomTypeClue | RoomCornerClue
Clue = Annotated[
    PositionClue | DirectionClue | CompanyClue | ColumnDistanceClue,
    Field(discriminator="kind"),
]


class SeatedRule(LevelModel):
    kind: Literal["seated_exactly"]
    count: int = Field(ge=0)


class RoomCountRule(LevelModel):
    kind: Literal["room_exactly"]
    room: RoomId
    count: int = Field(ge=0)


class EmptyRoomsRule(LevelModel):
    kind: Literal["empty_rooms_exactly"]
    count: int = Field(ge=0)


class RoomAccessRule(LevelModel):
    kind: Literal["room_access"]
    room: RoomId
    group: str = Field(min_length=1)


class AccompaniedRule(LevelModel):
    kind: Literal["everyone_accompanied"]


BoardRule = Annotated[
    SeatedRule | RoomCountRule | EmptyRoomsRule | RoomAccessRule | AccompaniedRule,
    Field(discriminator="kind"),
]


class Participant(LevelModel):
    name: str = Field(min_length=1)
    initial: RoomId
    sex: Literal["male", "female"] | None = None
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    clues: list[Clue] | None = Field(min_length=1)
    group: str | None = Field(default=None, min_length=1)
    outfit: str | None = None

    @model_validator(mode="after")
    def validate_outfit(self):
        if self.outfit is not None and self.outfit not in PORTRAIT_OUTFITS:
            raise ValueError("La vestimenta debe identificar una capa de retrato existente.")
        return self


class PlayableLevel(LevelSummary):
    version: Literal[2]
    rooms: list[Room] = Field(min_length=1)
    room_types: list[RoomType] = Field(default_factory=list)
    room_map: list[str]
    tiles: list[str]
    scenery: list[SceneryPlacement] = Field(default_factory=list)
    architecture: list[ArchitecturalEdge] = Field(default_factory=list)
    boundaries: list[RoomBoundary] = Field(default_factory=list)
    participants: list[Participant]
    rules: list[BoardRule] = Field(default_factory=list)

    @computed_field
    @cached_property
    def board_revision(self) -> str:
        layout = self.model_dump(mode="json", include={
            "version": True, "size": True, "room_map": True, "tiles": True, "rules": True,
            "scenery": True,
            "rooms": {"__all__": {"id", "room_type", "obstacle_asset", "rug_asset"}},
            "participants": {"__all__": {"initial", "group", "clues"}},
        })
        return sha256(json.dumps(layout, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    @model_validator(mode="after")
    def validate_board(self):
        for grid in (self.room_map, self.tiles):
            if len(grid) != self.size or any(len(row) != self.size for row in grid):
                raise ValueError("Cada mapa debe tener las dimensiones indicadas en size.")
        codes = {room.id for room in self.rooms}
        if len(codes) != len(self.rooms) or set("".join(self.room_map)) != codes:
            raise ValueError("El mapa debe utilizar exactamente los identificadores de sala declarados.")
        type_ids = {room_type.id for room_type in self.room_types}
        if len(type_ids) != len(self.room_types):
            raise ValueError("Los identificadores de tipo de sala deben ser únicos.")
        used_type_ids = {room.room_type for room in self.rooms if room.room_type is not None}
        if used_type_ids - type_ids:
            raise ValueError("Una sala hace referencia a un tipo de sala no declarado.")
        if set("".join(self.tiles)) - set(".#~SABPTC"):
            raise ValueError("El mapa de objetos contiene símbolos desconocidos.")
        neighboring_rooms = {
            frozenset((room, self.room_map[yy][xx]))
            for y, row in enumerate(self.room_map)
            for x, room in enumerate(row)
            for yy, xx in ((y + 1, x), (y, x + 1))
            if yy < self.size and xx < self.size and room != self.room_map[yy][xx]
        }
        pairs = [frozenset(boundary.rooms) for boundary in self.boundaries]
        if len(set(pairs)) != len(pairs) or set(pairs) - neighboring_rooms:
            raise ValueError("Cada límite debe separar dos salas vecinas y declararse una sola vez.")
        edges = set()
        for edge in self.architecture:
            y, x = edge.row - 1, edge.column - 1
            next_y, next_x = y + (edge.side == "south"), x + (edge.side == "east")
            if next_y >= self.size or next_x >= self.size or self.room_map[y][x] == self.room_map[next_y][next_x]:
                raise ValueError("Cada elemento de architecture debe separar dos salas del tablero.")
            if (y, x, edge.side) in edges:
                raise ValueError("Dos elementos de architecture ocupan el mismo borde.")
            edges.add((y, x, edge.side))
            if edge.kind in ("door", "opening") and {self.tiles[y][x], self.tiles[next_y][next_x]} & BLOCKED_TILES:
                raise ValueError("Las puertas y los pasos deben unir dos casillas transitables.")
        for y, x in self.scenery_cells:
            if not (0 <= y < self.size and 0 <= x < self.size):
                raise ValueError("Un recurso de scenery sale del tablero.")
        for placement in self.scenery:
            asset = SCENERY_ASSETS[placement.asset]
            cells = placement.footprint()
            expected_tile = scenery_symbol(asset)
            if any(self.tiles[y][x] != expected_tile for y, x in cells):
                raise ValueError(f"El recurso {placement.asset} debe ocupar casillas {expected_tile}.")
            if len({self.room_map[y][x] for y, x in cells}) != 1:
                raise ValueError(f"La huella de {placement.asset} debe estar dentro de una sola zona.")
        if any(tile == "C" and (y, x) not in self.scenery_cells
               for y, row in enumerate(self.tiles) for x, tile in enumerate(row)):
            raise ValueError("Cada casilla de cama debe pertenecer a una cama declarada en scenery.")
        for code in codes:
            cells = {(y, x) for y, row in enumerate(self.room_map) for x, value in enumerate(row) if value == code}
            pending = [cells.pop()]
            while pending:
                y, x = pending.pop()
                for neighbor in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if neighbor in cells:
                        cells.remove(neighbor)
                        pending.append(neighbor)
            if cells:
                raise ValueError(f"La sala {code} debe estar conectada por lados.")
        initials = {person.initial for person in self.participants}
        victims = [person for person in self.participants if person.clues is None]
        if len(self.participants) != self.size or len(victims) != 1 or len(initials) != self.size:
            raise ValueError("Debe haber una persona por fila, iniciales únicas y una sola víctima.")
        for person in self.participants:
            for clue in person.clues or []:
                if isinstance(clue, AxisClue) and clue.number > self.size:
                    raise ValueError("La fila o columna de la pista está fuera del tablero.")
                if isinstance(clue, RoomClue) and clue.room not in codes:
                    raise ValueError("La pista hace referencia a una sala inexistente.")
                if isinstance(clue, RoomTypeClue) and clue.room_type not in used_type_ids:
                    raise ValueError("La pista hace referencia a un tipo sin salas en el plano.")
                if isinstance(clue, PersonClue) and (clue.person == person.initial or clue.person not in initials):
                    raise ValueError("La pista debe hacer referencia a otra persona del nivel.")
                if isinstance(clue, ColumnDistanceClue) and clue.distance >= self.size:
                    raise ValueError("La distancia de columnas indicada supera el tablero.")
        groups = {person.group for person in self.participants if person.group}
        for rule in self.rules:
            if isinstance(rule, (RoomCountRule, RoomAccessRule)) and rule.room not in codes:
                raise ValueError("Una regla hace referencia a una sala inexistente.")
            if isinstance(rule, RoomAccessRule) and rule.group not in groups:
                raise ValueError("La regla de acceso hace referencia a un grupo inexistente.")
            if isinstance(rule, (SeatedRule, RoomCountRule)) and rule.count > self.size:
                raise ValueError("Una cuota supera el número de participantes.")
            if isinstance(rule, EmptyRoomsRule) and rule.count > len(codes):
                raise ValueError("La cuota de salas vacías supera el número de salas.")
        return self

    @cached_property
    def scenery_cells(self) -> dict[tuple[int, int], str]:
        cells = {}
        for placement in self.scenery:
            for cell in placement.footprint():
                if cell in cells:
                    raise ValueError("Dos recursos de scenery se superponen.")
                cells[cell] = placement.asset
        return cells


class Level(PlayableLevel):
    solution: dict[RoomId, int]

    @model_validator(mode="after")
    def validate_solution(self):
        if self.solution.keys() != {person.initial for person in self.participants}:
            raise ValueError("La solución debe ubicar a todas las personas.")
        if any(index < 0 or index >= self.size ** 2 for index in self.solution.values()):
            raise ValueError("La solución contiene una casilla fuera del tablero.")
        positions = {person: divmod(index, self.size) for person, index in self.solution.items()}
        if any(len({position[axis] for position in positions.values()}) != self.size for axis in (0, 1)):
            raise ValueError("La solución debe usar cada fila y columna una sola vez.")
        for person in self.participants:
            y, x = positions[person.initial]
            tile = self.tiles[y][x]
            if tile in BLOCKED_TILES:
                raise ValueError("La solución coloca una persona en una casilla bloqueada.")
            for clue in person.clues or []:
                if isinstance(clue, DirectionClue):
                    first, second = positions[person.initial], positions[clue.person]
                    matches = all(
                        first[axis] < second[axis] if ascending else first[axis] > second[axis]
                        for axis, ascending in DIRECTION_ORDER[clue.kind]
                    )
                elif isinstance(clue, ColumnDistanceClue):
                    matches = abs(x - positions[clue.person][1]) == clue.distance
                elif isinstance(clue, CompanyClue):
                    zone = self.room_map[y][x]
                    yy, xx = positions[clue.person]
                    matches = self.room_map[yy][xx] == zone
                    if clue.kind == "alone_with":
                        matches = matches and sum(self.room_map[r][c] == zone for r, c in positions.values()) == 2
                else:
                    matches = self.matches_position_clue(clue, (y, x))
                if not matches:
                    raise ValueError(f"La solución contradice una pista de {person.name}.")
        if not self.matches_board_rules(positions) or len(self.victim_companions()) != 1:
            raise ValueError("La solución contradice las reglas generales o de la víctima.")
        return self

    def matches_board_rules(self, positions: dict[str, tuple[int, int]]) -> bool:
        occupied = {person: self.room_map[y][x] for person, (y, x) in positions.items()}
        counts = {room.id: sum(zone == room.id for zone in occupied.values()) for room in self.rooms}
        for rule in self.rules:
            if isinstance(rule, SeatedRule):
                matches = sum(self.tiles[y][x] in SEATED_TILES for y, x in positions.values()) == rule.count
            elif isinstance(rule, RoomCountRule):
                matches = counts[rule.room] == rule.count
            elif isinstance(rule, EmptyRoomsRule):
                matches = sum(count == 0 for count in counts.values()) == rule.count
            elif isinstance(rule, RoomAccessRule):
                matches = all(person.group == rule.group for person in self.participants
                              if occupied[person.initial] == rule.room)
            else:
                matches = all(count != 1 for count in counts.values())
            if not matches:
                return False
        return True

    def matches_position_clue(self, clue: PositionClue, cell: tuple[int, int]) -> bool:
        y, x = cell
        if isinstance(clue, AxisClue):
            return clue.number == (y if clue.kind == "row" else x) + 1
        zone = self.room_map[y][x]
        if isinstance(clue, RoomClue):
            return clue.room == zone
        if isinstance(clue, RoomTypeClue):
            return any(room.id == zone and room.room_type == clue.room_type for room in self.rooms)
        if isinstance(clue, RoomCornerClue):
            vertical_edge = (y == 0 or self.room_map[y - 1][x] != zone
                             or y == self.size - 1 or self.room_map[y + 1][x] != zone)
            horizontal_edge = (x == 0 or self.room_map[y][x - 1] != zone
                               or x == self.size - 1 or self.room_map[y][x + 1] != zone)
            return self.tiles[y][x] not in BLOCKED_TILES and vertical_edge and horizontal_edge
        if clue.kind == "on":
            return self.tiles[y][x] == clue.object and (
                clue.asset is None or self.scenery_cells.get((y, x)) == clue.asset
            )
        default_obstacle = (next(room.obstacle_asset for room in self.rooms if room.id == zone)
                            if clue.object == "#" and clue.asset is not None else None)
        return any(
            0 <= yy < self.size and 0 <= xx < self.size
            and self.room_map[yy][xx] == zone and self.tiles[yy][xx] == clue.object
            and (clue.asset is None or self.scenery_cells.get((yy, xx), default_obstacle) == clue.asset)
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))
        )

    def victim_companions(self):
        victim = next(person for person in self.participants if person.clues is None)
        y, x = divmod(self.solution[victim.initial], self.size)
        room = self.room_map[y][x]
        return [
            person for person in self.participants
            if person.initial != victim.initial
            and self.room_map[self.solution[person.initial] // self.size][self.solution[person.initial] % self.size] == room
        ]
