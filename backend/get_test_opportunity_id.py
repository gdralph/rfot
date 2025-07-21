#!/usr/bin/env python3
"""
Find the integer ID for our test opportunity.
"""
from sqlmodel import Session, select

from app.models.database import engine
from app.models.opportunity import Opportunity
from app.models.resources import OpportunityResourceTimeline  # Import to ensure model is loaded


def get_test_opportunity_id():
    """Find the test opportunity ID."""
    with Session(engine) as session:
        # Find the test opportunity
        statement = select(Opportunity).where(Opportunity.opportunity_id == "TEST-001")
        opportunity = session.exec(statement).first()
        
        if opportunity:
            print(f"✅ Found test opportunity: {opportunity.opportunity_id}")
            print(f"   - Integer ID: {opportunity.id}")
            print(f"   - Name: {opportunity.opportunity_name}")
            print(f"   - TCV: ${opportunity.tcv_millions}M")
            return opportunity.id
        else:
            print("❌ Test opportunity not found")
            return None


if __name__ == "__main__":
    get_test_opportunity_id()