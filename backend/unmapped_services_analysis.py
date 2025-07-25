#!/usr/bin/env python3

"""
Analyze unmapped internal services across all opportunities
"""

from sqlmodel import Session, select
from app.models.database import engine
from app.models.opportunity import Opportunity, OpportunityLineItem
from app.models.config import ServiceLineInternalServiceMapping
from collections import defaultdict

def analyze_unmapped_services():
    with Session(engine) as session:
        # Get all opportunities
        opportunities = session.exec(
            select(Opportunity).where(
                Opportunity.decision_date.is_not(None),
                Opportunity.tcv_millions.is_not(None),
                Opportunity.tcv_millions > 0
            )
        ).all()
        
        # Get current mappings
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
        
        # Analyze all unmapped internal services
        unmapped_services = defaultdict(lambda: {'count': 0, 'total_tcv': 0, 'opportunities': set()})
        
        for opp in opportunities[:30]:  # Sample first 30 real opportunities
            if opp.opportunity_id.startswith('DEMO'):
                continue
                
            line_items = session.exec(
                select(OpportunityLineItem).where(
                    OpportunityLineItem.opportunity_id == opp.opportunity_id
                )
            ).all()
            
            for item in line_items:
                internal_service = item.internal_service
                if not internal_service:
                    continue
                    
                # Check if unmapped
                if internal_service not in mw_valid_services and internal_service not in itoc_valid_services:
                    unmapped_services[internal_service]['count'] += 1
                    unmapped_services[internal_service]['total_tcv'] += item.offering_tcv or 0
                    unmapped_services[internal_service]['opportunities'].add(opp.opportunity_id)
        
        print('TOP UNMAPPED INTERNAL SERVICES ACROSS ALL OPPORTUNITIES:')
        print('=' * 80)
        print('Service                          | Count | Total TCV | # Opps | Potential SL')
        print('-' * 80)
        
        # Sort by frequency
        sorted_services = sorted(unmapped_services.items(), 
                               key=lambda x: x[1]['count'], 
                               reverse=True)
        
        for service, data in sorted_services:
            itoc_keywords = ['infrastructure', 'cloud', 'platform', 'data', 'network', 'hosting', 'compute', 'it outsourcing']
            potential_sl = 'ITOC' if any(keyword in service.lower() for keyword in itoc_keywords) else 'OTHER'
            
            service_name = service[:32]
            count = data['count']
            total_tcv = data['total_tcv']
            num_opps = len(data['opportunities'])
            
            print(f'{service_name:32} | {count:5d} | ${total_tcv:8.1f} | {num_opps:6d} | {potential_sl}')
        
        print()
        print('RECOMMENDED ITOC MAPPINGS TO ADD:')
        print('=' * 40)
        
        itoc_candidates = []
        for service, data in sorted_services:
            itoc_keywords = ['infrastructure', 'cloud', 'platform', 'data', 'network', 'hosting', 'compute', 'it outsourcing']
            if any(keyword in service.lower() for keyword in itoc_keywords):
                itoc_candidates.append((service, data))
        
        for service, data in itoc_candidates:
            print(f'- {service} ({data["count"]} items, ${data["total_tcv"]:.1f}M, {len(data["opportunities"])} opportunities)')

if __name__ == '__main__':
    analyze_unmapped_services()