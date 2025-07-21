import pandas as pd
from sqlmodel import Session
from pydantic import BaseModel
from typing import Dict, List
import structlog
from datetime import datetime, date
import os

from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem

logger = structlog.get_logger()


class ImportTask(BaseModel):
    """Import task model for tracking progress."""
    task_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: int
    message: str
    total_rows: int = 0
    processed_rows: int = 0
    successful_rows: int = 0
    failed_rows: int = 0
    warnings_count: int = 0
    errors: List[str] = []
    start_time: str = ""
    end_time: str = ""


def validate_excel_data(df: pd.DataFrame, required_columns: List[str]) -> None:
    """Validate Excel data structure and content."""
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    
    if df.empty:
        raise ValueError("Excel file is empty")


def categorize_opportunity(amount: float) -> str:
    """Categorize opportunity based on TCV amount."""
    # Handle negative amounts
    if amount < 0:
        return "Negative"
    elif amount < 5_000_000:
        return "Sub $5M"
    elif amount < 25_000_000:
        return "Cat C"
    elif amount < 50_000_000:
        return "Cat B"
    else:
        return "Cat A"


async def import_excel_background(file_path: str, task_id: str, import_tasks: Dict[str, ImportTask]):
    """Background task for Excel import with progress tracking."""
    task = import_tasks[task_id]
    
    try:
        task.status = "processing"
        task.message = "Reading Excel file"
        task.start_time = datetime.now().isoformat()
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Validate required columns for opportunities (using actual Excel file column names)
        required_columns = ["Opportunity Id", "Opportunity Name", "Sales Stage", "Offering TCV (M)", "Decision Date"]
        validate_excel_data(df, required_columns)
        
        task.total_rows = len(df)
        task.message = f"Processing {task.total_rows} opportunities"
        
        with Session(engine) as session:
            skipped_rows = 0
            for idx, (_, row) in enumerate(df.iterrows()):
                try:
                    # Skip summary rows and invalid data
                    opportunity_id = str(row["Opportunity Id"])
                    
                    # Skip various types of summary/filter rows
                    skip_conditions = [
                        opportunity_id.lower() in ["total", "sum", "grand total", "nan", "nat"],
                        pd.isna(row["Opportunity Id"]),
                        "applied filters" in opportunity_id.lower(),
                        "status is" in opportunity_id.lower(),
                        "masterfy is" in opportunity_id.lower(),
                        "sales org" in opportunity_id.lower(),
                        len(opportunity_id.strip()) == 0 if isinstance(opportunity_id, str) else False,
                        # Skip multi-line filter descriptions
                        '\n' in opportunity_id if isinstance(opportunity_id, str) else False
                    ]
                    
                    if any(skip_conditions):
                        skipped_rows += 1
                        continue
                    
                    # Skip rows with missing critical data
                    if pd.isna(row["Opportunity Name"]) or pd.isna(row["Offering TCV (M)"]):
                        task.errors.append(f"Row {idx + 1}: Missing critical data (name or TCV)")
                        task.failed_rows += 1
                        continue
                    
                    # Parse close date with validation
                    try:
                        close_date = pd.to_datetime(row["Decision Date"]).date()
                    except:
                        task.errors.append(f"Row {idx + 1}: Invalid decision date")
                        task.failed_rows += 1
                        continue
                    
                    # Parse amount with validation
                    try:
                        tcv_value = row["Offering TCV (M)"]
                        if pd.isna(tcv_value):
                            task.errors.append(f"Row {idx + 1}: Missing TCV amount")
                            task.failed_rows += 1
                            continue
                        
                        amount = float(tcv_value) * 1_000_000  # Convert from millions
                        
                        # Allow negative amounts (they might be valid business cases like refunds/adjustments)
                        # Just warn about zero amounts
                        if amount == 0:
                            task.errors.append(f"Row {idx + 1}: Warning - TCV amount is zero")
                            task.warnings_count += 1
                            # Continue processing instead of skipping
                        
                    except (ValueError, TypeError) as e:
                        task.errors.append(f"Row {idx + 1}: Could not parse TCV amount: {str(e)}")
                        task.failed_rows += 1
                        continue
                    
                    # Clean string fields
                    name = str(row["Opportunity Name"]).strip()
                    stage = str(row["Sales Stage"]).strip() if not pd.isna(row["Sales Stage"]) else "Unknown"
                    assigned_resource = str(row.get("Opportunity Owner", "")).strip() if not pd.isna(row.get("Opportunity Owner")) else None
                    status = str(row.get("Forecast Category Consolidated", "")).strip() if not pd.isna(row.get("Forecast Category Consolidated")) else None
                    
                    # Skip if name is still invalid
                    if name.lower() in ["nan", "none", ""]:
                        task.errors.append(f"Row {idx + 1}: Invalid opportunity name")
                        task.failed_rows += 1
                        continue
                    
                    # Create opportunity
                    opp = Opportunity(
                        opportunity_id=opportunity_id,
                        name=name,
                        stage=stage,
                        amount=amount,
                        close_date=close_date,
                        category=categorize_opportunity(amount),
                        assigned_resource=assigned_resource if assigned_resource and assigned_resource.lower() not in ["nan", "none", ""] else None,
                        status=status if status and status.lower() not in ["nan", "none", ""] else None,
                        notes=None  # Not available in this Excel format
                    )
                    
                    # Check if opportunity already exists
                    existing = session.query(Opportunity).filter(
                        Opportunity.opportunity_id == opp.opportunity_id
                    ).first()
                    
                    if existing:
                        # Update existing opportunity
                        for field in ["name", "stage", "amount", "close_date", "category"]:
                            setattr(existing, field, getattr(opp, field))
                        logger.info("Updated existing opportunity", opportunity_id=opp.opportunity_id)
                    else:
                        # Add new opportunity
                        session.add(opp)
                        logger.info("Created new opportunity", opportunity_id=opp.opportunity_id)
                    
                    task.successful_rows += 1
                    task.processed_rows = idx + 1
                    task.progress = int((idx + 1) / task.total_rows * 100)
                    task.message = f"Processing row {idx + 1} of {task.total_rows}"
                    
                except Exception as e:
                    error_msg = f"Row {idx + 1}: {str(e)}"
                    task.errors.append(error_msg)
                    task.failed_rows += 1
                    logger.error("Row processing error", row_idx=idx, error=str(e))
                    # Rollback any partial transaction and continue
                    session.rollback()
                    continue
            
            try:
                session.commit()
            except Exception as e:
                session.rollback()
                raise e
            
            # Clean up temporary file
            try:
                os.remove(file_path)
            except OSError:
                pass
            
            task.status = "completed"
            task.progress = 100
            task.end_time = datetime.now().isoformat()
            
            # Create detailed completion message
            success_msg = f"Import completed: {task.successful_rows} successful"
            if task.failed_rows > 0:
                success_msg += f", {task.failed_rows} failed"
            if task.warnings_count > 0:
                success_msg += f", {task.warnings_count} warnings"
            if skipped_rows > 0:
                success_msg += f" ({skipped_rows} summary rows skipped)"
                
            task.message = success_msg
            
            logger.info("Excel import completed", 
                       task_id=task_id, 
                       successful=task.successful_rows,
                       failed=task.failed_rows,
                       warnings=task.warnings_count,
                       total_errors=len(task.errors))
                       
    except Exception as e:
        task.status = "failed"
        task.message = f"Import failed: {str(e)}"
        task.errors.append(str(e))
        
        # Clean up temporary file
        try:
            os.remove(file_path)
        except OSError:
            pass
        
        logger.error("Excel import failed", task_id=task_id, error=str(e))


async def import_line_items_background(file_path: str, task_id: str, import_tasks: Dict[str, ImportTask]):
    """Background task for line items import with progress tracking."""
    task = import_tasks[task_id]
    
    try:
        task.status = "processing"
        task.message = "Reading line items Excel file"
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Validate required columns for line items (using actual Excel file column names)
        required_columns = ["Opportunity Id", "TCV $M"]
        validate_excel_data(df, required_columns)
        
        task.total_rows = len(df)
        task.message = f"Processing {task.total_rows} line items"
        
        with Session(engine) as session:
            for idx, (_, row) in enumerate(df.iterrows()):
                try:
                    opportunity_id = str(row["Opportunity Id"])
                    
                    # Skip various types of summary/filter rows (same logic as opportunities import)
                    skip_conditions = [
                        opportunity_id.lower() in ["total", "sum", "grand total", "nan", "nat"],
                        pd.isna(row["Opportunity Id"]),
                        "applied filters" in opportunity_id.lower(),
                        "status is" in opportunity_id.lower(),
                        "masterfy is" in opportunity_id.lower(),
                        "sales org" in opportunity_id.lower(),
                        len(opportunity_id.strip()) == 0 if isinstance(opportunity_id, str) else False,
                        # Skip multi-line filter descriptions
                        '\n' in opportunity_id if isinstance(opportunity_id, str) else False
                    ]
                    
                    if any(skip_conditions):
                        continue
                    
                    # Skip rows with missing TCV data
                    if pd.isna(row["TCV $M"]):
                        task.errors.append(f"Row {idx + 1}: Missing TCV data")
                        continue
                    
                    # Check if opportunity exists
                    existing_opp = session.query(Opportunity).filter(
                        Opportunity.opportunity_id == opportunity_id
                    ).first()
                    
                    if not existing_opp:
                        task.errors.append(f"Row {idx + 1}: Opportunity {opportunity_id} not found")
                        continue
                    
                    # Create line item - convert from millions to actual amounts
                    line_item = OpportunityLineItem(
                        opportunity_id=opportunity_id,
                        tcv=float(row["TCV $M"]) * 1_000_000,  # Convert from millions
                        ces_revenue=float(row.get("CES (M)", 0)) * 1_000_000 if pd.notna(row.get("CES (M)")) else 0,
                        ins_revenue=float(row.get("INS (M)", 0)) * 1_000_000 if pd.notna(row.get("INS (M)")) else 0,
                        bps_revenue=float(row.get("BPS (M)", 0)) * 1_000_000 if pd.notna(row.get("BPS (M)")) else 0,
                        sec_revenue=float(row.get("SEC (M)", 0)) * 1_000_000 if pd.notna(row.get("SEC (M)")) else 0,
                        itoc_revenue=float(row.get("ITOC (M)", 0)) * 1_000_000 if pd.notna(row.get("ITOC (M)")) else 0,
                        mw_revenue=float(row.get("MW (M)", 0)) * 1_000_000 if pd.notna(row.get("MW (M)")) else 0,
                        contract_length=float(row.get("Contract Length")) if pd.notna(row.get("Contract Length")) else None,
                        in_forecast=str(row.get("In Forecast", "")) or None
                    )
                    
                    # Check if line item already exists
                    existing_item = session.query(OpportunityLineItem).filter(
                        OpportunityLineItem.opportunity_id == opportunity_id
                    ).first()
                    
                    if existing_item:
                        # Update existing line item
                        for field in ["tcv", "ces_revenue", "ins_revenue", "bps_revenue", 
                                     "sec_revenue", "itoc_revenue", "mw_revenue", "contract_length", "in_forecast"]:
                            setattr(existing_item, field, getattr(line_item, field))
                        logger.info("Updated existing line item", opportunity_id=opportunity_id)
                    else:
                        # Add new line item
                        session.add(line_item)
                        logger.info("Created new line item", opportunity_id=opportunity_id)
                    
                    task.processed_rows = idx + 1
                    task.progress = int((idx + 1) / task.total_rows * 100)
                    task.message = f"Processing row {idx + 1} of {task.total_rows}"
                    
                except Exception as e:
                    error_msg = f"Row {idx + 1}: {str(e)}"
                    task.errors.append(error_msg)
                    logger.error("Line item processing error", row_idx=idx, error=str(e))
                    # Rollback any partial transaction and continue
                    session.rollback()
                    continue
            
            try:
                session.commit()
            except Exception as e:
                session.rollback()
                raise e
            
            # Clean up temporary file
            try:
                os.remove(file_path)
            except OSError:
                pass
            
            task.status = "completed"
            task.progress = 100
            task.message = f"Successfully imported {task.processed_rows} line items"
            
            if task.errors:
                task.message += f" with {len(task.errors)} errors"
            
            logger.info("Line items import completed", 
                       task_id=task_id, 
                       processed=task.processed_rows,
                       errors=len(task.errors))
                       
    except Exception as e:
        task.status = "failed"
        task.message = f"Import failed: {str(e)}"
        task.errors.append(str(e))
        
        # Clean up temporary file
        try:
            os.remove(file_path)
        except OSError:
            pass
        
        logger.error("Line items import failed", task_id=task_id, error=str(e))