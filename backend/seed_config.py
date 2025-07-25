#!/usr/bin/env python3
"""
Configuration Data Seeding Script

This script populates all configuration tables with production data.
It seeds only configuration data - business data (opportunities, line items, 
resource timelines) is populated via Excel imports.

Configuration tables seeded:
- OpportunityCategory: TCV-based opportunity categorization  
- ServiceLineCategory: MW/ITOC category definitions
- ServiceLineStageEffort: Resource templates for MW/ITOC by category/stage
- ServiceLineOfferingThreshold: Offering threshold multiplier rules
- ServiceLineInternalServiceMapping: Internal service to service line mappings

Based on production database state as of 2025-07-25.
"""

import sys
import os
from sqlmodel import Session, select
import structlog

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.models.database import engine
from app.models.config import (
    OpportunityCategory, 
    ServiceLineCategory, 
    ServiceLineStageEffort,
    ServiceLineOfferingThreshold,
    ServiceLineInternalServiceMapping
)

logger = structlog.get_logger()

# === CONFIGURATION DATA (extracted from production database 2025-07-25) ===

# Opportunity Categories - TCV-based categorization with stage durations
OPPORTUNITY_CATEGORIES = [
    {
        "name": "Sub $5M",
        "min_tcv": 0.0,
        "max_tcv": 5.0,
        "stage_01_duration_weeks": 1.0,
        "stage_02_duration_weeks": 1.0,
        "stage_03_duration_weeks": 1.0,
        "stage_04a_duration_weeks": 4.0,
        "stage_04b_duration_weeks": 0.0,
        "stage_05a_duration_weeks": 1.0,
        "stage_05b_duration_weeks": 0.0,
        "stage_06_duration_weeks": 1.0
    },
    {
        "name": "Cat C",
        "min_tcv": 5.0,
        "max_tcv": 20.0,
        "stage_01_duration_weeks": 2.0,
        "stage_02_duration_weeks": 2.0,
        "stage_03_duration_weeks": 2.0,
        "stage_04a_duration_weeks": 8.0,
        "stage_04b_duration_weeks": 1.0,
        "stage_05a_duration_weeks": 2.0,
        "stage_05b_duration_weeks": 0.0,
        "stage_06_duration_weeks": 2.0
    },
    {
        "name": "Cat B",
        "min_tcv": 20.0,
        "max_tcv": 100.0,
        "stage_01_duration_weeks": 4.0,
        "stage_02_duration_weeks": 4.0,
        "stage_03_duration_weeks": 4.0,
        "stage_04a_duration_weeks": 15.0,
        "stage_04b_duration_weeks": 2.0,
        "stage_05a_duration_weeks": 4.0,
        "stage_05b_duration_weeks": 0.0,
        "stage_06_duration_weeks": 4.0
    },
    {
        "name": "Cat A",
        "min_tcv": 100.0,
        "max_tcv": None,
        "stage_01_duration_weeks": 4.0,
        "stage_02_duration_weeks": 4.0,
        "stage_03_duration_weeks": 8.0,
        "stage_04a_duration_weeks": 22.0,
        "stage_04b_duration_weeks": 4.0,
        "stage_05a_duration_weeks": 8.0,
        "stage_05b_duration_weeks": 0.0,
        "stage_06_duration_weeks": 4.0
    }
]

# Service Line Categories - MW and ITOC specific TCV thresholds
SERVICE_LINE_CATEGORIES = [
    {"service_line": "MW", "name": "Sub $5M", "min_tcv": 0.0, "max_tcv": 5.0},
    {"service_line": "MW", "name": "Cat C", "min_tcv": 5.0, "max_tcv": 25.0},
    {"service_line": "MW", "name": "Cat B", "min_tcv": 25.0, "max_tcv": 50.0},
    {"service_line": "MW", "name": "Cat A", "min_tcv": 50.0, "max_tcv": None},
    {"service_line": "MW", "name": "Small", "min_tcv": 0.0, "max_tcv": 5.0},
    {"service_line": "ITOC", "name": "Sub $5M", "min_tcv": 0.0, "max_tcv": 5.0},
    {"service_line": "ITOC", "name": "Cat C", "min_tcv": 5.0, "max_tcv": 25.0},
    {"service_line": "ITOC", "name": "Cat B", "min_tcv": 25.0, "max_tcv": 50.0},
    {"service_line": "ITOC", "name": "Cat A", "min_tcv": 50.0, "max_tcv": None},
]

# Service Line Stage Efforts - FTE requirements by service line, category, and stage
# Format: (service_line, category_name, stage_name, fte_required)
SERVICE_LINE_STAGE_EFFORTS = [
    # MW (Modern Workplace) efforts
    ("MW", "Sub $5M", "01", 0.0), ("MW", "Sub $5M", "02", 0.0), ("MW", "Sub $5M", "03", 0.0),
    ("MW", "Sub $5M", "04A", 0.5), ("MW", "Sub $5M", "04B", 0.0), ("MW", "Sub $5M", "05A", 0.0),
    ("MW", "Sub $5M", "05B", 0.0), ("MW", "Sub $5M", "06", 0.0),
    ("MW", "Cat C", "01", 0.0), ("MW", "Cat C", "02", 0.0), ("MW", "Cat C", "03", 0.0),
    ("MW", "Cat C", "04A", 1.0), ("MW", "Cat C", "04B", 0.0), ("MW", "Cat C", "05A", 0.0),
    ("MW", "Cat C", "05B", 0.0), ("MW", "Cat C", "06", 0.0),
    ("MW", "Cat B", "01", 0.0), ("MW", "Cat B", "02", 0.0), ("MW", "Cat B", "03", 0.25),
    ("MW", "Cat B", "04A", 2.0), ("MW", "Cat B", "04B", 0.0), ("MW", "Cat B", "05A", 0.25),
    ("MW", "Cat B", "05B", 0.0), ("MW", "Cat B", "06", 0.25),
    ("MW", "Cat A", "01", 0.0), ("MW", "Cat A", "02", 0.0), ("MW", "Cat A", "03", 0.25),
    ("MW", "Cat A", "04A", 2.5), ("MW", "Cat A", "04B", 0.0), ("MW", "Cat A", "05A", 0.25),
    ("MW", "Cat A", "05B", 0.0), ("MW", "Cat A", "06", 0.25),
    ("MW", "Small", "01", 0.0), ("MW", "Small", "02", 0.0), ("MW", "Small", "03", 0.0),
    ("MW", "Small", "04A", 0.0), ("MW", "Small", "04B", 0.0), ("MW", "Small", "05A", 0.0),
    ("MW", "Small", "05B", 0.0), ("MW", "Small", "06", 0.0),
    
    # ITOC (Infrastructure & Cloud) efforts  
    ("ITOC", "Sub $5M", "01", 0.08), ("ITOC", "Sub $5M", "02", 0.12), ("ITOC", "Sub $5M", "03", 0.17),
    ("ITOC", "Sub $5M", "04A", 0.5), ("ITOC", "Sub $5M", "04B", 0.0), ("ITOC", "Sub $5M", "05A", 0.08),
    ("ITOC", "Sub $5M", "05B", 0.0), ("ITOC", "Sub $5M", "06", 0.08),
    ("ITOC", "Cat C", "01", 0.08), ("ITOC", "Cat C", "02", 0.12), ("ITOC", "Cat C", "03", 0.17),
    ("ITOC", "Cat C", "04A", 1.0), ("ITOC", "Cat C", "04B", 0.0), ("ITOC", "Cat C", "05A", 0.08),
    ("ITOC", "Cat C", "05B", 0.0), ("ITOC", "Cat C", "06", 0.08),
    ("ITOC", "Cat B", "01", 0.08), ("ITOC", "Cat B", "02", 0.12), ("ITOC", "Cat B", "03", 0.25),
    ("ITOC", "Cat B", "04A", 2.0), ("ITOC", "Cat B", "04B", 0.0), ("ITOC", "Cat B", "05A", 0.25),
    ("ITOC", "Cat B", "05B", 0.0), ("ITOC", "Cat B", "06", 0.25),
    ("ITOC", "Cat A", "01", 0.08), ("ITOC", "Cat A", "02", 0.12), ("ITOC", "Cat A", "03", 0.5),
    ("ITOC", "Cat A", "04A", 2.5), ("ITOC", "Cat A", "04B", 0.0), ("ITOC", "Cat A", "05A", 0.5),
    ("ITOC", "Cat A", "05B", 0.0), ("ITOC", "Cat A", "06", 0.5),
]

# Service Line Offering Thresholds - Multiplier rules for offering counts  
OFFERING_THRESHOLDS = [
    # MW thresholds (consistent across all stages)
    ("MW", "01", 4, 0.2), ("MW", "02", 4, 0.2), ("MW", "03", 4, 0.2), ("MW", "04A", 4, 0.2),
    ("MW", "04B", 4, 0.2), ("MW", "05A", 4, 0.2), ("MW", "05B", 4, 0.2), ("MW", "06", 4, 0.2),
    # ITOC thresholds (consistent across all stages)
    ("ITOC", "01", 4, 0.2), ("ITOC", "02", 4, 0.2), ("ITOC", "03", 4, 0.2), ("ITOC", "04A", 4, 0.2),
    ("ITOC", "04B", 4, 0.2), ("ITOC", "05A", 4, 0.2), ("ITOC", "05B", 4, 0.2), ("ITOC", "06", 4, 0.2),
]

# Internal Service Mappings - Maps internal service values to service lines
INTERNAL_SERVICE_MAPPINGS = [
    # MW (Modern Workplace) mappings
    ("MW", "Modern Workplace"), ("MW", "MW"), ("MW", "Workplace Services"),
    ("MW", "Digital Employee Experience"), ("MW", "Collaboration"), ("MW", "Endpoint Services"),
    # ITOC (Infrastructure & Cloud) mappings
    ("ITOC", "Infrastructure & Cloud"), ("ITOC", "ITOC"), ("ITOC", "Cloud Services"),
    ("ITOC", "Infrastructure Services"), ("ITOC", "Data Center Services"), ("ITOC", "Platform Services"),
    ("ITOC", "IT Outsourcing"), ("ITOC", "Cloud"), ("ITOC", "Data & AI"), ("ITOC", "Network Services"),
]


def seed_opportunity_categories(session: Session):
    """Seed opportunity categories."""
    logger.info("Seeding opportunity categories")
    
    created_count = 0
    existing_count = 0
    
    for cat_data in OPPORTUNITY_CATEGORIES:
        # Check if category already exists
        existing = session.exec(
            select(OpportunityCategory).where(OpportunityCategory.name == cat_data["name"])
        ).first()
        
        if not existing:
            category = OpportunityCategory(**cat_data)
            session.add(category)
            created_count += 1
            logger.debug("Creating opportunity category", name=cat_data["name"])
        else:
            existing_count += 1
    
    if created_count > 0:
        session.commit()
        logger.info("Created opportunity categories", created=created_count, existing=existing_count)
    else:
        logger.info("All opportunity categories already exist", existing=existing_count)


def seed_service_line_categories(session: Session):
    """Seed service line categories."""
    logger.info("Seeding service line categories")
    
    created_count = 0
    existing_count = 0
    
    for cat_data in SERVICE_LINE_CATEGORIES:
        # Check if category already exists
        existing = session.exec(
            select(ServiceLineCategory).where(
                ServiceLineCategory.service_line == cat_data["service_line"],
                ServiceLineCategory.name == cat_data["name"]
            )
        ).first()
        
        if not existing:
            category = ServiceLineCategory(**cat_data)
            session.add(category)
            created_count += 1
            logger.debug("Creating service line category", 
                       service_line=cat_data["service_line"], 
                       name=cat_data["name"])
        else:
            existing_count += 1
    
    if created_count > 0:
        session.commit()
        logger.info("Created service line categories", created=created_count, existing=existing_count)
    else:
        logger.info("All service line categories already exist", existing=existing_count)


def seed_service_line_stage_efforts(session: Session):
    """Seed service line stage efforts."""
    logger.info("Seeding service line stage efforts")
    
    # Get all service line categories for ID lookup
    categories = session.exec(select(ServiceLineCategory)).all()
    category_lookup = {(cat.service_line, cat.name): cat.id for cat in categories}
    
    created_count = 0
    existing_count = 0
    skipped_count = 0
    
    for service_line, category_name, stage_name, fte_required in SERVICE_LINE_STAGE_EFFORTS:
        # Get category ID
        category_id = category_lookup.get((service_line, category_name))
        if not category_id:
            logger.warning("Service line category not found, skipping", 
                         service_line=service_line, category_name=category_name)
            skipped_count += 1
            continue
        
        # Check if stage effort already exists
        existing = session.exec(
            select(ServiceLineStageEffort).where(
                ServiceLineStageEffort.service_line == service_line,
                ServiceLineStageEffort.service_line_category_id == category_id,
                ServiceLineStageEffort.stage_name == stage_name
            )
        ).first()
        
        if not existing:
            effort = ServiceLineStageEffort(
                service_line=service_line,
                service_line_category_id=category_id,
                stage_name=stage_name,
                fte_required=fte_required
            )
            session.add(effort)
            created_count += 1
            logger.debug("Creating stage effort", 
                       service_line=service_line, 
                       category=category_name,
                       stage=stage_name, 
                       fte=fte_required)
        else:
            existing_count += 1
    
    if created_count > 0:
        session.commit()
        logger.info("Created service line stage efforts", 
                   created=created_count, existing=existing_count, skipped=skipped_count)
    else:
        logger.info("All service line stage efforts already exist", 
                   existing=existing_count, skipped=skipped_count)


def seed_offering_thresholds(session: Session):
    """Seed service line offering thresholds."""
    logger.info("Seeding offering thresholds")
    
    created_count = 0
    existing_count = 0
    
    for service_line, stage_name, threshold_count, increment_multiplier in OFFERING_THRESHOLDS:
        # Check if threshold already exists
        existing = session.exec(
            select(ServiceLineOfferingThreshold).where(
                ServiceLineOfferingThreshold.service_line == service_line,
                ServiceLineOfferingThreshold.stage_name == stage_name
            )
        ).first()
        
        if not existing:
            threshold = ServiceLineOfferingThreshold(
                service_line=service_line,
                stage_name=stage_name,
                threshold_count=threshold_count,
                increment_multiplier=increment_multiplier
            )
            session.add(threshold)
            created_count += 1
            logger.debug("Creating offering threshold", 
                       service_line=service_line, 
                       stage=stage_name,
                       threshold=threshold_count,
                       multiplier=increment_multiplier)
        else:
            existing_count += 1
    
    if created_count > 0:
        session.commit()
        logger.info("Created offering thresholds", created=created_count, existing=existing_count)
    else:
        logger.info("All offering thresholds already exist", existing=existing_count)


def seed_internal_service_mappings(session: Session):
    """Seed internal service mappings."""
    logger.info("Seeding internal service mappings")
    
    created_count = 0
    existing_count = 0
    
    for service_line, internal_service in INTERNAL_SERVICE_MAPPINGS:
        # Check if mapping already exists
        existing = session.exec(
            select(ServiceLineInternalServiceMapping).where(
                ServiceLineInternalServiceMapping.service_line == service_line,
                ServiceLineInternalServiceMapping.internal_service == internal_service
            )
        ).first()
        
        if not existing:
            mapping = ServiceLineInternalServiceMapping(
                service_line=service_line,
                internal_service=internal_service
            )
            session.add(mapping)
            created_count += 1
            logger.debug("Creating internal service mapping", 
                       service_line=service_line, 
                       internal_service=internal_service)
        else:
            existing_count += 1
    
    if created_count > 0:
        session.commit()
        logger.info("Created internal service mappings", created=created_count, existing=existing_count)
    else:
        logger.info("All internal service mappings already exist", existing=existing_count)


def seed_all_configuration():
    """Seed all configuration data in proper dependency order."""
    logger.info("Starting configuration data seeding")
    
    with Session(engine) as session:
        # Seed in dependency order
        seed_opportunity_categories(session)       # No dependencies
        seed_service_line_categories(session)      # No dependencies
        seed_service_line_stage_efforts(session)   # Depends on service line categories
        seed_offering_thresholds(session)          # No dependencies
        seed_internal_service_mappings(session)    # No dependencies
    
    logger.info("Configuration data seeding completed")


if __name__ == "__main__":
    seed_all_configuration()