#!/usr/bin/env python3

"""
Seed script for ServiceLineInternalServiceMapping data.

This script creates default internal service mappings for MW and ITOC service lines.
Run this after database initialization to set up default mappings for offering threshold calculations.
"""

from sqlmodel import Session, select
from app.models.database import engine
from app.models.config import ServiceLineInternalServiceMapping
import structlog
import sys

logger = structlog.get_logger()

# Default internal service mappings
DEFAULT_MAPPINGS = [
    # MW (Modern Workplace) mappings
    {"service_line": "MW", "internal_service": "Modern Workplace"},
    {"service_line": "MW", "internal_service": "MW"},
    {"service_line": "MW", "internal_service": "Workplace Services"},
    {"service_line": "MW", "internal_service": "Digital Employee Experience"},
    {"service_line": "MW", "internal_service": "Collaboration"},
    {"service_line": "MW", "internal_service": "Endpoint Services"},
    
    # ITOC (Infrastructure & Cloud) mappings  
    {"service_line": "ITOC", "internal_service": "Infrastructure & Cloud"},
    {"service_line": "ITOC", "internal_service": "ITOC"},
    {"service_line": "ITOC", "internal_service": "Cloud Services"},
    {"service_line": "ITOC", "internal_service": "Infrastructure Services"},
    {"service_line": "ITOC", "internal_service": "Data Center Services"},
    {"service_line": "ITOC", "internal_service": "Network Services"},
    {"service_line": "ITOC", "internal_service": "Platform Services"}
]


def verify_mappings():
    """Verify that all expected default mappings exist."""
    
    with Session(engine) as session:
        missing_mappings = []
        existing_count = 0
        
        for mapping_data in DEFAULT_MAPPINGS:
            existing = session.exec(
                select(ServiceLineInternalServiceMapping).where(
                    ServiceLineInternalServiceMapping.service_line == mapping_data["service_line"],
                    ServiceLineInternalServiceMapping.internal_service == mapping_data["internal_service"]
                )
            ).first()
            
            if not existing:
                missing_mappings.append(mapping_data)
            else:
                existing_count += 1
        
        return missing_mappings, existing_count


def reset_to_defaults():
    """Reset internal service mappings to default configuration."""
    
    with Session(engine) as session:
        print("Resetting internal service mappings to defaults...")
        
        # Remove all existing mappings
        existing_mappings = session.exec(select(ServiceLineInternalServiceMapping)).all()
        for mapping in existing_mappings:
            session.delete(mapping)
        session.commit()
        print(f"Removed {len(existing_mappings)} existing mappings")
        
        # Create default mappings
        created_count = 0
        for mapping_data in DEFAULT_MAPPINGS:
            mapping = ServiceLineInternalServiceMapping(**mapping_data)
            session.add(mapping)
            created_count += 1
        
        session.commit()
        print(f"Created {created_count} default mappings")
        logger.info("Reset internal service mappings to defaults", 
                   removed=len(existing_mappings), created=created_count)


def seed_internal_service_mappings():
    """Create default internal service mappings for MW and ITOC service lines."""
    
    with Session(engine) as session:
        
        created_count = 0
        updated_count = 0
        
        for mapping_data in DEFAULT_MAPPINGS:
            # Check if mapping already exists
            existing = session.exec(
                select(ServiceLineInternalServiceMapping).where(
                    ServiceLineInternalServiceMapping.service_line == mapping_data["service_line"],
                    ServiceLineInternalServiceMapping.internal_service == mapping_data["internal_service"]
                )
            ).first()
            
            if not existing:
                # Create new mapping
                mapping = ServiceLineInternalServiceMapping(**mapping_data)
                session.add(mapping)
                created_count += 1
                logger.info("Creating internal service mapping", 
                           service_line=mapping_data["service_line"],
                           internal_service=mapping_data["internal_service"])
            else:
                updated_count += 1
                logger.info("Internal service mapping already exists", 
                           service_line=mapping_data["service_line"],
                           internal_service=mapping_data["internal_service"])
        
        # Commit all changes
        if created_count > 0:
            session.commit()
            logger.info("Successfully created internal service mappings", 
                       created=created_count, existing=updated_count)
        else:
            logger.info("No new internal service mappings needed", 
                       existing=updated_count)
        
        # Display current mappings by service line
        print("\n=== Current Internal Service Mappings ===")
        for service_line in ["MW", "ITOC"]:
            mappings = session.exec(
                select(ServiceLineInternalServiceMapping).where(
                    ServiceLineInternalServiceMapping.service_line == service_line
                ).order_by(ServiceLineInternalServiceMapping.internal_service)
            ).all()
            
            print(f"\n{service_line} Service Line:")
            for mapping in mappings:
                print(f"  - {mapping.internal_service}")
        
        print(f"\nTotal mappings: {len(DEFAULT_MAPPINGS)}")
        print(f"Created: {created_count}, Existing: {updated_count}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "verify":
            print("Verifying internal service mappings...")
            missing, existing = verify_mappings()
            
            if missing:
                print(f"\nMISSING {len(missing)} default mappings:")
                for mapping in missing:
                    print(f"  - {mapping['service_line']}: {mapping['internal_service']}")
            
            print(f"\nSummary: {existing} existing, {len(missing)} missing")
            
            if missing:
                print("\nRun 'python3 seed_internal_service_mappings.py' to create missing mappings")
                print("Or run 'python3 seed_internal_service_mappings.py reset' to reset all mappings to defaults")
                sys.exit(1)
            else:
                print("✓ All default internal service mappings are present")
                
        elif command == "reset":
            reset_to_defaults()
            print("✓ Internal service mappings reset to defaults completed")
            
        else:
            print("Usage:")
            print("  python3 seed_internal_service_mappings.py         # Seed missing mappings")
            print("  python3 seed_internal_service_mappings.py verify  # Verify all defaults exist")
            print("  python3 seed_internal_service_mappings.py reset   # Reset to defaults")
            sys.exit(1)
    else:
        print("Seeding internal service mappings...")
        seed_internal_service_mappings()
        print("✓ Internal service mapping seeding completed")