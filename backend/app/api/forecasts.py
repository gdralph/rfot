from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from typing import Dict, List, Optional
import structlog

from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem

logger = structlog.get_logger()
router = APIRouter()


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


@router.get("/summary")
async def get_forecast_summary(
    session: Session = Depends(get_session),
    stage: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """Get forecast summary metrics."""
    logger.info("Fetching forecast summary", filters={"stage": stage, "category": category})
    
    statement = select(Opportunity)
    
    if stage:
        statement = statement.where(Opportunity.sales_stage == stage)
    if category:
        statement = statement.where(Opportunity.category == category)
    
    opportunities = session.exec(statement).all()
    
    total_opportunities = len(opportunities)
    total_value = sum(opp.tcv_millions or 0 for opp in opportunities)
    avg_value = total_value / total_opportunities if total_opportunities > 0 else 0
    
    # Define stage ordering for proper sorting
    STAGE_ORDER = ['01', '02', '03', '04A', '04B', '05A', '05B']
    CATEGORY_ORDER = ['Cat A', 'Cat B', 'Cat C', 'Sub $5M', 'Negative']
    
    # Group by stage
    stage_breakdown = {}
    for opp in opportunities:
        stage_breakdown[opp.sales_stage] = stage_breakdown.get(opp.sales_stage, 0) + (opp.tcv_millions or 0)
    
    # Sort stage breakdown by proper order
    stage_breakdown = {stage: stage_breakdown.get(stage, 0) for stage in STAGE_ORDER if stage in stage_breakdown}
    
    # Group by category  
    category_breakdown = {}
    for opp in opportunities:
        cat = getattr(opp, 'category', None) or "Uncategorized"
        category_breakdown[cat] = category_breakdown.get(cat, 0) + (opp.tcv_millions or 0)
    
    # Sort category breakdown by proper order  
    sorted_category_breakdown = {}
    for category in CATEGORY_ORDER:
        if category in category_breakdown:
            sorted_category_breakdown[category] = category_breakdown[category]
    # Add any remaining categories not in the predefined order
    for category, value in category_breakdown.items():
        if category not in sorted_category_breakdown:
            sorted_category_breakdown[category] = value
    category_breakdown = sorted_category_breakdown
    
    summary = {
        "total_opportunities": total_opportunities,
        "total_value": total_value,
        "average_value": avg_value,
        "stage_breakdown": stage_breakdown,
        "category_breakdown": category_breakdown
    }
    
    logger.info("Generated forecast summary", summary=summary)
    return summary


@router.get("/service-lines")
async def get_service_line_forecast(
    session: Session = Depends(get_session),
    service_line: Optional[str] = Query(None)
):
    """Get service line breakdown and forecasts."""
    logger.info("Fetching service line forecast", service_line=service_line)
    
    statement = select(Opportunity)
    opportunities = session.exec(statement).all()
    
    service_line_totals = {
        "CES": sum(opp.ces_millions or 0 for opp in opportunities),
        "INS": sum(opp.ins_millions or 0 for opp in opportunities),
        "BPS": sum(opp.bps_millions or 0 for opp in opportunities),
        "SEC": sum(opp.sec_millions or 0 for opp in opportunities),
        "ITOC": sum(opp.itoc_millions or 0 for opp in opportunities),
        "MW": sum(opp.mw_millions or 0 for opp in opportunities)
    }
    
    total_revenue = sum(service_line_totals.values())
    
    # Calculate percentages
    service_line_percentages = {
        line: (value / total_revenue * 100) if total_revenue > 0 else 0
        for line, value in service_line_totals.items()
    }
    
    forecast = {
        "service_line_totals": service_line_totals,
        "service_line_percentages": service_line_percentages,
        "total_revenue": total_revenue
    }
    
    if service_line:
        forecast["filtered_service_line"] = {
            "name": service_line,
            "revenue": service_line_totals.get(service_line, 0),
            "percentage": service_line_percentages.get(service_line, 0)
        }
    
    logger.info("Generated service line forecast", forecast=forecast)
    return forecast


@router.get("/active-service-lines")
async def get_active_service_lines(
    session: Session = Depends(get_session)
):
    """Get count and details of service lines with revenue > 0."""
    logger.info("Fetching active service lines count")
    
    statement = select(Opportunity)
    opportunities = session.exec(statement).all()
    
    service_line_totals = {
        "CES": sum(opp.ces_millions or 0 for opp in opportunities),
        "INS": sum(opp.ins_millions or 0 for opp in opportunities),
        "BPS": sum(opp.bps_millions or 0 for opp in opportunities),
        "SEC": sum(opp.sec_millions or 0 for opp in opportunities),
        "ITOC": sum(opp.itoc_millions or 0 for opp in opportunities),
        "MW": sum(opp.mw_millions or 0 for opp in opportunities)
    }
    
    # Filter active service lines (with revenue > 0)
    active_service_lines = {
        name: revenue for name, revenue in service_line_totals.items() 
        if revenue > 0
    }
    
    active_count = len(active_service_lines)
    total_active_revenue = sum(active_service_lines.values())
    
    result = {
        "active_count": active_count,
        "active_service_lines": active_service_lines,
        "total_active_revenue": total_active_revenue,
        "all_service_lines": service_line_totals
    }
    
    logger.info("Generated active service lines data", 
               active_count=active_count, 
               active_service_lines=list(active_service_lines.keys()))
    return result