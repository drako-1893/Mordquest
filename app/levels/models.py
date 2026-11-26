from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


DEFAULT_LEVEL_TYPE = "clasico"
LEVEL_SLUG = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
LevelId = str
Seat = Literal["S", "A", "B", "P"]
ObstacleAsset = Literal[
    "arcade", "arcade-carreras", "arcade-laberinto", "atril", "barril", "basurero",
    "caja", "caja-herramientas", "farol", "globo", "lavadero", "maceta",
    "maceta-helecho", "maceta-suculenta", "neumaticos", "pedestal-busto", "perchero",
]
RoomId = Annotated[str, Field(pattern=r"^[A-Z]$")]
Difficulty = Literal["easy", "medium", "hard", "expert"]
BOARD_SIZES = {"easy": (8,), "medium": (10, 12), "hard": (16,), "expert": (20,)}
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
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    difficulty: Difficulty
    size: int = Field(ge=8, le=20)
    cover: str = Field(pattern=r"^[a-z0-9-]+\.svg$")

    @model_validator(mode="after")
    def validate_size(self):
        expected = BOARD_SIZES[self.difficulty]
        if self.size not in expected:
            sizes = " o ".join(f"{size} × {size}" for size in expected)
            raise ValueError(f"La dificultad {self.difficulty} requiere un tablero de {sizes}.")
        return self


class Room(LevelModel):
    id: RoomId
    name: str = Field(min_length=1)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    floor: Literal["arena", "piedra", "cesped", "madera", "baldosa", "asfalto"] = "baldosa"
    obstacle_asset: ObstacleAsset = "caja"
    rug_asset: Literal["alfombra", "alfombra-ondas", "alfombra-cuadros"] = "alfombra"


class AxisClue(LevelModel):
    kind: Literal["row", "column"]
    number: int = Field(ge=1)


class ObjectClue(LevelModel):
    kind: Literal["on", "next_to"]
    object: Seat | Literal["#"]
    asset: ObstacleAsset | None = None

    @model_validator(mode="after")
    def validate_support(self):
        if self.kind == "on" and self.object == "#":
            raise ValueError("Una persona no puede colocarse sobre un obstáculo.")
        if self.object == "#" and self.asset is None:
            raise ValueError("La pista debe identificar el objeto con asset.")
        if self.object != "#" and self.asset is not None:
            raise ValueError("asset solo se usa en pistas con object igual a #.")
        return self


class RoomClue(LevelModel):
    kind: Literal["room"]
    room: RoomId


class PersonClue(LevelModel):
    person: RoomId


class DirectionClue(PersonClue):
    kind: Literal["north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"]


class CompanyClue(PersonClue):
    kind: Literal["same_room", "alone_with"]


class ColumnDistanceClue(PersonClue):
    kind: Literal["column_distance"]
    distance: int = Field(ge=1)


Clue = Annotated[
    AxisClue | ObjectClue | RoomClue | DirectionClue | CompanyClue | ColumnDistanceClue,
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
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    clues: list[Clue] | None = Field(min_length=1)
    group: str | None = Field(default=None, min_length=1)


class PlayableLevel(LevelSummary):
    version: Literal[2]
    rooms: list[Room] = Field(min_length=1)
    room_map: list[str]
    tiles: list[str]
    participants: list[Participant]
    rules: list[BoardRule] = Field(default_factory=list)

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
            if tile == "#":
                raise ValueError("La solución coloca una persona sobre un obstáculo.")
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
                matches = sum(self.tiles[y][x] in "SBP" for y, x in positions.values()) == rule.count
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

    def matches_position_clue(self, clue: AxisClue | RoomClue | ObjectClue, cell: tuple[int, int]) -> bool:
        y, x = cell
        if isinstance(clue, AxisClue):
            return clue.number == (y if clue.kind == "row" else x) + 1
        zone = self.room_map[y][x]
        if isinstance(clue, RoomClue):
            return clue.room == zone
        if clue.kind == "on":
            return self.tiles[y][x] == clue.object
        if clue.asset is not None and next(room.obstacle_asset for room in self.rooms if room.id == zone) != clue.asset:
            return False
        return any(
            0 <= yy < self.size and 0 <= xx < self.size
            and self.room_map[yy][xx] == zone and self.tiles[yy][xx] == clue.object
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
