#!/usr/bin/env python3
"""
Seed data script for the RFOT application.
This script populates initial configuration data for opportunity categories
and stage effort estimates.
"""

import asyncio
from sqlmodel import Session, select
import structlog

from app.models.database import engine
from app.models.config import OpportunityCategory

logger = structlog.get_logger()


def create_seed_data():
    """Create initial seed data for the application."""
    
    with Session(engine) as session:
        # Check if data already exists
        existing_categories = session.exec(select(OpportunityCategory)).first()
        if existing_categories:
            logger.info("Seed data already exists, skipping creation")
            return
            
        logger.info("Creating seed data for opportunity categories")
        
        # Create Opportunity Categories (based on TCV ranges)
        categories = [
            OpportunityCategory(name="Sub $5M", min_tcv=0.0, max_tcv=5000000.0),
            OpportunityCategory(name="Cat C", min_tcv=5000000.0, max_tcv=25000000.0),
            OpportunityCategory(name="Cat B", min_tcv=25000000.0, max_tcv=100000000.0),
            OpportunityCategory(name="Cat A", min_tcv=100000000.0, max_tcv=None),  # No upper limit
        ]
        
        for category in categories:
            session.add(category)
        session.commit()
        
        # Refresh to get IDs
        session.refresh(categories[0])  # Sub $5M
        session.refresh(categories[1])  # Cat C
        session.refresh(categories[2])  # Cat B
        session.refresh(categories[3])  # Cat A
        
        
        
        session.commit()
        logger.info("Seed data creation completed", categories_created=len(categories))


if __name__ == "__main__":
    create_seed_data()