from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
import structlog

from app.models.database import engine
from app.models.opportunity import (
    Opportunity, OpportunityRead, OpportunityUpdate,
    OpportunityLineItem, OpportunityLineItemRead
)

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
    
    # Add service line filtering via join with line items
    if service_line:
        from app.models.opportunity import OpportunityLineItem
        statement = statement.join(OpportunityLineItem)
        
        # Filter based on which service line has revenue > 0
        if service_line == 'CES':
            statement = statement.where(OpportunityLineItem.ces_revenue > 0)
        elif service_line == 'INS':
            statement = statement.where(OpportunityLineItem.ins_revenue > 0)
        elif service_line == 'BPS':
            statement = statement.where(OpportunityLineItem.bps_revenue > 0)
        elif service_line == 'SEC':
            statement = statement.where(OpportunityLineItem.sec_revenue > 0)
        elif service_line == 'ITOC':
            statement = statement.where(OpportunityLineItem.itoc_revenue > 0)
        elif service_line == 'MW':
            statement = statement.where(OpportunityLineItem.mw_revenue > 0)
    
    if stage:
        statement = statement.where(Opportunity.stage == stage)
    if status:
        statement = statement.where(Opportunity.status == status)
    if category:
        statement = statement.where(Opportunity.category == category)
    if search:
        statement = statement.where(
            (Opportunity.name.contains(search)) | 
            (Opportunity.opportunity_id.contains(search))
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