#!/usr/bin/env python3
"""
Add sample opportunities for testing the application.
"""

from sqlmodel import Session
from datetime import date, timedelta
import random
import structlog

from app.models.database import engine
from app.models.opportunity import Opportunity

logger = structlog.get_logger()


def create_sample_opportunities():
    """Create sample opportunity data for testing."""
    
    sample_opportunities = [
        {
            'opportunity_id': 'DXC-2024-001',
            'opportunity_name': 'Global IT Infrastructure Modernization',
            'sales_stage': 'Proposal/Price Quote',
            'tcv_millions': 75.0,
            'decision_date': date.today() + timedelta(days=45),
            'opportunity_owner': 'John Smith',
            'ces_millions': 25.0,
            'ins_millions': 20.0,
            'itoc_millions': 30.0,
            'in_forecast': 'Yes'
        },
        {
            'opportunity_id': 'DXC-2024-002',
            'opportunity_name': 'Cloud Migration & Security Assessment',
            'sales_stage': 'Negotiation/Review',
            'tcv_millions': 15.0,
            'decision_date': date.today() + timedelta(days=30),
            'opportunity_owner': 'Sarah Johnson',
            'sec_millions': 8.0,
            'itoc_millions': 7.0,
            'in_forecast': 'Yes'
        },
        {
            'opportunity_id': 'DXC-2024-003',
            'opportunity_name': 'Digital Workplace Transformation',
            'sales_stage': 'Value Proposition',
            'tcv_millions': 3.5,
            'decision_date': date.today() + timedelta(days=60),
            'opportunity_owner': 'Michael Chen',
            'mw_millions': 2.0,
            'ces_millions': 1.5,
            'in_forecast': 'Yes'
        },
        {
            'opportunity_id': 'DXC-2024-004',
            'opportunity_name': 'Enterprise Data Analytics Platform',
            'sales_stage': 'Qualification',
            'tcv_millions': 120.0,
            'decision_date': date.today() + timedelta(days=90),
            'opportunity_owner': 'Lisa Rodriguez',
            'bps_millions': 50.0,
            'mw_millions': 40.0,
            'ces_millions': 30.0,
            'in_forecast': 'Yes'
        },
        {
            'opportunity_id': 'DXC-2024-005',
            'opportunity_name': 'Cybersecurity Operations Center',
            'sales_stage': 'Prospecting',
            'tcv_millions': 8.0,
            'decision_date': date.today() + timedelta(days=120),
            'opportunity_owner': 'David Kim',
            'sec_millions': 8.0,
            'in_forecast': 'No'
        },
        {
            'opportunity_id': 'DXC-2024-006',
            'opportunity_name': 'Business Process Automation',
            'sales_stage': 'Needs Analysis',
            'tcv_millions': 22.0,
            'decision_date': date.today() + timedelta(days=75),
            'opportunity_owner': 'Emily Watson',
            'bps_millions': 22.0,
            'in_forecast': 'Yes'
        },
        {
            'opportunity_id': 'DXC-2024-007',
            'opportunity_name': 'Legacy System Modernization',
            'sales_stage': 'Id. Decision Makers',
            'tcv_millions': 45.0,
            'decision_date': date.today() + timedelta(days=55),
            'opportunity_owner': 'Robert Taylor',
            'mw_millions': 25.0,
            'ces_millions': 20.0,
            'in_forecast': 'No'
        }
    ]
    
    with Session(engine) as session:
        # Check if sample data already exists
        existing_opp = session.get(Opportunity, 1)
        if existing_opp:
            logger.info("Sample data already exists, skipping creation")
            return
            
        logger.info("Creating sample opportunities", count=len(sample_opportunities))
        
        for opp_data in sample_opportunities:
            # Create opportunity
            opportunity = Opportunity(**opp_data)
            session.add(opportunity)
        
        session.commit()
        logger.info("Sample opportunities created successfully", count=len(sample_opportunities))


if __name__ == "__main__":
    create_sample_opportunities()