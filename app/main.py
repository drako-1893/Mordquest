from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles

from .accounts.routes import router as accounts_router
from .accounts.store import initialize_database
from .config import WEB
from .levels.catalog import load_levels
from .levels.routes import router as levels_router
from .pages import router as pages_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.levels = load_levels()
    initialize_database()
    yield


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def protect_api(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        if request.method != "GET" and request.headers.get("X-Game-Request") != "1":
            return Response(status_code=403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response
    return await call_next(request)


app.include_router(levels_router)
app.include_router(accounts_router)
app.include_router(pages_router)
app.mount("/static", StaticFiles(directory=WEB / "static"), name="static")
app.mount("/Resources", StaticFiles(directory=WEB / "resources"), name="resources")
