#!/usr/bin/env python3

"""
Seed Service Line Stage Effort Data
This script populates the ServiceLineStageEffort table with MW and ITOC resource templates
based on the specifications provided.
"""

from sqlmodel import Session, select
import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.models.database import engine
from app.models.config import ServiceLineStageEffort, OpportunityCategory

# MW (Modern Workplace) Resource Templates - Exact values from user specification
MW_TEMPLATES = {
    # Category A (≥$50M) - Total: 70.0 FTE-weeks
    "Cat A": {
        "01": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 8, "fte_required": 0.25},  # 2.0 FTE-weeks
        "04A": {"duration_weeks": 26, "fte_required": 2.5}, # 65.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 8, "fte_required": 0.25}, # 2.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 4, "fte_required": 0.25}   # 1.0 FTE-weeks
    },
    # Category B ($25-50M) - Total: 37.0 FTE-weeks
    "Cat B": {
        "01": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 4, "fte_required": 0.25},  # 1.0 FTE-weeks
        "04A": {"duration_weeks": 17, "fte_required": 2.0}, # 34.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 4, "fte_required": 0.25}, # 1.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 4, "fte_required": 0.25}   # 1.0 FTE-weeks
    },
    # Category C ($5-25M) - Total: 9.0 FTE-weeks
    "Cat C": {
        "01": {"duration_weeks": 2, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 2, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 2, "fte_required": 0.0},   # 0.0 FTE-weeks
        "04A": {"duration_weeks": 9, "fte_required": 1.0},  # 9.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 2, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 2, "fte_required": 0.0}    # 0.0 FTE-weeks
    },
    # Sub $5M (< $5M) - Minimal resource requirements - Total: 2.0 FTE-weeks
    "Sub $5M": {
        "01": {"duration_weeks": 1, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 1, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 1, "fte_required": 0.0},   # 0.0 FTE-weeks
        "04A": {"duration_weeks": 4, "fte_required": 0.5},  # 2.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 1, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 1, "fte_required": 0.0}    # 0.0 FTE-weeks
    }
}

# ITOC (Infrastructure & Cloud) Resource Templates - Exact values from user specification
ITOC_TEMPLATES = {
    # Category A (≥$50M) - Total: 75.0 FTE-weeks
    "Cat A": {
        "01": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 8, "fte_required": 0.5},   # 4.0 FTE-weeks
        "04A": {"duration_weeks": 26, "fte_required": 2.5}, # 65.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 8, "fte_required": 0.5},  # 4.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 4, "fte_required": 0.5}    # 2.0 FTE-weeks
    },
    # Category B ($25-50M) - Total: 37.0 FTE-weeks
    "Cat B": {
        "01": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 4, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 4, "fte_required": 0.25},  # 1.0 FTE-weeks
        "04A": {"duration_weeks": 17, "fte_required": 2.0}, # 34.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 4, "fte_required": 0.25}, # 1.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 4, "fte_required": 0.25}   # 1.0 FTE-weeks
    },
    # Category C ($5-25M) - Total: 9.0 FTE-weeks
    "Cat C": {
        "01": {"duration_weeks": 2, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 2, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 2, "fte_required": 0.0},   # 0.0 FTE-weeks
        "04A": {"duration_weeks": 9, "fte_required": 1.0},  # 9.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 2, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 2, "fte_required": 0.0}    # 0.0 FTE-weeks
    },
    # Sub $5M (< $5M) - Minimal resource requirements - Total: 2.0 FTE-weeks  
    "Sub $5M": {
        "01": {"duration_weeks": 1, "fte_required": 0.0},   # 0.0 FTE-weeks
        "02": {"duration_weeks": 1, "fte_required": 0.0},   # 0.0 FTE-weeks
        "03": {"duration_weeks": 1, "fte_required": 0.0},   # 0.0 FTE-weeks
        "04A": {"duration_weeks": 4, "fte_required": 0.5},  # 2.0 FTE-weeks
        "04B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05A": {"duration_weeks": 1, "fte_required": 0.0},  # 0.0 FTE-weeks
        "05B": {"duration_weeks": 0, "fte_required": 0.0},  # 0.0 FTE-weeks
        "06": {"duration_weeks": 1, "fte_required": 0.0}    # 0.0 FTE-weeks
    }
}


def seed_service_line_stage_efforts():
    """Seed the ServiceLineStageEffort table with MW and ITOC templates."""
    
    with Session(engine) as session:
        # First, clear any existing service line stage effort data
        print("Clearing existing ServiceLineStageEffort data...")
        existing_efforts = session.exec(select(ServiceLineStageEffort)).all()
        for effort in existing_efforts:
            session.delete(effort)
        session.commit()
        print(f"Removed {len(existing_efforts)} existing entries")
        # Get all categories
        categories = session.exec(select(OpportunityCategory)).all()
        category_by_name = {cat.name: cat for cat in categories}
        
        print(f"Found {len(categories)} categories:")
        for cat in categories:
            print(f"  - {cat.name} (ID: {cat.id})")
        
        # Process MW templates
        print("\nSeeding MW (Modern Workplace) templates...")
        for category_name, stages in MW_TEMPLATES.items():
            category = category_by_name.get(category_name)
            if not category:
                print(f"  WARNING: Category '{category_name}' not found, skipping...")
                continue
                
            print(f"  Processing {category_name}...")
            for stage_name, config in stages.items():
                # Create new effort record
                effort = ServiceLineStageEffort(
                    service_line="MW",
                    category_id=category.id,
                    stage_name=stage_name,
                    duration_weeks=config["duration_weeks"],
                    fte_required=config["fte_required"]
                )
                
                session.add(effort)
                total_effort = config["duration_weeks"] * config["fte_required"]
                print(f"    {stage_name}: {config['duration_weeks']}w × {config['fte_required']} FTE = {total_effort} FTE-weeks")
        
        # Process ITOC templates
        print("\nSeeding ITOC (Infrastructure & Cloud) templates...")
        for category_name, stages in ITOC_TEMPLATES.items():
            category = category_by_name.get(category_name)
            if not category:
                print(f"  WARNING: Category '{category_name}' not found, skipping...")
                continue
                
            print(f"  Processing {category_name}...")
            for stage_name, config in stages.items():
                # Create new effort record
                effort = ServiceLineStageEffort(
                    service_line="ITOC",
                    category_id=category.id,
                    stage_name=stage_name,
                    duration_weeks=config["duration_weeks"],
                    fte_required=config["fte_required"]
                )
                
                session.add(effort)
                total_effort = config["duration_weeks"] * config["fte_required"]
                print(f"    {stage_name}: {config['duration_weeks']}w × {config['fte_required']} FTE = {total_effort} FTE-weeks")
        
        # Commit all changes
        session.commit()
        print("\nService Line Stage Effort data seeded successfully!")
        
        # Show summary
        mw_count = session.exec(
            select(ServiceLineStageEffort).where(ServiceLineStageEffort.service_line == "MW")
        ).all()
        itoc_count = session.exec(
            select(ServiceLineStageEffort).where(ServiceLineStageEffort.service_line == "ITOC")
        ).all()
        
        print(f"\nSummary:")
        print(f"  MW entries: {len(mw_count)}")
        print(f"  ITOC entries: {len(itoc_count)}")
        print(f"  Total: {len(mw_count) + len(itoc_count)}")


if __name__ == "__main__":
    print("Seeding Service Line Stage Effort data...")
    seed_service_line_stage_efforts()