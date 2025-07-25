# Excel Model vs Application Implementation Comparison

## Overview

This document provides a precise comparison between the Excel model logic described in the prompt and the current application implementation.

**Last Updated:** December 2024  
**Note:** This document reflects significant architectural changes including new offering-based multipliers, enhanced service line categorization, and dual-category calculation systems.

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

### Application Implementation (Current)
- **FTE Values**: Stored directly in ServiceLineStageEffort table per stage and service line category
- **Offering-Based Multipliers**: **NEW** - Dynamic multipliers based on unique offering counts
- **Formula**: Final_FTE = Base_FTE × Offering_Multiplier
- **Dual Category System**:
  - **Timeline Category**: Based on total TCV (determines stage durations)
  - **Resource Category**: Based on service line TCV (determines base FTE values)
- **Example ITOC FTE Values**:
  - RL A/Stage 04A: 2.5 FTE (base)
  - RL B/Stage 04A: 2.0 FTE (base)
  - RL C/Stage 04A: 1.0 FTE (base)
  - Sub $5M/Stage 04A: 0.5 FTE (base)
- **Offering Thresholds**: Configurable per service line and stage
  - Example: MW Stage 04A threshold = 5 offerings, increment = 0.2
  - If opportunity has 8 offerings: FTE = Base_FTE × (1.0 + 3 × 0.2) = Base_FTE × 1.6

### Key Differences
- **NEW: Offering-Based Scaling**: App now has dynamic FTE scaling based on offering counts
- **NEW: Internal Service Filtering**: Only offerings with mapped internal services are counted
- **Static Base FTE**: Base FTE still uses lookup tables, not capability-based calculation
- **Different Scaling Logic**: Scales by offering count instead of capability count

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

## 6. New Application Features (Not in Excel Model)

The application has evolved beyond the original Excel model with several new capabilities:

1. **Offering-Based Multipliers**:
   - `ServiceLineOfferingThreshold` table with threshold counts and increment multipliers
   - Dynamic FTE scaling based on unique offering counts per service line
   - Internal service filtering to determine which offerings count for each service line

2. **Enhanced Service Line Architecture**:
   - `ServiceLineCategory` table for service-line-specific TCV thresholds
   - `ServiceLineInternalServiceMapping` table for offering filtering
   - Dual category system (timeline vs resource categories)

3. **Advanced Configuration Management**:
   - Database-driven configuration instead of hardcoded values
   - Per-stage threshold configuration
   - Configurable internal service mappings

4. **Resource Timeline System**:
   - `OpportunityResourceTimeline` table for storing calculated timelines
   - Timeline generation and bulk management APIs
   - Resource status tracking (Predicted, Forecast, Planned)

## 7. Missing Components for Excel Model Implementation

To implement the Excel model exactly, the application would still need:

1. **New Fields**:
   - `capabilities` field on Opportunity model
   - Stage factor configuration to reduce early-stage FTE

2. **New Categories**:
   - Category D ($1M-$5M)
   - Category E (<$1M)

3. **Calculation Changes**:
   - Implement ROUNDUP(capabilities/10) for ITOC categorization
   - Add stage factor multiplication (currently each stage has independent FTE)
   - Convert timeline from per-stage weeks to total deal days

4. **Data Model Changes**:
   - Store stage factors (0.8, 0.6, 0.4, 0.0)
   - Store base FTE ranges by ITOC category
   - Add capability-based FTE scaling logic (instead of offering-based)

## 8. Summary

The application has evolved significantly beyond the original Excel model:

### Similarities with Excel Model:
- **Dynamic FTE Scaling**: Both use multipliers (Excel: capability-based, App: offering-based)
- **Threshold-Based Logic**: Both apply scaling when counts exceed thresholds
- **Stage-Aware Calculations**: Both consider sales stages in FTE calculations

### Key Architectural Differences:
- **Scaling Basis**: Excel uses capability count, App uses offering count
- **Category System**: Excel uses single categories, App uses dual categories (timeline + resource)
- **Data Source**: Excel uses capabilities field, App uses opportunity line items with internal service filtering
- **Timeline Granularity**: Excel uses total deal days, App uses per-stage weeks
- **Configuration**: Excel uses hardcoded values, App uses database-driven configuration

### Current Application Advantages:
- **More Sophisticated**: Offering-based multipliers with internal service filtering
- **Highly Configurable**: Database-driven thresholds and mappings
- **Service Line Specific**: Different logic per service line (MW vs ITOC)
- **Timeline Management**: Full CRUD operations on calculated timelines
- **Resource Status Tracking**: Predicted, Forecast, and Planned states

### Implementation Status:
- ✅ **Dynamic Multipliers**: Implemented via offering thresholds
- ✅ **Service Line Categories**: Implemented with separate TCV thresholds
- ✅ **Internal Service Mapping**: Implemented for offering filtering
- ❌ **Capability-Based Scaling**: Not implemented (uses offering count instead)
- ❌ **Stage Factors**: Not implemented (each stage has independent FTE)
- ❌ **Excel Category Structure**: Missing Category D and E

The application has evolved into a more sophisticated system than the original Excel model, though it uses different business logic for scaling calculations.