#!/usr/bin/env python3

"""
Timeline Calculation Demonstration Script

This script demonstrates how opportunity timelines are calculated step-by-step,
showing the actual data and logic used in the calculation process.
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
from app.models.config import (
    OpportunityCategory, 
    ServiceLineCategory, 
    ServiceLineStageEffort, 
    ServiceLineOfferingThreshold,
    ServiceLineInternalServiceMapping
)
from app.services.resource_calculation import (
    calculate_opportunity_resource_timeline,
    determine_opportunity_category,
    determine_service_line_resource_category,
    calculate_offering_multiplier,
    get_remaining_stages
)


def find_demo_opportunity():
    """Find a good opportunity for demonstration."""
    with Session(engine) as session:
        # Get opportunities with timeline data and multiple service lines
        opportunities = session.exec(
            select(Opportunity).where(
                Opportunity.decision_date.is_not(None),
                Opportunity.tcv_millions.is_not(None),
                Opportunity.tcv_millions > 0
            )
        ).all()
        
        print("=== AVAILABLE OPPORTUNITIES FOR TIMELINE DEMO ===")
        for i, opp in enumerate(opportunities[:5]):
            line_items = session.exec(
                select(OpportunityLineItem).where(OpportunityLineItem.opportunity_id == opp.opportunity_id)
            ).all()
            
            print(f"{i+1}. {opp.opportunity_id}")
            print(f"   Name: {opp.opportunity_name}")
            print(f"   TCV: ${opp.tcv_millions}M")
            print(f"   MW: ${opp.mw_millions or 0}M | ITOC: ${opp.itoc_millions or 0}M")
            print(f"   Stage: {opp.sales_stage} | Decision: {opp.decision_date}")
            print(f"   Line Items: {len(line_items)}")
            
            if line_items:
                unique_offerings = set(item.simplified_offering for item in line_items if item.simplified_offering)
                print(f"   Unique Offerings: {len(unique_offerings)}")
            print()
        
        return opportunities[0] if opportunities else None


def demonstrate_timeline_calculation(opportunity_id: str):
    """Demonstrate step-by-step timeline calculation for an opportunity."""
    
    with Session(engine) as session:
        # Get the opportunity
        opportunity = session.exec(
            select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
        ).first()
        
        if not opportunity:
            print(f"❌ Opportunity {opportunity_id} not found")
            return
            
        print("=" * 80)
        print(f"TIMELINE CALCULATION DEMONSTRATION: {opportunity_id}")
        print("=" * 80)
        
        # STEP 1: Opportunity Overview
        print("\n📋 STEP 1: OPPORTUNITY OVERVIEW")
        print("-" * 40)
        print(f"Opportunity ID: {opportunity.opportunity_id}")
        print(f"Name: {opportunity.opportunity_name}")
        print(f"Total TCV: ${opportunity.tcv_millions or 0:.1f} million")
        print(f"MW Revenue: ${opportunity.mw_millions or 0:.1f} million")
        print(f"ITOC Revenue: ${opportunity.itoc_millions or 0:.1f} million")
        print(f"Current Stage: {opportunity.sales_stage or 'Not Set'}")
        print(f"Decision Date: {opportunity.decision_date}")
        
        if not opportunity.decision_date:
            print("❌ Cannot calculate timeline - no decision date set")
            return
            
        # STEP 2: Category Determination
        print("\n📊 STEP 2: CATEGORY DETERMINATION")
        print("-" * 40)
        
        # Timeline category (based on total TCV)
        timeline_category = determine_opportunity_category(opportunity.tcv_millions or 0, session)
        print(f"Timeline Category: {timeline_category} (based on total TCV: ${opportunity.tcv_millions or 0:.1f}M)")
        
        # Show category thresholds
        categories = session.exec(select(OpportunityCategory).order_by(OpportunityCategory.min_tcv)).all()
        print("  Category Thresholds:")
        for cat in categories:
            max_tcv = f"${cat.max_tcv/1000000:.0f}M" if cat.max_tcv else "∞"
            indicator = "👉" if cat.name == timeline_category else "  "
            print(f"  {indicator} {cat.name}: ${cat.min_tcv/1000000:.0f}M - {max_tcv}")
        
        # Resource categories (based on service line TCV)
        service_lines_to_process = []
        if opportunity.mw_millions and opportunity.mw_millions > 0:
            mw_resource_category = determine_service_line_resource_category("MW", opportunity.mw_millions, session)
            service_lines_to_process.append(("MW", opportunity.mw_millions, mw_resource_category))
            print(f"MW Resource Category: {mw_resource_category} (based on MW TCV: ${opportunity.mw_millions:.1f}M)")
            
        if opportunity.itoc_millions and opportunity.itoc_millions > 0:
            itoc_resource_category = determine_service_line_resource_category("ITOC", opportunity.itoc_millions, session)
            service_lines_to_process.append(("ITOC", opportunity.itoc_millions, itoc_resource_category))
            print(f"ITOC Resource Category: {itoc_resource_category} (based on ITOC TCV: ${opportunity.itoc_millions:.1f}M)")
        
        if not service_lines_to_process:
            print("❌ No service lines with revenue - cannot calculate timeline")
            return
            
        # STEP 3: Line Items and Offering Analysis
        print("\n🔍 STEP 3: LINE ITEMS & OFFERING ANALYSIS")
        print("-" * 40)
        
        line_items = session.exec(
            select(OpportunityLineItem).where(OpportunityLineItem.opportunity_id == opportunity_id)
        ).all()
        
        print(f"Total Line Items: {len(line_items)}")
        
        if line_items:
            # Show sample line items
            print("Sample Line Items:")
            for i, item in enumerate(line_items[:3]):
                print(f"  {i+1}. Offering: {item.simplified_offering or 'N/A'}")
                print(f"     Internal Service: {item.internal_service or 'N/A'}")
                print(f"     TCV: ${item.offering_tcv or 0:.1f}")
            
            if len(line_items) > 3:
                print(f"     ... and {len(line_items) - 3} more")
        
        # Analyze offerings by service line
        for service_line, _, _ in service_lines_to_process:
            print(f"\n{service_line} Service Line Offering Analysis:")
            
            # Get internal service mappings
            mappings = session.exec(
                select(ServiceLineInternalServiceMapping).where(
                    ServiceLineInternalServiceMapping.service_line == service_line
                )
            ).all()
            
            valid_internal_services = {mapping.internal_service for mapping in mappings}
            print(f"  Valid Internal Services: {list(valid_internal_services)}")
            
            # Filter line items by valid internal services
            mapped_items = [item for item in line_items 
                          if item.internal_service in valid_internal_services]
            
            unique_offerings = set(item.simplified_offering for item in mapped_items 
                                 if item.simplified_offering and item.simplified_offering.strip())
            
            print(f"  Mapped Line Items: {len(mapped_items)}")
            print(f"  Unique Mapped Offerings: {len(unique_offerings)}")
            if unique_offerings:
                print(f"  Offerings: {list(unique_offerings)}")
        
        # STEP 4: Offering Multiplier Calculations
        print("\n🧮 STEP 4: OFFERING MULTIPLIER CALCULATIONS")
        print("-" * 40)
        
        from app.services.resource_calculation import SALES_STAGES_ORDER
        
        for service_line, service_line_tcv, resource_category in service_lines_to_process:
            print(f"\n{service_line} Service Line Multipliers:")
            
            # Get threshold configuration
            thresholds = session.exec(
                select(ServiceLineOfferingThreshold).where(
                    ServiceLineOfferingThreshold.service_line == service_line
                )
            ).all()
            
            if thresholds:
                threshold_count = thresholds[0].threshold_count
                print(f"  Threshold Count: {threshold_count}")
                
                print("  Stage Multipliers:")
                for stage in SALES_STAGES_ORDER:
                    multiplier = calculate_offering_multiplier(opportunity_id, service_line, stage, session)
                    stage_threshold = next((t for t in thresholds if t.stage_name == stage), None)
                    increment = stage_threshold.increment_multiplier if stage_threshold else 0.2
                    print(f"    {stage}: {multiplier:.2f}x (increment: {increment})")
            else:
                print("  No threshold configuration found")
        
        # STEP 5: Stage Timeline Calculation
        print("\n📅 STEP 5: STAGE TIMELINE CALCULATION")
        print("-" * 40)
        
        remaining_stages = get_remaining_stages(opportunity.sales_stage or "01")
        print(f"Remaining Stages: {remaining_stages}")
        print(f"Working backwards from decision date: {opportunity.decision_date}")
        
        # Get timeline category record for durations
        timeline_category_record = session.exec(
            select(OpportunityCategory).where(OpportunityCategory.name == timeline_category)
        ).first()
        
        if timeline_category_record:
            print(f"\nStage Durations (from {timeline_category} category):")
            duration_fields = [
                ('01', 'stage_01_duration_weeks'),
                ('02', 'stage_02_duration_weeks'), 
                ('03', 'stage_03_duration_weeks'),
                ('04A', 'stage_04a_duration_weeks'),
                ('04B', 'stage_04b_duration_weeks'),
                ('05A', 'stage_05a_duration_weeks'),
                ('05B', 'stage_05b_duration_weeks'),
                ('06', 'stage_06_duration_weeks')
            ]
            
            for stage_code, field_name in duration_fields:
                weeks = getattr(timeline_category_record, field_name, 0)
                indicator = "👉" if stage_code in remaining_stages else "  "
                print(f"  {indicator} Stage {stage_code}: {weeks} weeks")
        
        # STEP 6: Complete Timeline Calculation
        print("\n⏱️  STEP 6: COMPLETE TIMELINE CALCULATION")
        print("-" * 40)
        
        # Calculate the actual timeline
        try:
            timeline_result = calculate_opportunity_resource_timeline(opportunity.id, session)
            
            print(f"Timeline Category Used: {timeline_result['category']}")
            print(f"Service Line Categories: {timeline_result['service_line_categories']}")
            
            for service_line, timeline in timeline_result['service_line_timelines'].items():
                print(f"\n{service_line} Timeline:")
                print(f"{'Stage':<6} | {'Start Date':<12} | {'End Date':<12} | {'Duration':<8} | {'Base FTE':<8} | {'Multiplier':<10} | {'Final FTE':<9} | {'Effort':<12}")
                print("-" * 95)
                
                for stage_data in timeline:
                    print(f"{stage_data['stage_name']:<6} | "
                          f"{stage_data['stage_start_date'].strftime('%Y-%m-%d'):<12} | "
                          f"{stage_data['stage_end_date'].strftime('%Y-%m-%d'):<12} | "
                          f"{stage_data['duration_weeks']:<8.1f} | "
                          f"{stage_data['base_fte_required']:<8.2f} | "
                          f"{stage_data['offering_multiplier']:<10.2f} | "
                          f"{stage_data['fte_required']:<9.2f} | "
                          f"{stage_data['total_effort_weeks']:<12.1f}")
                
                total_effort = sum(stage['total_effort_weeks'] for stage in timeline)
                print("-" * 95)
                print(f"{'TOTAL':<6} | {'':<12} | {'':<12} | {'':<8} | {'':<8} | {'':<10} | {'':<9} | {total_effort:<12.1f}")
        
        except Exception as e:
            print(f"❌ Error calculating timeline: {e}")
        
        print("\n✅ Timeline calculation demonstration complete!")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Use provided opportunity ID
        opportunity_id = sys.argv[1]
        demonstrate_timeline_calculation(opportunity_id)
    else:
        # Find and show available opportunities
        demo_opp = find_demo_opportunity()
        if demo_opp:
            print(f"\nDemonstrating with opportunity: {demo_opp.opportunity_id}")
            print("=" * 50)
            demonstrate_timeline_calculation(demo_opp.opportunity_id)
        else:
            print("No suitable opportunities found for demonstration")