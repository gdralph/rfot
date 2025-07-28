from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks, HTTPException
from sqlmodel import Session
from typing import Dict, BinaryIO
import structlog
import uuid
import pandas as pd
from datetime import datetime
from pathlib import Path
import os

# Optional MIME type detection - gracefully handle missing dependency
try:
    import magic
    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False
    magic = None

from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.services.excel_import import ImportTask, import_excel_background, import_line_items_background

logger = structlog.get_logger()
router = APIRouter()

# In-memory task store (use Redis/DB for production)
import_tasks: Dict[str, ImportTask] = {}

# File validation settings
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'.xlsx', '.xls'}
ALLOWED_MIME_TYPES = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
    'application/vnd.ms-excel',  # .xls
    'application/excel',
    'application/x-excel',
    'application/x-msexcel'
}


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


def validate_excel_file(file: UploadFile) -> None:
    """
    Comprehensive validation for uploaded Excel files.
    
    Args:
        file: The uploaded file to validate
        
    Raises:
        HTTPException: If file fails validation
    """
    # Check if file exists and has content
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    
    # Check file size (FastAPI doesn't provide this directly, so we'll check later)
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File extension '{file_ext}' not allowed. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Validate filename to prevent path traversal
    if '..' in file.filename or '/' in file.filename or '\\' in file.filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Check filename length
    if len(file.filename) > 255:
        raise HTTPException(status_code=400, detail="Filename too long")


def validate_file_content(file_path: str) -> None:
    """
    Validate file content after it's been saved.
    
    Args:
        file_path: Path to the saved file
        
    Raises:
        HTTPException: If file content fails validation
    """
    try:
        # Check actual file size
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size {file_size // (1024*1024)}MB exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Check if file is empty
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Validate MIME type using libmagic (if available)
        if HAS_MAGIC:
            try:
                mime_type = magic.from_file(file_path, mime=True)
                if mime_type not in ALLOWED_MIME_TYPES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid file type. Expected Excel file, got: {mime_type}"
                    )
                logger.debug("MIME type validation passed", mime_type=mime_type)
            except Exception as e:
                logger.warning("MIME type detection failed", error=str(e), file_path=file_path)
                # Continue without MIME type validation if magic fails
        else:
            logger.info("MIME type detection skipped - python-magic not available")
        
        # Try to validate Excel file structure
        try:
            # Test if pandas can read the file (basic structure validation)
            df = pd.read_excel(file_path, nrows=0)  # Read only headers
            logger.info("Excel file structure validated", columns=len(df.columns))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Excel file format: {str(e)}"
            )
            
    except HTTPException:
        # Clean up file if validation fails
        try:
            os.unlink(file_path)
        except OSError:
            pass
        raise
    except Exception as e:
        # Clean up file and raise generic error
        try:
            os.unlink(file_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"File validation error: {str(e)}")


def save_uploaded_file(file: UploadFile) -> str:
    """
    Safely save uploaded file with validation.
    
    Args:
        file: The uploaded file
        
    Returns:
        str: Path to the saved file
        
    Raises:
        HTTPException: If file saving fails
    """
    # Generate safe filename
    safe_filename = f"{uuid.uuid4()}_{Path(file.filename).name}"
    file_path = f"/tmp/{safe_filename}"
    
    try:
        # Read file content and validate size
        content = file.file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Validate saved file content
        validate_file_content(file_path)
        
        logger.info("File saved and validated", file_path=file_path, size_bytes=len(content))
        return file_path
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file if saving fails
        try:
            os.unlink(file_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/excel")
async def import_excel(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Import opportunities from Excel file with comprehensive validation."""
    # Validate file before processing
    validate_excel_file(file)
    
    try:
        # Save and validate file content
        file_path = save_uploaded_file(file)
        
        # Create task
        task_id = str(uuid.uuid4())
        import_tasks[task_id] = ImportTask(
            task_id=task_id,
            status="pending",
            progress=0,
            message="Excel import queued",
            start_time=datetime.now().isoformat()
        )
        
        # Start background task
        background_tasks.add_task(import_excel_background, file_path, task_id, import_tasks)
        
        logger.info("Started Excel import", task_id=task_id, filename=file.filename, 
                   file_size=os.path.getsize(file_path))
        return {"task_id": task_id, "message": "Excel import started"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Excel import failed", error=str(e), filename=file.filename)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/line-items")
async def import_line_items(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Import opportunity line items from Excel file with comprehensive validation."""
    # Validate file before processing
    validate_excel_file(file)
    
    try:
        # Save and validate file content
        file_path = save_uploaded_file(file)
        
        # Create task
        task_id = str(uuid.uuid4())
        import_tasks[task_id] = ImportTask(
            task_id=task_id,
            status="pending", 
            progress=0,
            message="Line items import queued",
            start_time=datetime.now().isoformat()
        )
        
        # Start background task
        background_tasks.add_task(import_line_items_background, file_path, task_id, import_tasks)
        
        logger.info("Started line items import", task_id=task_id, filename=file.filename,
                   file_size=os.path.getsize(file_path))
        return {"task_id": task_id, "message": "Line items import started"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Line items import failed", error=str(e), filename=file.filename)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/status/{task_id}")
async def get_import_status(task_id: str):
    """Get import task status."""
    task = import_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task.dict()