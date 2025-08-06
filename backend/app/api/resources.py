"""
Resource forecasting API endpoints for FTE timeline calculations.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Union
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, delete
from pydantic import BaseModel

from app.models.database import engine
from app.models.resources import (
    OpportunityResourceTimeline, 
    OpportunityEffortPrediction,
    PortfolioEffortPrediction,
    StageEffortBreakdown
)
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.services.resource_calculation import (
    calculate_opportunity_resource_timeline,
    aggregate_portfolio_resource_forecast,
    SUPPORTED_SERVICE_LINES,
    SALES_STAGES_ORDER
)

router = APIRouter(prefix="/resources", tags=["resources"])


class ResourceStatusUpdate(BaseModel):
    """Request model for updating resource status."""
    resource_status: str  # Predicted, Forecast, or Planned


class ResourceTimelineUpdate(BaseModel):
    """Request model for updating resource timeline data."""
    stage_start_date: datetime
    stage_end_date: datetime
    duration_weeks: float
    fte_required: float
    resource_status: str = "Predicted"


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


def parse_multi_param(param: Optional[Union[str, List[str]]]) -> List[str]:
    """Parse parameter that could be a single string or list of strings."""
    if param is None:
        return []
    if isinstance(param, str):
        # Handle comma-separated values for backward compatibility
        return [p.strip() for p in param.split(',') if p.strip()]
    return param


@router.post("/calculate-timeline/{opportunity_id}", response_model=OpportunityEffortPrediction)
def calculate_and_store_timeline(
    opportunity_id: int,
    session: Session = Depends(get_session)
):
    """
    Calculate resource timeline for an opportunity and store in database.
    
    This endpoint calculates the resource requirements by working backwards
    from the opportunity's decision date through the remaining sales stages.
    """
    try:
        # Calculate timeline using service
        timeline_data = calculate_opportunity_resource_timeline(opportunity_id, session)
        
        # Calculate total FTE across all stages and service lines
        total_fte = 0
        for service_line, stages in timeline_data["service_line_timelines"].items():
            for stage_data in stages:
                total_fte += stage_data["fte_required"]
        
        # Skip creating timeline if total FTE is 0
        if total_fte == 0:
            raise ValueError("Cannot create timeline with zero FTE requirements across all stages")
        
        # Clear existing timeline data for this opportunity (using string opportunity_id from timeline_data)
        session.exec(
            delete(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.opportunity_id == timeline_data["opportunity_id"]
            )
        )
        
        # Store new timeline data
        total_effort_weeks = 0
        earliest_start_date = None
        service_lines = []
        
        for service_line, stages in timeline_data["service_line_timelines"].items():
            service_lines.append(service_line)
            
            # Get resource category for this service line
            resource_category = None
            if "service_line_categories" in timeline_data and service_line in timeline_data["service_line_categories"]:
                resource_category = timeline_data["service_line_categories"][service_line]["resource_category"]
            
            for stage_data in stages:
                timeline_record = OpportunityResourceTimeline(
                    opportunity_id=timeline_data["opportunity_id"],
                    service_line=service_line,
                    stage_name=stage_data["stage_name"],
                    stage_start_date=stage_data["stage_start_date"],
                    stage_end_date=stage_data["stage_end_date"],
                    duration_weeks=stage_data["duration_weeks"],
                    fte_required=stage_data["fte_required"],
                    total_effort_weeks=stage_data["total_effort_weeks"],
                    opportunity_name=timeline_data["opportunity_name"],
                    category=timeline_data["category"],
                    resource_category=resource_category or stage_data.get("resource_category"),
                    tcv_millions=timeline_data["tcv_millions"],
                    decision_date=timeline_data["decision_date"],
                    calculated_date=datetime.utcnow()
                )
                session.add(timeline_record)
                
                # Track summary metrics
                total_effort_weeks += stage_data["total_effort_weeks"]
                if earliest_start_date is None or stage_data["stage_start_date"] < earliest_start_date:
                    earliest_start_date = stage_data["stage_start_date"]
        
        session.commit()
        
        return OpportunityEffortPrediction(
            opportunity_id=timeline_data["opportunity_id"],
            opportunity_name=timeline_data["opportunity_name"],
            current_stage=timeline_data["current_stage"],
            category=timeline_data["category"],
            tcv_millions=timeline_data["tcv_millions"],
            decision_date=timeline_data["decision_date"],
            service_line_timelines=timeline_data["service_line_timelines"],
            service_line_categories=timeline_data.get("service_line_categories"),
            total_remaining_effort_weeks=total_effort_weeks,
            earliest_stage_start=earliest_start_date,
            supported_service_lines=service_lines
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating timeline: {str(e)}")


@router.get("/opportunity/{opportunity_id}/timeline", response_model=OpportunityEffortPrediction)
def get_opportunity_timeline(
    opportunity_id: int,
    session: Session = Depends(get_session)
):
    """
    Retrieve stored timeline for an opportunity.
    """
    # Get opportunity first to get the string opportunity_id
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Get stored timeline records using string opportunity_id
    timeline_records = session.exec(
        select(OpportunityResourceTimeline).where(
            OpportunityResourceTimeline.opportunity_id == opportunity.opportunity_id
        ).order_by(OpportunityResourceTimeline.stage_start_date)
    ).all()
    
    if not timeline_records:
        # Return empty timeline object instead of 404
        return OpportunityEffortPrediction(
            opportunity_id=opportunity.opportunity_id,
            opportunity_name=opportunity.opportunity_name,
            current_stage=opportunity.sales_stage or "01",
            category="",  # Will be set by frontend based on TCV
            tcv_millions=opportunity.tcv_millions,
            decision_date=opportunity.decision_date or datetime.now(),
            service_line_timelines={},
            total_remaining_effort_weeks=0.0,
            earliest_stage_start=None,
            supported_service_lines=[]
        )
    
    # Group by service line
    service_line_timelines = {}
    service_line_categories = {}
    total_effort_weeks = 0
    earliest_start_date = None
    service_lines = []
    
    for record in timeline_records:
        service_line = record.service_line
        if service_line not in service_line_timelines:
            service_line_timelines[service_line] = []
            service_lines.append(service_line)
            # Track the resource category for this service line
            if record.resource_category:
                service_line_categories[service_line] = {
                    "timeline_category": record.category,
                    "resource_category": record.resource_category
                }
        
        service_line_timelines[service_line].append({
            "stage_name": record.stage_name,
            "stage_start_date": record.stage_start_date,
            "stage_end_date": record.stage_end_date,
            "duration_weeks": record.duration_weeks,
            "fte_required": record.fte_required,
            "total_effort_weeks": record.total_effort_weeks,
            "resource_status": record.resource_status,
            "resource_category": record.resource_category,
            "last_updated": record.last_updated
        })
        
        total_effort_weeks += record.total_effort_weeks
        if earliest_start_date is None or record.stage_start_date < earliest_start_date:
            earliest_start_date = record.stage_start_date
    
    return OpportunityEffortPrediction(
        opportunity_id=opportunity.opportunity_id,
        opportunity_name=timeline_records[0].opportunity_name,
        current_stage=opportunity.sales_stage or "01",
        category=timeline_records[0].category,
        tcv_millions=timeline_records[0].tcv_millions,
        decision_date=timeline_records[0].decision_date,
        service_line_timelines=service_line_timelines,
        service_line_categories=service_line_categories if service_line_categories else None,
        total_remaining_effort_weeks=total_effort_weeks,
        earliest_stage_start=earliest_start_date,
        supported_service_lines=service_lines
    )


@router.delete("/opportunity/{opportunity_id}/timeline")
def delete_opportunity_timeline(
    opportunity_id: int,
    session: Session = Depends(get_session)
):
    """
    Delete stored timeline for an opportunity.
    """
    # Get opportunity first to get the string opportunity_id
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Delete timeline records using string opportunity_id
    result = session.exec(
        delete(OpportunityResourceTimeline).where(
            OpportunityResourceTimeline.opportunity_id == opportunity.opportunity_id
        )
    )
    
    session.commit()
    
    # Check if any records were actually deleted
    deleted_count = result.rowcount
    
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="No timeline found for opportunity")
    
    return {"message": f"Successfully deleted {deleted_count} timeline records for opportunity {opportunity.opportunity_id}"}


@router.patch("/opportunity/{opportunity_id}/timeline/status")
def update_resource_timeline_status(
    opportunity_id: int,
    status_update: ResourceStatusUpdate,
    service_line: Optional[str] = Query(None, description="Update status for specific service line only"),
    stage_name: Optional[str] = Query(None, description="Update status for specific stage only"),
    session: Session = Depends(get_session)
):
    """
    Update resource status for opportunity timeline records.
    
    Can update all records for an opportunity, or filter by service line and/or stage.
    """
    # Validate status value
    valid_statuses = ["Predicted", "Forecast", "Planned"]
    if status_update.resource_status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Get opportunity first to get the string opportunity_id
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Build query for timeline records to update
    query = select(OpportunityResourceTimeline).where(
        OpportunityResourceTimeline.opportunity_id == opportunity.opportunity_id
    )
    
    if service_line:
        query = query.where(OpportunityResourceTimeline.service_line == service_line)
    if stage_name:
        query = query.where(OpportunityResourceTimeline.stage_name == stage_name)
    
    timeline_records = session.exec(query).all()
    
    if not timeline_records:
        raise HTTPException(status_code=404, detail="No matching timeline records found")
    
    # Update status and last_updated timestamp
    updated_count = 0
    for record in timeline_records:
        record.resource_status = status_update.resource_status
        record.last_updated = datetime.utcnow()
        session.add(record)
        updated_count += 1
    
    session.commit()
    
    return {
        "message": f"Successfully updated {updated_count} timeline records",
        "opportunity_id": opportunity.opportunity_id,
        "status": status_update.resource_status,
        "filters": {
            "service_line": service_line,
            "stage_name": stage_name
        }
    }


@router.patch("/opportunity/{opportunity_id}/timeline/data")
def update_resource_timeline_data(
    opportunity_id: int,
    timeline_update: ResourceTimelineUpdate,
    service_line: str = Query(..., description="Service line to update"),
    stage_name: str = Query(..., description="Stage name to update"),
    session: Session = Depends(get_session)
):
    """
    Update resource timeline data (dates, duration, FTE, status) for a specific stage.
    """
    # Get opportunity first to get the string opportunity_id
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Find the specific timeline record
    timeline_record = session.exec(
        select(OpportunityResourceTimeline).where(
            OpportunityResourceTimeline.opportunity_id == opportunity.opportunity_id,
            OpportunityResourceTimeline.service_line == service_line,
            OpportunityResourceTimeline.stage_name == stage_name
        )
    ).first()
    
    if not timeline_record:
        raise HTTPException(status_code=404, detail="Timeline record not found")
    
    # Update the record
    timeline_record.stage_start_date = timeline_update.stage_start_date
    timeline_record.stage_end_date = timeline_update.stage_end_date
    timeline_record.duration_weeks = timeline_update.duration_weeks
    timeline_record.fte_required = timeline_update.fte_required
    timeline_record.total_effort_weeks = timeline_update.duration_weeks * timeline_update.fte_required
    timeline_record.resource_status = timeline_update.resource_status
    timeline_record.last_updated = datetime.utcnow()
    
    session.add(timeline_record)
    session.commit()
    
    return {
        "message": "Timeline record updated successfully",
        "opportunity_id": opportunity.opportunity_id,
        "service_line": service_line,
        "stage_name": stage_name,
        "updated_fields": {
            "stage_start_date": timeline_update.stage_start_date,
            "stage_end_date": timeline_update.stage_end_date,
            "duration_weeks": timeline_update.duration_weeks,
            "fte_required": timeline_update.fte_required,
            "total_effort_weeks": timeline_record.total_effort_weeks,
            "resource_status": timeline_update.resource_status
        }
    }


@router.get("/portfolio/resource-forecast", response_model=PortfolioEffortPrediction)
def get_portfolio_resource_forecast(
    start_date: Optional[datetime] = Query(None, description="Start date for forecast period"),
    end_date: Optional[datetime] = Query(None, description="End date for forecast period"),
    time_period: str = Query("month", description="Time period aggregation: week, month, quarter"),
    service_line: List[str] = Query(default=[], description="Filter by service lines"),
    category: List[str] = Query(default=[], description="Filter by categories"), 
    stage: List[str] = Query(default=[], description="Filter by stages"),
    limit: int = Query(100, description="Maximum opportunities to process"),
    session: Session = Depends(get_session)
):
    """
    Get aggregated resource forecast across portfolio of opportunities.
    
    This endpoint aggregates stored timeline data to provide portfolio-level
    resource requirements over time periods.
    """
    # Build query for timeline records
    query = select(OpportunityResourceTimeline)
    
    # Apply date filters (ensure timezone handling)
    if start_date:
        # Remove timezone info for SQLite comparison
        start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        query = query.where(OpportunityResourceTimeline.stage_end_date >= start_date_naive)
    if end_date:
        # Remove timezone info for SQLite comparison
        end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
        query = query.where(OpportunityResourceTimeline.stage_start_date <= end_date_naive)
    
    # Use the list parameters directly (FastAPI handles multiple query params as lists)
    service_line_filters = service_line
    category_filters = category
    stage_filters = stage
    
    # Get all timeline records (don't apply business logic filters yet for time period forecast)
    timeline_records = session.exec(query.limit(limit * 10)).all()
    
    # Apply all filters for non-time-series aggregations
    filtered_timeline_records = timeline_records
    if service_line_filters:
        filtered_timeline_records = [r for r in filtered_timeline_records if r.service_line in service_line_filters]
    if category_filters:
        filtered_timeline_records = [r for r in filtered_timeline_records if r.category in category_filters]
    if stage_filters:
        filtered_timeline_records = [r for r in filtered_timeline_records if r.stage_name in stage_filters]
    
    # Aggregate data using filtered records for summary stats
    total_effort_weeks = 0
    service_line_totals = {sl: 0 for sl in SUPPORTED_SERVICE_LINES}
    stage_totals = {stage: 0 for stage in SALES_STAGES_ORDER}
    category_totals = {}
    opportunity_ids = set()
    
    for record in filtered_timeline_records:
        # Apply date filtering at record level for more precise control
        if start_date:
            start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            if record.stage_end_date < start_date_naive:
                continue
        if end_date:
            end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
            if record.stage_start_date > end_date_naive:
                continue
            
        effort = record.total_effort_weeks
        total_effort_weeks += effort
        
        service_line_totals[record.service_line] += effort
        stage_totals[record.stage_name] += effort
        
        if record.category not in category_totals:
            category_totals[record.category] = 0
        category_totals[record.category] += effort
        
        opportunity_ids.add(record.opportunity_id)
    
    # Generate time period forecast if date range provided, or use defaults
    time_period_forecast = None
    if start_date and end_date:
        # Ensure dates are timezone-naive for consistency
        start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
        time_period_forecast = _generate_time_period_forecast(
            timeline_records, start_date_naive, end_date_naive, time_period, 
            service_line, category, stage
        )
    else:
        # Provide default date range for time period forecast based on actual data
        from datetime import datetime, timedelta
        
        # Use broad default range to ensure we capture timeline data
        default_start = datetime(2024, 1, 1)  # Start of 2024
        default_end = datetime(2027, 12, 31)   # End of 2027
            
        time_period_forecast = _generate_time_period_forecast(
            timeline_records, default_start, default_end, time_period, 
            service_line, category, stage
        )
    
    return PortfolioEffortPrediction(
        total_opportunities_processed=len(opportunity_ids),
        total_effort_weeks=total_effort_weeks,
        service_line_breakdown=service_line_totals,
        stage_breakdown=stage_totals,
        category_breakdown=category_totals,
        forecast_period={
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "timeline_opportunities": len(opportunity_ids),
            "missing_timelines": _calculate_missing_timelines_count(session, service_line, category)
        },
        monthly_forecast=time_period_forecast,
        processed_opportunities=[]  # Can be populated if needed
    )


@router.get("/timeline-data-bounds")
def get_timeline_data_bounds(session: Session = Depends(get_session)):
    """
    Get the earliest and latest stage dates from opportunity timeline data.
    """
    from sqlmodel import func
    
    # Get earliest stage_start_date and latest stage_end_date
    result = session.exec(
        select(
            func.min(OpportunityResourceTimeline.stage_start_date).label('earliest_date'),
            func.max(OpportunityResourceTimeline.stage_end_date).label('latest_date')
        )
    ).first()
    
    if not result or not result.earliest_date:
        return {"earliest_date": None, "latest_date": None}
    
    return {
        "earliest_date": result.earliest_date.isoformat() if result.earliest_date else None,
        "latest_date": result.latest_date.isoformat() if result.latest_date else None
    }


@router.get("/stage-effort/{service_line}/{category}", response_model=StageEffortBreakdown)
def get_stage_effort_breakdown(
    service_line: str,
    category: str,
    session: Session = Depends(get_session)
):
    """
    Get stage effort breakdown for a specific service line and category.
    """
    from app.models.config import ServiceLineStageEffort, ServiceLineCategory
    
    if service_line not in SUPPORTED_SERVICE_LINES:
        raise HTTPException(status_code=400, detail=f"Service line {service_line} not supported")
    
    # Find the service line category record to get its ID
    category_record = session.exec(
        select(ServiceLineCategory).where(
            ServiceLineCategory.service_line == service_line,
            ServiceLineCategory.name == category
        )
    ).first()
    
    if not category_record:
        raise HTTPException(status_code=404, detail=f"Category '{category}' not found for service line {service_line}")
    
    # Get stage effort configuration
    stage_efforts = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line == service_line,
            ServiceLineStageEffort.service_line_category_id == category_record.id
        ).order_by(ServiceLineStageEffort.stage_name)
    ).all()
    
    if not stage_efforts:
        raise HTTPException(status_code=404, detail="No stage effort data found")
    
    stages = []
    total_duration = 0
    total_effort = 0
    
    for stage_effort in stage_efforts:
        stage_data = {
            "stage_name": stage_effort.stage_name,
            "duration_weeks": stage_effort.duration_weeks,
            "fte_required": stage_effort.fte_required,
            "total_effort_weeks": stage_effort.duration_weeks * stage_effort.fte_required
        }
        stages.append(stage_data)
        total_duration += stage_effort.duration_weeks
        total_effort += stage_data["total_effort_weeks"]
    
    return StageEffortBreakdown(
        service_line=service_line,
        category=category,
        stages=stages,
        total_duration_weeks=total_duration,
        total_effort_weeks=total_effort,
        last_updated=datetime.utcnow()
    )


def _generate_time_period_forecast(
    timeline_records: List[OpportunityResourceTimeline],
    start_date: datetime,
    end_date: datetime,
    time_period: str = "month",
    service_line_filter: List[str] = None,
    category_filter: List[str] = None,
    stage_filter: List[str] = None
) -> List[dict]:
    """
    Generate resource forecast using mean concurrent headcount for accurate capacity planning.
    Calculates daily concurrent FTE requirements and averages within time periods to ensure
    consistent peak numbers regardless of time period granularity.
    
    Args:
        timeline_records: Timeline records to aggregate
        start_date: Start date for forecast
        end_date: End date for forecast
        time_period: "week", "month", or "quarter"
    """
    import calendar
    from collections import defaultdict
    
    # Apply filters to get the relevant records
    filtered_records = timeline_records
    if service_line_filter:
        filtered_records = [r for r in filtered_records if r.service_line in service_line_filter]
    if category_filter:
        filtered_records = [r for r in filtered_records if r.category in category_filter]
    if stage_filter:
        filtered_records = [r for r in filtered_records if r.stage_name in stage_filter]
    
    # Group records by opportunity + service line for sequential stage handling
    opportunity_service_groups = defaultdict(list)
    for record in filtered_records:
        group_key = f"{record.opportunity_id}_{record.service_line}"
        opportunity_service_groups[group_key].append(record)
    
    # Calculate daily concurrent FTE for the entire date range
    current_date = start_date
    daily_fte = {}
    
    while current_date <= end_date:
        daily_fte[current_date] = {
            "total_fte": 0.0,
            "service_line_breakdown": defaultdict(float)
        }
        
        # For each opportunity+service line group, find concurrent FTE on this day
        for group_key, group_records in opportunity_service_groups.items():
            # Find the stage that is active on this date (sequential stages, not concurrent)
            active_stage = None
            for record in group_records:
                record_start = record.stage_start_date.replace(tzinfo=None) if record.stage_start_date.tzinfo else record.stage_start_date
                record_end = record.stage_end_date.replace(tzinfo=None) if record.stage_end_date.tzinfo else record.stage_end_date
                current_date_naive = current_date.replace(tzinfo=None) if current_date.tzinfo else current_date
                
                # Check if this stage is active on current_date
                if record_start <= current_date_naive <= record_end and record.duration_weeks > 0:
                    # Take the stage with highest FTE if multiple overlap (edge case)
                    if active_stage is None or record.fte_required > active_stage.fte_required:
                        active_stage = record
            
            # Add the active stage's FTE to daily totals
            if active_stage:
                daily_fte[current_date]["total_fte"] += active_stage.fte_required
                daily_fte[current_date]["service_line_breakdown"][active_stage.service_line] += active_stage.fte_required
        
        current_date += timedelta(days=1)
    
    # Generate time periods and calculate mean FTE for each period
    period_totals = {}
    
    if time_period == "week":
        # Align start_date to Monday
        week_start = start_date - timedelta(days=start_date.weekday())
        current_date = week_start
        while current_date <= end_date:
            year, week_num, _ = current_date.isocalendar()
            week_key = f"{year}-W{week_num:02d}"
            week_end = current_date + timedelta(days=6)
            
            period_totals[week_key] = {
                "period": current_date.strftime("%m/%d"),
                "period_start": current_date,
                "period_end": week_end,
                "total_fte": 0.0,
                "service_line_breakdown": defaultdict(float),
                "days_count": 0
            }
            current_date += timedelta(weeks=1)
            
    elif time_period == "quarter":
        # Start from first month of start_date's quarter
        quarter_month = ((start_date.month - 1) // 3) * 3 + 1
        current_date = start_date.replace(month=quarter_month, day=1)
        while current_date <= end_date:
            quarter_num = ((current_date.month - 1) // 3) + 1
            quarter_key = f"{current_date.year}-Q{quarter_num}"
            
            # Calculate end of quarter
            end_month = current_date.month + 2  # 3 months - 1
            if end_month > 12:
                quarter_end = current_date.replace(year=current_date.year + 1, month=end_month - 12)
            else:
                quarter_end = current_date.replace(month=end_month)
            _, last_day = calendar.monthrange(quarter_end.year, quarter_end.month)
            quarter_end = quarter_end.replace(day=last_day)
            
            period_totals[quarter_key] = {
                "period": quarter_key,
                "period_start": current_date,
                "period_end": quarter_end,
                "total_fte": 0.0,
                "service_line_breakdown": defaultdict(float),
                "days_count": 0
            }
            
            # Move to next quarter
            next_quarter_month = current_date.month + 3
            if next_quarter_month > 12:
                current_date = current_date.replace(year=current_date.year + 1, month=next_quarter_month - 12)
            else:
                current_date = current_date.replace(month=next_quarter_month)
                
    else:  # Default to month
        current_date = start_date.replace(day=1)
        while current_date <= end_date:
            month_key = current_date.strftime("%Y-%m")
            _, last_day = calendar.monthrange(current_date.year, current_date.month)
            month_end = current_date.replace(day=last_day)
            
            period_totals[month_key] = {
                "period": current_date.strftime("%b %y"),
                "period_start": current_date,
                "period_end": month_end,
                "total_fte": 0.0,
                "service_line_breakdown": defaultdict(float),
                "days_count": 0
            }
            
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
    
    # Calculate mean FTE for each period using daily data
    for period_key, period_data in period_totals.items():
        period_start = period_data["period_start"]
        period_end = period_data["period_end"]
        
        # Sum daily FTE values for this period
        total_daily_fte = 0.0
        service_line_daily_totals = defaultdict(float)
        days_in_period = 0
        
        current_day = max(period_start, start_date)
        while current_day <= min(period_end, end_date):
            if current_day in daily_fte:
                total_daily_fte += daily_fte[current_day]["total_fte"]
                for sl, fte in daily_fte[current_day]["service_line_breakdown"].items():
                    service_line_daily_totals[sl] += fte
                days_in_period += 1
            current_day += timedelta(days=1)
        
        # Calculate mean FTE for the period
        if days_in_period > 0:
            period_data["total_fte"] = total_daily_fte / days_in_period
            for sl in ["CES", "INS", "BPS", "SEC", "ITOC", "MW"]:
                period_data["service_line_breakdown"][sl] = service_line_daily_totals[sl] / days_in_period
        
        period_data["days_count"] = days_in_period
    
    # Convert to list format for frontend
    time_period_forecast = []
    for period_key in sorted(period_totals.keys()):
        period_data = period_totals[period_key]
        
        # Format service line data
        all_service_lines = ["CES", "INS", "BPS", "SEC", "ITOC", "MW"]
        service_lines_data = {}
        for sl in all_service_lines:
            service_lines_data[sl] = round(period_data["service_line_breakdown"].get(sl, 0.0), 2)
        
        time_period_forecast.append({
            "month": period_data["period"],  # Keep "month" key for frontend compatibility
            "total_fte": round(period_data["total_fte"], 2),
            "service_lines": service_lines_data
        })
    
    return time_period_forecast


# Timeline Generation Endpoints

class TimelineGenerationStats(BaseModel):
    """Response model for timeline generation statistics."""
    total_opportunities: int
    eligible_for_generation: int
    existing_timelines: int
    predicted_timelines: int
    generated: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0


class ProcessedOpportunity(BaseModel):
    """Individual opportunity processing result."""
    id: str
    name: str
    action: str  # 'generated', 'updated', 'skipped', 'error'
    reason: Optional[str] = None


class TimelineGenerationResult(BaseModel):
    """Response model for bulk timeline generation."""
    success: bool
    message: str
    stats: TimelineGenerationStats
    processed_opportunities: List[ProcessedOpportunity]


@router.get("/timeline-generation/stats", response_model=TimelineGenerationStats)
def get_timeline_generation_stats(
    custom_tracking_filter: Optional[str] = Query(None, description="Comma-separated list of custom_tracking_field_2 values to filter by"),
    session: Session = Depends(get_session)
):
    """
    Get statistics for timeline generation - how many opportunities are eligible,
    have existing timelines, etc.
    
    - custom_tracking_filter: Optional comma-separated list of custom_tracking_field_2 values (e.g., "GREEN,AMBER,RED")
    """
    # Parse custom tracking filter
    tracking_values = []
    if custom_tracking_filter:
        tracking_values = [v.strip() for v in custom_tracking_filter.split(',') if v.strip()]
    
    # Get opportunities based on custom tracking filter
    query = select(Opportunity)
    if tracking_values:
        query = query.where(Opportunity.custom_tracking_field_2.in_(tracking_values))
    
    opportunities = session.exec(query).all()
    total_opportunities = len(opportunities)
    
    eligible_count = 0
    existing_timelines = 0
    predicted_timelines = 0
    
    for opp in opportunities:
        # Check if eligible for timeline generation
        is_eligible = _is_opportunity_eligible_for_generation(opp, session)
        if is_eligible:
            eligible_count += 1
            
        # Check existing timeline
        existing_timeline = session.exec(
            select(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.opportunity_id == opp.opportunity_id
            ).limit(1)
        ).first()
        
        if existing_timeline:
            existing_timelines += 1
            # Check if any timeline records are in Predicted status
            predicted_records = session.exec(
                select(OpportunityResourceTimeline).where(
                    OpportunityResourceTimeline.opportunity_id == opp.opportunity_id,
                    OpportunityResourceTimeline.resource_status == "Predicted"
                ).limit(1)
            ).first()
            if predicted_records:
                predicted_timelines += 1
    
    return TimelineGenerationStats(
        total_opportunities=total_opportunities,
        eligible_for_generation=eligible_count,
        existing_timelines=existing_timelines,
        predicted_timelines=predicted_timelines
    )


@router.delete("/timeline-generation/clear-predicted")
def clear_all_predicted_timelines(session: Session = Depends(get_session)):
    """
    Clear all timeline records with 'Predicted' status across all opportunities.
    """
    try:
        # Delete all timeline records with Predicted status
        result = session.exec(
            delete(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.resource_status == "Predicted"
            )
        )
        
        session.commit()
        deleted_count = result.rowcount
        
        return {
            "success": True,
            "message": f"Successfully cleared {deleted_count} predicted timeline records",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Error clearing predicted timelines: {str(e)}")


@router.post("/timeline-generation/bulk", response_model=TimelineGenerationResult)
def generate_bulk_timelines(
    request_data: dict = {},
    session: Session = Depends(get_session)
):
    """
    Generate timelines for all eligible opportunities.
    
    - regenerateAll: If True, regenerates timelines for opportunities with 'Predicted' status
    - If False, only generates timelines for opportunities without existing timelines
    - customTrackingFilter: If provided, only processes opportunities with matching custom_tracking_field_2 values
    """
    regenerate_all = request_data.get("regenerateAll", False)
    custom_tracking_filter = request_data.get("customTrackingFilter", [])
    
    # Get opportunities based on custom tracking filter
    query = select(Opportunity)
    if custom_tracking_filter:
        query = query.where(Opportunity.custom_tracking_field_2.in_(custom_tracking_filter))
    
    opportunities = session.exec(query).all()
    
    stats = TimelineGenerationStats(
        total_opportunities=len(opportunities),
        eligible_for_generation=0,
        existing_timelines=0,
        predicted_timelines=0
    )
    
    processed_opportunities = []
    
    for opp in opportunities:
        try:
            # Check if eligible for timeline generation
            is_eligible = _is_opportunity_eligible_for_generation(opp, session)
            if is_eligible:
                stats.eligible_for_generation += 1
                
            # Check existing timeline
            existing_timeline = session.exec(
                select(OpportunityResourceTimeline).where(
                    OpportunityResourceTimeline.opportunity_id == opp.opportunity_id
                ).limit(1)
            ).first()
            
            if existing_timeline:
                stats.existing_timelines += 1
                
                # Check if in Predicted status for regeneration
                has_predicted = session.exec(
                    select(OpportunityResourceTimeline).where(
                        OpportunityResourceTimeline.opportunity_id == opp.opportunity_id,
                        OpportunityResourceTimeline.resource_status == "Predicted"
                    ).limit(1)
                ).first()
                
                if has_predicted:
                    stats.predicted_timelines += 1
                    
                    if regenerate_all and is_eligible:
                        # Regenerate timeline - check if it actually creates records
                        try:
                            _generate_timeline_for_opportunity(opp, session)
                            # Check if timeline was actually created (not skipped due to zero FTE)
                            updated_timeline = session.exec(
                                select(OpportunityResourceTimeline).where(
                                    OpportunityResourceTimeline.opportunity_id == opp.opportunity_id
                                ).limit(1)
                            ).first()
                            
                            if updated_timeline:
                                stats.updated += 1
                                processed_opportunities.append(ProcessedOpportunity(
                                    id=opp.opportunity_id,
                                    name=opp.opportunity_name,
                                    action="updated",
                                    reason="Regenerated Predicted timeline"
                                ))
                            else:
                                stats.skipped += 1
                                processed_opportunities.append(ProcessedOpportunity(
                                    id=opp.opportunity_id,
                                    name=opp.opportunity_name,
                                    action="skipped",
                                    reason="Timeline regeneration skipped due to zero FTE requirements"
                                ))
                        except Exception as e:
                            stats.errors += 1
                            processed_opportunities.append(ProcessedOpportunity(
                                id=opp.opportunity_id,
                                name=opp.opportunity_name,
                                action="error",
                                reason=f"Regeneration error: {str(e)}"
                            ))
                    else:
                        stats.skipped += 1
                        processed_opportunities.append(ProcessedOpportunity(
                            id=opp.opportunity_id,
                            name=opp.opportunity_name,
                            action="skipped",
                            reason="Has non-Predicted timeline" if not regenerate_all else "Not eligible"
                        ))
                else:
                    # Has timeline but not in Predicted status
                    stats.skipped += 1
                    processed_opportunities.append(ProcessedOpportunity(
                        id=opp.opportunity_id,
                        name=opp.opportunity_name,
                        action="skipped",
                        reason="Timeline exists with non-Predicted status"
                    ))
            else:
                # No existing timeline
                if is_eligible:
                    # Generate new timeline - check if it actually creates records
                    try:
                        _generate_timeline_for_opportunity(opp, session)
                        # Check if timeline was actually created (not skipped due to zero FTE)
                        created_timeline = session.exec(
                            select(OpportunityResourceTimeline).where(
                                OpportunityResourceTimeline.opportunity_id == opp.opportunity_id
                            ).limit(1)
                        ).first()
                        
                        if created_timeline:
                            stats.generated += 1
                            processed_opportunities.append(ProcessedOpportunity(
                                id=opp.opportunity_id,
                                name=opp.opportunity_name,
                                action="generated",
                                reason="Created new timeline"
                            ))
                        else:
                            stats.skipped += 1
                            processed_opportunities.append(ProcessedOpportunity(
                                id=opp.opportunity_id,
                                name=opp.opportunity_name,
                                action="skipped",
                                reason="Timeline skipped due to zero FTE requirements"
                            ))
                    except Exception as e:
                        stats.errors += 1
                        processed_opportunities.append(ProcessedOpportunity(
                            id=opp.opportunity_id,
                            name=opp.opportunity_name,
                            action="error",
                            reason=f"Generation error: {str(e)}"
                        ))
                else:
                    stats.skipped += 1
                    processed_opportunities.append(ProcessedOpportunity(
                        id=opp.opportunity_id,
                        name=opp.opportunity_name,
                        action="skipped",
                        reason="Not eligible for timeline generation"
                    ))
                    
        except Exception as e:
            stats.errors += 1
            processed_opportunities.append(ProcessedOpportunity(
                id=opp.opportunity_id,
                name=opp.opportunity_name,
                action="error",
                reason=f"Error: {str(e)}"
            ))
    
    session.commit()
    
    success_count = stats.generated + stats.updated
    total_processed = stats.generated + stats.updated + stats.skipped + stats.errors
    
    return TimelineGenerationResult(
        success=stats.errors == 0,
        message=f"Processed {total_processed} opportunities: {stats.generated} generated, {stats.updated} updated, {stats.skipped} skipped, {stats.errors} errors",
        stats=stats,
        processed_opportunities=processed_opportunities
    )


def _calculate_missing_timelines_count(session: Session, 
                                     service_line_filter: Optional[str] = None,
                                     category_filter: Optional[str] = None) -> int:
    """
    Calculate how many opportunities are eligible for timeline generation but don't have timelines.
    
    Returns count of opportunities that:
    - Are eligible for timeline generation (_is_opportunity_eligible_for_generation)
    - Do NOT have existing OpportunityResourceTimeline records
    - Match any provided filters
    """
    from app.models.config import OpportunityCategory
    
    # Get all opportunities
    opportunities = session.exec(select(Opportunity)).all()
    
    missing_count = 0
    for opp in opportunities:
        # Check eligibility first
        if not _is_opportunity_eligible_for_generation(opp, session):
            continue
            
        # Check if timeline already exists
        existing_timeline = session.exec(
            select(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.opportunity_id == opp.opportunity_id
            ).limit(1)
        ).first()
        
        if existing_timeline:
            continue  # Has timeline, not missing
            
        # Apply filters if provided
        if service_line_filter or category_filter:
            # Check if this opportunity would generate timeline for filtered service line/category
            if category_filter:
                # Get opportunity category
                categories = session.exec(select(OpportunityCategory)).all()
                opp_category = None
                for cat in categories:
                    if cat.min_tcv <= (opp.tcv_millions or 0) <= (cat.max_tcv or float('inf')):
                        opp_category = cat.name
                        break
                
                if opp_category != category_filter:
                    continue
                    
            if service_line_filter:
                # Check which service lines this opportunity would process
                service_lines_to_process = []
                if opp.mw_millions and opp.mw_millions > 0:
                    service_lines_to_process.append("MW")
                if opp.itoc_millions and opp.itoc_millions > 0:
                    service_lines_to_process.append("ITOC")
                if not service_lines_to_process and opp.lead_offering_l1 in SUPPORTED_SERVICE_LINES:
                    service_lines_to_process.append(opp.lead_offering_l1)
                    
                if service_line_filter not in service_lines_to_process:
                    continue
        
        missing_count += 1
    
    return missing_count


def _is_opportunity_eligible_for_generation(opportunity: Opportunity, session: Session) -> bool:
    """
    Check if an opportunity is eligible for timeline generation.
    
    Criteria:
    - Has TCV and decision date
    - Has timeline category (determined from total TCV)
    - Has service line revenue (mw_millions or itoc_millions > 0) OR lead_offering_l1 in supported service lines
    - Service line can determine resource category from its TCV
    - Service line stage effort configuration exists
    """
    # Check basic requirements
    if not opportunity.tcv_millions or not opportunity.decision_date:
        return False
    
    from app.models.config import ServiceLineStageEffort, OpportunityCategory, ServiceLineCategory
    from app.services.resource_calculation import determine_opportunity_category, determine_service_line_resource_category
    
    # Get timeline category from total TCV
    timeline_category = determine_opportunity_category(opportunity.tcv_millions, session)
    if not timeline_category:
        return False
    
    # Determine which service lines to check (matching calculate_opportunity_resource_timeline logic)
    service_lines_to_check = []
    
    # Check MW service line
    if opportunity.mw_millions and opportunity.mw_millions > 0:
        service_lines_to_check.append(("MW", opportunity.mw_millions))
    
    # Check ITOC service line  
    if opportunity.itoc_millions and opportunity.itoc_millions > 0:
        service_lines_to_check.append(("ITOC", opportunity.itoc_millions))
    
    # Fallback to lead offering if no service line revenue
    if not service_lines_to_check and opportunity.lead_offering_l1:
        if opportunity.lead_offering_l1 in SUPPORTED_SERVICE_LINES:
            # Use a default small amount for resource category when no specific revenue
            service_lines_to_check.append((opportunity.lead_offering_l1, 1.0))
    
    if not service_lines_to_check:
        return False
    
    # Check if at least one service line is eligible
    for service_line, service_line_tcv in service_lines_to_check:
        # Determine resource category based on service line TCV
        resource_category = determine_service_line_resource_category(service_line, service_line_tcv, session)
        if not resource_category:
            continue
            
        # Find the resource category record to get its ID
        category_record = session.exec(
            select(ServiceLineCategory).where(
                ServiceLineCategory.service_line == service_line,
                ServiceLineCategory.name == resource_category
            )
        ).first()
        
        if not category_record:
            continue
        
        # Check if stage effort configuration exists for this service line + resource category
        stage_effort = session.exec(
            select(ServiceLineStageEffort).where(
                ServiceLineStageEffort.service_line == service_line,
                ServiceLineStageEffort.service_line_category_id == category_record.id
            ).limit(1)
        ).first()
        
        if stage_effort:
            return True
    
    return False


def _generate_timeline_for_opportunity(opportunity: Opportunity, session: Session):
    """
    Generate timeline for a single opportunity using the existing calculation service.
    """
    try:
        # Use the existing calculate_opportunity_resource_timeline service
        timeline_data = calculate_opportunity_resource_timeline(opportunity.id, session)
        
        # Calculate total FTE across all stages and service lines
        total_fte = 0
        for service_line, stages in timeline_data["service_line_timelines"].items():
            for stage_data in stages:
                total_fte += stage_data["fte_required"]
        
        # Skip creating timeline if total FTE is 0
        if total_fte == 0:
            return
        
        # Clear existing timeline data
        session.exec(
            delete(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.opportunity_id == opportunity.opportunity_id
            )
        )
        
        # Store new timeline data
        for service_line, stages in timeline_data["service_line_timelines"].items():
            # Get resource category for this service line
            resource_category = None
            if "service_line_categories" in timeline_data and service_line in timeline_data["service_line_categories"]:
                resource_category = timeline_data["service_line_categories"][service_line]["resource_category"]
                
            for stage_data in stages:
                timeline_record = OpportunityResourceTimeline(
                    opportunity_id=timeline_data["opportunity_id"],
                    service_line=service_line,
                    stage_name=stage_data["stage_name"],
                    stage_start_date=stage_data["stage_start_date"],
                    stage_end_date=stage_data["stage_end_date"],
                    duration_weeks=stage_data["duration_weeks"],
                    fte_required=stage_data["fte_required"],
                    total_effort_weeks=stage_data["total_effort_weeks"],
                    opportunity_name=timeline_data["opportunity_name"],
                    category=timeline_data["category"],
                    resource_category=resource_category or stage_data.get("resource_category"),
                    tcv_millions=timeline_data["tcv_millions"],
                    decision_date=timeline_data["decision_date"],
                    calculated_date=datetime.utcnow(),
                    resource_status="Predicted"  # Set as Predicted for bulk generation
                )
                session.add(timeline_record)
                
    except Exception as e:
        # Re-raise with more context for debugging
        raise RuntimeError(f"Failed to generate timeline for opportunity: {str(e)}") from e


@router.get("/portfolio/stage-resource-timeline")
def get_stage_resource_timeline(
    start_date: Optional[datetime] = Query(None, description="Start date for forecast period"),
    end_date: Optional[datetime] = Query(None, description="End date for forecast period"),
    time_period: str = Query("month", description="Time period aggregation: week, month, quarter"),
    service_line: List[str] = Query(default=[], description="Filter by service lines"),
    category: List[str] = Query(default=[], description="Filter by categories"), 
    stage: List[str] = Query(default=[], description="Filter by stages"),
    limit: int = Query(100, description="Maximum opportunities to process"),
    session: Session = Depends(get_session)
):
    """
    Get stage-based resource timeline showing FTE requirements by time period,
    broken down by service line and current opportunity stage.
    
    Returns data structured for stacked charts where each service line has its own
    stack showing FTE requirements from opportunities currently in different stages.
    """
    from collections import defaultdict
    from datetime import timedelta
    
    # Build query for timeline records with opportunity data
    query = select(OpportunityResourceTimeline, Opportunity).join(
        Opportunity, OpportunityResourceTimeline.opportunity_id == Opportunity.opportunity_id
    )
    
    # Apply date filters
    if start_date:
        start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        query = query.where(OpportunityResourceTimeline.stage_end_date >= start_date_naive)
    if end_date:
        end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
        query = query.where(OpportunityResourceTimeline.stage_start_date <= end_date_naive)
    
    # Apply filters
    if service_line:
        query = query.where(OpportunityResourceTimeline.service_line.in_(service_line))
    if category:
        query = query.where(OpportunityResourceTimeline.category.in_(category))
    if stage:
        query = query.where(Opportunity.sales_stage.in_(stage))
    
    # Get timeline records with opportunity data
    results = session.exec(query.limit(limit * 10)).all()
    
    # Set default date range if not provided
    if not start_date or not end_date:
        from datetime import datetime
        if not start_date:
            start_date = datetime(2024, 1, 1)
        if not end_date:
            end_date = datetime(2027, 12, 31)
    
    # Generate time periods
    period_data = {}
    
    if time_period == "week":
        # Align start_date to Monday BEFORE the loop
        week_start = start_date - timedelta(days=start_date.weekday())
        current_date = week_start
    elif time_period == "month":
        current_date = start_date.replace(day=1)
    else:
        current_date = start_date
    
    while current_date <= end_date:
        if time_period == "week":
            # Use ISO week numbering to avoid conflicts
            year, week_num, _ = current_date.isocalendar()
            period_key = f"{year}-W{week_num:02d}"
            display_period = current_date.strftime("%m/%d")
            next_date = current_date + timedelta(weeks=1)
        elif time_period == "quarter":
            quarter_month = ((current_date.month - 1) // 3) * 3 + 1
            current_date = current_date.replace(month=quarter_month, day=1)
            quarter_num = ((current_date.month - 1) // 3) + 1
            period_key = f"{current_date.year}-Q{quarter_num}"
            display_period = period_key
            # Move to next quarter
            next_quarter_month = current_date.month + 3
            if next_quarter_month > 12:
                next_date = current_date.replace(year=current_date.year + 1, month=next_quarter_month - 12)
            else:
                next_date = current_date.replace(month=next_quarter_month)
        else:  # month
            period_key = current_date.strftime("%Y-%m")
            display_period = current_date.strftime("%b %y")
            next_month = current_date.month + 1
            next_year = current_date.year
            if next_month > 12:
                next_month = 1
                next_year += 1
            next_date = current_date.replace(year=next_year, month=next_month)
        
        period_data[period_key] = {
            "period": display_period,
            "period_start": current_date,
            "period_end": next_date - timedelta(days=1),
            "service_line_stage_breakdown": defaultdict(float),
            "total_fte": 0,
        }
        current_date = next_date
    
    # Process timeline records
    total_opportunities_processed = set()
    total_effort_weeks = 0
    service_line_breakdown = defaultdict(float)
    stage_breakdown = defaultdict(float)
    category_breakdown = defaultdict(float)
    
    # Group timeline records by opportunity + service line to handle sequential stages correctly
    opportunity_service_groups = defaultdict(list)
    for timeline_record, opportunity in results:
        group_key = f"{timeline_record.opportunity_id}_{timeline_record.service_line}"
        opportunity_service_groups[group_key].append((timeline_record, opportunity))
    
    for group_key, group_records in opportunity_service_groups.items():
        # Get current opportunity stage from first record
        current_stage = group_records[0][1].sales_stage or "01"
        
        # For each period, find the maximum FTE needed within this opportunity+service line group
        for period_key, period_info in period_data.items():
            period_start = period_info["period_start"]
            period_end = period_info["period_end"]
            
            # Make sure all dates are timezone-naive for comparison
            period_start = period_start.replace(tzinfo=None) if period_start.tzinfo else period_start
            period_end = period_end.replace(tzinfo=None) if period_end.tzinfo else period_end
            
            # Find all stages within this group that overlap with this period
            overlapping_stages = []
            for timeline_record, opportunity in group_records:
                record_start = timeline_record.stage_start_date.replace(tzinfo=None) if timeline_record.stage_start_date.tzinfo else timeline_record.stage_start_date
                record_end = timeline_record.stage_end_date.replace(tzinfo=None) if timeline_record.stage_end_date.tzinfo else timeline_record.stage_end_date
                
                # Check if timeline record overlaps with this period
                if (record_start <= period_end and record_end >= period_start):
                    # Skip zero-duration stages
                    if timeline_record.duration_weeks > 0:
                        overlapping_stages.append(timeline_record)
            
            # Take maximum FTE from overlapping stages (not sum) - stages are sequential, not concurrent
            if overlapping_stages:
                max_fte = max(stage.fte_required for stage in overlapping_stages)
                
                # For display purposes, use the stage with the highest FTE for this period
                # (In practice, FTE should be the same for sequential stages, but this handles edge cases)
                representative_stage = max(overlapping_stages, key=lambda s: s.fte_required)
                
                # Create key for service line + actual stage combination
                service_stage_key = f"{representative_stage.service_line}_{representative_stage.stage_name}"
                
                period_info["service_line_stage_breakdown"][service_stage_key] += max_fte
                period_info["total_fte"] += max_fte
        
        # Track overall statistics (use first record from group for stats)
        first_record = group_records[0][0]
        total_opportunities_processed.add(first_record.opportunity_id)
        for timeline_record, _ in group_records:
            total_effort_weeks += timeline_record.total_effort_weeks
            service_line_breakdown[timeline_record.service_line] += timeline_record.total_effort_weeks
            stage_breakdown[current_stage] += timeline_record.total_effort_weeks
            category_breakdown[timeline_record.category] += timeline_record.total_effort_weeks
    
    # Convert defaultdicts to regular dicts for JSON serialization
    monthly_forecast = []
    for period_key in sorted(period_data.keys()):
        period_info = period_data[period_key]
        monthly_forecast.append({
            "period": period_info["period"],
            "total_fte": round(period_info["total_fte"], 2),
            "service_line_stage_breakdown": dict(period_info["service_line_stage_breakdown"])
        })
    
    # Calculate missing timelines (opportunities eligible but without timelines)
    missing_timelines = _calculate_missing_timelines_count(session, service_line, category)
    
    return {
        "monthly_forecast": monthly_forecast,
        "total_opportunities_processed": len(total_opportunities_processed),
        "total_effort_weeks": round(total_effort_weeks, 2),
        "service_line_breakdown": dict(service_line_breakdown),
        "stage_breakdown": dict(stage_breakdown),
        "category_breakdown": dict(category_breakdown),
        "forecast_period": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "timeline_opportunities": len(total_opportunities_processed),
            "missing_timelines": missing_timelines
        }
    }