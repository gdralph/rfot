#!/usr/bin/env python3

"""
Test script for offering-based FTE multiplier calculations.

This script tests the calculate_offering_multiplier function with various scenarios.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlmodel import Session, select
from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.services.resource_calculation import calculate_offering_multiplier
from datetime import datetime
import structlog

logger = structlog.get_logger()


def create_test_opportunity_with_offerings(opp_id: str, offering_count: int, session: Session, include_mapped: bool = True):
    """Create a test opportunity with specified number of unique offerings."""
    
    # Create opportunity
    opportunity = Opportunity(
        opportunity_id=opp_id,
        opportunity_name=f"Test Opportunity {opp_id}",
        tcv_millions=10.0,
        mw_millions=5.0,
        decision_date=datetime(2024, 12, 31),
        sales_stage="03"
    )
    session.add(opportunity)
    
    # Create line items with unique simplified_offering values
    for i in range(offering_count):
        # Use MW internal service for mapped offerings, or unmapped service for unmapped
        internal_service = "MW" if include_mapped else "Unmapped Service"
        
        line_item = OpportunityLineItem(
            opportunity_id=opp_id,
            simplified_offering=f"Offering_{i+1}",
            offering_tcv=1.0,
            internal_service=internal_service
        )
        session.add(line_item)
    
    session.commit()
    logger.info("Created test opportunity", opportunity_id=opp_id, offering_count=offering_count, mapped=include_mapped)


def test_offering_multiplier():
    """Test the offering multiplier calculation with various scenarios."""
    
    with Session(engine) as session:
        # Test scenarios: opportunity_id -> number of offerings
        test_scenarios = {
            "TEST_OPP_1": 1,   # Below threshold (should be 1.0x)
            "TEST_OPP_2": 3,   # Below threshold (should be 1.0x)  
            "TEST_OPP_3": 4,   # At threshold (should be 1.0x)
            "TEST_OPP_4": 5,   # Above threshold by 1 (should be 1.2x)
            "TEST_OPP_5": 6,   # Above threshold by 2 (should be 1.4x)
            "TEST_OPP_6": 8,   # Above threshold by 4 (should be 1.8x)
        }
        
        # Clean up any existing test opportunities
        for opp_id in test_scenarios.keys():
            existing_line_items = session.exec(
                select(OpportunityLineItem).where(OpportunityLineItem.opportunity_id == opp_id)
            ).all()
            for item in existing_line_items:
                session.delete(item)
            
            existing_opp = session.exec(
                select(Opportunity).where(Opportunity.opportunity_id == opp_id)
            ).first()
            if existing_opp:
                session.delete(existing_opp)
        
        session.commit()
        
        # Create test opportunities
        for opp_id, offering_count in test_scenarios.items():
            create_test_opportunity_with_offerings(opp_id, offering_count, session)
        
        # Test multiplier calculations
        print("\n=== Offering Multiplier Test Results ===")
        print("Format: Opportunity | Offerings | Expected | Actual | Status")
        print("-" * 55)
        
        for opp_id, offering_count in test_scenarios.items():
            # Calculate expected multiplier
            threshold = 4
            increment = 0.2
            if offering_count <= threshold:
                expected_multiplier = 1.0
            else:
                excess = offering_count - threshold
                expected_multiplier = 1.0 + (excess * increment)
            
            # Test with MW service line (should exist from seed data)
            actual_multiplier = calculate_offering_multiplier(
                opp_id, "MW", "03", session
            )
            
            status = "✓ PASS" if abs(actual_multiplier - expected_multiplier) < 0.001 else "✗ FAIL"
            
            print(f"{opp_id:12} | {offering_count:9} | {expected_multiplier:8.1f} | {actual_multiplier:6.1f} | {status}")
        
        print("-" * 55)
        
        # Test edge cases
        print("\n=== Edge Case Tests ===")
        
        # Test with no line items
        empty_opp = Opportunity(
            opportunity_id="EMPTY_OPP",
            opportunity_name="Empty Test Opportunity",
            tcv_millions=10.0,
            mw_millions=5.0,
            decision_date=datetime(2024, 12, 31),
            sales_stage="03"
        )
        session.add(empty_opp)
        session.commit()
        
        empty_multiplier = calculate_offering_multiplier("EMPTY_OPP", "MW", "03", session)
        print(f"No offerings: {empty_multiplier:.1f} (expected: 1.0)")
        
        # Test with null/empty simplified_offering values
        test_opp = Opportunity(
            opportunity_id="NULL_TEST",
            opportunity_name="Null Test Opportunity", 
            tcv_millions=10.0,
            mw_millions=5.0,
            decision_date=datetime(2024, 12, 31),
            sales_stage="03"
        )
        session.add(test_opp)
        
        # Add line items with null and empty offerings
        null_item = OpportunityLineItem(opportunity_id="NULL_TEST", simplified_offering=None, offering_tcv=1.0)
        empty_item = OpportunityLineItem(opportunity_id="NULL_TEST", simplified_offering="", offering_tcv=1.0)
        valid_item = OpportunityLineItem(opportunity_id="NULL_TEST", simplified_offering="Valid_Offering", offering_tcv=1.0)
        
        session.add(null_item)
        session.add(empty_item)
        session.add(valid_item)
        session.commit()
        
        null_test_multiplier = calculate_offering_multiplier("NULL_TEST", "MW", "03", session)
        print(f"1 valid + null/empty offerings: {null_test_multiplier:.1f} (expected: 1.0)")
        
        # Test internal service filtering
        print("\\n=== Internal Service Filtering Tests ===")
        
        # Test with mapped internal services (should count offerings)
        mapped_opp = Opportunity(
            opportunity_id="MAPPED_TEST",
            opportunity_name="Mapped Internal Service Test",
            tcv_millions=10.0,
            mw_millions=5.0,
            decision_date=datetime(2024, 12, 31),
            sales_stage="03"
        )
        session.add(mapped_opp)
        
        # Add 6 line items with MW internal service (mapped)
        for i in range(6):
            mapped_item = OpportunityLineItem(
                opportunity_id="MAPPED_TEST",
                simplified_offering=f"MW_Offering_{i+1}",
                offering_tcv=1.0,
                internal_service="MW"
            )
            session.add(mapped_item)
        session.commit()
        
        mapped_multiplier = calculate_offering_multiplier("MAPPED_TEST", "MW", "03", session)
        print(f"6 mapped MW offerings: {mapped_multiplier:.1f} (expected: 1.4)")
        
        # Test with unmapped internal services (should not count offerings)
        unmapped_opp = Opportunity(
            opportunity_id="UNMAPPED_TEST",
            opportunity_name="Unmapped Internal Service Test",
            tcv_millions=10.0,
            mw_millions=5.0,
            decision_date=datetime(2024, 12, 31),
            sales_stage="03"
        )
        session.add(unmapped_opp)
        
        # Add 6 line items with unmapped internal service
        for i in range(6):
            unmapped_item = OpportunityLineItem(
                opportunity_id="UNMAPPED_TEST",
                simplified_offering=f"Unmapped_Offering_{i+1}",
                offering_tcv=1.0,
                internal_service="Unmapped Service"
            )
            session.add(unmapped_item)
        session.commit()
        
        unmapped_multiplier = calculate_offering_multiplier("UNMAPPED_TEST", "MW", "03", session)
        print(f"6 unmapped offerings: {unmapped_multiplier:.1f} (expected: 1.0)")
        
        # Test mixed mapped/unmapped
        mixed_opp = Opportunity(
            opportunity_id="MIXED_TEST",
            opportunity_name="Mixed Internal Service Test",
            tcv_millions=10.0,
            mw_millions=5.0,
            decision_date=datetime(2024, 12, 31),
            sales_stage="03"
        )
        session.add(mixed_opp)
        
        # Add 3 mapped and 3 unmapped offerings (only mapped should count)
        for i in range(3):
            mapped_item = OpportunityLineItem(
                opportunity_id="MIXED_TEST",
                simplified_offering=f"MW_Offering_{i+1}",
                offering_tcv=1.0,
                internal_service="MW"
            )
            session.add(mapped_item)
            
            unmapped_item = OpportunityLineItem(
                opportunity_id="MIXED_TEST",
                simplified_offering=f"Unmapped_Offering_{i+1}",
                offering_tcv=1.0,
                internal_service="Unmapped Service"
            )
            session.add(unmapped_item)
        session.commit()
        
        mixed_multiplier = calculate_offering_multiplier("MIXED_TEST", "MW", "03", session)
        print(f"3 mapped + 3 unmapped offerings: {mixed_multiplier:.1f} (expected: 1.0)")
        
        # Cleanup test data
        test_opps = ["EMPTY_OPP", "NULL_TEST", "MAPPED_TEST", "UNMAPPED_TEST", "MIXED_TEST"] + list(test_scenarios.keys())
        for opp_id in test_opps:
            # Delete line items first
            line_items = session.exec(
                select(OpportunityLineItem).where(OpportunityLineItem.opportunity_id == opp_id)
            ).all()
            for item in line_items:
                session.delete(item)
            
            # Delete opportunity
            opp = session.exec(
                select(Opportunity).where(Opportunity.opportunity_id == opp_id)
            ).first()
            if opp:
                session.delete(opp)
        
        session.commit()
        print("\nTest data cleaned up.")


if __name__ == "__main__":
    test_offering_multiplier()