"""
Centralized exception handling for the Resource Forecasting & Opportunity Tracker API.

This module provides custom exception classes and error handling utilities
to ensure consistent error responses across the application.
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from pydantic import BaseModel
import structlog

logger = structlog.get_logger()


class APIError(BaseModel):
    """Standard API error response model."""
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


class BusinessLogicError(HTTPException):
    """Custom exception for business logic violations."""
    
    def __init__(
        self,
        message: str,
        error_code: str = "BUSINESS_LOGIC_ERROR",
        details: Optional[Dict[str, Any]] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ):
        self.error_code = error_code
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)
        
        # Log the business logic error
        logger.warning("Business logic error", 
                      error_code=error_code,
                      message=message,
                      details=details)


class ValidationError(BusinessLogicError):
    """Exception for data validation failures."""
    
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        validation_details = details or {}
        if field:
            validation_details["field"] = field
        if value is not None:
            validation_details["invalid_value"] = str(value)
            
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            details=validation_details,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )


class ResourceNotFoundError(HTTPException):
    """Exception for when a requested resource is not found."""
    
    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_code = "RESOURCE_NOT_FOUND"
        self.details = details or {}
        message = f"{resource_type} with ID '{resource_id}' not found"
        
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=message
        )
        
        logger.info("Resource not found", 
                   resource_type=resource_type,
                   resource_id=resource_id,
                   details=details)


class ConflictError(BusinessLogicError):
    """Exception for resource conflicts (e.g., duplicate entries)."""
    
    def __init__(
        self,
        message: str,
        resource_type: Optional[str] = None,
        conflicting_field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        conflict_details = details or {}
        if resource_type:
            conflict_details["resource_type"] = resource_type
        if conflicting_field:
            conflict_details["conflicting_field"] = conflicting_field
            
        super().__init__(
            message=message,
            error_code="CONFLICT_ERROR",
            details=conflict_details,
            status_code=status.HTTP_409_CONFLICT
        )


class DatabaseError(HTTPException):
    """Exception for database-related errors."""
    
    def __init__(
        self,
        message: str = "Database operation failed",
        operation: Optional[str] = None,
        table: Optional[str] = None,
        original_error: Optional[Exception] = None
    ):
        self.error_code = "DATABASE_ERROR"
        self.operation = operation
        self.table = table
        self.original_error = original_error
        
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message
        )
        
        # Log the database error with context
        logger.error("Database error",
                    message=message,
                    operation=operation,
                    table=table,
                    original_error=str(original_error) if original_error else None)


class ExternalServiceError(HTTPException):
    """Exception for external service failures."""
    
    def __init__(
        self,
        service_name: str,
        message: str,
        status_code: int = status.HTTP_503_SERVICE_UNAVAILABLE,
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_code = "EXTERNAL_SERVICE_ERROR"
        self.service_name = service_name
        self.details = details or {}
        
        super().__init__(status_code=status_code, detail=message)
        
        logger.error("External service error",
                    service_name=service_name,
                    message=message,
                    details=details)


class RateLimitError(HTTPException):
    """Exception for rate limiting."""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None
    ):
        self.error_code = "RATE_LIMIT_EXCEEDED"
        self.retry_after = retry_after
        
        headers = {}
        if retry_after:
            headers["Retry-After"] = str(retry_after)
            
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message,
            headers=headers
        )
        
        logger.warning("Rate limit exceeded", 
                      message=message,
                      retry_after=retry_after)


class AuthenticationError(HTTPException):
    """Exception for authentication failures."""
    
    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_code = "AUTHENTICATION_ERROR"
        self.details = details or {}
        
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message,
            headers={"WWW-Authenticate": "Bearer"}
        )
        
        logger.warning("Authentication error",
                      message=message,
                      details=details)


class AuthorizationError(HTTPException):
    """Exception for authorization failures."""
    
    def __init__(
        self,
        message: str = "Insufficient permissions",
        required_permission: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.error_code = "AUTHORIZATION_ERROR"
        self.required_permission = required_permission
        self.details = details or {}
        
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )
        
        logger.warning("Authorization error",
                      message=message,
                      required_permission=required_permission,
                      details=details)


# Error handling utilities
def handle_database_error(e: Exception, operation: str, table: Optional[str] = None) -> DatabaseError:
    """
    Convert database exceptions to standardized DatabaseError.
    
    Args:
        e: The original exception
        operation: The database operation that failed
        table: The table involved (optional)
        
    Returns:
        DatabaseError: Standardized database error
    """
    error_message = f"Database {operation} failed"
    if table:
        error_message += f" for table '{table}'"
        
    return DatabaseError(
        message=error_message,
        operation=operation,
        table=table,
        original_error=e
    )


def handle_validation_error(field: str, value: Any, expected: str) -> ValidationError:
    """
    Create a standardized validation error.
    
    Args:
        field: The field that failed validation
        value: The invalid value
        expected: Description of expected value
        
    Returns:
        ValidationError: Standardized validation error
    """
    message = f"Invalid value for field '{field}': expected {expected}, got '{value}'"
    return ValidationError(
        message=message,
        field=field,
        value=value,
        details={"expected": expected}
    )


def safe_operation(operation_name: str, table: Optional[str] = None):
    """
    Decorator to safely execute database operations with error handling.
    
    Args:
        operation_name: Name of the operation for logging
        table: Table name for context (optional)
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                raise handle_database_error(e, operation_name, table)
        return wrapper
    return decorator


# Common error messages
class ErrorMessages:
    """Centralized error message constants."""
    
    # Generic errors
    INTERNAL_SERVER_ERROR = "An internal server error occurred"
    INVALID_REQUEST = "Invalid request format"
    MISSING_REQUIRED_FIELD = "Required field is missing"
    
    # Authentication/Authorization
    INVALID_API_KEY = "Invalid API key"
    MISSING_API_KEY = "API key is required"
    INSUFFICIENT_PERMISSIONS = "Insufficient permissions for this operation"
    
    # Opportunity errors
    OPPORTUNITY_NOT_FOUND = "Opportunity not found"
    DUPLICATE_OPPORTUNITY_ID = "Opportunity ID already exists"
    INVALID_OPPORTUNITY_STAGE = "Invalid sales stage"
    INVALID_TCV_VALUE = "TCV value must be a valid number"
    
    # File upload errors
    FILE_TOO_LARGE = "File size exceeds maximum limit"
    INVALID_FILE_TYPE = "Invalid file type"
    FILE_UPLOAD_FAILED = "File upload failed"
    CORRUPTED_FILE = "File appears to be corrupted"
    
    # Import errors
    IMPORT_TASK_NOT_FOUND = "Import task not found"
    IMPORT_IN_PROGRESS = "Import already in progress"
    INVALID_EXCEL_FORMAT = "Excel file format is invalid"
    
    # Resource timeline errors
    TIMELINE_NOT_FOUND = "Resource timeline not found"
    INVALID_SERVICE_LINE = "Invalid service line"
    INVALID_STAGE_NAME = "Invalid stage name"
    TIMELINE_GENERATION_FAILED = "Timeline generation failed"