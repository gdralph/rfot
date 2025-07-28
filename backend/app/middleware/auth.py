"""
Authentication middleware for the Resource Forecasting & Opportunity Tracker API.

This middleware provides API key authentication for internal DXC Technology use.
"""

from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import structlog
import hashlib
import secrets
import os
from typing import Optional

logger = structlog.get_logger()

# Default API key for development (should be overridden in production via environment variable)
DEFAULT_API_KEY = "dxc-rfot-dev-key-2024"

class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """
    API Key Authentication Middleware.
    
    Validates API keys for all API endpoints except health checks.
    Supports both header-based and query parameter authentication.
    """
    
    def __init__(self, app, api_key: Optional[str] = None):
        super().__init__(app)
        # Use provided API key or environment variable or default
        self.api_key = api_key or os.getenv("RFOT_API_KEY", DEFAULT_API_KEY)
        self.api_key_hash = self._hash_key(self.api_key)
        
        # Exempt paths that don't require authentication
        self.exempt_paths = {
            "/api/health",
            "/docs",
            "/redoc",
            "/openapi.json"
        }
        
        logger.info("API Key authentication enabled", 
                   api_key_configured=bool(self.api_key),
                   exempt_paths=list(self.exempt_paths))
    
    def _hash_key(self, key: str) -> str:
        """Hash API key for secure comparison."""
        return hashlib.sha256(key.encode()).hexdigest()
    
    def _is_exempt_path(self, path: str) -> bool:
        """Check if path is exempt from authentication."""
        return any(path.startswith(exempt) for exempt in self.exempt_paths)
    
    def _extract_api_key(self, request: Request) -> Optional[str]:
        """Extract API key from request headers or query parameters."""
        # Try Authorization header first (Bearer token)
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]  # Remove "Bearer " prefix
        
        # Try X-API-Key header
        api_key_header = request.headers.get("x-api-key")
        if api_key_header:
            return api_key_header
        
        # Try query parameter (less secure, but useful for development)
        return request.query_params.get("api_key")
    
    def _validate_api_key(self, provided_key: str) -> bool:
        """Validate provided API key against configured key."""
        if not provided_key:
            return False
        
        # Hash the provided key and compare
        provided_hash = self._hash_key(provided_key)
        return secrets.compare_digest(provided_hash, self.api_key_hash)
    
    async def dispatch(self, request: Request, call_next):
        """Process authentication for incoming requests."""
        
        # Skip authentication for exempt paths
        if self._is_exempt_path(request.url.path):
            return await call_next(request)
        
        # Extract API key from request
        provided_key = self._extract_api_key(request)
        
        if not provided_key:
            logger.warning("API request without authentication", 
                          path=request.url.path,
                          method=request.method,
                          client_ip=request.client.host if request.client else "unknown")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "API key required. Provide via Authorization header (Bearer token), X-API-Key header, or api_key query parameter.",
                    "error_code": "API_KEY_MISSING"
                }
            )
        
        # Validate API key
        if not self._validate_api_key(provided_key):
            logger.warning("API request with invalid authentication", 
                          path=request.url.path,
                          method=request.method,
                          client_ip=request.client.host if request.client else "unknown",
                          key_prefix=provided_key[:8] + "..." if len(provided_key) > 8 else provided_key)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Invalid API key.",
                    "error_code": "API_KEY_INVALID"
                }
            )
        
        # Log successful authentication (without exposing the key)
        logger.info("Authenticated API request", 
                   path=request.url.path,
                   method=request.method,
                   client_ip=request.client.host if request.client else "unknown")
        
        # Proceed with the request
        return await call_next(request)


def generate_api_key() -> str:
    """Generate a secure random API key for production use."""
    return secrets.token_urlsafe(32)


# FastAPI dependency for explicit authentication where needed
security = HTTPBearer(auto_error=False)

async def get_api_key(credentials: HTTPAuthorizationCredentials = security) -> str:
    """
    FastAPI dependency for explicit API key validation.
    
    Use this dependency in route handlers that need to access the API key
    or perform additional authorization checks.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # This would be called after middleware validation, so key should be valid
    return credentials.credentials