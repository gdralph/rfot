# Archived Chart Components

This directory contains chart components that were removed from active use during dashboard consolidation but preserved for potential future use.

## Archived Components

### ResourceHeatmap.tsx
- **Purpose**: Interactive heat map visualization for resource allocation
- **Features**: Week-by-week resource utilization, capacity, demand, and efficiency metrics
- **Reason for archival**: Not integrated into current dashboard workflow
- **Restoration**: Can be restored and integrated into dashboard tabs if needed

### InteractiveForecastChart.tsx
- **Purpose**: Advanced forecast analysis with confidence intervals and scenario modeling
- **Features**: Optimistic/realistic/pessimistic scenarios, confidence intervals, brush selection
- **Reason for archival**: Advanced features not exposed in current UI
- **Restoration**: Could be integrated into forecast tab for enhanced analysis

### TimelineView.tsx
- **Purpose**: Comprehensive timeline analysis with multiple view types
- **Features**: Revenue, opportunities, and conversion rate analysis over time
- **Reason for archival**: Overlaps with existing timeline components
- **Restoration**: Could be used to replace or enhance existing timeline charts

### ServiceLineDistribution.tsx (Replaced)
- **Purpose**: Service line performance analysis with multiple visualization modes
- **Features**: Pie, bar, treemap, and detailed card views for service line data
- **Reason for archival**: Consolidated into ServiceLineAnalysisChart with LeadOfferingDistribution
- **Replacement**: ServiceLineAnalysisChart in the charts directory

### LeadOfferingDistribution.tsx (Replaced)
- **Purpose**: Lead offering performance analysis (nearly identical to ServiceLineDistribution)
- **Features**: Pie, bar, treemap, and detailed card views for lead offering data
- **Reason for archival**: Consolidated into ServiceLineAnalysisChart with ServiceLineDistribution
- **Replacement**: ServiceLineAnalysisChart in the charts directory

## Restoration Notes
- All components were functional when archived
- May require updates to match current data structures and API changes
- Import statements may need adjustment
- Test thoroughly before re-integrating