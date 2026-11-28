from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles

from .accounts.routes import router as accounts_router
from .accounts.store import initialize_database
from .config import APP_VERSION, GUEST_ONLY, RESOURCES, STATIC, STATIC_PREFIX
from .levels.catalog import load_levels
from .levels.routes import router as levels_router
from .levels.walkthrough import build_walkthrough
from .pages import router as pages_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.levels = load_levels()
    app.state.levels_by_number = {str(level.order): level for level in app.state.levels.values()}
    app.state.walkthroughs = {
        level.id: build_walkthrough(level) for level in app.state.levels.values()
    }
    if not GUEST_ONLY:
        initialize_database()
    yield


app = FastAPI(title="Assoku", version=APP_VERSION, lifespan=lifespan)


@app.middleware("http")
async def protect_api(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        if request.method != "GET" and request.headers.get("X-Game-Request") != "1":
            return Response(status_code=403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response
    response = await call_next(request)
    if request.url.path.startswith(f"{STATIC_PREFIX}/") and response.status_code in (200, 206, 304):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


@app.get("/api/heartbeat", status_code=204, include_in_schema=False)
async def heartbeat():
    return Response(status_code=204)


app.include_router(levels_router)
if not GUEST_ONLY:
    app.include_router(accounts_router)
app.include_router(pages_router)
app.mount(f"{STATIC_PREFIX}/resources", StaticFiles(directory=RESOURCES), name="versioned-resources")
app.mount(STATIC_PREFIX, StaticFiles(directory=STATIC), name="versioned-static")
app.mount("/static/resources", StaticFiles(directory=RESOURCES), name="static-resources")
app.mount("/static", StaticFiles(directory=STATIC), name="static")
app.mount("/Resources", StaticFiles(directory=RESOURCES), name="resources")
