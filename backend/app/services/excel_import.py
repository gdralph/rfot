import pandas as pd
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Dict, List, Optional
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
        # Show available columns for debugging
        available_cols = list(df.columns)
        raise ValueError(f"Missing required columns: {missing_cols}. Available columns: {available_cols}")
    
    if df.empty:
        raise ValueError("Excel file is empty")


def categorize_opportunity(amount: float) -> str:
    """Categorize opportunity based on TCV amount."""
    # Handle negative amounts
    if amount < 0:
        return "Uncategorized"
    elif amount < 5_000_000:
        return "Sub $5M"
    elif amount < 25_000_000:
        return "Cat C"
    elif amount < 50_000_000:
        return "Cat B"
    else:
        return "Cat A"


def safe_float_convert(value: any, multiplier: float = 1.0) -> Optional[float]:
    """Safely convert value to float with optional multiplier."""
    if pd.isna(value) or value is None:
        return None
    try:
        return float(value) * multiplier
    except (ValueError, TypeError):
        return None


def find_tcv_column(df: pd.DataFrame) -> Optional[str]:
    """Find the TCV column name in the DataFrame."""
    possible_tcv_names = [
        "Offering TCV (M)",
        "TCV (M)",
        "TCV $M", 
        "Total Contract Value (M)",
        "Total Contract Value",
        "Contract Value (M)",
        "Contract Value",
        "TCV"
    ]
    
    for col_name in possible_tcv_names:
        if col_name in df.columns:
            return col_name
    
    # If no exact match, look for columns containing "TCV" or "Contract Value"
    for col in df.columns:
        if "TCV" in str(col).upper() or "CONTRACT VALUE" in str(col).upper():
            return col
    
    return None


def safe_string_clean(value: any) -> Optional[str]:
    """Safely clean and return string value."""
    if pd.isna(value) or value is None:
        return None
    result = str(value).strip()
    return result if result and result.lower() not in ["nan", "none", ""] else None


def categorize_opportunity(amount: float) -> str:
    """Categorize opportunity based on TCV amount."""
    # Handle negative amounts
    if amount < 0:
        return "Uncategorized"
    elif amount < 5_000_000:
        return "Sub $5M"
    elif amount < 25_000_000:
        return "Cat C"
    elif amount < 50_000_000:
        return "Cat B"
    else:
        return "Cat A"


def safe_float_convert(value: any, multiplier: float = 1.0) -> Optional[float]:
    """Safely convert value to float with optional multiplier."""
    if pd.isna(value) or value is None:
        return None
    try:
        return float(value) * multiplier
    except (ValueError, TypeError):
        return None


def find_tcv_column(df: pd.DataFrame) -> Optional[str]:
    """Find the TCV column name in the DataFrame."""
    possible_tcv_names = [
        "Offering TCV (M)",
        "TCV (M)",
        "TCV $M", 
        "Total Contract Value (M)",
        "Total Contract Value",
        "Contract Value (M)",
        "Contract Value",
        "TCV"
    ]
    
    for col_name in possible_tcv_names:
        if col_name in df.columns:
            return col_name
    
    # If no exact match, look for columns containing "TCV" or "Contract Value"
    for col in df.columns:
        if "TCV" in str(col).upper() or "CONTRACT VALUE" in str(col).upper():
            return col
    
    return None


def safe_string_clean(value: any) -> Optional[str]:
    """Safely clean and return string value."""
    if pd.isna(value) or value is None:
        return None
    result = str(value).strip()
    return result if result and result.lower() not in ["nan", "none", ""] else None




async def import_excel_background(file_path: str, task_id: str, import_tasks: Dict[str, ImportTask]) -> None:
    """Background task for Excel import with progress tracking."""
    task = import_tasks[task_id]
    
    try:
        task.status = "processing"
        task.message = "Reading Excel file"
        task.start_time = datetime.now().isoformat()
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Find the TCV column dynamically
        tcv_column = find_tcv_column(df)
        if not tcv_column:
            available_cols = list(df.columns)
            raise ValueError(f"No TCV column found. Available columns: {available_cols}")
        
        # Validate required columns for opportunities (using flexible TCV column)
        required_columns = ["Opportunity Id", "Opportunity Name", "Sales Stage", "Decision Date"]
        validate_excel_data(df, required_columns)
        
        # Log which TCV column we're using
        logger.info("Using TCV column", column_name=tcv_column)
        
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
                    if pd.isna(row["Opportunity Name"]) or pd.isna(row[tcv_column]):
                        task.errors.append(f"Row {idx + 1}: Missing critical data (name or TCV)")
                        task.failed_rows += 1
                        continue
                    
                    # Parse close date with validation
                    try:
                        close_date = pd.to_datetime(row["Decision Date"]).date()
                    except (ValueError, TypeError) as e:
                        task.errors.append(f"Row {idx + 1}: Invalid decision date: {str(e)}")
                        task.failed_rows += 1
                        continue
                    
                    # Parse amount with validation
                    try:
                        tcv_value = row[tcv_column]
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
                    assigned_resource = safe_string_clean(row.get("Opportunity Owner"))
                    status = safe_string_clean(row.get("Forecast Category Consolidated"))
                    
                    # Skip if name is still invalid
                    if name.lower() in ["nan", "none", ""]:
                        task.errors.append(f"Row {idx + 1}: Invalid opportunity name")
                        task.failed_rows += 1
                        continue
                    
                    # Extract all new fields
                    account_name = safe_string_clean(row.get("Account Name"))
                    sfdc_url = safe_string_clean(row.get("SFDC"))
                    opportunity_type = safe_string_clean(row.get("Opportunity Type"))
                    margin_percentage = safe_float_convert(row.get("Opp Margin %"))
                    first_year_revenue = safe_float_convert(row.get("First Year Revenue"), 1_000_000)
                    second_year_revenue = safe_float_convert(row.get("2nd Year Revenue"), 1_000_000)
                    revenue_beyond_year2 = safe_float_convert(row.get("FY Rev Beyond Yr 2"), 1_000_000)
                    master_period = safe_string_clean(row.get("Master Period"))
                    lead_offering = safe_string_clean(row.get("Lead Offering L1"))
                    sales_org = safe_string_clean(row.get("Sales Org L1"))
                    deal_size = safe_string_clean(row.get("Deal Size"))
                    solution_type = safe_string_clean(row.get("Solution Type"))
                    contract_model = safe_string_clean(row.get("Contract Model"))
                    
                    # Extract quarterly revenue fields
                    first_year_q1_rev = safe_float_convert(row.get("First Year Q1 Rev (M)"))
                    first_year_q2_rev = safe_float_convert(row.get("First Year Q2 Rev (M)"))
                    first_year_q3_rev = safe_float_convert(row.get("First Year Q3 Rev (M)"))
                    first_year_q4_rev = safe_float_convert(row.get("First Year Q4 Rev (M)"))
                    first_year_fy_rev = safe_float_convert(row.get("First Year FY Rev (M)"))
                    second_year_q1_rev = safe_float_convert(row.get("2nd Year Q1 Rev (M)"))
                    second_year_q2_rev = safe_float_convert(row.get("2nd Year Q2 Rev (M)"))
                    second_year_q3_rev = safe_float_convert(row.get("2nd Year Q3 Rev (M)"))
                    second_year_q4_rev = safe_float_convert(row.get("2nd Year Q4 Rev (M)"))
                    second_year_fy_rev = safe_float_convert(row.get("2nd Year FY Rev (M)"))
                    fy_rev_beyond_yr2 = safe_float_convert(row.get("FY Rev Beyond Yr 2 (M)"))
                    
                    # Extract service line revenues
                    ces_millions = safe_float_convert(row.get("CES (M)"))
                    ins_millions = safe_float_convert(row.get("INS (M)"))
                    bps_millions = safe_float_convert(row.get("BPS (M)"))
                    sec_millions = safe_float_convert(row.get("SEC (M)"))
                    itoc_millions = safe_float_convert(row.get("ITOC (M)"))
                    mw_millions = safe_float_convert(row.get("MW (M)"))
                    
                    # Parse close date for decision_date field
                    try:
                        decision_date = pd.to_datetime(row["Decision Date"]).to_pydatetime()
                    except (ValueError, TypeError):
                        decision_date = None
                        
                    # Extract other fields
                    contract_length = safe_float_convert(row.get("Contract Length"))
                    in_forecast = safe_string_clean(row.get("In Forecast"))
                    opportunity_owner = safe_string_clean(row.get("Opportunity Owner"))

                    # Create opportunity with new schema fields
                    opp = Opportunity(
                        opportunity_id=opportunity_id,
                        sfdc_url=sfdc_url,
                        account_name=account_name,
                        opportunity_name=name,
                        opportunity_type=opportunity_type,
                        tcv_millions=amount / 1_000_000 if amount else None,  # Convert back to millions
                        margin_percentage=margin_percentage,
                        first_year_q1_rev=first_year_q1_rev,
                        first_year_q2_rev=first_year_q2_rev,
                        first_year_q3_rev=first_year_q3_rev,
                        first_year_q4_rev=first_year_q4_rev,
                        first_year_fy_rev=first_year_fy_rev,
                        second_year_q1_rev=second_year_q1_rev,
                        second_year_q2_rev=second_year_q2_rev,
                        second_year_q3_rev=second_year_q3_rev,
                        second_year_q4_rev=second_year_q4_rev,
                        second_year_fy_rev=second_year_fy_rev,
                        fy_rev_beyond_yr2=fy_rev_beyond_yr2,
                        sales_stage=stage,
                        decision_date=decision_date,
                        master_period=master_period,
                        contract_length=contract_length,
                        in_forecast=in_forecast,
                        opportunity_owner=opportunity_owner,
                        lead_offering_l1=lead_offering,
                        ces_millions=ces_millions,
                        ins_millions=ins_millions,
                        bps_millions=bps_millions,
                        sec_millions=sec_millions,
                        itoc_millions=itoc_millions,
                        mw_millions=mw_millions,
                        sales_org_l1=sales_org
                    )
                    
                    # Check if opportunity already exists
                    existing = session.exec(
                        select(Opportunity).where(Opportunity.opportunity_id == opp.opportunity_id)
                    ).first()
                    
                    if existing:
                        # Update existing opportunity with all fields EXCEPT user-managed fields
                        # User-managed fields are preserved during imports: security_clearance, custom_priority,
                        # internal_stage_assessment, custom_tracking_field_1/2/3, internal_notes
                        update_fields = [
                            "sfdc_url", "account_name", "opportunity_name", "opportunity_type", "tcv_millions",
                            "margin_percentage", "first_year_q1_rev", "first_year_q2_rev", "first_year_q3_rev",
                            "first_year_q4_rev", "first_year_fy_rev", "second_year_q1_rev", "second_year_q2_rev",
                            "second_year_q3_rev", "second_year_q4_rev", "second_year_fy_rev", "fy_rev_beyond_yr2",
                            "sales_stage", "decision_date", "master_period", "contract_length", "in_forecast",
                            "opportunity_owner", "lead_offering_l1", "ces_millions", "ins_millions", "bps_millions",
                            "sec_millions", "itoc_millions", "mw_millions", "sales_org_l1"
                        ]
                        for field in update_fields:
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
                    logger.error("Row processing error", row_idx=idx, error=str(e), opportunity_id=opportunity_id)
                    # Rollback any partial transaction and continue
                    session.rollback()
                    continue
            
            try:
                session.commit()
            except Exception as e:
                session.rollback()
                logger.error("Database commit failed", error=str(e))
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


async def import_line_items_background(file_path: str, task_id: str, import_tasks: Dict[str, ImportTask]) -> None:
    """Background task for line items import with progress tracking."""
    task = import_tasks[task_id]
    
    try:
        task.status = "processing"
        task.message = "Reading line items Excel file"
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Find the TCV column dynamically
        tcv_column = find_tcv_column(df)
        if not tcv_column:
            available_cols = list(df.columns)
            raise ValueError(f"No TCV column found. Available columns: {available_cols}")
        
        # Validate required columns for line items (using flexible TCV column)
        required_columns = ["Opportunity Id"]
        validate_excel_data(df, required_columns)
        
        # Log which TCV column we're using
        logger.info("Using TCV column for line items", column_name=tcv_column)
        
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
                    if pd.isna(row[tcv_column]):
                        task.errors.append(f"Row {idx + 1}: Missing TCV data")
                        continue
                    
                    # Check if opportunity exists
                    existing_opp = session.exec(
                        select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
                    ).first()
                    
                    if not existing_opp:
                        task.errors.append(f"Row {idx + 1}: Opportunity {opportunity_id} not found")
                        continue
                    
                    # Extract line item fields based on columns G-AC from Excel analysis
                    offering_tcv = safe_float_convert(row.get("Offering TCV (M)"))
                    offering_abr = safe_float_convert(row.get("Offering ABR (M)"))
                    offering_iyr = safe_float_convert(row.get("Offering IYR (M)"))
                    offering_iqr = safe_float_convert(row.get("Offering IQR (M)"))
                    offering_margin = safe_float_convert(row.get("Offering Margin (M)"))
                    offering_margin_percentage = safe_float_convert(row.get("Offering Margin %"))
                    
                    # Parse decision date
                    try:
                        decision_date = pd.to_datetime(row.get("Decision Date")).to_pydatetime()
                    except (ValueError, TypeError):
                        decision_date = None
                        
                    master_period = safe_string_clean(row.get("Master Period"))
                    lead_offering_l2 = safe_string_clean(row.get("Lead Offering L2"))
                    internal_service = safe_string_clean(row.get("Internal Service"))
                    simplified_offering = safe_string_clean(row.get("Simplified Offering"))
                    product_name = safe_string_clean(row.get("Product Name"))
                    
                    # Extract quarterly revenue fields for line items
                    first_year_q1_rev = safe_float_convert(row.get("First Year Q1 Rev (M)"))
                    first_year_q2_rev = safe_float_convert(row.get("First Year Q2 Rev (M)"))
                    first_year_q3_rev = safe_float_convert(row.get("First Year Q3 Rev (M)"))
                    first_year_q4_rev = safe_float_convert(row.get("First Year Q4 Rev (M)"))
                    first_year_fy_rev = safe_float_convert(row.get("First Year FY Rev (M)"))
                    second_year_q1_rev = safe_float_convert(row.get("2nd Year Q1 Rev (M)"))
                    second_year_q2_rev = safe_float_convert(row.get("2nd Year Q2 Rev (M)"))
                    second_year_q3_rev = safe_float_convert(row.get("2nd Year Q3 Rev (M)"))
                    second_year_q4_rev = safe_float_convert(row.get("2nd Year Q4 Rev (M)"))
                    second_year_fy_rev = safe_float_convert(row.get("2nd Year FY Rev (M)"))
                    fy_rev_beyond_yr2 = safe_float_convert(row.get("FY Rev Beyond Yr 2 (M)"))
                    
                    # Create line item with new schema fields
                    line_item = OpportunityLineItem(
                        opportunity_id=opportunity_id,
                        offering_tcv=offering_tcv,
                        offering_abr=offering_abr,
                        offering_iyr=offering_iyr,
                        offering_iqr=offering_iqr,
                        offering_margin=offering_margin,
                        offering_margin_percentage=offering_margin_percentage,
                        decision_date=decision_date,
                        master_period=master_period,
                        lead_offering_l2=lead_offering_l2,
                        internal_service=internal_service,
                        simplified_offering=simplified_offering,
                        product_name=product_name,
                        first_year_q1_rev=first_year_q1_rev,
                        first_year_q2_rev=first_year_q2_rev,
                        first_year_q3_rev=first_year_q3_rev,
                        first_year_q4_rev=first_year_q4_rev,
                        first_year_fy_rev=first_year_fy_rev,
                        second_year_q1_rev=second_year_q1_rev,
                        second_year_q2_rev=second_year_q2_rev,
                        second_year_q3_rev=second_year_q3_rev,
                        second_year_q4_rev=second_year_q4_rev,
                        second_year_fy_rev=second_year_fy_rev,
                        fy_rev_beyond_yr2=fy_rev_beyond_yr2
                    )
                    
                    # Check if line item already exists
                    existing_item = session.exec(
                        select(OpportunityLineItem).where(OpportunityLineItem.opportunity_id == opportunity_id)
                    ).first()
                    
                    if existing_item:
                        # Update existing line item with all fields
                        update_fields = [
                            "offering_tcv", "offering_abr", "offering_iyr", "offering_iqr",
                            "offering_margin", "offering_margin_percentage", "decision_date", "master_period",
                            "lead_offering_l2", "internal_service", "simplified_offering", "product_name",
                            "first_year_q1_rev", "first_year_q2_rev", "first_year_q3_rev", "first_year_q4_rev",
                            "first_year_fy_rev", "second_year_q1_rev", "second_year_q2_rev", "second_year_q3_rev",
                            "second_year_q4_rev", "second_year_fy_rev", "fy_rev_beyond_yr2"
                        ]
                        for field in update_fields:
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
                    logger.error("Line item processing error", row_idx=idx, error=str(e), opportunity_id=opportunity_id)
                    # Rollback any partial transaction and continue
                    session.rollback()
                    continue
            
            try:
                session.commit()
            except Exception as e:
                session.rollback()
                logger.error("Database commit failed", error=str(e))
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