import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.v1 import api_router
from app.core.config import settings
from app.core.errors import error_payload, install_error_handlers
from app.services.storage import ensure_upload_dir

logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("mlstem")


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_upload_dir()
    if settings.environment == "production" and settings.secret_key.startswith("insecure"):
        raise RuntimeError("SECRET_KEY must be configured in production")
    logger.info(
        "ML STEM LAB API started: env=%s docs=%s",
        settings.environment,
        settings.docs_enabled,
    )
    yield


app = FastAPI(
    title=f"{settings.app_name} API",
    version="1.0.0",
    description="ML + STEM LAB MVP REST API. Барлық құқықтар backend-те тексеріледі.",
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

install_error_handlers(app)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    duration_ms = (time.perf_counter() - started) * 1000
    # No request bodies, tokens or personal data in access logs.
    logger.info(
        "%s %s -> %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError) -> JSONResponse:
    logger.warning("Database integrity error: %s", exc.orig)
    return JSONResponse(
        status_code=409,
        content=error_payload(
            "Деректер қақтығысы. Қайталап көріңіз немесе әкімшіге хабарласыңыз.",
            "conflict",
        ),
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content=error_payload("Серверде қате орын алды.", "internal_error"),
    )


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "name": settings.app_name,
        "api": settings.api_v1_prefix,
        "docs": "/docs" if settings.docs_enabled else None,
    }
