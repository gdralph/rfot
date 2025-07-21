#!/usr/bin/env python3
"""
Seed data script for the RFOT application.
This script populates initial configuration data for opportunity categories,
stage effort estimates, and SME allocation rules.
"""

import asyncio
from sqlmodel import Session, select

from app.models.database import engine
from app.models.config import OpportunityCategory, StageEffortEstimate, SMEAllocationRule


def create_seed_data():
    """Create initial seed data for the application."""
    
    with Session(engine) as session:
        # Check if data already exists
        existing_categories = session.exec(select(OpportunityCategory)).first()
        if existing_categories:
            print("Seed data already exists. Skipping...")
            return
            
        print("Creating seed data...")
        
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
        
        # Create Stage Effort Estimates for each category
        # Salesforce opportunity stages: Prospecting, Qualification, Needs Analysis, 
        # Value Proposition, Id. Decision Makers, Proposal/Price Quote, Negotiation/Review, Closed Won/Lost
        
        stages = [
            "Prospecting",
            "Qualification", 
            "Needs Analysis",
            "Value Proposition",
            "Id. Decision Makers",
            "Proposal/Price Quote",
            "Negotiation/Review"
        ]
        
        # Stage effort estimates (weeks of effort, weeks of duration) by category
        stage_estimates = {
            "Sub $5M": [
                (1, 2), (2, 2), (2, 3), (2, 3), (1, 2), (3, 4), (2, 3)
            ],
            "Cat C": [
                (2, 3), (3, 4), (4, 6), (3, 4), (2, 3), (6, 8), (4, 6)
            ],
            "Cat B": [
                (3, 4), (4, 6), (6, 8), (5, 7), (3, 5), (10, 12), (6, 9)
            ],
            "Cat A": [
                (4, 6), (6, 8), (8, 12), (7, 10), (4, 6), (15, 20), (8, 12)
            ]
        }
        
        for i, category in enumerate(categories):
            category_name = category.name
            for j, stage in enumerate(stages):
                effort_weeks, duration_weeks = stage_estimates[category_name][j]
                
                estimate = StageEffortEstimate(
                    category_id=category.id,
                    stage_name=stage,
                    default_effort_weeks=effort_weeks,
                    default_duration_weeks=duration_weeks
                )
                session.add(estimate)
        
        # Create SME Allocation Rules for different service lines
        # DXC Service Lines: CES, INS, BPS, SEC, ITOC, MW
        sme_rules = [
            SMEAllocationRule(team_name="Solutions Architecture", service_line="CES", effort_per_million=0.2),
            SMEAllocationRule(team_name="Solutions Architecture", service_line="INS", effort_per_million=0.15),
            SMEAllocationRule(team_name="Solutions Architecture", service_line="BPS", effort_per_million=0.1),
            SMEAllocationRule(team_name="Security Architecture", service_line="SEC", effort_per_million=0.3),
            SMEAllocationRule(team_name="Infrastructure Architecture", service_line="ITOC", effort_per_million=0.25),
            SMEAllocationRule(team_name="Application Architecture", service_line="MW", effort_per_million=0.2),
            
            # General SME support
            SMEAllocationRule(team_name="Business Development", service_line=None, effort_per_million=0.05),
            SMEAllocationRule(team_name="Legal Support", service_line=None, effort_per_million=0.02),
            SMEAllocationRule(team_name="Pricing Support", service_line=None, effort_per_million=0.03),
        ]
        
        for rule in sme_rules:
            session.add(rule)
        
        session.commit()
        print(f"Created {len(categories)} opportunity categories")
        print(f"Created {len(categories) * len(stages)} stage effort estimates") 
        print(f"Created {len(sme_rules)} SME allocation rules")
        print("Seed data creation completed!")


if __name__ == "__main__":
    create_seed_data()