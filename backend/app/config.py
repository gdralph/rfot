from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import ConfigDict


class Settings(BaseSettings):
    """Application settings configuration."""
    
    app_name: str = "Resource Forecasting & Opportunity Tracker"
    app_version: str = "1.0.0"
    
    # Database
    database_url: str = "sqlite:///./database.db"
    
    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176"
    ]
    
    # Environment
    environment: str = "development"
    debug: bool = False
    
    # Logging
    log_level: str = "INFO"
    
    model_config = ConfigDict(env_file=".env")


settings = Settings()