from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks, HTTPException
from sqlmodel import Session
from typing import Dict
import structlog
import uuid
import pandas as pd
from datetime import datetime
from pathlib import Path

from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.services.excel_import import ImportTask, import_excel_background, import_line_items_background

logger = structlog.get_logger()
router = APIRouter()

# In-memory task store (use Redis/DB for production)
import_tasks: Dict[str, ImportTask] = {}


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


@router.post("/excel")
async def import_excel(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Import opportunities from Excel file."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file")
    
    # Save uploaded file temporarily
    file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create task
    task_id = str(uuid.uuid4())
    import_tasks[task_id] = ImportTask(
        task_id=task_id,
        status="pending",
        progress=0,
        message="Excel import queued"
    )
    
    # Start background task
    background_tasks.add_task(import_excel_background, file_path, task_id, import_tasks)
    
    logger.info("Started Excel import", task_id=task_id, filename=file.filename)
    return {"task_id": task_id, "message": "Excel import started"}


@router.post("/line-items")
async def import_line_items(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Import opportunity line items from Excel file."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file")
    
    # Save uploaded file temporarily
    file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create task
    task_id = str(uuid.uuid4())
    import_tasks[task_id] = ImportTask(
        task_id=task_id,
        status="pending", 
        progress=0,
        message="Line items import queued"
    )
    
    # Start background task
    background_tasks.add_task(import_line_items_background, file_path, task_id, import_tasks)
    
    logger.info("Started line items import", task_id=task_id, filename=file.filename)
    return {"task_id": task_id, "message": "Line items import started"}


@router.get("/status/{task_id}")
async def get_import_status(task_id: str):
    """Get import task status."""
    task = import_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task.dict()