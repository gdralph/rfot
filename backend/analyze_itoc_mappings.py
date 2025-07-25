#!/usr/bin/env python3

"""
Analyze ITOC mapping issues for OPX-0021393760
"""

from sqlmodel import Session, select
from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.models.config import ServiceLineInternalServiceMapping

def analyze_opportunity_mappings(opportunity_id: str):
    with Session(engine) as session:
        # Get the specific opportunity
        opp = session.exec(
            select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
        ).first()
        
        if not opp:
            print('Opportunity not found')
            return
        
        print(f'Analyzing: {opp.opportunity_id} - {opp.opportunity_name}')
        print(f'TCV: ${opp.tcv_millions:.1f}M | MW: ${opp.mw_millions or 0:.1f}M | ITOC: ${opp.itoc_millions or 0:.1f}M')
        print()
        
        # Get all line items
        line_items = session.exec(
            select(OpportunityLineItem).where(
                OpportunityLineItem.opportunity_id == opportunity_id
            )
        ).all()
        
        print(f'Total Line Items: {len(line_items)}')
        print()
        
        # Get current internal service mappings
        mw_mappings = session.exec(
            select(ServiceLineInternalServiceMapping).where(
                ServiceLineInternalServiceMapping.service_line == 'MW'
            )
        ).all()
        
        itoc_mappings = session.exec(
            select(ServiceLineInternalServiceMapping).where(
                ServiceLineInternalServiceMapping.service_line == 'ITOC'
            )
        ).all()
        
        mw_valid_services = {mapping.internal_service for mapping in mw_mappings}
        itoc_valid_services = {mapping.internal_service for mapping in itoc_mappings}
        
        print('Current MW mappings:', list(mw_valid_services))
        print('Current ITOC mappings:', list(itoc_valid_services))
        print()
        
        # Analyze all line items
        print('ALL LINE ITEMS ANALYSIS:')
        print('=' * 90)
        print('# | Internal Service          | Simplified Offering           | TCV    | Mapped?')
        print('-' * 90)
        
        unmapped_internal_services = set()
        potential_itoc_items = []
        
        for i, item in enumerate(line_items, 1):
            internal_service = item.internal_service or 'N/A'
            simplified_offering = item.simplified_offering or 'N/A'
            tcv = item.offering_tcv or 0
            
            # Check if mapped to any service line
            mapped_to = []
            if internal_service in mw_valid_services:
                mapped_to.append('MW')
            if internal_service in itoc_valid_services:
                mapped_to.append('ITOC')
            
            mapped_status = ','.join(mapped_to) if mapped_to else 'UNMAPPED'
            
            print(f'{i:2d}| {internal_service[:25]:<25} | {simplified_offering[:30]:<30} | ${tcv:6.1f} | {mapped_status}')
            
            # Track unmapped services
            if not mapped_to and internal_service != 'N/A':
                unmapped_internal_services.add(internal_service)
                
            # Look for potential ITOC items based on keywords
            keywords = ['infrastructure', 'cloud', 'platform', 'data center', 'network', 'server', 'storage', 'hosting', 'compute']
            if any(keyword in internal_service.lower() for keyword in keywords):
                potential_itoc_items.append((internal_service, simplified_offering, tcv))
        
        print()
        print('UNMAPPED INTERNAL SERVICES:')
        print('=' * 50)
        for service in sorted(unmapped_internal_services):
            count = sum(1 for item in line_items if item.internal_service == service)
            total_tcv = sum(item.offering_tcv or 0 for item in line_items if item.internal_service == service)
            print(f'- {service} ({count} items, ${total_tcv:.1f}M total)')
        
        print()
        print('POTENTIAL ITOC ITEMS (by keyword matching):')
        print('=' * 60)
        for service, offering, tcv in potential_itoc_items:
            print(f'- {service} | {offering} | ${tcv:.1f}')
        
        print()
        print('CURRENT MAPPING RESULTS:')
        print('=' * 30)
        
        # Show current MW mappings
        mw_items = [item for item in line_items if item.internal_service in mw_valid_services]
        mw_offerings = set(item.simplified_offering for item in mw_items if item.simplified_offering and item.simplified_offering.strip())
        print(f'MW: {len(mw_offerings)} offerings')
        for offering in sorted(mw_offerings):
            print(f'  - {offering}')
        
        # Show current ITOC mappings
        itoc_items = [item for item in line_items if item.internal_service in itoc_valid_services]
        itoc_offerings = set(item.simplified_offering for item in itoc_items if item.simplified_offering and item.simplified_offering.strip())
        print(f'ITOC: {len(itoc_offerings)} offerings')
        for offering in sorted(itoc_offerings):
            print(f'  - {offering}')
        
        print()
        print('RECOMMENDED ITOC MAPPINGS TO ADD:')
        print('=' * 40)
        
        # Suggest mappings based on unmapped services that look like ITOC
        itoc_candidates = []
        for service in unmapped_internal_services:
            keywords = ['infrastructure', 'cloud', 'platform', 'data', 'network', 'hosting', 'compute', 'server', 'storage']
            if any(keyword in service.lower() for keyword in keywords):
                itoc_candidates.append(service)
        
        for candidate in sorted(itoc_candidates):
            count = sum(1 for item in line_items if item.internal_service == candidate)
            offerings = set(item.simplified_offering for item in line_items 
                          if item.internal_service == candidate and item.simplified_offering and item.simplified_offering.strip())
            print(f'- {candidate} ({count} items, {len(offerings)} unique offerings)')
            for offering in sorted(offerings):
                print(f'    -> {offering}')

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        opportunity_id = sys.argv[1]
    else:
        opportunity_id = 'OPX-0021393760'
    analyze_opportunity_mappings(opportunity_id)