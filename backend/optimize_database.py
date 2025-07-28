#!/usr/bin/env python3
"""
Database optimization script for the Resource Forecasting & Opportunity Tracker.

This script adds database indexes and optimizations to improve query performance
for commonly used filters and search operations.
"""

import sqlite3
import structlog
from pathlib import Path
import sys
import time

logger = structlog.get_logger()

DATABASE_PATH = "database.db"

# Database indexes to create for query optimization
INDEXES = [
    # Opportunity table indexes - based on common query patterns
    {
        "name": "idx_opportunity_sales_stage",
        "table": "opportunity",
        "columns": ["sales_stage"],
        "description": "Optimize filtering by sales stage"
    },
    {
        "name": "idx_opportunity_decision_date",
        "table": "opportunity", 
        "columns": ["decision_date"],
        "description": "Optimize filtering and sorting by decision date"
    },
    {
        "name": "idx_opportunity_in_forecast",
        "table": "opportunity",
        "columns": ["in_forecast"],
        "description": "Optimize filtering by forecast status"
    },
    {
        "name": "idx_opportunity_tcv_millions",
        "table": "opportunity",
        "columns": ["tcv_millions"],
        "description": "Optimize filtering and sorting by TCV"
    },
    {
        "name": "idx_opportunity_account_name",
        "table": "opportunity",
        "columns": ["account_name"],
        "description": "Optimize search by account name"
    },
    {
        "name": "idx_opportunity_opportunity_name",
        "table": "opportunity",
        "columns": ["opportunity_name"],
        "description": "Optimize search by opportunity name"
    },
    {
        "name": "idx_opportunity_lead_offering_l1",
        "table": "opportunity",
        "columns": ["lead_offering_l1"],
        "description": "Optimize filtering by lead offering"
    },
    {
        "name": "idx_opportunity_sales_org_l1",
        "table": "opportunity",
        "columns": ["sales_org_l1"],
        "description": "Optimize filtering by sales organization"
    },
    {
        "name": "idx_opportunity_opportunity_owner",
        "table": "opportunity",
        "columns": ["opportunity_owner"],
        "description": "Optimize filtering by opportunity owner"
    },
    
    # Composite indexes for common filter combinations
    {
        "name": "idx_opportunity_stage_forecast",
        "table": "opportunity",
        "columns": ["sales_stage", "in_forecast"],
        "description": "Optimize combined stage and forecast filtering"
    },
    {
        "name": "idx_opportunity_stage_decision_date",
        "table": "opportunity",
        "columns": ["sales_stage", "decision_date"],
        "description": "Optimize stage filtering with date sorting"
    },
    {
        "name": "idx_opportunity_tcv_decision_date",
        "table": "opportunity",
        "columns": ["tcv_millions", "decision_date"],
        "description": "Optimize TCV range filtering with date sorting"
    },
    
    # Service line amount indexes for service line filtering
    {
        "name": "idx_opportunity_ces_millions",
        "table": "opportunity",
        "columns": ["ces_millions"],
        "description": "Optimize CES service line filtering"
    },
    {
        "name": "idx_opportunity_ins_millions", 
        "table": "opportunity",
        "columns": ["ins_millions"],
        "description": "Optimize INS service line filtering"
    },
    {
        "name": "idx_opportunity_bps_millions",
        "table": "opportunity",
        "columns": ["bps_millions"],
        "description": "Optimize BPS service line filtering"
    },
    {
        "name": "idx_opportunity_sec_millions",
        "table": "opportunity",
        "columns": ["sec_millions"],
        "description": "Optimize SEC service line filtering"
    },
    {
        "name": "idx_opportunity_itoc_millions",
        "table": "opportunity",
        "columns": ["itoc_millions"],
        "description": "Optimize ITOC service line filtering"
    },
    {
        "name": "idx_opportunity_mw_millions",
        "table": "opportunity",
        "columns": ["mw_millions"],
        "description": "Optimize MW service line filtering"
    },
    
    # Opportunity Line Items indexes
    {
        "name": "idx_opportunitylineitem_opportunity_id",
        "table": "opportunitylineitem",
        "columns": ["opportunity_id"],
        "description": "Optimize line item lookups by opportunity"
    },
    {
        "name": "idx_opportunitylineitem_service_line",
        "table": "opportunitylineitem",
        "columns": ["service_line"],
        "description": "Optimize filtering by service line"
    },
    {
        "name": "idx_opportunitylineitem_internal_service",
        "table": "opportunitylineitem",
        "columns": ["internal_service"],
        "description": "Optimize filtering by internal service"
    },
    
    # Resource Timeline indexes
    {
        "name": "idx_opportunityresourcetimeline_opportunity_id",
        "table": "opportunityresourcetimeline",
        "columns": ["opportunity_id"],
        "description": "Optimize resource timeline lookups by opportunity"
    },
    {
        "name": "idx_opportunityresourcetimeline_service_line",
        "table": "opportunityresourcetimeline",
        "columns": ["service_line"],
        "description": "Optimize resource timeline filtering by service line"
    },
    {
        "name": "idx_opportunityresourcetimeline_stage_name",
        "table": "opportunityresourcetimeline",
        "columns": ["stage_name"],
        "description": "Optimize resource timeline filtering by stage"
    },
    {
        "name": "idx_opportunityresourcetimeline_stage_start_date",
        "table": "opportunityresourcetimeline",
        "columns": ["stage_start_date"],
        "description": "Optimize resource timeline filtering by start date"
    },
    {
        "name": "idx_opportunityresourcetimeline_stage_end_date",
        "table": "opportunityresourcetimeline", 
        "columns": ["stage_end_date"],
        "description": "Optimize resource timeline filtering by end date"
    },
    
    # Configuration table indexes
    {
        "name": "idx_servicelinestageeffort_service_line",
        "table": "servicelinestageeffort",
        "columns": ["service_line"],
        "description": "Optimize service line stage effort lookups"
    },
    {
        "name": "idx_servicelinestageeffort_stage_name",
        "table": "servicelinestageeffort",
        "columns": ["stage_name"],
        "description": "Optimize stage effort lookups by stage"
    },
    {
        "name": "idx_servicelineofferingthreshold_service_line",
        "table": "servicelineofferingthreshold",
        "columns": ["service_line"],
        "description": "Optimize offering threshold lookups by service line"
    },
]

# Database optimization queries
OPTIMIZATIONS = [
    "PRAGMA cache_size = 10000;",  # Increase cache size to 10MB
    "PRAGMA temp_store = MEMORY;",  # Store temporary tables in memory
    "PRAGMA journal_mode = WAL;",   # Use Write-Ahead Logging for better concurrency
    "PRAGMA synchronous = NORMAL;", # Balance between safety and performance
    "PRAGMA mmap_size = 268435456;", # Use memory-mapped I/O (256MB)
    "PRAGMA optimize;",             # Run SQLite optimizer
]


def connect_database() -> sqlite3.Connection:
    """Connect to the SQLite database."""
    if not Path(DATABASE_PATH).exists():
        logger.error("Database file not found", path=DATABASE_PATH)
        sys.exit(1)
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable dictionary-like access
    return conn


def check_table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    """Check if a table exists in the database."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
    """, (table_name,))
    return cursor.fetchone() is not None


def check_index_exists(conn: sqlite3.Connection, index_name: str) -> bool:
    """Check if an index exists in the database."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name=?
    """, (index_name,))
    return cursor.fetchone() is not None


def create_index(conn: sqlite3.Connection, index_info: dict) -> bool:
    """
    Create a database index.
    
    Args:
        conn: Database connection
        index_info: Index configuration dictionary
        
    Returns:
        bool: True if index was created, False if it already existed
    """
    # Check if table exists
    if not check_table_exists(conn, index_info["table"]):
        logger.warning("Table does not exist, skipping index", 
                      table=index_info["table"], 
                      index=index_info["name"])
        return False
    
    # Check if index already exists
    if check_index_exists(conn, index_info["name"]):
        logger.info("Index already exists, skipping", index=index_info["name"])
        return False
    
    # Create index
    columns_str = ", ".join(index_info["columns"])
    sql = f"""
        CREATE INDEX {index_info["name"]} 
        ON {index_info["table"]} ({columns_str})
    """
    
    try:
        start_time = time.time()
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        end_time = time.time()
        
        logger.info("Created index", 
                   index=index_info["name"],
                   table=index_info["table"],
                   columns=index_info["columns"],
                   description=index_info["description"],
                   duration_ms=round((end_time - start_time) * 1000, 2))
        return True
        
    except sqlite3.Error as e:
        logger.error("Failed to create index", 
                    index=index_info["name"],
                    error=str(e))
        return False


def apply_optimizations(conn: sqlite3.Connection) -> None:
    """Apply SQLite performance optimizations."""
    cursor = conn.cursor()
    
    for optimization in OPTIMIZATIONS:
        try:
            cursor.execute(optimization)
            logger.info("Applied optimization", sql=optimization)
        except sqlite3.Error as e:
            logger.warning("Failed to apply optimization", 
                          sql=optimization, 
                          error=str(e))
    
    conn.commit()


def analyze_database(conn: sqlite3.Connection) -> None:
    """Run ANALYZE to update SQLite statistics."""
    try:
        start_time = time.time()
        cursor = conn.cursor()
        cursor.execute("ANALYZE;")
        conn.commit()
        end_time = time.time()
        
        logger.info("Database analysis completed", 
                   duration_ms=round((end_time - start_time) * 1000, 2))
    except sqlite3.Error as e:
        logger.error("Failed to analyze database", error=str(e))


def get_database_stats(conn: sqlite3.Connection) -> dict:
    """Get database statistics."""
    cursor = conn.cursor()
    
    # Get table row counts
    tables = ["opportunity", "opportunitylineitem", "opportunityresourcetimeline"]
    stats = {}
    
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            stats[f"{table}_rows"] = count
        except sqlite3.Error:
            stats[f"{table}_rows"] = "N/A"
    
    # Get database size
    try:
        cursor.execute("PRAGMA page_count")
        page_count = cursor.fetchone()[0]
        cursor.execute("PRAGMA page_size")
        page_size = cursor.fetchone()[0]
        stats["database_size_mb"] = round((page_count * page_size) / (1024 * 1024), 2)
    except sqlite3.Error:
        stats["database_size_mb"] = "N/A"
    
    return stats


def main():
    """Main optimization routine."""
    logger.info("Starting database optimization", database=DATABASE_PATH)
    
    # Connect to database
    conn = connect_database()
    
    try:
        # Get initial stats
        initial_stats = get_database_stats(conn)
        logger.info("Initial database statistics", **initial_stats)
        
        # Apply SQLite optimizations
        logger.info("Applying SQLite performance optimizations")
        apply_optimizations(conn)
        
        # Create indexes
        logger.info("Creating database indexes", total_indexes=len(INDEXES))
        created_count = 0
        skipped_count = 0
        
        for index_info in INDEXES:
            if create_index(conn, index_info):
                created_count += 1
            else:
                skipped_count += 1
        
        # Run database analysis
        logger.info("Running database analysis")
        analyze_database(conn)
        
        # Get final stats
        final_stats = get_database_stats(conn)
        logger.info("Final database statistics", **final_stats)
        
        # Summary
        logger.info("Database optimization completed",
                   indexes_created=created_count,
                   indexes_skipped=skipped_count,
                   total_indexes=len(INDEXES))
        
    except Exception as e:
        logger.error("Database optimization failed", error=str(e))
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    # Configure structured logging
    import structlog
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.dev.ConsoleRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    main()