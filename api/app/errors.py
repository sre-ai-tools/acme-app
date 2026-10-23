"""One error shape for every response: {"error": {"code": ..., "message": ...}}."""

import logging

import psycopg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

log = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def not_found(what: str) -> ApiError:
    return ApiError(404, "not_found", f"{what} not found")


def _body(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return _body(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0]
        field = ".".join(str(p) for p in first["loc"] if p != "body")
        return _body(422, "validation_error", f"{field}: {first['msg']}" if field else first["msg"])

    @app.exception_handler(HTTPException)
    def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return _body(exc.status_code, code, str(exc.detail))

    # Last line of defence: the models mirror the table constraints, so this is rare.
    @app.exception_handler(psycopg.errors.CheckViolation)
    def check_violation(_: Request, exc: psycopg.errors.CheckViolation) -> JSONResponse:
        name = exc.diag.constraint_name or "a constraint"
        return _body(422, "constraint_violation", f"Violates {name}")

    @app.exception_handler(Exception)
    def unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error")
        return _body(500, "internal_error", "Internal server error")
