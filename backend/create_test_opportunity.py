#!/usr/bin/env python3
"""
Create a test opportunity for resource timeline testing.
"""
from datetime import datetime, timedelta
from sqlmodel import Session

from app.models.database import engine
from app.models.opportunity import Opportunity
from app.models.resources import OpportunityResourceTimeline  # Import to ensure model is loaded


def create_test_opportunity():
    """Create a test opportunity with MW/ITOC revenue and decision date."""
    with Session(engine) as session:
        # Create test opportunity
        test_opp = Opportunity(
            opportunity_id="TEST-001",
            opportunity_name="Test Digital Transformation Project",
            tcv_millions=15.0,  # Should be Cat B category
            mw_millions=8.0,
            itoc_millions=7.0,
            sales_stage="SS-03",  # Qualify stage
            decision_date=datetime.now() + timedelta(days=120),  # 4 months from now
            account_name="Test Client Corp",
            opportunity_type="New Business",
            margin_percentage=25.0
        )
        
        session.add(test_opp)
        session.commit()
        
        print(f"✅ Created test opportunity: {test_opp.opportunity_id}")
        print(f"   - Name: {test_opp.opportunity_name}")
        print(f"   - TCV: ${test_opp.tcv_millions}M")
        print(f"   - MW Revenue: ${test_opp.mw_millions}M")
        print(f"   - ITOC Revenue: ${test_opp.itoc_millions}M")
        print(f"   - Current Stage: {test_opp.sales_stage}")
        print(f"   - Decision Date: {test_opp.decision_date}")


if __name__ == "__main__":
    create_test_opportunity()