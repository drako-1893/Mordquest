from collections.abc import Iterator

from pydantic import BaseModel, Field

from .models import DIRECTION_ORDER, DirectionClue, Level


Cell = tuple[int, int]
Domains = dict[str, set[Cell]]


class SolutionStep(BaseModel):
    title: str
    text: str
    details: list[str] = Field(default_factory=list)
    person: str | None = None
    proof: bool = False


class Contradiction(Exception):
    pass


def coordinates(cell: Cell) -> str:
    return f"fila {cell[0] + 1}, columna {cell[1] + 1}"


def copy_domains(domains: Domains) -> Domains:
    return {person: cells.copy() for person, cells in domains.items()}


class Walkthrough:
    def __init__(self, level: Level):
        self.level = level
        self.people = {p.initial: p for p in sorted(level.participants, key=lambda p: p.name)}
        self.victim = next(p.initial for p in self.people.values() if p.clues is None)
        self.zones = {room.id: room.name for room in level.rooms}
        self.free = {(y, x) for y, row in enumerate(level.tiles) for x, tile in enumerate(row) if tile != "#"}
        self.room_cells = {
            zone: {(y, x) for y, x in self.free if level.room_map[y][x] == zone} for zone in self.zones
        }
        self.seats = {(y, x) for y, x in self.free if level.tiles[y][x] in "SBP"}
        self.target = level.rules[0].count if level.rules else None
        self.relatives = [
            (initial, clue) for initial, p in self.people.items()
            for clue in p.clues or () if isinstance(clue, DirectionClue)
        ]
        self.search_nodes = 0

    def name(self, initial: str) -> str:
        return self.people[initial].name

    def restrict(self, domains: Domains, initial: str, allowed: set[Cell], reason: str) -> str | None:
        old = domains[initial]
        new = old & allowed
        if not new:
            raise Contradiction(f"{reason} {self.name(initial)} se queda sin casillas posibles.")
        if len(new) == len(old):
            return None
        domains[initial] = new
        name = self.name(initial)
        if len(new) == 1 and initial != self.victim:
            return f"{reason} {name} solo puede estar en {coordinates(next(iter(new)))}."
        return f"{reason} {name} pasa de {len(old)} a {len(new)} opciones."

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
                            raise Contradiction(f"{self.name(owners[index])} y {self.name(initial)} necesitarían la misma {label} {index + 1}.")
                        owners[index] = initial
                for index, owner in owners.items():
                    for initial, cells in domains.items():
                        if initial == owner or all(cell[axis] != index for cell in cells):
                            continue
                        reason = f"{self.name(owner)} solo puede ocupar la {label} {index + 1}."
                        step = self.restrict(domains, initial, {c for c in cells if c[axis] != index}, reason)
                        if step:
                            yield step

            for first, clue in self.relatives:
                axis, ascending = DIRECTION_ORDER[clue.kind]
                second = clue.person
                low, high = (first, second) if ascending else (second, first)
                limit_low = min(cell[axis] for cell in domains[low])
                limit_high = max(cell[axis] for cell in domains[high])
                direction = {"north": "norte", "south": "sur", "west": "oeste", "east": "este"}[clue.kind]
                reason = f"{self.name(first)} debe estar al {direction} de {self.name(second)}."
                for initial, allowed in (
                    (low, {c for c in domains[low] if c[axis] < limit_high}),
                    (high, {c for c in domains[high] if c[axis] > limit_low}),
                ):
                    step = self.restrict(domains, initial, allowed, reason)
                    if step:
                        yield step

            if self.target is not None:
                forced = {p for p, cells in domains.items() if cells <= self.seats}
                possible = {p for p, cells in domains.items() if cells & self.seats}
                if not len(forced) <= self.target <= len(possible):
                    raise Contradiction(
                        f"Se requieren {self.target} personas sentadas, pero estas opciones solo permiten entre {len(forced)} y {len(possible)}."
                    )
                if len(forced) == self.target:
                    reason = f"Las {self.target} plazas del recuento ya están comprometidas."
                    for initial in domains:
                        if initial not in forced:
                            step = self.restrict(domains, initial, domains[initial] - self.seats, reason)
                            if step:
                                yield step
                if len(possible) == self.target:
                    reason = f"Exactamente {self.target} personas todavía pueden sentarse y todas deben hacerlo."
                    for initial in domains:
                        if initial in possible:
                            step = self.restrict(domains, initial, self.seats, reason)
                            if step:
                                yield step

            for zone, cells in self.room_cells.items():
                if not domains[self.victim] & cells:
                    continue
                others = [d for p, d in domains.items() if p != self.victim]
                forced_in = sum(d <= cells for d in others)
                if forced_in > 1 or not any(d & cells for d in others):
                    reason = f"En {self.zones[zone]}, la víctima no podría quedar con exactamente una persona."
                    step = self.restrict(domains, self.victim, domains[self.victim] - cells, reason)
                    if step:
                        yield step
            if sum(map(len, domains.values())) == before:
                return

    def choose(self, domains: Domains) -> str:
        return min((p for p in domains if len(domains[p]) > 1), key=lambda p: (p == self.victim, len(domains[p])))

    def search(self, domains: Domains, depth: int = 0) -> tuple[bool, list[str]]:
        self.search_nodes += 1
        if self.search_nodes > 12_000:
            raise ValueError(f"{self.level.id}: la verificación excedió 12 000 ramas.")
        prefix = "↳ " * depth
        proof = []
        try:
            for reason in self.propagate(domains):
                proof.append(prefix + reason)
        except Contradiction as error:
            proof.append(prefix + str(error))
            return False, proof
        if all(len(cells) == 1 for cells in domains.values()):
            return True, []
        person = self.choose(domains)
        proof.append(f"{prefix}Se prueban las {len(domains[person])} opciones restantes de {self.name(person)}.")
        for cell in sorted(domains[person]):
            trial = copy_domains(domains)
            trial[person] = {cell}
            valid, branch = self.search(trial, depth + 1)
            if valid:
                return True, []
            proof.append(f"{prefix}Si {self.name(person)} estuviera en {coordinates(cell)}:")
            proof.extend(branch)
        return False, proof

    def build(self) -> list[SolutionStep]:
        domains = {p: self.free.copy() for p in self.people}
        steps = [SolutionStep(
            title="Prepara el tablero",
            text="Descarta las casillas bloqueadas. Cada fila y cada columna debe contener una persona. La víctima se coloca al final y comparte su zona con una sola persona.",
        )]
        for initial, person in self.people.items():
            direct = [c for c in person.clues or () if not isinstance(c, DirectionClue)]
            if not direct:
                continue
            possible = {cell for cell in self.free if all(self.level.matches_position_clue(c, cell) for c in direct)}
            reason = self.restrict(domains, initial, possible, "Combina las pistas directas de su ficha.")
            if reason:
                steps.append(SolutionStep(title=f"Las pistas de {person.name}", text=reason, person=initial))

        while True:
            deductions = list(self.propagate(domains))
            for offset in range(0, len(deductions), 6):
                steps.append(SolutionStep(
                    title="Cruza las pistas y las reglas",
                    text="Aplica estas deducciones en orden para reducir las opciones del plano.",
                    details=deductions[offset:offset + 6],
                ))
            if all(len(cells) == 1 for cells in domains.values()):
                break
            person = self.choose(domains)
            valid_cells = []
            for cell in sorted(domains[person]):
                trial = copy_domains(domains)
                trial[person] = {cell}
                valid, proof = self.search(trial)
                if valid:
                    valid_cells.append(cell)
                    if len(valid_cells) > 1:
                        raise ValueError(f"{self.level.id}: tiene más de una solución.")
                    continue
                where = coordinates(cell)
                steps.append(SolutionStep(
                    title=f"Descarta una opción de {self.name(person)}",
                    text=f"Si {self.name(person)} estuviera en {where}, las pistas y las reglas producirían una contradicción.",
                    details=proof,
                    proof=True,
                ))
            if not valid_cells:
                raise ValueError(f"{self.level.id}: las pistas no tienen solución.")
            remaining, = valid_cells
            domains[person] = {remaining}
            if person != self.victim:
                steps.append(SolutionStep(
                    title=f"Ubica a {self.name(person)}",
                    text=f"Tras descartar las demás opciones, queda {coordinates(remaining)}.",
                ))

        result = {p: next(iter(cells)) for p, cells in domains.items()}
        if {p: y * self.level.size + x for p, (y, x) in result.items()} != self.level.solution:
            raise ValueError(f"{self.level.id}: el recorrido deduce una solución distinta de la guardada.")
        y, x = result[self.victim]
        zone = self.level.room_map[y][x]
        companion, = (p for p, (r, c) in result.items() if p != self.victim and self.level.room_map[r][c] == zone)
        steps.append(SolutionStep(
            title="Ubica a la víctima y resuelve el caso",
            text=f"Solo queda {coordinates((y, x))} para {self.name(self.victim)}, en {self.zones[zone]}. "
                 f"{self.name(companion)} es la única otra persona en esa zona.",
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
