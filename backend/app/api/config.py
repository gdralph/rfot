from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
import structlog

from app.models.database import engine
from app.models.config import (
    OpportunityCategory, OpportunityCategoryRead, OpportunityCategoryCreate, OpportunityCategoryUpdate,
    ServiceLineCategory, ServiceLineCategoryRead, ServiceLineCategoryCreate, ServiceLineCategoryUpdate,
    ServiceLineStageEffort, ServiceLineStageEffortRead, ServiceLineStageEffortCreate, ServiceLineStageEffortUpdate
)

logger = structlog.get_logger()
router = APIRouter()


def get_session():
    """Database session dependency."""
    with Session(engine) as session:
        yield session


# Opportunity Categories
@router.get("/categories", response_model=List[OpportunityCategoryRead])
async def get_categories(session: Session = Depends(get_session)):
    """Get all opportunity categories."""
    categories = session.exec(select(OpportunityCategory)).all()
    logger.info("Retrieved categories", count=len(categories))
    return categories


@router.post("/categories", response_model=OpportunityCategoryRead)
async def create_category(
    category: OpportunityCategoryCreate,
    session: Session = Depends(get_session)
):
    """Create a new opportunity category."""
    db_category = OpportunityCategory.from_orm(category)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    
    logger.info("Created category", category_id=db_category.id, name=db_category.name)
    return db_category


@router.put("/categories/{category_id}", response_model=OpportunityCategoryRead)
async def update_category(
    category_id: int,
    category: OpportunityCategoryUpdate,
    session: Session = Depends(get_session)
):
    """Update an existing opportunity category."""
    db_category = session.get(OpportunityCategory, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category_data = category.dict(exclude_unset=True)
    for key, value in category_data.items():
        setattr(db_category, key, value)
    
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    
    logger.info("Updated category", category_id=db_category.id, name=db_category.name)
    return db_category


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    session: Session = Depends(get_session)
):
    """Delete an opportunity category."""
    db_category = session.get(OpportunityCategory, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    session.delete(db_category)
    session.commit()
    
    logger.info("Deleted category", category_id=category_id)
    return {"message": "Category deleted successfully"}


# Service Line Categories (Service-line-specific TCV thresholds)
@router.get("/service-line-categories", response_model=List[ServiceLineCategoryRead])
async def get_service_line_categories(
    service_line: str = None,
    session: Session = Depends(get_session)
):
    """Get service line categories, optionally filtered by service line."""
    query = select(ServiceLineCategory)
    if service_line:
        query = query.where(ServiceLineCategory.service_line == service_line)
    
    categories = session.exec(query.order_by(ServiceLineCategory.service_line, ServiceLineCategory.min_tcv)).all()
    logger.info("Retrieved service line categories", count=len(categories), service_line=service_line)
    return categories


@router.post("/service-line-categories", response_model=ServiceLineCategoryRead)
async def create_service_line_category(
    category: ServiceLineCategoryCreate,
    session: Session = Depends(get_session)
):
    """Create a new service line category."""
    # Check for duplicates
    existing = session.exec(
        select(ServiceLineCategory).where(
            ServiceLineCategory.service_line == category.service_line,
            ServiceLineCategory.name == category.name
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Category '{category.name}' already exists for service line {category.service_line}"
        )
    
    db_category = ServiceLineCategory.from_orm(category)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    
    logger.info("Created service line category", 
                category_id=db_category.id, 
                service_line=db_category.service_line,
                name=db_category.name)
    return db_category


@router.put("/service-line-categories/{category_id}", response_model=ServiceLineCategoryRead)
async def update_service_line_category(
    category_id: int,
    category: ServiceLineCategoryUpdate,
    session: Session = Depends(get_session)
):
    """Update a service line category."""
    db_category = session.get(ServiceLineCategory, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Service line category not found")
    
    # Update fields
    for field, value in category.dict(exclude_unset=True).items():
        setattr(db_category, field, value)
    
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    
    logger.info("Updated service line category", 
                category_id=db_category.id, 
                service_line=db_category.service_line,
                name=db_category.name)
    return db_category


@router.delete("/service-line-categories/{category_id}")
async def delete_service_line_category(
    category_id: int,
    session: Session = Depends(get_session)
):
    """Delete a service line category."""
    db_category = session.get(ServiceLineCategory, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Service line category not found")
    
    # Check if category is in use
    effort_count = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line_category_id == category_id
        ).limit(1)
    ).first()
    
    if effort_count:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete category that is in use by service line stage efforts"
        )
    
    session.delete(db_category)
    session.commit()
    
    logger.info("Deleted service line category", category_id=category_id)
    return {"message": "Service line category deleted successfully"}






# Service Line Stage Efforts
@router.get("/service-line-stage-efforts", response_model=List[ServiceLineStageEffortRead])
async def get_service_line_stage_efforts(
    service_line: str = None,
    service_line_category_id: int = None,
    session: Session = Depends(get_session)
):
    """Get service line stage efforts with optional filtering."""
    query = select(ServiceLineStageEffort)
    
    if service_line:
        query = query.where(ServiceLineStageEffort.service_line == service_line)
    if service_line_category_id:
        query = query.where(ServiceLineStageEffort.service_line_category_id == service_line_category_id)
    
    efforts = session.exec(query).all()
    
    logger.info("Retrieved service line stage efforts", count=len(efforts), 
               service_line=service_line, service_line_category_id=service_line_category_id)
    return efforts


@router.post("/service-line-stage-efforts", response_model=ServiceLineStageEffortRead)
async def create_service_line_stage_effort(
    effort: ServiceLineStageEffortCreate,
    session: Session = Depends(get_session)
):
    """Create a new service line stage effort."""
    # Check if this combination already exists
    existing = session.exec(
        select(ServiceLineStageEffort).where(
            ServiceLineStageEffort.service_line == effort.service_line,
            ServiceLineStageEffort.service_line_category_id == effort.service_line_category_id,
            ServiceLineStageEffort.stage_name == effort.stage_name
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Service line stage effort already exists for {effort.service_line} - {effort.stage_name} - Service Line Category {effort.service_line_category_id}"
        )
    
    db_effort = ServiceLineStageEffort.from_orm(effort)
    session.add(db_effort)
    session.commit()
    session.refresh(db_effort)
    
    logger.info("Created service line stage effort", 
               effort_id=db_effort.id, 
               service_line=db_effort.service_line,
               stage=db_effort.stage_name)
    return db_effort


@router.put("/service-line-stage-efforts/{effort_id}", response_model=ServiceLineStageEffortRead)
async def update_service_line_stage_effort(
    effort_id: int,
    effort: ServiceLineStageEffortUpdate,
    session: Session = Depends(get_session)
):
    """Update an existing service line stage effort."""
    db_effort = session.get(ServiceLineStageEffort, effort_id)
    if not db_effort:
        raise HTTPException(status_code=404, detail="Service line stage effort not found")
    
    effort_data = effort.dict(exclude_unset=True)
    for key, value in effort_data.items():
        setattr(db_effort, key, value)
    
    session.add(db_effort)
    session.commit()
    session.refresh(db_effort)
    
    logger.info("Updated service line stage effort", 
               effort_id=db_effort.id, 
               service_line=db_effort.service_line,
               stage=db_effort.stage_name)
    return db_effort


@router.delete("/service-line-stage-efforts/{effort_id}")
async def delete_service_line_stage_effort(
    effort_id: int,
    session: Session = Depends(get_session)
):
    """Delete a service line stage effort."""
    db_effort = session.get(ServiceLineStageEffort, effort_id)
    if not db_effort:
        raise HTTPException(status_code=404, detail="Service line stage effort not found")
    
    session.delete(db_effort)
    session.commit()
    
    logger.info("Deleted service line stage effort", effort_id=effort_id)
    return {"message": "Service line stage effort deleted successfully"}


@router.post("/service-line-stage-efforts/bulk", response_model=List[ServiceLineStageEffortRead])
async def bulk_create_service_line_stage_efforts(
    efforts: List[ServiceLineStageEffortCreate],
    session: Session = Depends(get_session)
):
    """Bulk create service line stage efforts."""
    created_efforts = []
    
    for effort in efforts:
        # Check if this combination already exists
        existing = session.exec(
            select(ServiceLineStageEffort).where(
                ServiceLineStageEffort.service_line == effort.service_line,
                ServiceLineStageEffort.category_id == effort.category_id,
                ServiceLineStageEffort.stage_name == effort.stage_name
            )
        ).first()
        
        if not existing:
            db_effort = ServiceLineStageEffort.from_orm(effort)
            session.add(db_effort)
            created_efforts.append(db_effort)
    
    if created_efforts:
        session.commit()
        for effort in created_efforts:
            session.refresh(effort)
    
    logger.info("Bulk created service line stage efforts", count=len(created_efforts))
    return created_efforts