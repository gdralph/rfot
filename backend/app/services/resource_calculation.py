"""
Resource calculation service for FTE timeline forecasting.

Calculates resource requirements by working backwards from decision dates
using service line stage effort data.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlmodel import Session, select
import structlog

from app.models.opportunity import Opportunity, OpportunityLineItem
from app.models.config import OpportunityCategory, ServiceLineStageEffort
from app.models.database import engine

logger = structlog.get_logger()

# Sales stage order for backward calculation
SALES_STAGES_ORDER = [
    "01",  # Understand Customer
    "02",  # Validate Opportunity
    "03",  # Qualify Opportunity
    "04A", # Develop Solution
    "04B", # Propose Solution
    "05A", # Negotiate
    "05B", # Award & Close
    "06"   # Deploy & Extend
]

# Service lines that have resource planning data
SUPPORTED_SERVICE_LINES = ["MW", "ITOC"]


def determine_opportunity_category(tcv_value: float, session: Session) -> Optional[str]:
    """
    Determine opportunity category based on TCV value.
    
    Args:
        tcv_value: Total Contract Value in millions
        session: Database session
        
    Returns:
        Category name or None if cannot be determined
    """
    # Handle negative TCV - return None as we don't categorize negative opportunities
    if tcv_value < 0:
        return None
    
    categories = session.exec(
        select(OpportunityCategory).order_by(OpportunityCategory.min_tcv)
    ).all()
    
    # Find the category with the highest min_tcv that the tcv_value meets or exceeds
    best_match = None
    for category in categories:
        if tcv_value >= category.min_tcv:
            if category.max_tcv is None or tcv_value <= category.max_tcv:
                best_match = category
    
    return best_match.name if best_match else None


def get_remaining_stages(current_stage: str) -> List[str]:
    """
    Get list of remaining stages from current stage to completion.
    
    Args:
        current_stage: Current sales stage (e.g., "SS-03")
        
    Returns:
        List of remaining stage names including current stage
    """
    if current_stage not in SALES_STAGES_ORDER:
        # If unknown stage, assume at beginning
        return SALES_STAGES_ORDER.copy()
    
    current_index = SALES_STAGES_ORDER.index(current_stage)
    return SALES_STAGES_ORDER[current_index:]


def calculate_stage_timeline(
    decision_date: datetime,
    current_stage: str,
    service_line: str,
    category: str,
    session: Session
) -> List[Dict]:
    """
    Calculate timeline for remaining stages working backwards from decision date.
    
    Args:
        decision_date: Target close/decision date
        current_stage: Current sales stage
        service_line: Service line (MW, ITOC)
        category: Opportunity category
        session: Database session
        
    Returns:
        List of stage timeline dictionaries with dates and FTE requirements
    """
    if service_line not in SUPPORTED_SERVICE_LINES:
        return []
    
    # Get remaining stages
    remaining_stages = get_remaining_stages(current_stage)
    
    # First get the category record to find its ID
    category_record = session.exec(
        select(OpportunityCategory).where(OpportunityCategory.name == category)
    ).first()
    
    if not category_record:
        return []
    
    # Get stage effort data for this service line and category
    stage_efforts = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line == service_line,
            ServiceLineStageEffort.category_id == category_record.id
        )
    ).all()
    
    # Create lookup for stage efforts
    effort_lookup = {se.stage_name: se for se in stage_efforts}
    
    # Calculate timeline working backwards
    timeline = []
    current_end_date = decision_date
    
    # Process stages in reverse order (work backwards)
    for stage in reversed(remaining_stages):
        if stage not in effort_lookup:
            continue
            
        stage_effort = effort_lookup[stage]
        duration_days = stage_effort.duration_weeks * 7
        
        stage_start_date = current_end_date - timedelta(days=duration_days)
        
        timeline.append({
            "stage_name": stage,
            "stage_start_date": stage_start_date,
            "stage_end_date": current_end_date,
            "duration_weeks": stage_effort.duration_weeks,
            "fte_required": stage_effort.fte_required,
            "total_effort_weeks": stage_effort.duration_weeks * stage_effort.fte_required
        })
        
        # Move backwards for next stage
        current_end_date = stage_start_date
    
    # Reverse to get chronological order
    timeline.reverse()
    
    return timeline


def calculate_opportunity_resource_timeline(
    opportunity_id: int,
    session: Session
) -> Dict:
    """
    Calculate complete resource timeline for an opportunity.
    
    Args:
        opportunity_id: Opportunity database ID (integer)
        session: Database session
        
    Returns:
        Dictionary with opportunity info and calculated timeline
    """
    # Get opportunity by integer ID
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise ValueError(f"Opportunity {opportunity_id} not found")
    
    if not opportunity.decision_date:
        raise ValueError(f"Opportunity {opportunity_id} has no decision date")
    
    # Determine category from TCV
    tcv_millions = opportunity.tcv_millions or 0
    category = determine_opportunity_category(tcv_millions, session)
    if not category:
        # For negative TCV or uncategorized opportunities, return empty timeline
        return {
            "opportunity_id": opportunity.opportunity_id,
            "opportunity_name": opportunity.opportunity_name,
            "decision_date": opportunity.decision_date,
            "current_stage": opportunity.sales_stage or "01",
            "category": None,
            "tcv_millions": tcv_millions,
            "service_line_timelines": {}
        }
    
    # Current stage (default to 01 if not set)
    current_stage = opportunity.sales_stage or "01"
    
    # Calculate timeline for each service line that has revenue or fallback to lead offering
    service_line_timelines = {}
    service_lines_to_process = []
    
    # Check MW service line
    if opportunity.mw_millions and opportunity.mw_millions > 0:
        service_lines_to_process.append("MW")
    
    # Check ITOC service line
    if opportunity.itoc_millions and opportunity.itoc_millions > 0:
        service_lines_to_process.append("ITOC")
    
    # Fallback to lead offering if no service line revenue
    if not service_lines_to_process and opportunity.lead_offering_l1:
        if opportunity.lead_offering_l1 in SUPPORTED_SERVICE_LINES:
            service_lines_to_process.append(opportunity.lead_offering_l1)
    
    # Generate timelines for determined service lines
    for service_line in service_lines_to_process:
        timeline = calculate_stage_timeline(
            opportunity.decision_date,
            current_stage,
            service_line,
            category,
            session
        )
        if timeline:
            service_line_timelines[service_line] = timeline
    
    return {
        "opportunity_id": opportunity.opportunity_id,  # Return the string ID
        "opportunity_name": opportunity.opportunity_name,
        "decision_date": opportunity.decision_date,
        "current_stage": current_stage,
        "category": category,
        "tcv_millions": tcv_millions,
        "service_line_timelines": service_line_timelines
    }


def aggregate_portfolio_resource_forecast(
    opportunities: List[int],
    session: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> Dict:
    """
    Aggregate resource requirements across multiple opportunities.
    
    Args:
        opportunities: List of opportunity integer IDs
        session: Database session (required)
        start_date: Start date for forecast period
        end_date: End date for forecast period
        
    Returns:
        Aggregated resource forecast data
    """
    
    total_effort_weeks = 0
    service_line_totals = {"MW": 0, "ITOC": 0}
    stage_totals = {stage: 0 for stage in SALES_STAGES_ORDER}
    category_totals = {}
    
    processed_opportunities = []
    
    for opp_id in opportunities:
        try:
            timeline_data = calculate_opportunity_resource_timeline(opp_id, session)
            processed_opportunities.append(timeline_data)
            
            # Aggregate by service line
            for service_line, timeline in timeline_data["service_line_timelines"].items():
                for stage_data in timeline:
                    # Filter by date range if specified
                    if start_date and stage_data["stage_end_date"] < start_date:
                        continue
                    if end_date and stage_data["stage_start_date"] > end_date:
                        continue
                    
                    effort_weeks = stage_data["total_effort_weeks"]
                    total_effort_weeks += effort_weeks
                    service_line_totals[service_line] += effort_weeks
                    stage_totals[stage_data["stage_name"]] += effort_weeks
                    
                    # Aggregate by category
                    category = timeline_data["category"]
                    if category not in category_totals:
                        category_totals[category] = 0
                    category_totals[category] += effort_weeks
                    
        except Exception as e:
            # Log error but continue processing other opportunities
            logger.error("Error processing opportunity", opportunity_id=opp_id, error=str(e))
            continue
    
    return {
        "total_opportunities_processed": len(processed_opportunities),
        "total_effort_weeks": total_effort_weeks,
        "service_line_breakdown": service_line_totals,
        "stage_breakdown": stage_totals,
        "category_breakdown": category_totals,
        "forecast_period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "processed_opportunities": processed_opportunities
    }