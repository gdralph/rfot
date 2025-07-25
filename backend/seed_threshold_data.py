#!/usr/bin/env python3

"""
Seed script for ServiceLineOfferingThreshold data.

This script populates default threshold configurations for MW and ITOC service lines
with a threshold of 4 offerings and an increment multiplier of 0.2 per additional offering.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlmodel import Session, select, create_engine
import structlog

from app.models.database import engine
from app.models.config import ServiceLineOfferingThreshold

logger = structlog.get_logger()

# Sales stages for which to create thresholds
SALES_STAGES = ["01", "02", "03", "04A", "04B", "05A", "05B", "06"]

# Default threshold configuration
DEFAULT_THRESHOLD_COUNT = 4
DEFAULT_INCREMENT_MULTIPLIER = 0.2


def seed_threshold_data():
    """Seed the ServiceLineOfferingThreshold table with default configurations."""
    
    with Session(engine) as session:
        # First, clear any existing threshold data
        # print("Clearing existing ServiceLineOfferingThreshold data...")
        existing_thresholds = session.exec(select(ServiceLineOfferingThreshold)).all()
        for threshold in existing_thresholds:
            session.delete(threshold)
        session.commit()
        
        # Service lines to configure
        service_lines = ["MW", "ITOC"]
        
        # Create threshold configurations for each service line and stage
        thresholds_created = 0
        
        for service_line in service_lines:
            logger.info("Creating thresholds for service line", service_line=service_line)
            
            for stage in SALES_STAGES:
                threshold = ServiceLineOfferingThreshold(
                    service_line=service_line,
                    stage_name=stage,
                    threshold_count=DEFAULT_THRESHOLD_COUNT,
                    increment_multiplier=DEFAULT_INCREMENT_MULTIPLIER
                )
                session.add(threshold)
                thresholds_created += 1
        
        session.commit()
        logger.info("Threshold seeding completed", thresholds_created=thresholds_created)
        
        # Verify the data was created correctly
        mw_count = session.exec(
            select(ServiceLineOfferingThreshold).where(ServiceLineOfferingThreshold.service_line == "MW")
        ).all()
        itoc_count = session.exec(
            select(ServiceLineOfferingThreshold).where(ServiceLineOfferingThreshold.service_line == "ITOC")
        ).all()
        
        logger.info("Threshold seeding summary", 
                   mw_entries=len(mw_count), 
                   itoc_entries=len(itoc_count), 
                   total=len(mw_count) + len(itoc_count),
                   default_threshold=DEFAULT_THRESHOLD_COUNT,
                   default_increment=DEFAULT_INCREMENT_MULTIPLIER)


if __name__ == "__main__":
    seed_threshold_data()