from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
import structlog

from app.models.database import engine
from app.models.opportunity import (
    Opportunity, OpportunityRead, OpportunityUpdate,
    OpportunityLineItem, OpportunityLineItemRead
)
from app.models.config import OpportunityCategory

logger = structlog.get_logger()
router = APIRouter()


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


@router.get("/", response_model=List[OpportunityRead])
async def get_opportunities(
    session: Session = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    stage: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    service_line: Optional[str] = Query(None)
):
    """Get opportunities with optional filtering."""
    logger.info("Fetching opportunities", skip=skip, limit=limit, filters={
        "stage": stage, "status": status, "category": category, "search": search, "service_line": service_line
    })
    
    statement = select(Opportunity)
    
    # Add service line filtering based on opportunity table service line totals
    if service_line:
        if service_line == 'CES':
            statement = statement.where(Opportunity.ces_millions > 0)
        elif service_line == 'INS':
            statement = statement.where(Opportunity.ins_millions > 0)
        elif service_line == 'BPS':
            statement = statement.where(Opportunity.bps_millions > 0)
        elif service_line == 'SEC':
            statement = statement.where(Opportunity.sec_millions > 0)
        elif service_line == 'ITOC':
            statement = statement.where(Opportunity.itoc_millions > 0)
        elif service_line == 'MW':
            statement = statement.where(Opportunity.mw_millions > 0)
    
    if stage:
        statement = statement.where(Opportunity.sales_stage == stage)
    
    if status:
        if status == "In Forecast":
            statement = statement.where(Opportunity.in_forecast == 'Y')
        elif status == "Not In Forecast":
            statement = statement.where(Opportunity.in_forecast == 'N')
    
    if category:
        # Get the category configuration from database
        category_config = session.exec(
            select(OpportunityCategory).where(OpportunityCategory.name == category)
        ).first()
        
        if category_config:
            # Apply TCV range filtering based on configuration
            if category_config.max_tcv is not None:
                # Category has both min and max TCV
                statement = statement.where(
                    (Opportunity.tcv_millions >= category_config.min_tcv) & 
                    (Opportunity.tcv_millions < category_config.max_tcv)
                )
            else:
                # Category has only min TCV (no upper limit)
                statement = statement.where(Opportunity.tcv_millions >= category_config.min_tcv)
        elif category == 'Negative':
            # Special case for negative/null TCV values
            statement = statement.where(
                (Opportunity.tcv_millions.is_(None)) | (Opportunity.tcv_millions <= 0)
            )
    
    if search:
        statement = statement.where(
            (Opportunity.opportunity_name.contains(search)) | 
            (Opportunity.opportunity_id.contains(search)) |
            (Opportunity.account_name.contains(search)) |
            (Opportunity.lead_offering_l1.contains(search)) |
            (Opportunity.sales_org_l1.contains(search))
        )
    
    statement = statement.offset(skip).limit(limit)
    opportunities = session.exec(statement).all()
    
    logger.info("Retrieved opportunities", count=len(opportunities))
    return opportunities


@router.get("/{opportunity_id}", response_model=OpportunityRead)
async def get_opportunity(opportunity_id: int, session: Session = Depends(get_session)):
    """Get a specific opportunity by ID."""
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    logger.info("Retrieved opportunity", opportunity_id=opportunity_id)
    return opportunity


@router.put("/{opportunity_id}", response_model=OpportunityRead)
async def update_opportunity(
    opportunity_id: int,
    opportunity_update: OpportunityUpdate,
    session: Session = Depends(get_session)
):
    """Update an opportunity."""
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    update_data = opportunity_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(opportunity, field, value)
    
    session.add(opportunity)
    session.commit()
    session.refresh(opportunity)
    
    logger.info("Updated opportunity", opportunity_id=opportunity_id, updates=update_data)
    return opportunity


@router.get("/{opportunity_id}/line-items", response_model=List[OpportunityLineItemRead])
async def get_opportunity_line_items(
    opportunity_id: int,
    session: Session = Depends(get_session)
):
    """Get line items for a specific opportunity."""
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    statement = select(OpportunityLineItem).where(
        OpportunityLineItem.opportunity_id == opportunity.opportunity_id
    )
    line_items = session.exec(statement).all()
    
    logger.info("Retrieved line items", opportunity_id=opportunity_id, count=len(line_items))
    return line_items


@router.get("/{opportunity_id}/quarterly-revenue")
async def get_opportunity_quarterly_revenue(
    opportunity_id: int,
    session: Session = Depends(get_session)
):
    """Get quarterly revenue data for a specific opportunity from the opportunity record."""
    opportunity = session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    
    # Return quarterly revenue data from the opportunity record itself
    quarterly_data = {
        "first_year": {
            "q1": opportunity.first_year_q1_rev,
            "q2": opportunity.first_year_q2_rev,
            "q3": opportunity.first_year_q3_rev,
            "q4": opportunity.first_year_q4_rev,
            "fy_total": opportunity.first_year_fy_rev
        },
        "second_year": {
            "q1": opportunity.second_year_q1_rev,
            "q2": opportunity.second_year_q2_rev,
            "q3": opportunity.second_year_q3_rev,
            "q4": opportunity.second_year_q4_rev,
            "fy_total": opportunity.second_year_fy_rev
        },
        "beyond_year2": opportunity.fy_rev_beyond_yr2
    }
    
    logger.info("Retrieved quarterly revenues", opportunity_id=opportunity_id)
    return quarterly_data