from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


DATA = Path(__file__).with_name("levels")
LevelId = str
Seat = Literal["S", "A", "B", "P"]
RoomId = Annotated[str, Field(pattern=r"^[A-Z]$")]
Difficulty = Literal["easy", "medium", "hard", "expert"]
BOARD_SIZES = {"easy": 8, "medium": 12, "hard": 16, "expert": 20}


class LevelModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LevelSummary(LevelModel):
    id: LevelId = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    order: int = Field(ge=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    difficulty: Difficulty
    size: int = Field(ge=8, le=20)
    cover: str = Field(pattern=r"^[a-z0-9-]+\.svg$")

    @model_validator(mode="after")
    def validate_size(self):
        expected = BOARD_SIZES[self.difficulty]
        if self.size != expected:
            raise ValueError(f"La dificultad {self.difficulty} requiere un tablero de {expected} × {expected}.")
        return self


class Room(LevelModel):
    id: RoomId
    name: str = Field(min_length=1)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    floor: Literal["arena", "piedra", "cesped", "madera", "baldosa", "asfalto"] = "baldosa"
    obstacle_asset: Literal[
        "arcade", "arcade-carreras", "arcade-laberinto", "atril", "barril", "basurero",
        "caja", "caja-herramientas", "farol", "globo", "lavadero", "maceta",
        "maceta-helecho", "maceta-suculenta", "neumaticos", "pedestal-busto", "perchero",
    ] = "caja"
    rug_asset: Literal["alfombra", "alfombra-ondas", "alfombra-cuadros"] = "alfombra"


class AxisClue(LevelModel):
    kind: Literal["row", "column"]
    number: int = Field(ge=1)


class ObjectClue(LevelModel):
    kind: Literal["on", "next_to"]
    object: Seat | Literal["#"]

    @model_validator(mode="after")
    def validate_support(self):
        if self.kind == "on" and self.object == "#":
            raise ValueError("Una persona no puede colocarse sobre un obstáculo.")
        return self


class RoomClue(LevelModel):
    kind: Literal["room"]
    room: RoomId


class DirectionClue(LevelModel):
    kind: Literal["north", "south", "east", "west"]
    person: RoomId


Clue = Annotated[AxisClue | ObjectClue | RoomClue | DirectionClue, Field(discriminator="kind")]


class BoardRule(LevelModel):
    kind: Literal["seated_exactly"]
    count: int = Field(ge=0)


class Participant(LevelModel):
    name: str = Field(min_length=1)
    initial: RoomId
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    clues: list[Clue] | None = Field(min_length=1)


class PlayableLevel(LevelSummary):
    version: Literal[2]
    rooms: list[Room] = Field(min_length=1)
    room_map: list[str]
    tiles: list[str]
    participants: list[Participant]
    rules: list[BoardRule] = Field(default_factory=list, max_length=1)

    @model_validator(mode="after")
    def validate_board(self):
        for grid in (self.room_map, self.tiles):
            if len(grid) != self.size or any(len(row) != self.size for row in grid):
                raise ValueError("Cada mapa debe tener las dimensiones indicadas en size.")
        codes = {room.id for room in self.rooms}
        if len(codes) != len(self.rooms) or set("".join(self.room_map)) != codes:
            raise ValueError("El mapa debe utilizar exactamente los identificadores de sala declarados.")
        if set("".join(self.tiles)) - set(".#SABP"):
            raise ValueError("El mapa de objetos contiene símbolos desconocidos.")
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
                if isinstance(clue, DirectionClue) and (clue.person == person.initial or clue.person not in initials):
                    raise ValueError("La pista debe hacer referencia a otra persona del nivel.")
        if any(rule.count > self.size for rule in self.rules):
            raise ValueError("La regla de personas sentadas supera el número de participantes.")
        return self


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
        seated = 0
        for person in self.participants:
            y, x = positions[person.initial]
            tile = self.tiles[y][x]
            if tile == "#":
                raise ValueError("La solución coloca una persona sobre un obstáculo.")
            seated += tile in "SBP"
            for clue in person.clues or []:
                if isinstance(clue, AxisClue):
                    matches = clue.number == (y if clue.kind == "row" else x) + 1
                elif isinstance(clue, RoomClue):
                    matches = clue.room == self.room_map[y][x]
                elif isinstance(clue, DirectionClue):
                    yy, xx = positions[clue.person]
                    matches = {"north": y < yy, "south": y > yy, "east": x > xx, "west": x < xx}[clue.kind]
                elif clue.kind == "on":
                    matches = tile == clue.object
                else:
                    matches = any(
                        0 <= yy < self.size and 0 <= xx < self.size and self.tiles[yy][xx] == clue.object
                        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))
                    )
                if not matches:
                    raise ValueError(f"La solución contradice una pista de {person.name}.")
        if any(seated != rule.count for rule in self.rules) or len(self.victim_companions()) != 1:
            raise ValueError("La solución contradice las reglas generales o de la víctima.")
        return self

    def victim_companions(self):
        victim = next(person for person in self.participants if person.clues is None)
        y, x = divmod(self.solution[victim.initial], self.size)
        room = self.room_map[y][x]
        return [
            person for person in self.participants
            if person.initial != victim.initial
            and self.room_map[self.solution[person.initial] // self.size][self.solution[person.initial] % self.size] == room
        ]


def load_levels() -> dict[LevelId, Level]:
    levels = {}
    orders = set()
    for path in sorted(DATA.glob("*.json")):
        level = Level.model_validate_json(path.read_text(encoding="utf-8"))
        if path.stem != level.id or level.id in levels or level.order in orders:
            raise ValueError(f"Nombre, identificador u orden en conflicto en {path.name}.")
        levels[level.id] = level
        orders.add(level.order)
    if not levels:
        raise ValueError("El catálogo está vacío.")
    return dict(sorted(levels.items(), key=lambda item: item[1].order))
