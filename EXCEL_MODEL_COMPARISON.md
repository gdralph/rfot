# Excel Model vs Application Implementation Comparison

## Overview

This document provides a precise comparison between the Excel model logic described in the prompt and the current application implementation.

## 1. Deal Categories Comparison

### Excel Model
- **Categories**: A (≥$100M), B (≥$20M), C (≥$5M), D (≥$1M), E (<$1M)
- **Purpose**: Used to determine timeline and base calculations

### Application Implementation
- **Categories**: Cat A (≥$100M), Cat B ($20M-$100M), Cat C ($5M-$20M), Sub $5M (<$5M)
- **Purpose**: Used for both timeline duration AND as a baseline for resource allocation

### Key Differences
- **Missing Categories**: Application lacks categories D ($1M-$5M) and E (<$1M) - both are merged into "Sub $5M"
- **Range Differences**: 
  - Excel: B is ≥$20M (no upper limit mentioned)
  - App: Cat B is $20M-$100M (has upper limit)
  - Excel: C is ≥$5M (no upper limit mentioned)  
  - App: Cat C is $5M-$20M (has upper limit)

## 2. ITOC Category Calculation

### Excel Model
- **Formula**: ITOC_Category = ROUNDUP(capabilities/10, 0)
- **Purpose**: Determines resource category based on number of capabilities
- **Example**: 35 capabilities → Category 4

### Application Implementation
- **No Capabilities Field**: The application has no "capabilities" field in the Opportunity model
- **Uses Service Line TCV**: ITOC category determined by ITOC revenue (itoc_millions field)
- **Service Line Categories**: RL A (≥$50M), RL B ($25M-$50M), RL C ($5M-$25M), Sub $5M (<$5M)

### Key Differences
- **Completely Different Approach**: Excel uses capability count, app uses revenue
- **Different Category Names**: Excel uses numeric (1,2,3,4), app uses named categories
- **No Capability-Based Calculation**: App cannot implement the ROUNDUP(capabilities/10) formula

## 3. FTE Calculation

### Excel Model
- **Base FTE**: 0.2-1.0 based on ITOC category (capability-derived)
- **Additional FTE**: IF(capabilities > 4, (capabilities-4) * 0.2, 0)
- **Formula**: Estimated_FTE = (Base_FTE + Additional_FTE) × Sales_Stage_Factor

### Application Implementation
- **FTE Values**: Stored directly in ServiceLineStageEffort table per stage
- **No Base/Additional Split**: Single FTE value per stage
- **No Dynamic Calculation**: FTE is a static lookup, not calculated
- **Example ITOC FTE Values**:
  - RL A/Stage 04A: 2.5 FTE
  - RL B/Stage 04A: 2.0 FTE
  - RL C/Stage 04A: 1.0 FTE
  - Sub $5M/Stage 04A: 0.5 FTE

### Key Differences
- **No Formula-Based Calculation**: App uses static lookup tables
- **No Capability-Based Scaling**: Cannot add 0.2 FTE per capability over 4
- **Different FTE Ranges**: App FTE values don't match Excel's 0.2-1.0 base range

## 4. Sales Stage Factors

### Excel Model
- **Stage Factors**: 01 (0.8), 02 (0.6), 03 (0.4), 04+ (0.0)
- **Purpose**: Multiplies FTE to reduce effort in earlier stages
- **Example**: Stage 01 FTE = Base_FTE × 0.8

### Application Implementation
- **No Stage Factors**: Each stage has its own independent FTE value
- **Direct FTE Assignment**: FTE values are set directly, not calculated with factors
- **Stage-Specific Values**: Each stage can have any FTE value

### Key Differences
- **No Multiplicative Factors**: App doesn't reduce FTE based on stage
- **Independent Stage Values**: Each stage's FTE is independently configured
- **Cannot Implement Factor Logic**: Would require code changes to add stage factors

## 5. Timeline Duration

### Excel Model
- **Timeline Days**: A (120), B (90), C (60), D (30), E (15)
- **Unit**: Days
- **Per Deal**: Total timeline for the entire deal

### Application Implementation
- **Timeline Weeks**: Stored per stage in OpportunityCategory
- **Unit**: Weeks (converted to days by × 7)
- **Per Stage**: Each stage has its own duration
- **Example Cat A Durations**:
  - Stage 01: 4 weeks (28 days)
  - Stage 03: 8 weeks (56 days)
  - Stage 04A: 22 weeks (154 days)
  - Total: 54 weeks (378 days)

### Key Differences
- **Unit Mismatch**: Excel uses days, app uses weeks
- **Granularity**: Excel has one timeline per deal, app has per-stage timelines
- **Total Duration**: App's total durations are much longer than Excel's

## 6. Missing Components for Excel Model Implementation

To implement the Excel model exactly, the application would need:

1. **New Fields**:
   - `capabilities` field on Opportunity model
   - `base_fte` and `additional_fte` fields or calculation methods
   - Stage factor configuration

2. **New Categories**:
   - Category D ($1M-$5M)
   - Category E (<$1M)

3. **Calculation Changes**:
   - Replace static FTE lookup with dynamic calculation
   - Implement ROUNDUP(capabilities/10) for ITOC categorization
   - Add stage factor multiplication
   - Convert timeline from per-stage weeks to total deal days

4. **Data Model Changes**:
   - Store stage factors (0.8, 0.6, 0.4, 0.0)
   - Store base FTE ranges by ITOC category
   - Add capability-based FTE scaling logic

## Summary

The application uses a fundamentally different approach:
- **Revenue-based** categorization vs **capability-based**
- **Static lookup** tables vs **dynamic formulas**
- **Per-stage** configuration vs **deal-level with factors**
- **Week-based** timelines vs **day-based**

The two systems are architecturally incompatible without significant refactoring.