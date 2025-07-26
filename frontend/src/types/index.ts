// API Response Types based on SQLModel schemas

export interface Opportunity {
  id?: number;
  opportunity_id: string;
  sfdc_url?: string;
  account_name?: string;
  opportunity_name: string;
  opportunity_type?: string;
  tcv_millions?: number;
  margin_percentage?: number;
  first_year_q1_rev?: number;
  first_year_q2_rev?: number;
  first_year_q3_rev?: number;
  first_year_q4_rev?: number;
  first_year_fy_rev?: number;
  second_year_q1_rev?: number;
  second_year_q2_rev?: number;
  second_year_q3_rev?: number;
  second_year_q4_rev?: number;
  second_year_fy_rev?: number;
  fy_rev_beyond_yr2?: number;
  sales_stage?: string;
  decision_date?: string; // ISO datetime string
  master_period?: string;
  contract_length?: number;
  in_forecast?: string;
  opportunity_owner?: string;
  lead_offering_l1?: string;
  ces_millions?: number;
  ins_millions?: number;
  bps_millions?: number;
  sec_millions?: number;
  itoc_millions?: number;
  mw_millions?: number;
  sales_org_l1?: string;
  
  // User-managed fields (not overwritten by Excel imports)
  security_clearance?: string;
  custom_priority?: string;
  internal_stage_assessment?: string;
  custom_tracking_field_1?: string;
  custom_tracking_field_2?: string;
  custom_tracking_field_3?: string;
  internal_notes?: string;
}

export interface OpportunityLineItem {
  id?: number;
  opportunity_id: string;
  offering_tcv?: number;
  offering_abr?: number;
  offering_iyr?: number;
  offering_iqr?: number;
  offering_margin?: number;
  offering_margin_percentage?: number;
  decision_date?: string; // ISO datetime string
  master_period?: string;
  lead_offering_l2?: string;
  internal_service?: string;
  simplified_offering?: string;
  product_name?: string;
  first_year_q1_rev?: number;
  first_year_q2_rev?: number;
  first_year_q3_rev?: number;
  first_year_q4_rev?: number;
  first_year_fy_rev?: number;
  second_year_q1_rev?: number;
  second_year_q2_rev?: number;
  second_year_q3_rev?: number;
  second_year_q4_rev?: number;
  second_year_fy_rev?: number;
  fy_rev_beyond_yr2?: number;
}

// QuarterlyRevenue is now integrated into the Opportunity model

export interface OpportunityCategory {
  id?: number;
  name: string;
  min_tcv: number;
  max_tcv?: number;
  // Stage duration fields (in weeks)
  stage_01_duration_weeks?: number;
  stage_02_duration_weeks?: number;
  stage_03_duration_weeks?: number;
  stage_04a_duration_weeks?: number;
  stage_04b_duration_weeks?: number;
  stage_05a_duration_weeks?: number;
  stage_05b_duration_weeks?: number;
  stage_06_duration_weeks?: number;
}

export interface ServiceLineCategory {
  id?: number;
  service_line: string;
  name: string;
  min_tcv: number;
  max_tcv?: number;
}

export interface ServiceLineStageEffort {
  id?: number;
  service_line: string;
  service_line_category_id: number;
  stage_name: string;
  fte_required: number;
}

export interface ServiceLineOfferingThreshold {
  id?: number;
  service_line: string;
  stage_name: string;
  threshold_count: number;
  increment_multiplier: number;
}

export interface ServiceLineInternalServiceMapping {
  id?: number;
  service_line: string;
  internal_service: string;
}

export interface ImportTask {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  total_rows?: number;
  processed_rows?: number;
  successful_rows?: number;
  failed_rows?: number;
  warnings_count?: number;
  errors?: string[];
  start_time?: string;
  end_time?: string;
}

// Request Types
export interface OpportunityUpdate {
  sfdc_url?: string;
  account_name?: string;
  opportunity_name?: string;
  opportunity_type?: string;
  tcv_millions?: number;
  margin_percentage?: number;
  sales_stage?: string;
  decision_date?: string;
  opportunity_owner?: string;
  
  // User-managed fields
  security_clearance?: string;
  custom_priority?: string;
  internal_stage_assessment?: string;
  custom_tracking_field_1?: string;
  custom_tracking_field_2?: string;
  custom_tracking_field_3?: string;
  internal_notes?: string;
}

export interface OpportunityFilters {
  skip?: number;
  limit?: number;
  stage?: string | string[];
  search?: string;
  service_line?: string | string[];
  status?: string | string[];
  category?: string | string[];
}

// Response Types
export interface ForecastSummary {
  total_opportunities: number;
  total_value: number;
  average_value: number;
  stage_breakdown: Record<string, number>;
  stage_counts: Record<string, number>;
  category_breakdown: Record<string, number>;
  category_counts: Record<string, number>;
}

export interface ServiceLineForecast {
  service_line_totals: Record<string, number>;
  service_line_percentages: Record<string, number>;
  service_line_counts: Record<string, number>;
  service_line_avg_deal_size: Record<string, number>;
  total_revenue: number;
  filtered_service_line?: {
    name: string;
    revenue: number;
    percentage: number;
    opportunities: number;
    avg_deal_size: number;
  };
}

export interface ActiveServiceLines {
  active_count: number;
  active_service_lines: Record<string, number>;
  total_active_revenue: number;
  all_service_lines: Record<string, number>;
}

// Service Line Types
export type ServiceLine = 'CES' | 'INS' | 'BPS' | 'SEC' | 'ITOC' | 'MW';

export const SERVICE_LINES: ServiceLine[] = ['CES', 'INS', 'BPS', 'SEC', 'ITOC', 'MW'];

// Sales Stage Types and Ordering
export type SalesStage = '01' | '02' | '03' | '04A' | '04B' | '05A' | '05B' | '06';

export const SALES_STAGES: Array<{code: SalesStage, label: string, description: string}> = [
  { code: '01', label: 'Stage 01 (Understand Customer)', description: 'Understanding customer needs and requirements' },
  { code: '02', label: 'Stage 02 (Validate Opportunity)', description: 'Validating the business opportunity' },
  { code: '03', label: 'Stage 03 (Qualify Opportunity)', description: 'Qualifying the opportunity for pursuit' },
  { code: '04A', label: 'Stage 04A (Develop Solution)', description: 'Developing the technical and commercial solution' },
  { code: '04B', label: 'Stage 04B (Propose Solution)', description: 'Proposing the solution to the customer' },
  { code: '05A', label: 'Stage 05A (Negotiate)', description: 'Negotiating terms and conditions' },
  { code: '05B', label: 'Stage 05B (Award & Close)', description: 'Awarding and closing the deal' },
  { code: '06', label: 'Stage 06 (Deploy & Extend)', description: 'Deploying the solution and extending the relationship' },
];

export const STAGE_ORDER: Record<string, number> = SALES_STAGES.reduce((acc, stage, index) => {
  acc[stage.code] = index;
  return acc;
}, {} as Record<string, number>);

// Opportunity Category Types and Ordering
export const OPPORTUNITY_CATEGORIES = [
  'Cat A',      // Largest opportunities first
  'Cat B', 
  'Cat C',
  'Sub $5M',
  'Uncategorized'    // Uncategorized amounts last
] as const;

export const CATEGORY_ORDER: Record<string, number> = OPPORTUNITY_CATEGORIES.reduce((acc, category, index) => {
  acc[category] = index;
  return acc;
}, {} as Record<string, number>);

// Chart Data Types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  category?: string;
}

// Form Types
export interface OpportunityFormData {
  sfdc_url?: string;
  account_name?: string;
  opportunity_name?: string;
  opportunity_type?: string;
  tcv_millions?: number;
  margin_percentage?: number;
  sales_stage?: string;
  decision_date?: string;
  opportunity_owner?: string;
  assigned_resource?: string;
  status?: string;
  notes?: string;
  
  // User-managed fields
  security_clearance?: string;
  custom_priority?: string;
  internal_stage_assessment?: string;
  custom_tracking_field_1?: string;
  custom_tracking_field_2?: string;
  custom_tracking_field_3?: string;
  internal_notes?: string;
}

// Resource Timeline Types
export interface OpportunityResourceTimeline {
  id?: number;
  opportunity_id: string;
  service_line: string;
  stage_name: string;
  stage_start_date: string;
  stage_end_date: string;
  duration_weeks: number;
  fte_required: number;
  total_effort_weeks: number;
  resource_status: string;
  last_updated: string;
  opportunity_name?: string;
  category: string;
  tcv_millions?: number;
  decision_date: string;
  calculated_date: string;
}

export interface OpportunityEffortPrediction {
  opportunity_id: string;
  opportunity_name?: string;
  current_stage: string;
  category: string;
  tcv_millions?: number;
  decision_date: string;
  service_line_timelines: Record<string, any[]>;
  total_remaining_effort_weeks: number;
  earliest_stage_start?: string;
  supported_service_lines: string[];
}

export interface StageTimelineData {
  stage_name: string;
  stage_start_date: string;
  stage_end_date: string;
  duration_weeks: number;
  fte_required: number;
  total_effort_weeks: number;
  resource_status: string;
  last_updated: string;
}

export interface ServiceLineTimelines {
  [serviceLine: string]: StageTimelineData[];
}

export interface ResourceStatusUpdate {
  resource_status: string;
}

// Valid resource statuses
export const RESOURCE_STATUSES = ['Predicted', 'Forecast', 'Planned'] as const;
export type ResourceStatus = typeof RESOURCE_STATUSES[number];

// DXC Color Palette for Charts
export const DXC_COLORS = [
  '#5F249F', // Bright Purple
  '#00968F', // Bright Teal
  '#00A3E1', // Blue
  '#006975', // Dark Teal
  '#6CC24A', // Green
  '#ED9B33', // Orange
  '#FFCD00', // Gold
  '#330072', // Dark Purple
  '#F9F048', // Yellow
] as const;

// API Error Types
export interface APIError {
  detail: string;
  status?: number;
}

// Financial Quarter Utilities
export interface FinancialQuarter {
  quarter: number; // 1, 2, 3, 4
  fiscalYear: number; // e.g., 26 for FY26
  label: string; // e.g., "Q1 FY26"
}

/**
 * Calculates the financial quarter and fiscal year for a given date.
 * Financial year runs April 1 to March 31.
 * FY26 = April 1, 2025 to March 31, 2026
 */
export function getFinancialQuarter(date: Date): FinancialQuarter {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  let quarter: number;
  let fiscalYear: number;
  
  if (month >= 3 && month <= 5) { // April (3), May (4), June (5)
    quarter = 1;
    fiscalYear = year + 1; // If it's April 2025, it's FY26
  } else if (month >= 6 && month <= 8) { // July (6), August (7), September (8)
    quarter = 2;
    fiscalYear = year + 1;
  } else if (month >= 9 && month <= 11) { // October (9), November (10), December (11)
    quarter = 3;
    fiscalYear = year + 1;
  } else { // January (0), February (1), March (2)
    quarter = 4;
    fiscalYear = year; // If it's January 2026, it's still FY26
  }
  
  // Convert to 2-digit fiscal year (2026 -> 26)
  const fiscalYearShort = fiscalYear % 100;
  
  return {
    quarter,
    fiscalYear: fiscalYearShort,
    label: `Q${quarter} FY${fiscalYearShort.toString().padStart(2, '0')}`
  };
}

/**
 * Parses a financial quarter label and returns the corresponding date range start.
 * Supports formats like "Q1 FY26", "Q1 26", etc.
 */
export function parseFinancialQuarterLabel(label: string): Date | null {
  // Try "Q1 FY26" format
  let match = label.match(/Q(\d)\s+FY(\d{2})/);
  if (match) {
    const quarter = parseInt(match[1]);
    const fiscalYear = 2000 + parseInt(match[2]);
    return getFinancialQuarterStartDate(quarter, fiscalYear);
  }
  
  // Try "Q1 26" format (legacy)
  match = label.match(/Q(\d)\s+(\d{2})/);
  if (match) {
    const quarter = parseInt(match[1]);
    const fiscalYear = 2000 + parseInt(match[2]);
    return getFinancialQuarterStartDate(quarter, fiscalYear);
  }
  
  return null;
}

/**
 * Gets the start date of a financial quarter.
 */
function getFinancialQuarterStartDate(quarter: number, fiscalYear: number): Date {
  const calendarYear = fiscalYear - 1; // FY26 starts in calendar year 2025
  
  switch (quarter) {
    case 1: return new Date(calendarYear, 3, 1); // April 1
    case 2: return new Date(calendarYear, 6, 1); // July 1
    case 3: return new Date(calendarYear, 9, 1); // October 1
    case 4: return new Date(fiscalYear, 0, 1); // January 1 of the fiscal year
    default: throw new Error(`Invalid quarter: ${quarter}`);
  }
}