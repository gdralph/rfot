#!/usr/bin/env python3
"""
Script to update opportunity records with security clearance and FTE data from CSV file.
Updates security_clearance and custom_tracking_field_1 fields for matching opportunities.
"""

import csv
import sys
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session, select

# Add the app directory to Python path
sys.path.append(str(Path(__file__).parent))

from app.models.opportunity import Opportunity
from app.config import settings

def map_clearance_value(clearance_str):
    """Map CSV clearance values to database format."""
    if not clearance_str or clearance_str.strip() == '':
        return None
    
    clearance = clearance_str.strip().upper()
    
    # Map variations to standard values
    if clearance == 'BPSS':
        return 'BPSS'
    elif clearance == 'SC':
        return 'SC'
    elif clearance == 'DV':
        return 'DV'
    else:
        # For any other values, store as-is but warn
        print(f"Warning: Unrecognized clearance value: {clearance_str}")
        return clearance_str.strip()

def update_opportunities_from_csv():
    """Update opportunities with data from candi-forecast.csv"""
    
    # Set up database connection
    engine = create_engine(settings.database_url)
    
    csv_file = Path(__file__).parent.parent / "candi-forecast.csv"
    
    if not csv_file.exists():
        print(f"Error: CSV file not found at {csv_file}")
        return
    
    updates_made = 0
    opportunities_processed = 0
    
    with Session(engine) as session:
        with open(csv_file, 'r', encoding='utf-8-sig') as file:
            # Use csv.DictReader to handle the CSV properly
            reader = csv.DictReader(file)
            
            for row in reader:
                opportunity_id = row.get('Opportunity Id', '').strip()
                clearance = row.get('Clearance', '').strip()
                fte = row.get('FTE', '').strip()
                
                # Skip rows without opportunity ID
                if not opportunity_id:
                    continue
                
                opportunities_processed += 1
                
                # Find the opportunity in database
                statement = select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
                opportunity = session.exec(statement).first()
                
                if not opportunity:
                    print(f"Warning: Opportunity {opportunity_id} not found in database")
                    continue
                
                # Track if any updates are made to this record
                record_updated = False
                
                # Update security_clearance if clearance data exists
                if clearance:
                    mapped_clearance = map_clearance_value(clearance)
                    if opportunity.security_clearance != mapped_clearance:
                        print(f"Updating {opportunity_id} security_clearance: '{opportunity.security_clearance}' → '{mapped_clearance}'")
                        opportunity.security_clearance = mapped_clearance
                        record_updated = True
                
                # Update custom_tracking_field_1 if FTE data exists
                if fte:
                    if opportunity.custom_tracking_field_1 != fte:
                        print(f"Updating {opportunity_id} custom_tracking_field_1: '{opportunity.custom_tracking_field_1}' → '{fte}'")
                        opportunity.custom_tracking_field_1 = fte
                        record_updated = True
                
                if record_updated:
                    updates_made += 1
        
        # Commit all changes
        session.commit()
    
    print(f"\nSummary:")
    print(f"- Processed {opportunities_processed} opportunities from CSV")
    print(f"- Updated {updates_made} opportunity records")
    print(f"- Completed successfully")

if __name__ == "__main__":
    update_opportunities_from_csv()