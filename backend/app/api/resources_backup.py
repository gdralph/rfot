"""
Resource forecasting API endpoints for FTE timeline calculations.
"""
from datetime import datetime, timedelta
from typing import List, Optional
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
    total_effort_weeks = 0
    earliest_start_date = None
    service_lines = []
    
    for record in timeline_records:
        service_line = record.service_line
        if service_line not in service_line_timelines:
            service_line_timelines[service_line] = []
            service_lines.append(service_line)
        
        service_line_timelines[service_line].append({
            "stage_name": record.stage_name,
            "stage_start_date": record.stage_start_date,
            "stage_end_date": record.stage_end_date,
            "duration_weeks": record.duration_weeks,
            "fte_required": record.fte_required,
            "total_effort_weeks": record.total_effort_weeks,
            "resource_status": record.resource_status,
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
    service_line: Optional[str] = Query(None, description="Filter by service line"),
    category: Optional[str] = Query(None, description="Filter by category"),
    stage: Optional[str] = Query(None, description="Filter by stage"),
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
    
    # Apply filters (ensure timezone handling)
    if start_date:
        # Remove timezone info for SQLite comparison
        start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        query = query.where(OpportunityResourceTimeline.stage_end_date >= start_date_naive)
    if end_date:
        # Remove timezone info for SQLite comparison
        end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
        query = query.where(OpportunityResourceTimeline.stage_start_date <= end_date_naive)
    if service_line:
        query = query.where(OpportunityResourceTimeline.service_line == service_line)
    if category:
        query = query.where(OpportunityResourceTimeline.category == category)
    if stage:
        query = query.where(OpportunityResourceTimeline.stage_name == stage)
    
    timeline_records = session.exec(query.limit(limit * 10)).all()  # Get more records for aggregation
    
    # Aggregate data
    total_effort_weeks = 0
    service_line_totals = {sl: 0 for sl in SUPPORTED_SERVICE_LINES}
    stage_totals = {stage: 0 for stage in SALES_STAGES_ORDER}
    category_totals = {}
    opportunity_ids = set()
    
    for record in timeline_records:
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
    
    # Generate time period forecast if date range provided
    time_period_forecast = None
    if start_date and end_date:
        # Ensure dates are timezone-naive for consistency
        start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        end_date_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
        time_period_forecast = _generate_time_period_forecast(
            timeline_records, start_date_naive, end_date_naive, time_period
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
            "missing_timelines": 0  # TODO: Calculate missing timelines
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
    from app.models.config import ServiceLineStageEffort
    
    if service_line not in SUPPORTED_SERVICE_LINES:
        raise HTTPException(status_code=400, detail=f"Service line {service_line} not supported")
    
    # Find the category record to get its ID
    category_record = session.exec(
        select(OpportunityCategory).where(OpportunityCategory.name == category)
    ).first()
    
    if not category_record:
        raise HTTPException(status_code=404, detail=f"Category '{category}' not found")
    
    # Get stage effort configuration
    stage_efforts = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line == service_line,
            ServiceLineStageEffort.category_id == category_record.id
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
    time_period: str = "month"
) -> List[dict]:
    """
    Generate resource forecast using average daily FTE for headcount planning.
    Calculates daily concurrent FTE requirements and averages within time periods.
    
    Args:
        timeline_records: Timeline records to aggregate
        start_date: Start date for forecast
        end_date: End date for forecast
        time_period: "week", "month", or "quarter"
    """
    period_totals = {}
    
    # Generate period keys based on time_period
    if time_period == "week":
        # Start from Monday of start_date's week
        current_date = start_date - timedelta(days=start_date.weekday())
        while current_date <= end_date:
            week_key = current_date.strftime("%Y-W%U")  # Year-Week format
            period_totals[week_key] = {
                "period": current_date.strftime("%m/%d"),  # MM/DD format for display
                "period_start": current_date,
                "total_fte": 0,
                "opportunities_count": set(),
                "service_line_breakdown": {sl: 0 for sl in SUPPORTED_SERVICE_LINES}
            }
            current_date += timedelta(weeks=1)
            
    elif time_period == "quarter":
        # Start from first month of start_date's quarter
        quarter_month = ((start_date.month - 1) // 3) * 3 + 1
        current_date = start_date.replace(month=quarter_month, day=1)
        while current_date <= end_date:
            quarter_num = ((current_date.month - 1) // 3) + 1
            quarter_key = f"{current_date.year}-Q{quarter_num}"
            period_totals[quarter_key] = {
                "period": quarter_key,
                "period_start": current_date,
                "total_fte": 0,
                "opportunities_count": set(),
                "service_line_breakdown": {sl: 0 for sl in SUPPORTED_SERVICE_LINES}
            }
            # Move to next quarter
            next_quarter_month = current_date.month + 3
            if next_quarter_month > 12:
                current_date = current_date.replace(year=current_date.year + 1, month=next_quarter_month - 12)
            else:
                current_date = current_date.replace(month=next_quarter_month)
                
    else:  # Default to month
        current_date = start_date.replace(day=1)  # First day of start month
        while current_date <= end_date:
            month_key = current_date.strftime("%Y-%m")
            period_totals[month_key] = {
                "period": current_date.strftime("%b %y"),  # Short month year format
                "period_start": current_date,
                "total_fte": 0,
                "opportunities_count": set(),
                "service_line_breakdown": {sl: 0 for sl in SUPPORTED_SERVICE_LINES}
            }
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
    
    # Aggregate records by period - track FTE rates during active periods
    for record in timeline_records:
        stage_start = record.stage_start_date
        stage_end = record.stage_end_date
        
        for period_key, period_data in period_totals.items():
            period_start = period_data["period_start"]
            
            # Calculate period end based on time_period
            if time_period == "week":
                period_end = period_start + timedelta(days=6)
            elif time_period == "quarter":
                # End of quarter (last day of 3rd month)
                month_offset = 2  # 3 months - 1
                end_month = period_start.month + month_offset
                if end_month > 12:
                    period_end = period_start.replace(year=period_start.year + 1, month=end_month - 12)
                else:
                    period_end = period_start.replace(month=end_month)
                # Last day of the month
                import calendar
                _, last_day = calendar.monthrange(period_end.year, period_end.month)
                period_end = period_end.replace(day=last_day)
            else:  # month
                # Last day of month
                import calendar
                _, last_day = calendar.monthrange(period_start.year, period_start.month)
                period_end = period_start.replace(day=last_day)
            
            # Check if stage overlaps with this period
            if stage_end >= period_start and stage_start <= period_end:
                # For headcount planning, we need peak concurrent FTE during the period
                # If a stage is active during this period, the full FTE applies
                period_totals[period_key]["total_fte"] += record.fte_required
                period_totals[period_key]["opportunities_count"].add(record.opportunity_id)
                period_totals[period_key]["service_line_breakdown"][record.service_line] += record.fte_required
    
    # Convert to list format with correct structure
    time_period_forecast = []
    for period_key in sorted(period_totals.keys()):
        period_data = period_totals[period_key]
        
        time_period_forecast.append({
            "month": period_data["period"],  # Keep "month" key for frontend compatibility
            "total_fte": round(period_data["total_fte"], 2),
            "service_lines": {
                sl: round(fte, 2) 
                for sl, fte in period_data["service_line_breakdown"].items()
            }
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
def get_timeline_generation_stats(session: Session = Depends(get_session)):
    """
    Get statistics for timeline generation - how many opportunities are eligible,
    have existing timelines, etc.
    """
    # Get all opportunities
    opportunities = session.exec(select(Opportunity)).all()
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


@router.post("/timeline-generation/bulk", response_model=TimelineGenerationResult)
def generate_bulk_timelines(
    request_data: dict = {},
    session: Session = Depends(get_session)
):
    """
    Generate timelines for all eligible opportunities.
    
    - regenerateAll: If True, regenerates timelines for opportunities with 'Predicted' status
    - If False, only generates timelines for opportunities without existing timelines
    """
    regenerate_all = request_data.get("regenerateAll", False)
    
    # Get all opportunities
    opportunities = session.exec(select(Opportunity)).all()
    
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
                        # Regenerate timeline
                        _generate_timeline_for_opportunity(opp, session)
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
                    # Generate new timeline
                    _generate_timeline_for_opportunity(opp, session)
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


def _is_opportunity_eligible_for_generation(opportunity: Opportunity, session: Session) -> bool:
    """
    Check if an opportunity is eligible for timeline generation.
    
    Criteria:
    - Has TCV and decision date
    - Has category (determined from TCV)
    - Has service line revenue (mw_millions or itoc_millions > 0) OR lead_offering_l1 in supported service lines
    - Service line stage effort configuration exists for determined service line + category
    """
    # Check basic requirements
    if not opportunity.tcv_millions or not opportunity.decision_date:
        return False
    
    from app.models.config import ServiceLineStageEffort, OpportunityCategory
    
    # Get category from TCV
    categories = session.exec(select(OpportunityCategory)).all()
    category = None
    for cat in categories:
        if cat.min_tcv <= opportunity.tcv_millions <= (cat.max_tcv or float('inf')):
            category = cat.name
            break
    
    if not category:
        return False
    
    # Determine which service lines to check (matching calculate_opportunity_resource_timeline logic)
    service_lines_to_check = []
    
    # Check MW service line
    if opportunity.mw_millions and opportunity.mw_millions > 0:
        service_lines_to_check.append("MW")
    
    # Check ITOC service line  
    if opportunity.itoc_millions and opportunity.itoc_millions > 0:
        service_lines_to_check.append("ITOC")
    
    # Fallback to lead offering if no service line revenue
    if not service_lines_to_check and opportunity.lead_offering_l1:
        if opportunity.lead_offering_l1 in SUPPORTED_SERVICE_LINES:
            service_lines_to_check.append(opportunity.lead_offering_l1)
    
    if not service_lines_to_check:
        return False
    
    # Find the category record to get its ID
    category_record = session.exec(
        select(OpportunityCategory).where(OpportunityCategory.name == category)
    ).first()
    
    if not category_record:
        return False
    
    # Check if stage effort configuration exists for at least one service line
    for service_line in service_lines_to_check:
        stage_effort = session.exec(
            select(ServiceLineStageEffort).where(
                ServiceLineStageEffort.service_line == service_line,
                ServiceLineStageEffort.category_id == category_record.id
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
        
        # Clear existing timeline data
        session.exec(
            delete(OpportunityResourceTimeline).where(
                OpportunityResourceTimeline.opportunity_id == opportunity.opportunity_id
            )
        )
        
        # Store new timeline data
        for service_line, stages in timeline_data["service_line_timelines"].items():
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
                    tcv_millions=timeline_data["tcv_millions"],
                    decision_date=timeline_data["decision_date"],
                    calculated_date=datetime.utcnow(),
                    resource_status="Predicted"  # Set as Predicted for bulk generation
                )
                session.add(timeline_record)
                
    except Exception as e:
        # Re-raise the exception to be caught by the calling function
        raise e