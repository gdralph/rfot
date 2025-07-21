// API Response Types based on SQLModel schemas

export interface Opportunity {
  id?: number;
  opportunity_id: string;
  name: string;
  stage: string;
  amount: number;
  close_date: string; // ISO date string
  assigned_resource?: string;
  status?: string;
  notes?: string;
  category?: string;
}

export interface OpportunityLineItem {
  id?: number;
  opportunity_id: string;
  ces_revenue?: number;
  ins_revenue?: number;
  bps_revenue?: number;
  sec_revenue?: number;
  itoc_revenue?: number;
  mw_revenue?: number;
  tcv: number;
  contract_length?: number;
  in_forecast?: string;
}

export interface OpportunityCategory {
  id?: number;
  name: string;
  min_tcv: number;
  max_tcv?: number;
}

export interface StageEffortEstimate {
  id?: number;
  category_id: number;
  stage_name: string;
  default_effort_weeks: number;
  default_duration_weeks: number;
}

export interface SMEAllocationRule {
  id?: number;
  team_name: string;
  service_line?: string;
  effort_per_million: number;
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
  assigned_resource?: string;
  status?: string;
  notes?: string;
}

export interface OpportunityFilters {
  skip?: number;
  limit?: number;
  stage?: string;
  status?: string;
  category?: string;
  search?: string;
  service_line?: string;
}

// Response Types
export interface ForecastSummary {
  total_opportunities: number;
  total_value: number;
  average_value: number;
  stage_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
}

export interface ServiceLineForecast {
  service_line_totals: Record<string, number>;
  service_line_percentages: Record<string, number>;
  total_revenue: number;
  filtered_service_line?: {
    name: string;
    revenue: number;
    percentage: number;
  };
}

// Service Line Types
export type ServiceLine = 'CES' | 'INS' | 'BPS' | 'SEC' | 'ITOC' | 'MW';

export const SERVICE_LINES: ServiceLine[] = ['CES', 'INS', 'BPS', 'SEC', 'ITOC', 'MW'];

// Sales Stage Types and Ordering
export type SalesStage = '01' | '02' | '03' | '04A' | '04B' | '05A' | '05B';

export const SALES_STAGES: Array<{code: SalesStage, label: string, description: string}> = [
  { code: '01', label: '01 - Prospecting', description: 'Initial prospect identification and outreach' },
  { code: '02', label: '02 - Qualification', description: 'Qualifying prospect needs and budget' },
  { code: '03', label: '03 - Needs Analysis', description: 'Detailed needs analysis and solution design' },
  { code: '04A', label: '04A - Proposal/Price Quote', description: 'Formal proposal and pricing submitted' },
  { code: '04B', label: '04B - Negotiation/Review', description: 'Contract negotiation and review' },
  { code: '05A', label: '05A - Closed Won', description: 'Opportunity closed successfully' },
  { code: '05B', label: '05B - Closed Lost', description: 'Opportunity closed without success' },
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
  'Negative'    // Negative amounts last
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
  assigned_resource?: string;
  status?: string;
  notes?: string;
}

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