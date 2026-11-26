from html import escape
from string import Template

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from .config import APP_VERSION, STATIC_PREFIX, WEB


router = APIRouter(include_in_schema=False)
TEMPLATES = WEB / "templates"
SESSION = {
    "session_controls": "shared/session_controls",
    "session_dialogs": "shared/session_dialogs",
}


def render_page(page, title, description, *, components=None, body_class="", styles=(), level_id="") -> HTMLResponse:
    # Template values come from these routes and local fragments, never from a request.
    fragments = {
        slot: (TEMPLATES / "components" / f"{name}.html").read_text(encoding="utf-8").rstrip()
        for slot, name in (components or {}).items()
    }
    view = Template((TEMPLATES / "pages" / f"{page}.html").read_text(encoding="utf-8"))
    layout = Template((TEMPLATES / "layout.html").read_text(encoding="utf-8"))
    return HTMLResponse(layout.substitute(
        page=page,
        title=escape(title),
        description=escape(description),
        body_class=escape(body_class),
        static_prefix=STATIC_PREFIX,
        page_styles="\n  ".join(
            f'<link rel="stylesheet" href="{STATIC_PREFIX}/css/{name}.css">' for name in styles
        ),
        body=view.substitute(fragments, app_version=APP_VERSION, level_id=escape(level_id)).rstrip(),
    ))


@router.get("/")
@router.get("/niveles.html")
def home():
    return RedirectResponse("/levels")


@router.get("/levels", response_class=HTMLResponse)
def levels_page():
    return render_page(
        "levels", "Niveles", "Selecciona un caso de deducción en Archivo Nocturno.",
        components={**SESSION, "card": "levels/card"},
        body_class="levels-page",
        styles=("levels",),
    )


@router.get("/index.html")
def legacy_game_page(request: Request, nivel: str | None = None):
    levels = request.app.state.levels
    level = levels.get(nivel) if nivel is not None else next(iter(levels.values()))
    if level is None:
        raise HTTPException(404, "Ese nivel no existe.")
    return RedirectResponse(f"/level/{level.order}/")


@router.get("/level/{number:int}/", response_class=HTMLResponse)
def game_page(number: int, request: Request):
    level = next((case for case in request.app.state.levels.values() if case.order == number), None)
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
        styles=("scenery", "game"),
        level_id=level.id,
    )


@router.get("/recursos.html")
def legacy_resources_page():
    return RedirectResponse("/resources")


@router.get("/resources", response_class=HTMLResponse)
def resources_page():
    return render_page(
        "resources", "Catálogo de recursos", "Explora los recursos gráficos de Archivo Nocturno.",
        styles=("scenery", "resources"),
    )
