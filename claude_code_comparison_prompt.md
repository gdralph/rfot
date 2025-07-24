# Claude Code Prompt: Resource Forecasting App Analysis & Comparison

## Context
I have built a resource forecasting application that calculates FTE requirements from opportunity data, similar to an Excel-based forecasting tool. I need to analyze my app's calculations and compare them against a reference Excel model to identify gaps and improvement opportunities.

## Reference Excel Model Overview
The Excel model uses a sophisticated multi-factor approach with these key components:

### Core Calculation Flow:
1. **Deal Categorization**: TCV-based categories (A: ≥$100M, B: ≥$20M, C: ≥$5M, D: ≥$1M, E: <$1M)
2. **Capability Analysis**: Counts Cloud + ITO capabilities per opportunity
3. **ITOC Category**: `ROUNDUP(total_capabilities/10, 0)` determines complexity tier
4. **Base FTE Lookup**: Maps ITOC category to baseline FTE (0.2 to 1.0 FTE range)
5. **Additional FTE**: `IF(capabilities > 4, (capabilities-4) * 0.2, 0)`
6. **Sales Stage Factor**: Probability weighting (80% early stages → 0% late stages)
7. **Timeline Calculation**: Deal-size-based solution periods (15-120 days)
8. **Weekly Distribution**: Spreads FTE across active solution weeks

### Key Lookup Tables:
- **Sales Stage Factors**: 01-Understand(0.8), 02-Validate(0.6), 03-Qualify(0.4), 04+(0.0)
- **Deal Category Days**: A(120), B(90), C(60), D(30), E(15)
- **ITOC FTE Baseline**: Category 1-2(0.2-0.4), 3-6(0.4-0.6), 7-10(0.8-1.0)
- **Capability Thresholds**: 4+ capabilities trigger additional FTE

### Final Formula Pattern:
```
Estimated_FTE = (Base_FTE + Additional_FTE) × Sales_Stage_Factor
Weekly_Allocation = IF(week >= solution_start AND week <= solution_end, Estimated_FTE, 0)
```

## Analysis Tasks

### 1. Codebase Architecture Review
- Examine the application structure and identify where forecasting calculations occur
- Map out the data flow from opportunity data to FTE predictions
- Identify current calculation methods and business logic
- Document the existing database schema and tables involved

### 2. Database Schema Analysis
- Compare my opportunity data structure with the Excel model's data requirements
- Identify missing fields that could improve forecasting accuracy
- Analyze the "stage predicted table" and compare with Excel stage factors
- Check for capability/offering categorization data
- Assess if TCV/deal value data is properly structured

### 3. Calculation Logic Comparison
- Compare my current FTE calculation approach with the Excel multi-factor model
- Identify which of these Excel factors my app currently implements:
  - Deal size categorization (A-E scale)
  - Capability counting and complexity scoring
  - Sales stage probability weighting
  - Timeline-based resource distribution
  - Base + additional FTE calculation pattern
- Flag missing calculation components

### 4. Lookup Table Implementation
- Check if my app uses configurable lookup tables for:
  - Sales stage resource factors
  - Deal size to timeline mappings
  - Complexity to FTE baseline mappings
  - Capability threshold rules
- Suggest how to implement missing lookup mechanisms

### 5. Time-Series Forecasting
- Analyze if my app provides weekly/periodic resource forecasts
- Compare timeline calculation methods
- Check for solution start/end date logic
- Assess resource distribution algorithms

### 6. Gap Analysis & Recommendations
Provide specific recommendations for:
- **Missing Features**: What Excel model capabilities should be added
- **Database Enhancements**: Schema changes needed for better forecasting
- **Calculation Improvements**: More sophisticated FTE prediction methods
- **Configuration Options**: Making the model more flexible via lookup tables
- **Code Structure**: Better organization for complex forecasting logic

### 7. Implementation Roadmap
- Prioritize improvements by business impact
- Suggest incremental enhancement approach
- Identify quick wins vs. major refactoring needs
- Recommend testing strategies for forecast accuracy

## Specific Questions to Address:

1. **Data Completeness**: What opportunity fields are missing that could improve forecasting?
2. **Calculation Sophistication**: How does my current FTE calculation compare to the multi-factor Excel approach?
3. **Configurability**: Are my forecasting parameters hardcoded or configurable like the Excel lookup tables?
4. **Timeline Modeling**: Does my app account for deal-size-based solution timelines?
5. **Probability Weighting**: Do I apply sales stage probability factors?
6. **Capability Complexity**: Do I factor in the number/type of capabilities per deal?
7. **Resource Distribution**: Can my app show when resources are needed (weekly forecasts)?

## Output Requirements:

### 1. Executive Summary
- Overall assessment of my app vs. Excel model
- Key strengths and major gaps
- Recommended improvement priority

### 2. Technical Analysis
- Detailed code review findings
- Database schema recommendations
- Specific calculation enhancements needed

### 3. Implementation Plan
- Step-by-step improvement roadmap
- Code examples for key enhancements
- Database migration scripts if needed

### 4. Enhanced Forecasting Algorithm
- Proposed new calculation logic incorporating Excel model strengths
- Implementation approach for multi-factor FTE prediction
- Configuration table designs

## Files to Analyze:
Please examine all relevant files in my application, particularly:
- Database models/schemas
- Forecasting calculation modules
- Configuration files
- API endpoints related to resource prediction
- Frontend components displaying forecasts

Focus on understanding the current implementation depth and identifying concrete ways to incorporate the sophisticated multi-factor approach used in the Excel reference model.