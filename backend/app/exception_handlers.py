"""
Global exception handlers for the Resource Forecasting & Opportunity Tracker API.

This module provides centralized exception handling for the FastAPI application,
ensuring consistent error responses and proper logging.
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from pydantic import ValidationError as PydanticValidationError
import structlog
from typing import Dict, Any
import traceback
import uuid

from app.exceptions import (
    APIError, BusinessLogicError, ValidationError, ResourceNotFoundError,
    ConflictError, DatabaseError, ExternalServiceError, RateLimitError,
    AuthenticationError, AuthorizationError, ErrorMessages
)

logger = structlog.get_logger()


def generate_request_id() -> str:
    """Generate a unique request ID for error tracking."""
    return str(uuid.uuid4())[:8]


async def business_logic_exception_handler(request: Request, exc: BusinessLogicError) -> JSONResponse:
    """Handle business logic exceptions."""
    request_id = generate_request_id()
    
    error_response = APIError(
        error_code=exc.error_code,
        message=exc.detail,
        details=getattr(exc, 'details', None),
        request_id=request_id
    )
    
    logger.info("Business logic error handled",
               request_id=request_id,
               error_code=exc.error_code,
               message=exc.detail,
               path=str(request.url))
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.dict(exclude_none=True)
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI request validation errors."""
    request_id = generate_request_id()
    
    # Format validation errors for better user experience
    formatted_errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        formatted_errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    
    error_response = APIError(
        error_code="VALIDATION_ERROR",
        message="Request validation failed",
        details={
            "validation_errors": formatted_errors,
            "error_count": len(formatted_errors)
        },
        request_id=request_id
    )
    
    logger.warning("Request validation error",
                  request_id=request_id,
                  path=str(request.url),
                  errors=formatted_errors)
    
    return JSONResponse(
        status_code=422,
        content=error_response.dict(exclude_none=True)
    )


async def pydantic_validation_exception_handler(request: Request, exc: PydanticValidationError) -> JSONResponse:
    """Handle Pydantic validation errors."""
    request_id = generate_request_id()
    
    formatted_errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        formatted_errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    
    error_response = APIError(
        error_code="DATA_VALIDATION_ERROR",
        message="Data validation failed",
        details={
            "validation_errors": formatted_errors,
            "error_count": len(formatted_errors)
        },
        request_id=request_id
    )
    
    logger.warning("Pydantic validation error",
                  request_id=request_id,
                  path=str(request.url),
                  errors=formatted_errors)
    
    return JSONResponse(
        status_code=422,
        content=error_response.dict(exclude_none=True)
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle SQLAlchemy database errors."""
    request_id = generate_request_id()
    
    # Don't expose internal database errors to users
    error_response = APIError(
        error_code="DATABASE_ERROR",
        message="A database error occurred",
        request_id=request_id
    )
    
    logger.error("SQLAlchemy database error",
                request_id=request_id,
                path=str(request.url),
                error_type=type(exc).__name__,
                error_message=str(exc))
    
    return JSONResponse(
        status_code=500,
        content=error_response.dict(exclude_none=True)
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all other unhandled exceptions."""
    request_id = generate_request_id()
    
    # Log the full traceback for debugging
    error_traceback = traceback.format_exc()
    
    error_response = APIError(
        error_code="INTERNAL_SERVER_ERROR",
        message=ErrorMessages.INTERNAL_SERVER_ERROR,
        request_id=request_id
    )
    
    logger.error("Unhandled exception",
                request_id=request_id,
                path=str(request.url),
                method=request.method,
                error_type=type(exc).__name__,
                error_message=str(exc),
                traceback=error_traceback)
    
    return JSONResponse(
        status_code=500,
        content=error_response.dict(exclude_none=True)
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle HTTP exceptions from custom exception classes."""
    request_id = generate_request_id()
    
    # Extract error details from custom exceptions
    error_code = getattr(exc, 'error_code', 'HTTP_ERROR')
    details = getattr(exc, 'details', None)
    
    error_response = APIError(
        error_code=error_code,
        message=str(exc.detail) if hasattr(exc, 'detail') else str(exc),
        details=details,
        request_id=request_id
    )
    
    status_code = getattr(exc, 'status_code', 500)
    
    # Log at appropriate level based on status code
    if status_code >= 500:
        log_level = logger.error
    elif status_code >= 400:
        log_level = logger.warning
    else:
        log_level = logger.info
    
    log_level("HTTP exception handled",
             request_id=request_id,
             path=str(request.url),
             status_code=status_code,
             error_code=error_code,
             message=error_response.message)
    
    return JSONResponse(
        status_code=status_code,
        content=error_response.dict(exclude_none=True),
        headers=getattr(exc, 'headers', None)
    )


# Exception handler registry for easy registration with FastAPI
EXCEPTION_HANDLERS = {
    BusinessLogicError: business_logic_exception_handler,
    ValidationError: business_logic_exception_handler,
    ResourceNotFoundError: http_exception_handler,
    ConflictError: business_logic_exception_handler,
    DatabaseError: http_exception_handler,
    ExternalServiceError: http_exception_handler,
    RateLimitError: http_exception_handler,
    AuthenticationError: http_exception_handler,
    AuthorizationError: http_exception_handler,
    RequestValidationError: validation_exception_handler,
    PydanticValidationError: pydantic_validation_exception_handler,
    SQLAlchemyError: sqlalchemy_exception_handler,
    Exception: generic_exception_handler,
}


def register_exception_handlers(app):
    """
    Register all exception handlers with the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    for exception_class, handler in EXCEPTION_HANDLERS.items():
        app.add_exception_handler(exception_class, handler)
    
    logger.info("Exception handlers registered", 
               handler_count=len(EXCEPTION_HANDLERS))


# Middleware for request logging and error context
class ErrorContextMiddleware:
    """Middleware to add error context to requests."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Add request context for error handling
        request_id = generate_request_id()
        
        async def send_with_context(message):
            if message["type"] == "http.response.start":
                # Add request ID to response headers
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)
        
        # Add request ID to structlog context
        with structlog.contextvars.bound_contextvars(request_id=request_id):
            await self.app(scope, receive, send_with_context)