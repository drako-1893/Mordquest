import re
from contextlib import closing
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..accounts.store import COOKIE, connect, current_user, profile, save_progress
from ..config import GUEST_ONLY
from .catalog import is_catalog_visible, next_catalog_level
from .models import BOARD_SIZES, LEVEL_SLUG, Level, LevelSummary, PlayableLevel, RoomId
from .walkthrough import SolutionStep


router = APIRouter(prefix="/api/levels")


class Attempt(BaseModel):
    positions: dict[RoomId, int] = Field(max_length=max(BOARD_SIZES.values()))


class OpeningHint(BaseModel):
    person: RoomId
    deduction: str


@router.get("")
def list_levels(
    request: Request,
    type: Annotated[str | None, Query(pattern=LEVEL_SLUG)] = None,
) -> list[LevelSummary]:
    return [
        LevelSummary(**level.model_dump(include=set(LevelSummary.model_fields)))
        for level in request.app.state.levels.values()
        if is_catalog_visible(level) and (type is None or level.type == type)
    ]


def find_level(level_id: str, request: Request) -> Level:
    level = request.app.state.levels.get(level_id) or request.app.state.levels_by_number.get(level_id)
    if level is None:
        raise HTTPException(404, "Ese nivel no existe.")
    return level


@router.get("/{level_id}", response_model=PlayableLevel)
def get_level(level_id: str, request: Request) -> Level:
    return find_level(level_id, request)


@router.get("/{level_id}/walkthrough")
def get_walkthrough(level_id: str, request: Request) -> list[SolutionStep]:
    level = find_level(level_id, request)
    return request.app.state.walkthroughs[level.id]


@router.get("/{level_id}/hint")
def get_opening_hint(level_id: str, request: Request) -> OpeningHint:
    level = find_level(level_id, request)
    steps = request.app.state.walkthroughs[level.id]
    step = next((step for step in steps if step.person), steps[0])
    names = {person.initial: person.name for person in level.participants}
    person = step.person or next(person.initial for person in level.participants if person.clues)
    deduction = re.sub(r"\[\[([A-Z])\]\]", lambda reference: names[reference[1]], step.text)
    return OpeningHint(person=person, deduction=deduction)


@router.post("/{level_id}/check")
def check_level(level_id: str, attempt: Attempt, request: Request):
    level = find_level(level_id, request)
    if (attempt.positions.keys() != level.solution.keys()
            or any(not 0 <= index < level.size ** 2 for index in attempt.positions.values())):
        raise HTTPException(422, "Coloca a todas las personas antes de comprobar el caso.")
    misplaced = [
        person.initial for person in level.participants
        if attempt.positions[person.initial] != level.solution[person.initial]
    ]
    result = {
        "misplaced": misplaced,
        "culprit": None if misplaced else level.victim_companions()[0].initial,
    }
    if not misplaced:
        next_level = next_catalog_level(level, request.app.state.levels.values())
        result["next_level"] = (
            {"order": next_level.order, "title": next_level.title, "url": next_level.url} if next_level else None
        )
    if not GUEST_ONLY and not misplaced and request.cookies.get(COOKIE):
        with closing(connect()) as db, db:
            username = current_user(db, request)
            if username:
                save_progress(db, username, [level.id], request.app.state.levels)
                result["progress"] = profile(db, username)
    return result
