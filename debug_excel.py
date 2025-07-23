#!/usr/bin/env python3

import pandas as pd
import sys

def analyze_excel_file(file_path):
    """Analyze Excel file to understand the data structure around problematic rows."""
    
    print(f"Analyzing Excel file: {file_path}")
    
    try:
        # Read the Excel file
        df = pd.read_excel(file_path)
        
        print(f"Total rows: {len(df)}")
        print(f"Total columns: {len(df.columns)}")
        print("\nColumn names:")
        for i, col in enumerate(df.columns):
            print(f"  {i}: {col}")
        
        # Look at rows around 4040
        print(f"\n=== Analyzing rows 4035-4045 ===")
        for idx in range(4034, min(4045, len(df))):  # 0-based index
            row = df.iloc[idx]
            print(f"\nRow {idx + 1}:")
            print(f"  Opportunity Id: '{row.get('Opportunity Id')}'")
            print(f"  Opportunity Name: '{row.get('Opportunity Name')}'")
            
            # Find TCV column
            tcv_col = None
            for col in df.columns:
                if "TCV" in str(col).upper():
                    tcv_col = col
                    break
            
            if tcv_col:
                print(f"  {tcv_col}: '{row.get(tcv_col)}'")
            
            print(f"  Sales Stage: '{row.get('Sales Stage')}'")
            print(f"  Decision Date: '{row.get('Decision Date')}'")
            
            # Count non-null values in this row
            non_null_count = row.notna().sum()
            print(f"  Non-null fields: {non_null_count}/{len(row)}")
        
        # Check if there are any completely empty rows at the end
        print(f"\n=== Checking for empty rows ===")
        empty_rows = 0
        for idx in range(len(df) - 100, len(df)):  # Check last 100 rows
            if idx < 0:
                continue
            row = df.iloc[idx]
            if row.notna().sum() == 0:
                empty_rows += 1
        
        print(f"Empty rows in last 100: {empty_rows}")
        
        # Show some successful rows for comparison
        print(f"\n=== Sample of early rows (should be good data) ===")
        for idx in range(min(5, len(df))):
            row = df.iloc[idx]
            print(f"\nRow {idx + 1}:")
            print(f"  Opportunity Id: '{row.get('Opportunity Id')}'")
            print(f"  Opportunity Name: '{row.get('Opportunity Name')}'")
            if tcv_col:
                print(f"  {tcv_col}: '{row.get(tcv_col)}'")
            
    except Exception as e:
        print(f"Error analyzing file: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_excel.py <path_to_excel_file>")
        sys.exit(1)
    
    analyze_excel_file(sys.argv[1])