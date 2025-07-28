from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import ConfigDict


class Settings(BaseSettings):
    """
    Application settings configuration.
    
    For production deployment, set these environment variables:
    - RFOT_API_KEY: Secure API key for authentication
    - CORS_ORIGINS: Comma-separated list of allowed origins (e.g., "https://app.dxc.com,https://rfot.dxc.com")
    - ENVIRONMENT: Set to "production"
    - AUTH_ENABLED: Set to "true" (default)
    - LOG_LEVEL: Set to "WARNING" or "ERROR" for production
    """
    
    app_name: str = "Resource Forecasting & Opportunity Tracker"
    app_version: str = "1.0.0"
    
    # Database
    database_url: str = "sqlite:///./database.db"
    
    # CORS - restrictive for production, permissive for development
    cors_origins: list[str] = [
        "http://localhost:3000",    # React dev server
        "http://localhost:5173",    # Vite dev server (primary)
        "http://localhost:5174",    # Vite dev server (secondary)
    ]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["GET", "POST", "PUT", "DELETE", "PATCH"]
    cors_allow_headers: list[str] = ["Authorization", "Content-Type", "X-API-Key"]
    
    # Environment
    environment: str = "development"
    debug: bool = False
    
    # Authentication
    api_key: Optional[str] = None  # Set via RFOT_API_KEY environment variable
    auth_enabled: bool = False     # Disabled for development - set to True for production
    
    # Logging
    log_level: str = "INFO"
    mask_financial_data: bool = True  # Mask financial data in logs for production
    enable_audit_logging: bool = True  # Enable audit trail logging
    
    model_config = ConfigDict(env_file=".env")


settings = Settings()