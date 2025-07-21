"""
Resource forecasting API endpoints for FTE timeline calculations.
"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, delete

from app.models.database import engine
from app.models.resources import (
    OpportunityResourceTimeline, 
    OpportunityEffortPrediction,
    PortfolioEffortPrediction,
    StageEffortBreakdown
)
from app.models.opportunity import Opportunity
from app.services.resource_calculation import (
    calculate_opportunity_resource_timeline,
    aggregate_portfolio_resource_forecast,
    SUPPORTED_SERVICE_LINES,
    SALES_STAGES_ORDER
)

router = APIRouter(prefix="/resources", tags=["resources"])


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
        raise HTTPException(status_code=404, detail="No timeline found for opportunity")
    
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
            "total_effort_weeks": record.total_effort_weeks
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


@router.get("/portfolio/resource-forecast", response_model=PortfolioEffortPrediction)
def get_portfolio_resource_forecast(
    start_date: Optional[datetime] = Query(None, description="Start date for forecast period"),
    end_date: Optional[datetime] = Query(None, description="End date for forecast period"),
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
    
    # Apply filters
    if start_date:
        query = query.where(OpportunityResourceTimeline.stage_end_date >= start_date)
    if end_date:
        query = query.where(OpportunityResourceTimeline.stage_start_date <= end_date)
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
        if start_date and record.stage_end_date < start_date:
            continue
        if end_date and record.stage_start_date > end_date:
            continue
            
        effort = record.total_effort_weeks
        total_effort_weeks += effort
        
        service_line_totals[record.service_line] += effort
        stage_totals[record.stage_name] += effort
        
        if record.category not in category_totals:
            category_totals[record.category] = 0
        category_totals[record.category] += effort
        
        opportunity_ids.add(record.opportunity_id)
    
    # Generate monthly forecast if date range provided
    monthly_forecast = None
    if start_date and end_date:
        monthly_forecast = _generate_monthly_forecast(
            timeline_records, start_date, end_date
        )
    
    return PortfolioEffortPrediction(
        total_opportunities_processed=len(opportunity_ids),
        total_effort_weeks=total_effort_weeks,
        service_line_breakdown=service_line_totals,
        stage_breakdown=stage_totals,
        category_breakdown=category_totals,
        forecast_period={
            "start_date": start_date,
            "end_date": end_date
        },
        monthly_forecast=monthly_forecast,
        processed_opportunities=[]  # Can be populated if needed
    )


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
    
    # Get stage effort configuration
    stage_efforts = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line == service_line,
            ServiceLineStageEffort.category == category
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


def _generate_monthly_forecast(
    timeline_records: List[OpportunityResourceTimeline],
    start_date: datetime,
    end_date: datetime
) -> List[dict]:
    """
    Generate monthly resource forecast from timeline records.
    """
    monthly_totals = {}
    
    # Generate month keys
    current_date = start_date.replace(day=1)  # First day of start month
    while current_date <= end_date:
        month_key = current_date.strftime("%Y-%m")
        monthly_totals[month_key] = {
            "month": month_key,
            "total_effort_weeks": 0,
            "opportunities_count": set(),
            "service_line_breakdown": {sl: 0 for sl in SUPPORTED_SERVICE_LINES}
        }
        
        # Move to next month
        if current_date.month == 12:
            current_date = current_date.replace(year=current_date.year + 1, month=1)
        else:
            current_date = current_date.replace(month=current_date.month + 1)
    
    # Aggregate records by month
    for record in timeline_records:
        # Determine which months this stage overlaps
        stage_start = record.stage_start_date.replace(day=1)
        stage_end = record.stage_end_date.replace(day=1)
        
        current_month = stage_start
        while current_month <= stage_end:
            month_key = current_month.strftime("%Y-%m")
            if month_key in monthly_totals:
                monthly_totals[month_key]["total_effort_weeks"] += record.total_effort_weeks
                monthly_totals[month_key]["opportunities_count"].add(record.opportunity_id)
                monthly_totals[month_key]["service_line_breakdown"][record.service_line] += record.total_effort_weeks
            
            # Move to next month
            if current_month.month == 12:
                current_month = current_month.replace(year=current_month.year + 1, month=1)
            else:
                current_month = current_month.replace(month=current_month.month + 1)
    
    # Convert to list format
    monthly_forecast = []
    for month_key in sorted(monthly_totals.keys()):
        month_data = monthly_totals[month_key].copy()
        month_data["opportunities_count"] = len(month_data["opportunities_count"])
        monthly_forecast.append(month_data)
    
    return monthly_forecast