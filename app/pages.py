from html import escape
from string import Template

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse

from .config import WEB


router = APIRouter(include_in_schema=False)
TEMPLATES = WEB / "templates"
SESSION = {
    "session_controls": "shared/session_controls",
    "session_dialogs": "shared/session_dialogs",
}


def render_page(page, title, description, *, components=None, body_class="", styles=()) -> HTMLResponse:
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
        page_styles="\n  ".join(
            f'<link rel="stylesheet" href="/static/css/{name}.css">' for name in styles
        ),
        body=view.substitute(fragments).rstrip(),
    ))


@router.get("/")
def home():
    return RedirectResponse("/niveles.html")


@router.get("/niveles.html", response_class=HTMLResponse)
def levels_page():
    return render_page(
        "levels", "Niveles", "Selecciona un caso de deducción en Archivo Nocturno.",
        components={**SESSION, "card": "levels/card", "detail": "levels/detail"},
        body_class="levels-page",
        styles=("levels",),
    )


@router.get("/index.html", response_class=HTMLResponse)
def game_page():
    return render_page(
        "game", "Jugar", "Resuelve un caso de deducción en Archivo Nocturno.",
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
    )


@router.get("/recursos.html", response_class=HTMLResponse)
def resources_page():
    return render_page(
        "resources", "Catálogo de recursos", "Explora los recursos gráficos de Archivo Nocturno.",
        styles=("scenery", "resources"),
    )
