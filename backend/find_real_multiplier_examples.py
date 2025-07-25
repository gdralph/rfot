#!/usr/bin/env python3

"""
Find Real Opportunities with Offering Multipliers Above Threshold

This script searches for real opportunities in the database where the offering count
for MW and/or ITOC service lines exceeds the threshold of 4, triggering multiplier effects.
"""

import sys
from pathlib import Path
from datetime import datetime
from sqlmodel import Session, select

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.models.config import ServiceLineInternalServiceMapping
from app.services.resource_calculation import calculate_offering_multiplier


def analyze_opportunity_offerings():
    """Find opportunities with offering counts above threshold."""
    
    with Session(engine) as session:
        # Get all opportunities with timeline data and service line revenue
        opportunities = session.exec(
            select(Opportunity).where(
                Opportunity.decision_date.is_not(None),
                Opportunity.tcv_millions.is_not(None),
                Opportunity.tcv_millions > 0
            )
        ).all()
        
        # Get internal service mappings for filtering
        mw_mappings = session.exec(
            select(ServiceLineInternalServiceMapping).where(
                ServiceLineInternalServiceMapping.service_line == "MW"
            )
        ).all()
        
        itoc_mappings = session.exec(
            select(ServiceLineInternalServiceMapping).where(
                ServiceLineInternalServiceMapping.service_line == "ITOC"
            )
        ).all()
        
        mw_valid_services = {mapping.internal_service for mapping in mw_mappings}
        itoc_valid_services = {mapping.internal_service for mapping in itoc_mappings}
        
        print("=" * 80)
        print("SEARCHING FOR REAL OPPORTUNITIES WITH OFFERING MULTIPLIERS")
        print("=" * 80)
        print(f"MW Valid Internal Services: {list(mw_valid_services)}")
        print(f"ITOC Valid Internal Services: {list(itoc_valid_services)}")
        print(f"Threshold: 4 offerings (multiplier kicks in above this)")
        print()
        
        above_threshold_opportunities = []
        
        for opp in opportunities:
            # Get line items for this opportunity
            line_items = session.exec(
                select(OpportunityLineItem).where(
                    OpportunityLineItem.opportunity_id == opp.opportunity_id
                )
            ).all()
            
            if not line_items:
                continue
                
            # Analyze MW offerings
            mw_mapped_items = [item for item in line_items 
                             if item.internal_service in mw_valid_services]
            mw_unique_offerings = set(item.simplified_offering for item in mw_mapped_items 
                                    if item.simplified_offering and item.simplified_offering.strip())
            
            # Analyze ITOC offerings
            itoc_mapped_items = [item for item in line_items 
                               if item.internal_service in itoc_valid_services]
            itoc_unique_offerings = set(item.simplified_offering for item in itoc_mapped_items 
                                      if item.simplified_offering and item.simplified_offering.strip())
            
            # Check if any service line exceeds threshold
            mw_count = len(mw_unique_offerings)
            itoc_count = len(itoc_unique_offerings)
            
            if (mw_count > 4 and opp.mw_millions and opp.mw_millions > 0) or \
               (itoc_count > 4 and opp.itoc_millions and opp.itoc_millions > 0):
                
                above_threshold_opportunities.append({
                    'opportunity': opp,
                    'mw_count': mw_count,
                    'itoc_count': itoc_count,
                    'mw_offerings': list(mw_unique_offerings),
                    'itoc_offerings': list(itoc_unique_offerings),
                    'total_line_items': len(line_items)
                })
        
        print(f"FOUND {len(above_threshold_opportunities)} OPPORTUNITIES WITH OFFERING MULTIPLIERS")
        print("=" * 80)
        
        # Sort by total offering count (MW + ITOC)
        above_threshold_opportunities.sort(
            key=lambda x: x['mw_count'] + x['itoc_count'], 
            reverse=True
        )
        
        # Show top opportunities
        for i, opp_data in enumerate(above_threshold_opportunities[:5]):
            opp = opp_data['opportunity']
            print(f"\n{i+1}. {opp.opportunity_id}")
            print(f"   Name: {opp.opportunity_name}")
            print(f"   TCV: ${opp.tcv_millions:.1f}M")
            print(f"   MW: ${opp.mw_millions or 0:.1f}M ({opp_data['mw_count']} offerings)")
            print(f"   ITOC: ${opp.itoc_millions or 0:.1f}M ({opp_data['itoc_count']} offerings)")
            print(f"   Stage: {opp.sales_stage} | Decision: {opp.decision_date}")
            print(f"   Total Line Items: {opp_data['total_line_items']}")
            
            # Show multiplier potential
            mw_excess = max(0, opp_data['mw_count'] - 4)
            itoc_excess = max(0, opp_data['itoc_count'] - 4)
            
            if mw_excess > 0:
                mw_multiplier = 1.0 + (mw_excess * 0.2)
                print(f"   🚀 MW Multiplier: {mw_multiplier:.1f}x ({mw_excess} offerings above threshold)")
                
            if itoc_excess > 0:
                itoc_multiplier = 1.0 + (itoc_excess * 0.2)
                print(f"   🚀 ITOC Multiplier: {itoc_multiplier:.1f}x ({itoc_excess} offerings above threshold)")
        
        return above_threshold_opportunities[:3]  # Return top 3 for detailed analysis


if __name__ == "__main__":
    opportunities = analyze_opportunity_offerings()
    
    if opportunities:
        print(f"\n" + "=" * 80)
        print("DETAILED TIMELINE CALCULATIONS FOR TOP OPPORTUNITIES")
        print("=" * 80)
        
        # Import the demo script function
        sys.path.append('/Users/gdralph/Development/rfot/backend')
        from demo_timeline_calculation import demonstrate_timeline_calculation
        
        for i, opp_data in enumerate(opportunities):
            opp = opp_data['opportunity']
            print(f"\n{'#' * 20} OPPORTUNITY {i+1}: {opp.opportunity_id} {'#' * 20}")
            
            # Show offering details first
            print(f"\n📋 OFFERING BREAKDOWN:")
            print(f"MW Offerings ({opp_data['mw_count']}): {opp_data['mw_offerings']}")
            print(f"ITOC Offerings ({opp_data['itoc_count']}): {opp_data['itoc_offerings']}")
            
            # Run detailed calculation
            demonstrate_timeline_calculation(opp.opportunity_id)
            
            if i < len(opportunities) - 1:
                print("\n" + "=" * 80)
    else:
        print("\nNo opportunities found with offering counts above threshold of 4.")