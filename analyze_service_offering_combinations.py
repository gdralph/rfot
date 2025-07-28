#!/usr/bin/env python3
"""Analyze combinations of internal_service and simplified_offering in the data."""

import sqlite3
import json

def main():
    conn = sqlite3.connect('backend/database.db')
    cursor = conn.cursor()

    print("Analyzing Internal Service and Simplified Offering Combinations")
    print("=" * 70)

    # Get all combinations that exist in the data
    cursor.execute('''
        SELECT internal_service, simplified_offering, COUNT(*) as count
        FROM opportunitylineitem 
        WHERE internal_service IS NOT NULL 
        AND simplified_offering IS NOT NULL
        GROUP BY internal_service, simplified_offering
        ORDER BY internal_service, simplified_offering
    ''')
    
    combinations = cursor.fetchall()
    
    # Group by internal service
    grouped = {}
    for internal_service, simplified_offering, count in combinations:
        if internal_service not in grouped:
            grouped[internal_service] = []
        grouped[internal_service].append({
            'simplified_offering': simplified_offering,
            'count': count
        })
    
    print(f"Found {len(combinations)} unique combinations across {len(grouped)} internal services:")
    print()
    
    # Display the relationships
    for internal_service in sorted(grouped.keys()):
        offerings = grouped[internal_service]
        print(f"{internal_service} ({len(offerings)} offerings):")
        for offering_data in sorted(offerings, key=lambda x: x['simplified_offering']):
            print(f"  - {offering_data['simplified_offering']} ({offering_data['count']} records)")
        print()
    
    # Determine service line mappings based on our previous logic
    service_line_mappings = {}
    
    # ITOC: internal_service is 'Cloud' or 'IT Outsourcing'
    itoc_services = ['Cloud', 'IT Outsourcing']
    itoc_combinations = []
    for service in itoc_services:
        if service in grouped:
            for offering_data in grouped[service]:
                itoc_combinations.append({
                    'internal_service': service,
                    'simplified_offering': offering_data['simplified_offering'],
                    'count': offering_data['count']
                })
    
    # MW: internal_service is 'Modern Workplace'
    mw_combinations = []
    if 'Modern Workplace' in grouped:
        for offering_data in grouped['Modern Workplace']:
            mw_combinations.append({
                'internal_service': 'Modern Workplace',
                'simplified_offering': offering_data['simplified_offering'],
                'count': offering_data['count']
            })
    
    print("=" * 70)
    print("SERVICE LINE MAPPINGS:")
    print("=" * 70)
    
    print(f"\nITOC Mappings ({len(itoc_combinations)} combinations):")
    for combo in sorted(itoc_combinations, key=lambda x: (x['internal_service'], x['simplified_offering'])):
        print(f"  {combo['internal_service']} → {combo['simplified_offering']} ({combo['count']} records)")
    
    print(f"\nMW Mappings ({len(mw_combinations)} combinations):")
    for combo in sorted(mw_combinations, key=lambda x: x['simplified_offering']):
        print(f"  {combo['internal_service']} → {combo['simplified_offering']} ({combo['count']} records)")
    
    # Save the analysis for later use
    analysis_data = {
        'all_combinations': combinations,
        'grouped_by_internal_service': grouped,
        'itoc_mappings': itoc_combinations,
        'mw_mappings': mw_combinations
    }
    
    with open('service_offering_analysis.json', 'w') as f:
        json.dump(analysis_data, f, indent=2)
    
    print(f"\n✅ Analysis complete! Data saved to service_offering_analysis.json")
    print(f"Total unique combinations: {len(combinations)}")
    print(f"ITOC combinations: {len(itoc_combinations)}")
    print(f"MW combinations: {len(mw_combinations)}")
    
    conn.close()

if __name__ == '__main__':
    main()