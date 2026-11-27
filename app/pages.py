from contextlib import closing
from functools import cache
from html import escape
from string import Template
from xml.etree import ElementTree

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from .accounts.store import ADMIN_ROLE, account_role, connect, current_user
from .config import APP_VERSION, GUEST_ONLY, STATIC_PREFIX, WEB
from .levels.catalog import is_catalog_visible


router = APIRouter(include_in_schema=False)
TEMPLATES = WEB / "templates"
SESSION = {
    "session_controls": "shared/session_controls",
    "session_dialogs": "shared/session_dialogs",
}


@cache
def portrait_sprite() -> str:
    layers = []
    for path in sorted((WEB / "resources" / "personajes").glob("*.svg")):
        layer = ElementTree.fromstring(path.read_bytes())
        for element in layer.iter():
            element.tag = element.tag.rsplit("}", 1)[-1]
        artwork = "".join(ElementTree.tostring(element, encoding="unicode")
                          for element in layer if element.tag != "title")
        layers.append(f'<g id="portrait-{escape(path.stem)}">{artwork}</g>')
    return '<svg class="tool-symbols" aria-hidden="true"><defs>' + "".join(layers) + '</defs></svg>'


def render_page(page, title, description, *, components=None, body_class="", styles=(), level_id="") -> HTMLResponse:
    # Template values come from these routes and local fragments, never from a request.
    fragments = {
        slot: (TEMPLATES / "components" / f"{name}.html").read_text(encoding="utf-8").rstrip()
        for slot, name in (components or {}).items()
    }
    view = Template((TEMPLATES / "pages" / f"{page}.html").read_text(encoding="utf-8"))
    layout = Template((TEMPLATES / "layout.html").read_text(encoding="utf-8"))
    body = view.substitute(fragments, app_version=APP_VERSION, level_id=escape(level_id)).rstrip()
    if page == "game":
        body += "\n" + portrait_sprite()
    return HTMLResponse(layout.substitute(
        page=page,
        title=escape(title),
        description=escape(description),
        body_class=escape(body_class),
        guest_only=" data-guest-only" if GUEST_ONLY else "",
        static_prefix=STATIC_PREFIX,
        page_styles="\n  ".join(
            f'<link rel="stylesheet" href="{STATIC_PREFIX}/css/{name}.css">' for name in styles
        ),
        body=body,
    ), headers={"Cache-Control": "no-cache"})


@router.get("/")
@router.get("/niveles.html")
def home():
    return RedirectResponse("/levels")


@router.get("/levels", response_class=HTMLResponse)
def levels_page():
    return render_page(
        "levels", "Niveles", "Selecciona un caso de deducción en Assoku.",
        components={**SESSION, "card": "levels/card"},
        body_class="levels-page",
        styles=("levels",),
    )


@router.get("/index.html")
def legacy_game_page(request: Request, nivel: str | None = None):
    levels = request.app.state.levels
    level = levels.get(nivel) if nivel is not None else next(
        (case for case in levels.values() if is_catalog_visible(case)), None
    )
    if nivel is None and level is None:
        return RedirectResponse("/levels")
    if level is None:
        raise HTTPException(404, "Ese nivel no existe.")
    return RedirectResponse(f"/level/{level.order}/")


@router.get("/level/{number:int}/", response_class=HTMLResponse)
def game_page(number: int, request: Request):
    level = request.app.state.levels_by_number.get(str(number))
    if level is None:
        raise HTTPException(404, "Ese nivel no existe.")
    return render_page(
        "game", level.title, level.description,
        components={
            **SESSION,
            "header": "game/header",
            "board": "game/board",
            "roster": "game/roster",
            "help": "game/help",
            "result": "game/result",
            "walkthrough": "game/walkthrough",
        },
        body_class="game-page",
        styles=("scenery", "game"),
        level_id=level.id,
    )


@router.get("/recursos.html")
def legacy_resources_page():
    return RedirectResponse("/resources")


@router.get("/resources", response_class=HTMLResponse)
def resources_page(request: Request):
    if GUEST_ONLY:
        raise HTTPException(404)
    with closing(connect()) as db:
        if account_role(db, current_user(db, request)) != ADMIN_ROLE:
            raise HTTPException(403, "El catálogo de recursos requiere una cuenta de administrador.",
                                headers={"Cache-Control": "no-store"})
    response = render_page(
        "resources", "Catálogo de recursos", "Explora los recursos gráficos de Assoku.",
        styles=("scenery", "resources"),
    )
    response.headers["Cache-Control"] = "no-store"
    return response
