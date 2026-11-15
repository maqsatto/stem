from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """Uniform API error: {"detail": "...", "code": "..."}."""

    def __init__(self, status_code: int, code: str, detail: str):
        self.status_code = status_code
        self.code = code
        self.detail = detail
        super().__init__(detail)


def error_payload(detail: str, code: str) -> dict:
    return {"detail": detail, "code": code}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.detail, exc.code),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        code = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            429: "rate_limited",
        }.get(exc.status_code, "http_error")
        return JSONResponse(status_code=exc.status_code, content=error_payload(detail, code))

    @app.exception_handler(RequestValidationError)
    async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        location = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        message = first.get("msg", "Validation failed")
        detail = f"{location}: {message}" if location else message
        cleaned_errors = []
        for error in exc.errors():
            item = {key: value for key, value in error.items() if key != "ctx"}
            if isinstance(error.get("ctx"), dict):
                item["ctx"] = {key: str(value) for key, value in error["ctx"].items()}
            cleaned_errors.append(item)
        return JSONResponse(
            status_code=422,
            content={**error_payload(detail, "validation_error"), "errors": cleaned_errors},
        )
