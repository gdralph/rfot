#!/usr/bin/env python3
"""
Seed test data for resource timeline testing.
"""
from sqlmodel import Session

from app.models.database import engine
from app.models.config import OpportunityCategory, ServiceLineStageEffort
from app.models.resources import OpportunityResourceTimeline  # Import to ensure model is loaded


def create_test_data():
    """Create test configuration data."""
    with Session(engine) as session:
        # Create categories
        categories = [
            OpportunityCategory(name="Sub $5M", min_tcv=0, max_tcv=5.0, color="#FFA500"),
            OpportunityCategory(name="Cat C", min_tcv=5.0, max_tcv=10.0, color="#008080"),
            OpportunityCategory(name="Cat B", min_tcv=10.0, max_tcv=25.0, color="#008000"),
            OpportunityCategory(name="Cat A", min_tcv=25.0, max_tcv=None, color="#FF0000")
        ]
        
        for category in categories:
            session.add(category)
        
        session.flush()  # Get IDs for categories
        
        # Find Cat B category ID
        cat_b = None
        for category in categories:
            if category.name == "Cat B":
                cat_b = category
                break
        
        if not cat_b:
            raise ValueError("Cat B category not found")
        
        # Create MW service line stage efforts
        mw_efforts = [
            # Cat B stages (for our $15M test opportunity)
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-01", duration_weeks=3, fte_required=2),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-02", duration_weeks=4, fte_required=3),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-03", duration_weeks=6, fte_required=4),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-04a", duration_weeks=8, fte_required=5),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-04b", duration_weeks=4, fte_required=3),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-05a", duration_weeks=2, fte_required=2),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-05b", duration_weeks=1, fte_required=1),
            ServiceLineStageEffort(service_line="MW", category_id=cat_b.id, stage_name="SS-06", duration_weeks=12, fte_required=6),
        ]
        
        # Create ITOC service line stage efforts  
        itoc_efforts = [
            # Cat B stages (for our $15M test opportunity)
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-01", duration_weeks=2, fte_required=1.5),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-02", duration_weeks=3, fte_required=2),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-03", duration_weeks=4, fte_required=3),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-04a", duration_weeks=6, fte_required=4),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-04b", duration_weeks=3, fte_required=2.5),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-05a", duration_weeks=1.5, fte_required=1.5),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-05b", duration_weeks=1, fte_required=1),
            ServiceLineStageEffort(service_line="ITOC", category_id=cat_b.id, stage_name="SS-06", duration_weeks=10, fte_required=5),
        ]
        
        for effort in mw_efforts + itoc_efforts:
            session.add(effort)
        
        session.commit()
        
        print("✅ Created test configuration data:")
        print(f"   - Categories: {len(categories)}")
        print(f"   - MW stage efforts: {len(mw_efforts)}")
        print(f"   - ITOC stage efforts: {len(itoc_efforts)}")


if __name__ == "__main__":
    create_test_data()