import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface MonthlyForecast {
  month: string;
  total_fte: number;
  service_lines: Record<string, number>;
}

export interface PortfolioResourceForecast {
  total_opportunities_processed: number;
  total_effort_weeks: number;
  service_line_breakdown: Record<string, number>;
  stage_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  forecast_period: {
    start_date: string;
    end_date: string;
    timeline_opportunities: number;
    missing_timelines: number;
  };
  monthly_forecast: MonthlyForecast[] | null;
  processed_opportunities: Array<{
    opportunity_id: string;
    opportunity_name: string;
    total_effort_weeks: number;
    service_lines: string[];
  }>;
}

interface UsePortfolioResourceForecastOptions {
  startDate?: Date;
  endDate?: Date;
  timePeriod?: 'week' | 'month' | 'quarter';
  enabled?: boolean;
  filters?: {
    stage?: string | string[];
    category?: string | string[];
    service_line?: string | string[];
    lead_offering?: string | string[];
  };
}

export function usePortfolioResourceForecast(options: UsePortfolioResourceForecastOptions = {}) {
  const { startDate, endDate, timePeriod = 'month', enabled = true, filters } = options;

  return useQuery<PortfolioResourceForecast, Error>({
    queryKey: ['portfolio-resource-forecast', startDate?.toISOString(), endDate?.toISOString(), timePeriod, filters],
    queryFn: async () => {
      try {
        const response = await api.getPortfolioResourceForecast({
          startDate,
          endDate,
          timePeriod,
          filters,
        });
        return response;
      } catch (error) {
        console.error('Portfolio resource forecast error:', error);
        throw error;
      }
    },
    enabled,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

export function useTimelineDataBounds() {
  return useQuery<{earliest_date: string | null, latest_date: string | null}, Error>({
    queryKey: ['timeline-data-bounds'],
    queryFn: async () => {
      try {
        const response = await api.getTimelineDataBounds();
        return response;
      } catch (error) {
        console.error('Timeline data bounds error:', error);
        throw error;
      }
    },
    staleTime: 600000, // 10 minutes - this doesn't change often
    gcTime: 1200000, // 20 minutes
    refetchOnWindowFocus: false,
  });
}