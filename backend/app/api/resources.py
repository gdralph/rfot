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


def _generate_time_period_forecast(
    timeline_records: List[OpportunityResourceTimeline],
    start_date: datetime,
    end_date: datetime,
    time_period: str = "month"
) -> List[dict]:
    """
    Generate resource forecast from timeline records for specified time period.
    Shows FTE as rate (people working) during active periods.
    
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
                # Add FTE rate (not total effort weeks) for this active stage
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