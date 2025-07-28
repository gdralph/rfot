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
from app.models.config import OpportunityCategory, ServiceLineStageEffort, ServiceLineOfferingThreshold, ServiceLineOfferingMapping
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


def determine_service_line_resource_category(service_line: str, service_line_tcv: float, session: Session) -> Optional[str]:
    """
    Determine resource category based on service line TCV value using service-line-specific categories.
    This is used to determine which FTE/effort template to use for a specific service line.
    
    Args:
        service_line: Service line name (MW, ITOC)
        service_line_tcv: Service Line TCV value in millions
        session: Database session
        
    Returns:
        Category name or None if cannot be determined
    """
    from app.models.config import ServiceLineCategory
    
    # Handle negative or zero TCV - return None as we don't categorize these
    if service_line_tcv <= 0:
        return None
    
    categories = session.exec(
        select(ServiceLineCategory)
        .where(ServiceLineCategory.service_line == service_line)
        .order_by(ServiceLineCategory.min_tcv)
    ).all()
    
    # Find the category with the highest min_tcv that the service_line_tcv meets or exceeds
    best_match = None
    for category in categories:
        if service_line_tcv >= category.min_tcv:
            if category.max_tcv is None or service_line_tcv <= category.max_tcv:
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


def calculate_offering_multiplier(
    opportunity_id: str,
    service_line: str,
    stage_name: str,
    session: Session
) -> float:
    """
    Calculate the offering-based multiplier for FTE calculations.
    Only counts offerings that are mapped to the specified service line via internal_service.
    
    Args:
        opportunity_id: Opportunity string ID
        service_line: Service line (MW, ITOC)
        stage_name: Sales stage name
        session: Database session
        
    Returns:
        Multiplier value (1.0 if no threshold configured or count below threshold)
    """
    # Get valid internal service and simplified offering combinations for this service line
    offering_mappings = session.exec(
        select(ServiceLineOfferingMapping).where(
            ServiceLineOfferingMapping.service_line == service_line
        )
    ).all()
    
    if not offering_mappings:
        # No mappings configured, return default multiplier
        logger.info("No offering mappings found for service line", 
                   service_line=service_line)
        return 1.0
    
    # Get all opportunity line items
    all_line_items = session.exec(
        select(OpportunityLineItem).where(
            OpportunityLineItem.opportunity_id == opportunity_id
        )
    ).all()
    
    # Count unique simplified offerings that match the configured mappings
    unique_offerings = set()
    for item in all_line_items:
        if item.internal_service and item.simplified_offering and item.simplified_offering.strip():
            # Check if this combination is mapped to the service line
            for mapping in offering_mappings:
                if (mapping.internal_service == item.internal_service and 
                    mapping.simplified_offering == item.simplified_offering.strip()):
                    unique_offerings.add(item.simplified_offering.strip())
                    break
    
    offering_count = len(unique_offerings)
    
    # Look up threshold configuration for this service line and stage
    threshold_config = session.exec(
        select(ServiceLineOfferingThreshold).where(
            ServiceLineOfferingThreshold.service_line == service_line,
            ServiceLineOfferingThreshold.stage_name == stage_name
        )
    ).first()
    
    if not threshold_config:
        # No threshold configured, return default multiplier
        return 1.0
    
    # Calculate multiplier based on threshold
    if offering_count <= threshold_config.threshold_count:
        # At or below threshold, use base multiplier
        multiplier = 1.0
    else:
        # Above threshold, add increment for each additional offering
        excess_offerings = offering_count - threshold_config.threshold_count
        multiplier = 1.0 + (excess_offerings * threshold_config.increment_multiplier)
    
    logger.info("Calculated offering multiplier", 
                opportunity_id=opportunity_id, 
                service_line=service_line, 
                stage_name=stage_name,
                offering_count=offering_count, 
                unique_offerings=list(unique_offerings),
                mapped_combinations_count=len(offering_mappings),
                threshold=threshold_config.threshold_count,
                increment=threshold_config.increment_multiplier,
                multiplier=multiplier)
    
    return multiplier


def calculate_stage_timeline(
    decision_date: datetime,
    current_stage: str,
    service_line: str,
    timeline_category: str,
    resource_category: str,
    opportunity_id: str,
    session: Session
) -> List[Dict]:
    """
    Calculate timeline for remaining stages working backwards from decision date.
    Uses timeline_category for stage durations and resource_category for FTE requirements.
    Applies offering-based multipliers to FTE calculations.
    
    Args:
        decision_date: Target close/decision date
        current_stage: Current sales stage
        service_line: Service line (MW, ITOC)
        timeline_category: Category for timeline/duration (based on total TCV)
        resource_category: Category for FTE/effort (based on service line TCV)
        opportunity_id: Opportunity string ID for offering count lookup
        session: Database session
        
    Returns:
        List of stage timeline dictionaries with dates and FTE requirements
    """
    if service_line not in SUPPORTED_SERVICE_LINES:
        return []
    
    # Get remaining stages
    remaining_stages = get_remaining_stages(current_stage)
    
    # Get timeline category record for duration (from OpportunityCategory)
    timeline_category_record = session.exec(
        select(OpportunityCategory).where(OpportunityCategory.name == timeline_category)
    ).first()
    
    if not timeline_category_record:
        return []
    
    # Import ServiceLineCategory
    from app.models.config import ServiceLineCategory
    
    # Get resource category record for FTE (using service line categories)
    resource_category_record = session.exec(
        select(ServiceLineCategory).where(
            ServiceLineCategory.service_line == service_line,
            ServiceLineCategory.name == resource_category
        )
    ).first()
    
    if not resource_category_record:
        return []
    
    # Create duration lookup from OpportunityCategory
    duration_lookup = {
        '01': timeline_category_record.stage_01_duration_weeks,
        '02': timeline_category_record.stage_02_duration_weeks,
        '03': timeline_category_record.stage_03_duration_weeks,
        '04A': timeline_category_record.stage_04a_duration_weeks,
        '04B': timeline_category_record.stage_04b_duration_weeks,
        '05A': timeline_category_record.stage_05a_duration_weeks,
        '05B': timeline_category_record.stage_05b_duration_weeks,
        '06': timeline_category_record.stage_06_duration_weeks
    }
    
    # Get stage FTE data for this service line and resource category
    fte_efforts = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line == service_line,
            ServiceLineStageEffort.service_line_category_id == resource_category_record.id
        )
    ).all()
    
    # Create lookup for FTE
    fte_lookup = {fe.stage_name: fe.fte_required for fe in fte_efforts}
    
    # Calculate timeline working backwards
    timeline = []
    current_end_date = decision_date
    
    # Process stages in reverse order (work backwards)
    for stage in reversed(remaining_stages):
        if stage not in duration_lookup or stage not in fte_lookup:
            continue
            
        duration_weeks = duration_lookup[stage]
        base_fte_required = fte_lookup[stage]
        
        # Calculate offering-based multiplier for this stage
        offering_multiplier = calculate_offering_multiplier(
            opportunity_id, service_line, stage, session
        )
        
        # Apply multiplier to base FTE
        fte_required = base_fte_required * offering_multiplier
        duration_days = duration_weeks * 7
        
        stage_start_date = current_end_date - timedelta(days=duration_days)
        
        timeline.append({
            "stage_name": stage,
            "stage_start_date": stage_start_date,
            "stage_end_date": current_end_date,
            "duration_weeks": duration_weeks,
            "fte_required": fte_required,
            "base_fte_required": base_fte_required,  # Track original FTE
            "offering_multiplier": offering_multiplier,  # Track multiplier applied
            "total_effort_weeks": duration_weeks * fte_required,
            "resource_category": resource_category  # Track which category was used for resources
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
    Uses total TCV for timeline/duration and individual service line TCV for FTE/effort.
    
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
    
    # Determine timeline category from total TCV
    tcv_millions = opportunity.tcv_millions or 0
    timeline_category = determine_opportunity_category(tcv_millions, session)
    if not timeline_category:
        # For negative TCV or uncategorized opportunities, return empty timeline
        return {
            "opportunity_id": opportunity.opportunity_id,
            "opportunity_name": opportunity.opportunity_name,
            "decision_date": opportunity.decision_date,
            "current_stage": opportunity.sales_stage or "01",
            "category": None,
            "tcv_millions": tcv_millions,
            "service_line_timelines": {},
            "service_line_categories": {}
        }
    
    # Current stage (default to 01 if not set)
    current_stage = opportunity.sales_stage or "01"
    
    # Calculate timeline for each service line that has revenue or fallback to lead offering
    service_line_timelines = {}
    service_line_categories = {}
    service_lines_to_process = []
    
    # Check MW service line
    if opportunity.mw_millions and opportunity.mw_millions > 0:
        service_lines_to_process.append(("MW", opportunity.mw_millions))
    
    # Check ITOC service line
    if opportunity.itoc_millions and opportunity.itoc_millions > 0:
        service_lines_to_process.append(("ITOC", opportunity.itoc_millions))
    
    # Fallback to lead offering if no service line revenue
    if not service_lines_to_process and opportunity.lead_offering_l1:
        if opportunity.lead_offering_l1 in SUPPORTED_SERVICE_LINES:
            # Use a default small amount for resource category when no specific revenue
            service_lines_to_process.append((opportunity.lead_offering_l1, 1.0))
    
    # Generate timelines for determined service lines
    for service_line, service_line_tcv in service_lines_to_process:
        # Determine resource category based on service line TCV
        resource_category = determine_service_line_resource_category(service_line, service_line_tcv, session)
        if not resource_category:
            logger.warning(f"Could not determine resource category for {service_line} with TCV {service_line_tcv}")
            continue
            
        service_line_categories[service_line] = {
            "timeline_category": timeline_category,
            "resource_category": resource_category,
            "service_line_tcv": service_line_tcv
        }
        
        timeline = calculate_stage_timeline(
            opportunity.decision_date,
            current_stage,
            service_line,
            timeline_category,
            resource_category,
            opportunity.opportunity_id,  # Pass the string opportunity_id
            session
        )
        if timeline:
            service_line_timelines[service_line] = timeline
    
    return {
        "opportunity_id": opportunity.opportunity_id,  # Return the string ID
        "opportunity_name": opportunity.opportunity_name,
        "decision_date": opportunity.decision_date,
        "current_stage": current_stage,
        "category": timeline_category,  # This is the timeline category based on total TCV
        "tcv_millions": tcv_millions,
        "service_line_timelines": service_line_timelines,
        "service_line_categories": service_line_categories  # New field to track which categories were used
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