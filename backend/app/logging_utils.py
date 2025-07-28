"""
Logging utilities for the Resource Forecasting & Opportunity Tracker.

This module provides utilities for safe logging that prevents sensitive data exposure.
"""

import re
from typing import Any, Dict, List, Union
import structlog

# Patterns for detecting sensitive data
SENSITIVE_PATTERNS = {
    'api_key': re.compile(r'(?i)(api_key|apikey|api-key)'),
    'password': re.compile(r'(?i)(password|passwd|pwd)'),
    'token': re.compile(r'(?i)(token|bearer|authorization)'),
    'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    'phone': re.compile(r'(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}'),
    'credit_card': re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'),
    'ssn': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
}

# Sensitive field names (case insensitive)
SENSITIVE_FIELDS = {
    'password', 'passwd', 'pwd', 'api_key', 'apikey', 'api-key', 'token', 
    'bearer', 'authorization', 'secret', 'private_key', 'privatekey',
    'client_secret', 'clientsecret', 'session_key', 'sessionkey',
    'refresh_token', 'refreshtoken', 'access_token', 'accesstoken'
}

# Financial data fields that should be logged carefully
FINANCIAL_FIELDS = {
    'tcv_millions', 'revenue', 'margin', 'cost', 'price', 'salary',
    'offering_tcv', 'offering_abr', 'offering_iyr', 'offering_iqr'
}

REDACTED_VALUE = "[REDACTED]"
MASKED_VALUE = "***MASKED***"


def sanitize_value(key: str, value: Any, mask_financial: bool = False) -> Any:
    """
    Sanitize a single value for safe logging.
    
    Args:
        key: The field name/key
        value: The value to sanitize
        mask_financial: Whether to mask financial data
        
    Returns:
        Sanitized value safe for logging
    """
    if value is None:
        return None
    
    key_lower = key.lower()
    
    # Always redact sensitive authentication/security fields
    if any(sensitive in key_lower for sensitive in SENSITIVE_FIELDS):
        return REDACTED_VALUE
    
    # Mask financial data if requested (typically for production)
    if mask_financial and any(financial in key_lower for financial in FINANCIAL_FIELDS):
        if isinstance(value, (int, float)):
            return f"[FINANCIAL:{type(value).__name__}]"
        return MASKED_VALUE
    
    # Check string values for sensitive patterns
    if isinstance(value, str):
        # Check for sensitive patterns in the value
        for pattern_name, pattern in SENSITIVE_PATTERNS.items():
            if pattern.search(value):
                return f"[{pattern_name.upper()}_DETECTED]"
        
        # Truncate very long strings to prevent log flooding
        if len(value) > 1000:
            return value[:1000] + "...[TRUNCATED]"
    
    return value


def sanitize_dict(data: Dict[str, Any], mask_financial: bool = False) -> Dict[str, Any]:
    """
    Recursively sanitize a dictionary for safe logging.
    
    Args:
        data: Dictionary to sanitize
        mask_financial: Whether to mask financial data
        
    Returns:
        Sanitized dictionary safe for logging
    """
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    for key, value in data.items():
        if isinstance(value, dict):
            sanitized[key] = sanitize_dict(value, mask_financial)
        elif isinstance(value, list):
            sanitized[key] = sanitize_list(value, mask_financial)
        else:
            sanitized[key] = sanitize_value(key, value, mask_financial)
    
    return sanitized


def sanitize_list(data: List[Any], mask_financial: bool = False) -> List[Any]:
    """
    Sanitize a list for safe logging.
    
    Args:
        data: List to sanitize
        mask_financial: Whether to mask financial data
        
    Returns:
        Sanitized list safe for logging
    """
    if not isinstance(data, list):
        return data
    
    # Limit list size in logs to prevent flooding
    if len(data) > 100:
        sanitized = [sanitize_item(item, mask_financial) for item in data[:100]]
        sanitized.append(f"...[{len(data) - 100} more items truncated]")
        return sanitized
    
    return [sanitize_item(item, mask_financial) for item in data]


def sanitize_item(item: Any, mask_financial: bool = False) -> Any:
    """
    Sanitize a single item (can be any type).
    
    Args:
        item: Item to sanitize
        mask_financial: Whether to mask financial data
        
    Returns:
        Sanitized item safe for logging
    """
    if isinstance(item, dict):
        return sanitize_dict(item, mask_financial)
    elif isinstance(item, list):
        return sanitize_list(item, mask_financial)
    elif isinstance(item, str) and len(item) > 500:
        return item[:500] + "...[TRUNCATED]"
    else:
        return item


def get_safe_logger(name: str = None) -> structlog.stdlib.BoundLogger:
    """
    Get a logger configured for safe logging.
    
    Args:
        name: Logger name (optional)
        
    Returns:
        Configured logger instance
    """
    return structlog.get_logger(name)


def log_safely(
    logger: structlog.stdlib.BoundLogger,
    level: str,
    message: str,
    mask_financial: bool = True,
    **kwargs
) -> None:
    """
    Log a message with automatic sanitization of sensitive data.
    
    Args:
        logger: Logger instance
        level: Log level ('info', 'warning', 'error', 'debug')
        message: Log message
        mask_financial: Whether to mask financial data
        **kwargs: Additional fields to log
    """
    # Sanitize all keyword arguments
    safe_kwargs = sanitize_dict(kwargs, mask_financial)
    
    # Get the logging method
    log_method = getattr(logger, level.lower(), logger.info)
    
    # Log the sanitized data
    log_method(message, **safe_kwargs)


def log_user_action(
    logger: structlog.stdlib.BoundLogger,
    action: str,
    user_id: str = None,
    resource_type: str = None,
    resource_id: str = None,
    **context
) -> None:
    """
    Log user actions for auditing purposes.
    
    Args:
        logger: Logger instance
        action: Action performed
        user_id: User identifier (optional)
        resource_type: Type of resource affected
        resource_id: ID of resource affected
        **context: Additional context
    """
    audit_data = {
        'action': action,
        'user_id': user_id,
        'resource_type': resource_type,
        'resource_id': resource_id,
        'audit': True  # Flag for audit log processing
    }
    
    # Add sanitized context
    audit_data.update(sanitize_dict(context, mask_financial=True))
    
    logger.info("User action", **audit_data)


def log_database_operation(
    logger: structlog.stdlib.BoundLogger,
    operation: str,
    table: str,
    record_id: str = None,
    affected_rows: int = None,
    duration_ms: float = None,
    **context
) -> None:
    """
    Log database operations for monitoring.
    
    Args:
        logger: Logger instance
        operation: Database operation (SELECT, INSERT, UPDATE, DELETE)
        table: Table name
        record_id: Record ID if applicable
        affected_rows: Number of rows affected
        duration_ms: Operation duration in milliseconds
        **context: Additional context
    """
    db_data = {
        'db_operation': operation,
        'table': table,
        'record_id': record_id,
        'affected_rows': affected_rows,
        'duration_ms': duration_ms,
        'database': True  # Flag for database log processing
    }
    
    # Add sanitized context (mask financial data in production)
    db_data.update(sanitize_dict(context, mask_financial=True))
    
    # Use appropriate log level based on duration
    if duration_ms and duration_ms > 5000:  # Slow query > 5 seconds
        logger.warning("Slow database operation", **db_data)
    else:
        logger.debug("Database operation", **db_data)


# Example usage functions
def create_audit_logger() -> structlog.stdlib.BoundLogger:
    """Create a logger specifically for audit events."""
    return structlog.get_logger("audit")


def create_performance_logger() -> structlog.stdlib.BoundLogger:
    """Create a logger specifically for performance monitoring."""
    return structlog.get_logger("performance")


def create_security_logger() -> structlog.stdlib.BoundLogger:
    """Create a logger specifically for security events."""
    return structlog.get_logger("security")