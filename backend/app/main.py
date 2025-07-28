from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import structlog

from app.config import settings
from app.api import opportunities, forecasts, config as config_api, imports, resources, reports
from app.middleware import APIKeyAuthMiddleware
from app.exception_handlers import register_exception_handlers, ErrorContextMiddleware

# Configure structured logging with production-ready processors
def configure_logging():
    """Configure structured logging based on environment."""
    processors = [
        structlog.stdlib.filter_by_level,  # Filter by log level
        structlog.contextvars.merge_contextvars,  # Add context variables
        structlog.stdlib.add_logger_name,  # Add logger name
        structlog.stdlib.add_log_level,    # Add log level
        structlog.stdlib.PositionalArgumentsFormatter(),  # Handle positional args
        structlog.processors.TimeStamper(fmt="ISO"),  # Add timestamps
        structlog.processors.StackInfoRenderer(),  # Add stack info if available
        structlog.processors.format_exc_info,  # Format exception info
    ]
    
    # Add environment-specific processors
    if settings.environment == "production":
        # Use JSON formatting for production (better for log aggregation)
        processors.append(structlog.processors.JSONRenderer())
    else:
        # Use console rendering for development
        processors.append(structlog.dev.ConsoleRenderer())
    
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

configure_logging()

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Application starting", app=settings.app_name, version=settings.app_version)
    yield
    # Shutdown
    logger.info("Application shutting down")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Resource Forecasting & Opportunity Tracker - A DXC Technology internal tool",
    lifespan=lifespan,
)

# Register exception handlers
register_exception_handlers(app)

# Add error context middleware
app.add_middleware(ErrorContextMiddleware)

# Authentication middleware (applied first, before CORS)
if settings.auth_enabled:
    app.add_middleware(APIKeyAuthMiddleware, api_key=settings.api_key)
    logger.info("Authentication middleware enabled")
else:
    logger.warning("Authentication middleware disabled - not suitable for production")

# CORS configuration - restricted for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

logger.info("CORS configured", 
           origins=settings.cors_origins,
           methods=settings.cors_allow_methods,
           headers=settings.cors_allow_headers)

# Include API routers
app.include_router(opportunities.router, prefix="/api/opportunities", tags=["opportunities"])
app.include_router(forecasts.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(config_api.router, prefix="/api/config", tags=["config"])
app.include_router(imports.router, prefix="/api/import", tags=["import"])
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(reports.router, prefix="/api", tags=["reports"])

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name, "version": settings.app_version}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.debug)