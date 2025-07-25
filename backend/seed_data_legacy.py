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
from app.models.config import OpportunityCategory, ServiceLineInternalServiceMapping

logger = structlog.get_logger()


def seed_internal_service_mappings(session: Session):
    """Create default internal service mappings for MW and ITOC service lines."""
    
    # Default internal service mappings
    default_mappings = [
        # MW (Modern Workplace) mappings
        {"service_line": "MW", "internal_service": "Modern Workplace"},
        {"service_line": "MW", "internal_service": "MW"},
        {"service_line": "MW", "internal_service": "Workplace Services"},
        {"service_line": "MW", "internal_service": "Digital Employee Experience"},
        {"service_line": "MW", "internal_service": "Collaboration"},
        {"service_line": "MW", "internal_service": "Endpoint Services"},
        
        # ITOC (Infrastructure & Cloud) mappings  
        {"service_line": "ITOC", "internal_service": "Infrastructure & Cloud"},
        {"service_line": "ITOC", "internal_service": "ITOC"},
        {"service_line": "ITOC", "internal_service": "Cloud Services"},
        {"service_line": "ITOC", "internal_service": "Infrastructure Services"},
        {"service_line": "ITOC", "internal_service": "Data Center Services"},
        {"service_line": "ITOC", "internal_service": "Network Services"},
        {"service_line": "ITOC", "internal_service": "Platform Services"}
    ]
    
    created_count = 0
    existing_count = 0
    
    for mapping_data in default_mappings:
        # Check if mapping already exists
        existing = session.exec(
            select(ServiceLineInternalServiceMapping).where(
                ServiceLineInternalServiceMapping.service_line == mapping_data["service_line"],
                ServiceLineInternalServiceMapping.internal_service == mapping_data["internal_service"]
            )
        ).first()
        
        if not existing:
            # Create new mapping
            mapping = ServiceLineInternalServiceMapping(**mapping_data)
            session.add(mapping)
            created_count += 1
            logger.debug("Creating internal service mapping", 
                       service_line=mapping_data["service_line"],
                       internal_service=mapping_data["internal_service"])
        else:
            existing_count += 1
    
    # Commit mappings
    if created_count > 0:
        session.commit()
        logger.info("Created internal service mappings", 
                   created=created_count, existing=existing_count)
    else:
        logger.info("All internal service mappings already exist", 
                   existing=existing_count)


def create_seed_data():
    """Create initial seed data for the application."""
    
    with Session(engine) as session:
        # Check if categories already exist
        existing_categories = session.exec(select(OpportunityCategory)).first()
        categories_exist = existing_categories is not None
        
        if not categories_exist:
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
            logger.info("Opportunity categories created", categories_created=len(categories))
        else:
            logger.info("Opportunity categories already exist, skipping creation")
        
        # Seed internal service mappings
        seed_internal_service_mappings(session)


if __name__ == "__main__":
    create_seed_data()