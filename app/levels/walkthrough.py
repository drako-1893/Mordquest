from collections.abc import Iterator
from string import ascii_uppercase

from pydantic import BaseModel, Field

from .models import (
    BLOCKED_TILES,
    DIRECTION_ORDER,
    SEATED_TILES,
    AccompaniedRule,
    ColumnDistanceClue,
    CompanyClue,
    DirectionClue,
    EmptyRoomsRule,
    Level,
    PersonClue,
    RoomAccessRule,
    RoomCountRule,
    RoomTypeClue,
    SeatedRule,
)


Cell = tuple[int, int]
Domains = dict[str, set[Cell]]
DIRECTION_LABELS = {
    "north": "norte", "south": "sur", "west": "oeste", "east": "este",
    "northeast": "noreste", "northwest": "noroeste",
    "southeast": "sureste", "southwest": "suroeste",
}


class SolutionStep(BaseModel):
    title: str
    text: str
    details: list[str] = Field(default_factory=list)
    person: str | None = None
    positions: dict[str, int] = Field(default_factory=dict)


class Contradiction(Exception):
    pass


def coordinates(cell: Cell) -> str:
    return f"{ascii_uppercase[cell[1]]}{cell[0] + 1}"


class Walkthrough:
    def __init__(self, level: Level):
        self.level = level
        self.people = {p.initial: p for p in sorted(level.participants, key=lambda p: p.name)}
        self.victim = next(p.initial for p in self.people.values() if p.clues is None)
        self.zones = {room.id: room.name for room in level.rooms}
        self.free = {(y, x) for y, row in enumerate(level.tiles) for x, tile in enumerate(row) if tile not in BLOCKED_TILES}
        self.room_cells = {
            zone: {(y, x) for y, x in self.free if level.room_map[y][x] == zone} for zone in self.zones
        }
        self.seats = {(y, x) for y, x in self.free if level.tiles[y][x] in SEATED_TILES}
        self.room_rules = [rule for rule in level.rules if isinstance(rule, (RoomCountRule, EmptyRoomsRule, AccompaniedRule))]
        self.relatives = [
            (initial, clue) for initial, p in self.people.items()
            for clue in p.clues or () if isinstance(clue, PersonClue)
        ]

    def name(self, initial: str) -> str:
        return f"[[{initial}]]"

    def confirmed(self, domains: Domains) -> dict[str, int]:
        positions = {}
        for person, cells in domains.items():
            if len(cells) == 1:
                (y, x), = cells
                positions[person] = y * self.level.size + x
        return positions

    def restrict(self, domains: Domains, initial: str, allowed: set[Cell], reason: str) -> str | None:
        old = domains[initial]
        new = old & allowed
        prefix = f"{reason} " if reason else ""
        if not new:
            raise Contradiction(f"{prefix}{self.name(initial)} se queda sin casillas posibles.")
        if len(new) == len(old):
            return None
        domains[initial] = new
        name = self.name(initial)
        if len(new) == 1:
            return f"{prefix}{name} solo puede estar en {coordinates(next(iter(new)))}."
        if len(new) <= 3:
            options = " / ".join(map(coordinates, sorted(new)))
            return f"{prefix}Para {name} quedan {options}."
        return f"{prefix}{name} conserva {len(new)} casillas posibles."

    def occupancy(self, domains: Domains, cells: set[Cell]) -> tuple[list[str], list[str]]:
        forced = [person for person, options in domains.items() if options <= cells]
        possible = [person for person, options in domains.items() if options & cells]
        return forced, possible

    def apply_pair(self, domains: Domains, first: str, clue: CompanyClue | ColumnDistanceClue) -> Iterator[str]:
        second = clue.person
        if isinstance(clue, ColumnDistanceClue):
            distance = {1: "una columna", 2: "dos columnas"}.get(clue.distance, f"{clue.distance} columnas")
            reason = f"{self.name(first)} está a {distance} de {self.name(second)}."
            options = []
            for person, other in ((first, second), (second, first)):
                columns = {x + offset for _, x in domains[other] for offset in (-clue.distance, clue.distance)}
                options.append((person, {cell for cell in domains[person] if cell[1] in columns}))
            yield from self.narrow_together(domains, iter(options), reason)
            return

        alone = clue.kind == "alone_with"
        relationship = "a solas con" if alone else "en la misma sala que"
        reason = f"{self.name(first)} está {relationship} {self.name(second)}."
        shared = set()
        for cells in self.room_cells.values():
            if not (domains[first] & cells and domains[second] & cells):
                continue
            if alone and any(options <= cells for person, options in domains.items() if person not in (first, second)):
                continue
            shared.update(cells)
        yield from self.narrow_together(domains, iter(((first, shared), (second, shared))), reason)
        if alone:
            for cells in self.room_cells.values():
                if domains[first] <= cells:
                    yield from self.apply_count(domains, cells, {2}, reason)
                    break

    def narrow_together(self, domains: Domains, options: Iterator[tuple[str, set[Cell]]], reason: str) -> Iterator[str]:
        changed = False
        placements = []
        for person, allowed in options:
            result = self.restrict(domains, person, allowed, reason="")
            if result:
                changed = True
                if len(domains[person]) <= 3:
                    placements.append(result)
        if changed:
            yield " ".join([reason, *placements])

    def apply_count(self, domains: Domains, cells: set[Cell], allowed: set[int], reason: str) -> Iterator[str]:
        forced, possible = self.occupancy(domains, cells)
        counts = allowed.intersection(range(len(forced), len(possible) + 1))
        if not counts:
            raise Contradiction(f"{reason} El recuento solo puede estar entre {len(forced)} y {len(possible)}.")
        if min(counts) == len(possible) and len(forced) < len(possible):
            people = ", ".join(map(self.name, possible))
            yield from self.narrow_together(domains, ((p, cells) for p in possible),
                                            f"{reason} Solo {people} pueden cubrir ese cupo y deben hacerlo.")
        if max(counts) == len(forced) and len(forced) < len(possible):
            if forced:
                people = ", ".join(map(self.name, forced))
                reason = f"{reason} Cupo cubierto por {people}. Descarta esas casillas para los demás."
            yield from self.narrow_together(domains, ((p, domains[p] - cells) for p in possible if p not in forced),
                                            reason)

    def apply_room_rules(self, domains: Domains) -> Iterator[str]:
        if not self.room_rules:
            return
        counts = set(range(len(domains) + 1))
        allowed = {zone: counts.copy() for zone in self.zones}
        reasons: dict[str, str] = {}
        empty_target = None
        for rule in self.room_rules:
            if isinstance(rule, RoomCountRule):
                allowed[rule.room] &= {rule.count}
                reasons[rule.room] = f"La cuota de {self.zones[rule.room]} es de {rule.count} personas."
            elif isinstance(rule, AccompaniedRule):
                for zone, values in allowed.items():
                    values.discard(1)
                    reasons.setdefault(zone, f"En {self.zones[zone]} nadie puede estar a solas.")
            else:
                if empty_target is not None and empty_target != rule.count:
                    raise Contradiction("Las cuotas de salas vacías se contradicen.")
                empty_target = rule.count

        for zone, cells in self.room_cells.items():
            if zone in reasons:
                yield from self.apply_count(domains, cells, allowed[zone], reasons[zone])
        if empty_target is None:
            return
        options = {}
        for zone, cells in self.room_cells.items():
            forced, possible = self.occupancy(domains, cells)
            options[zone] = allowed[zone].intersection(range(len(forced), len(possible) + 1))
        empty = {zone for zone, values in options.items() if values == {0}}
        can_be_empty = {zone for zone, values in options.items() if 0 in values}
        if not len(empty) <= empty_target <= len(can_be_empty):
            raise Contradiction(f"Deben quedar {empty_target} salas vacías, con un rango posible de {len(empty)} a {len(can_be_empty)}.")
        if len(empty) == empty_target:
            for zone in self.zones:
                if zone in can_be_empty - empty:
                    reason = f"Ya se completó la cuota de salas vacías. {self.zones[zone]} debe tener ocupantes."
                    yield from self.apply_count(domains, self.room_cells[zone], options[zone] - {0}, reason)
        elif len(can_be_empty) == empty_target:
            names = ", ".join(self.zones[zone] for zone in self.zones if zone in can_be_empty)
            for zone in self.zones:
                if zone in can_be_empty - empty:
                    reason = f"Deben quedar {empty_target} salas vacías y solo pueden ser {names}. Descarta {self.zones[zone]}."
                    yield from self.apply_count(domains, self.room_cells[zone], {0}, reason)

    def propagate(self, domains: Domains) -> Iterator[str]:
        while True:
            before = sum(map(len, domains.values()))
            for axis, label in enumerate(("fila", "columna")):
                owners = {}
                for initial, cells in domains.items():
                    indices = {cell[axis] for cell in cells}
                    if len(indices) == 1:
                        index, = indices
                        if index in owners:
                            marker = ascii_uppercase[index] if axis else index + 1
                            raise Contradiction(f"{self.name(owners[index])} y {self.name(initial)} necesitarían la misma {label} {marker}.")
                        owners[index] = initial
                for index, owner in owners.items():
                    marker = ascii_uppercase[index] if axis else index + 1
                    reason = f"Reserva la {label} {marker} para {self.name(owner)} y descártala para los demás."
                    options = (
                        (initial, {cell for cell in cells if cell[axis] != index})
                        for initial, cells in domains.items() if initial != owner
                    )
                    yield from self.narrow_together(domains, options, reason)

                axis_domains = {p: {cell[axis] for cell in cells} for p, cells in domains.items()}
                for index in range(self.level.size):
                    candidates = [p for p, indices in axis_domains.items() if index in indices]
                    marker = ascii_uppercase[index] if axis else index + 1
                    if not candidates:
                        raise Contradiction(f"La {label} {marker} se queda sin ocupante.")
                    if len(candidates) == 1:
                        person, = candidates
                        reason = f"La {label} {marker} necesita una ficha y solo {self.name(person)} puede ocuparla."
                        allowed = {cell for cell in domains[person] if cell[axis] == index}
                        step = self.restrict(domains, person, allowed, reason)
                        if step:
                            yield step
                pairs = {}
                for person, cells in domains.items():
                    indices = frozenset(cell[axis] for cell in cells)
                    if len(indices) == 2:
                        pairs.setdefault(indices, []).append(person)
                for indices, people in pairs.items():
                    if len(people) < 2:
                        continue
                    markers = [ascii_uppercase[i] if axis else str(i + 1) for i in sorted(indices)]
                    names = " y ".join(map(self.name, people))
                    reason = f"{names} solo tienen las {label}s {' y '.join(markers)}."
                    if len(people) > 2:
                        raise Contradiction(reason)
                    reason += " Resérvalas para esas dos fichas."
                    options = (
                        (p, {cell for cell in cells if cell[axis] not in indices})
                        for p, cells in domains.items() if p not in people
                    )
                    yield from self.narrow_together(domains, options, reason)

            for first, clue in self.relatives:
                if not isinstance(clue, DirectionClue):
                    yield from self.apply_pair(domains, first, clue)
                    continue
                second = clue.person
                direction = DIRECTION_LABELS[clue.kind]
                reason = f"{self.name(first)} debe estar al {direction} de {self.name(second)}."
                for axis, ascending in DIRECTION_ORDER[clue.kind]:
                    low, high = (first, second) if ascending else (second, first)
                    limit_low = min(cell[axis] for cell in domains[low])
                    limit_high = max(cell[axis] for cell in domains[high])
                    options = iter((
                        (low, {c for c in domains[low] if c[axis] < limit_high}),
                        (high, {c for c in domains[high] if c[axis] > limit_low}),
                    ))
                    yield from self.narrow_together(domains, options, reason)

            for rule in self.level.rules:
                if isinstance(rule, SeatedRule):
                    yield from self.apply_count(domains, self.seats, {rule.count},
                                                f"El recuento exige {rule.count} personas sentadas.")
            yield from self.apply_room_rules(domains)

            for zone, cells in self.room_cells.items():
                if not domains[self.victim] & cells:
                    continue
                others = [d for p, d in domains.items() if p != self.victim]
                forced_in = sum(d <= cells for d in others)
                if forced_in > 1 or not any(d & cells for d in others):
                    reason = f"En {self.zones[zone]}, {self.name(self.victim)} no podría quedar con exactamente una persona."
                    step = self.restrict(domains, self.victim, domains[self.victim] - cells, reason)
                    if step:
                        yield step
            if sum(map(len, domains.values())) == before:
                return

    def build(self) -> list[SolutionStep]:
        domains = {p: self.free.copy() for p in self.people}
        steps = []
        for initial, person in self.people.items():
            direct = [c for c in person.clues or () if not isinstance(c, PersonClue)]
            if not direct:
                continue
            possible = {cell for cell in self.free if all(self.level.matches_position_clue(c, cell) for c in direct)}
            reason = self.restrict(domains, initial, possible, "")
            if reason:
                details = []
                for clue in direct:
                    if isinstance(clue, RoomTypeClue):
                        rooms = [f"«{room.name}»" for room in self.level.rooms if room.room_type == clue.room_type]
                        alternatives = f"{', '.join(rooms[:-1])} o {rooms[-1]}" if len(rooms) > 1 else rooms[0]
                        details.append(f"La pista de tipo admite {alternatives}.")
                steps.append(SolutionStep(title=f"Las pistas de {self.name(initial)}", text=reason,
                                          person=initial, details=details, positions=self.confirmed(domains)))

        for rule in self.level.rules:
            if isinstance(rule, RoomAccessRule):
                room = self.zones[rule.room]
                members = [self.name(initial) for initial, person in self.people.items() if person.group == rule.group]
                options = ((p, domains[p] - self.room_cells[rule.room])
                           for p, person in self.people.items() if person.group != rule.group)
                reason = f"Solo el grupo «{rule.group}» ({', '.join(members)}) puede estar en {room}. Descarta esa sala para los demás."
                updates = list(self.narrow_together(domains, options, reason))
                if updates:
                    steps.append(SolutionStep(title=f"Acceso a {room}", text=updates[0],
                                              positions=self.confirmed(domains)))

        deductions = []
        for deduction in self.propagate(domains):
            deductions.append(deduction)
            if len(deductions) == 5:
                steps.append(SolutionStep(title="Cruza las pistas", text=deductions[0],
                                          details=deductions[1:], positions=self.confirmed(domains)))
                deductions.clear()
        if deductions:
            steps.append(SolutionStep(title="Cruza las pistas", text=deductions[0],
                                      details=deductions[1:], positions=self.confirmed(domains)))
        unresolved = [self.people[initial].name for initial, cells in domains.items() if len(cells) != 1]
        if unresolved:
            raise ValueError(f"{self.level.id}: faltan deducciones directas para ubicar a {', '.join(unresolved)}.")

        result = {p: next(iter(cells)) for p, cells in domains.items()}
        if {p: y * self.level.size + x for p, (y, x) in result.items()} != self.level.solution:
            raise ValueError(f"{self.level.id}: el recorrido deduce una solución distinta de la guardada.")
        y, x = result[self.victim]
        zone = self.level.room_map[y][x]
        companion, = (p for p, (r, c) in result.items() if p != self.victim and self.level.room_map[r][c] == zone)
        steps.append(SolutionStep(
            title="Resuelve el caso",
            text=f"{self.name(self.victim)} estaba en {self.zones[zone]} ({coordinates((y, x))}), "
                 f"a solas con {self.name(companion)}. "
                 f"Por eso {self.name(companion)} es la persona culpable.",
            positions=self.confirmed(domains),
        ))
        return steps


def build_walkthrough(level: Level) -> list[SolutionStep]:
    try:
        return Walkthrough(level).build()
    except Contradiction as error:
        raise ValueError(f"{level.id}: {error}") from error


if __name__ == "__main__":
    from .catalog import load_levels

    for case in load_levels().values():
        print(f"{case.id}: solución única verificada, {len(build_walkthrough(case))} tarjetas.")
