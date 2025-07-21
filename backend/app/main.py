from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import structlog

from app.config import settings
from app.api import opportunities, forecasts, config as config_api, imports, resources

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Resource Forecasting & Opportunity Tracker - A DXC Technology internal tool",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(opportunities.router, prefix="/api/opportunities", tags=["opportunities"])
app.include_router(forecasts.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(config_api.router, prefix="/api/config", tags=["config"])
app.include_router(imports.router, prefix="/api/import", tags=["import"])
app.include_router(resources.router, prefix="/api", tags=["resources"])

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name, "version": settings.app_version}

@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("Application starting", app=settings.app_name, version=settings.app_version)

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Application shutting down")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.debug)