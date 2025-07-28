#!/usr/bin/env python3
"""Migrate to consolidated ServiceLineOfferingMapping table."""

import sqlite3
import json

def main():
    conn = sqlite3.connect('backend/database.db')
    cursor = conn.cursor()

    print("Migrating to Consolidated ServiceLineOfferingMapping Table")
    print("=" * 60)

    # Load the analysis data we created earlier
    try:
        with open('service_offering_analysis.json', 'r') as f:
            analysis_data = json.load(f)
    except FileNotFoundError:
        print("Error: service_offering_analysis.json not found. Please run analyze_service_offering_combinations.py first.")
        return

    itoc_mappings = analysis_data['itoc_mappings']
    mw_mappings = analysis_data['mw_mappings']

    print(f"Found {len(itoc_mappings)} ITOC mappings and {len(mw_mappings)} MW mappings from analysis")

    # Clear the new consolidated table first
    cursor.execute('DELETE FROM servicelineofferingmapping')
    print("Cleared existing data from consolidated table")

    # Insert ITOC mappings
    print("\nInserting ITOC mappings:")
    for mapping in itoc_mappings:
        cursor.execute('''
            INSERT INTO servicelineofferingmapping (service_line, internal_service, simplified_offering)
            VALUES (?, ?, ?)
        ''', ('ITOC', mapping['internal_service'], mapping['simplified_offering']))
        print(f"  ITOC: {mapping['internal_service']} → {mapping['simplified_offering']}")

    # Insert MW mappings
    print("\nInserting MW mappings:")
    for mapping in mw_mappings:
        cursor.execute('''
            INSERT INTO servicelineofferingmapping (service_line, internal_service, simplified_offering)
            VALUES (?, ?, ?)
        ''', ('MW', mapping['internal_service'], mapping['simplified_offering']))
        print(f"  MW: {mapping['internal_service']} → {mapping['simplified_offering']}")

    # Commit the changes
    conn.commit()

    # Verify the results
    cursor.execute('''
        SELECT service_line, internal_service, simplified_offering, COUNT(*) as count
        FROM servicelineofferingmapping 
        GROUP BY service_line, internal_service, simplified_offering
        ORDER BY service_line, internal_service, simplified_offering
    ''')
    final_mappings = cursor.fetchall()

    print(f"\nFinal consolidated mappings ({len(final_mappings)}):")
    print("-" * 60)
    current_service_line = None
    current_internal_service = None
    
    for service_line, internal_service, simplified_offering, count in final_mappings:
        if service_line != current_service_line:
            if current_service_line is not None:
                print()
            print(f"{service_line}:")
            current_service_line = service_line
            current_internal_service = None
        
        if internal_service != current_internal_service:
            print(f"  {internal_service}:")
            current_internal_service = internal_service
        
        print(f"    - {simplified_offering}")

    print(f"\n✅ Successfully migrated to consolidated table!")
    print(f"Total mappings: {len(final_mappings)}")
    
    # Show a summary by service line
    cursor.execute('''
        SELECT service_line, COUNT(*) as count
        FROM servicelineofferingmapping 
        GROUP BY service_line
        ORDER BY service_line
    ''')
    summary = cursor.fetchall()
    
    print("\nSummary by service line:")
    for service_line, count in summary:
        print(f"  {service_line}: {count} mappings")

    print("\n📋 Next steps:")
    print("  1. Update API endpoints to use the new consolidated table")
    print("  2. Update frontend to use dropdown selections")
    print("  3. Test the new functionality")
    print("  4. Drop old tables when everything is working")

    conn.close()

if __name__ == '__main__':
    main()