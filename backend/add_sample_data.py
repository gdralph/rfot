#!/usr/bin/env python3
"""
Add sample opportunities for testing the application.
"""

from sqlmodel import Session
from datetime import date, timedelta
import random

from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem


def create_sample_opportunities():
    """Create sample opportunity data for testing."""
    
    sample_opportunities = [
        {
            'opportunity_id': 'DXC-2024-001',
            'name': 'Global IT Infrastructure Modernization',
            'stage': 'Proposal/Price Quote',
            'amount': 75000000.0,
            'close_date': date.today() + timedelta(days=45),
            'assigned_resource': 'John Smith',
            'status': 'Active',
            'category': 'Cat B',
            'line_items': {
                'ces_revenue': 25000000.0,
                'ins_revenue': 20000000.0,
                'itoc_revenue': 30000000.0,
                'tcv': 75000000.0,
                'contract_length': 36,
                'in_forecast': 'Yes'
            }
        },
        {
            'opportunity_id': 'DXC-2024-002',
            'name': 'Cloud Migration & Security Assessment',
            'stage': 'Negotiation/Review',
            'amount': 15000000.0,
            'close_date': date.today() + timedelta(days=30),
            'assigned_resource': 'Sarah Johnson',
            'status': 'Active',
            'category': 'Cat C',
            'line_items': {
                'sec_revenue': 8000000.0,
                'itoc_revenue': 7000000.0,
                'tcv': 15000000.0,
                'contract_length': 24,
                'in_forecast': 'Yes'
            }
        },
        {
            'opportunity_id': 'DXC-2024-003',
            'name': 'Digital Workplace Transformation',
            'stage': 'Value Proposition',
            'amount': 3500000.0,
            'close_date': date.today() + timedelta(days=60),
            'assigned_resource': 'Michael Chen',
            'status': 'Active',
            'category': 'Sub $5M',
            'line_items': {
                'mw_revenue': 2000000.0,
                'ces_revenue': 1500000.0,
                'tcv': 3500000.0,
                'contract_length': 18,
                'in_forecast': 'Yes'
            }
        },
        {
            'opportunity_id': 'DXC-2024-004',
            'name': 'Enterprise Data Analytics Platform',
            'stage': 'Qualification',
            'amount': 120000000.0,
            'close_date': date.today() + timedelta(days=90),
            'assigned_resource': 'Lisa Rodriguez',
            'status': 'Active',
            'category': 'Cat A',
            'line_items': {
                'bps_revenue': 50000000.0,
                'mw_revenue': 40000000.0,
                'ces_revenue': 30000000.0,
                'tcv': 120000000.0,
                'contract_length': 48,
                'in_forecast': 'Yes'
            }
        },
        {
            'opportunity_id': 'DXC-2024-005',
            'name': 'Cybersecurity Operations Center',
            'stage': 'Prospecting',
            'amount': 8000000.0,
            'close_date': date.today() + timedelta(days=120),
            'assigned_resource': 'David Kim',
            'status': 'Active',
            'category': 'Cat C',
            'line_items': {
                'sec_revenue': 8000000.0,
                'tcv': 8000000.0,
                'contract_length': 24,
                'in_forecast': 'No'
            }
        },
        {
            'opportunity_id': 'DXC-2024-006',
            'name': 'Business Process Automation',
            'stage': 'Needs Analysis',
            'amount': 22000000.0,
            'close_date': date.today() + timedelta(days=75),
            'assigned_resource': 'Emily Watson',
            'status': 'Active',
            'category': 'Cat C',
            'line_items': {
                'bps_revenue': 22000000.0,
                'tcv': 22000000.0,
                'contract_length': 36,
                'in_forecast': 'Yes'
            }
        },
        {
            'opportunity_id': 'DXC-2024-007',
            'name': 'Legacy System Modernization',
            'stage': 'Id. Decision Makers',
            'amount': 45000000.0,
            'close_date': date.today() + timedelta(days=55),
            'assigned_resource': 'Robert Taylor',
            'status': 'On Hold',
            'category': 'Cat B',
            'line_items': {
                'mw_revenue': 25000000.0,
                'ces_revenue': 20000000.0,
                'tcv': 45000000.0,
                'contract_length': 30,
                'in_forecast': 'No'
            }
        }
    ]
    
    with Session(engine) as session:
        # Check if sample data already exists
        existing_opp = session.get(Opportunity, 1)
        if existing_opp:
            print("Sample data already exists. Skipping...")
            return
            
        print("Creating sample opportunities...")
        
        for opp_data in sample_opportunities:
            line_item_data = opp_data.pop('line_items')
            
            # Create opportunity
            opportunity = Opportunity(**opp_data)
            session.add(opportunity)
            session.commit()
            session.refresh(opportunity)
            
            # Create line item
            line_item = OpportunityLineItem(
                opportunity_id=opportunity.opportunity_id,
                **line_item_data
            )
            session.add(line_item)
        
        session.commit()
        print(f"Created {len(sample_opportunities)} sample opportunities with line items")
        print("Sample data creation completed!")


if __name__ == "__main__":
    create_sample_opportunities()