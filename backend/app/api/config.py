from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
import structlog

from app.models.database import engine
from app.models.config import (
    OpportunityCategory, OpportunityCategoryRead, OpportunityCategoryCreate,
    StageEffortEstimate, StageEffortEstimateRead, StageEffortEstimateCreate,
    SMEAllocationRule, SMEAllocationRuleRead, SMEAllocationRuleCreate
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


# Stage Effort Estimates
@router.get("/stage-effort", response_model=List[StageEffortEstimateRead])
async def get_stage_effort_estimates(session: Session = Depends(get_session)):
    """Get all stage effort estimates."""
    estimates = session.exec(select(StageEffortEstimate)).all()
    logger.info("Retrieved stage effort estimates", count=len(estimates))
    return estimates


@router.post("/stage-effort", response_model=StageEffortEstimateRead)
async def create_stage_effort_estimate(
    estimate: StageEffortEstimateCreate,
    session: Session = Depends(get_session)
):
    """Create a new stage effort estimate."""
    db_estimate = StageEffortEstimate.from_orm(estimate)
    session.add(db_estimate)
    session.commit()
    session.refresh(db_estimate)
    
    logger.info("Created stage effort estimate", 
               estimate_id=db_estimate.id, 
               stage=db_estimate.stage_name)
    return db_estimate


# SME Allocation Rules
@router.get("/sme-rules", response_model=List[SMEAllocationRuleRead])
async def get_sme_rules(session: Session = Depends(get_session)):
    """Get all SME allocation rules."""
    rules = session.exec(select(SMEAllocationRule)).all()
    logger.info("Retrieved SME rules", count=len(rules))
    return rules


@router.post("/sme-rules", response_model=SMEAllocationRuleRead)
async def create_sme_rule(
    rule: SMEAllocationRuleCreate,
    session: Session = Depends(get_session)
):
    """Create a new SME allocation rule."""
    db_rule = SMEAllocationRule.from_orm(rule)
    session.add(db_rule)
    session.commit()
    session.refresh(db_rule)
    
    logger.info("Created SME rule", 
               rule_id=db_rule.id, 
               team=db_rule.team_name,
               service_line=db_rule.service_line)
    return db_rule