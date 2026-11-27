from contextlib import closing
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..accounts.store import COOKIE, connect, current_user, profile, save_progress
from ..config import GUEST_ONLY
from .catalog import is_catalog_visible
from .models import BOARD_SIZES, LEVEL_SLUG, Level, LevelSummary, PlayableLevel, RoomId
from .walkthrough import SolutionStep


router = APIRouter(prefix="/api/levels")


class Attempt(BaseModel):
    positions: dict[RoomId, int] = Field(max_length=max(BOARD_SIZES.values()))


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
        next_level = next(
            (case for case in request.app.state.levels.values()
             if case.order > level.order and case.type == level.type and is_catalog_visible(case)),
            None,
        )
        result["next_level"] = (
            {"order": next_level.order, "title": next_level.title} if next_level else None
        )
    if not GUEST_ONLY and not misplaced and request.cookies.get(COOKIE):
        with closing(connect()) as db, db:
            username = current_user(db, request)
            if username:
                save_progress(db, username, [level.id], request.app.state.levels)
                result["progress"] = profile(db, username)
    return result
