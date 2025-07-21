import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ForecastSummary, ServiceLineForecast, ActiveServiceLines } from '../types/index.js';

// Query keys
const FORECAST_KEYS = {
  all: ['forecasts'] as const,
  summary: (filters?: { stage?: string; category?: string; service_line?: string }) => 
    [...FORECAST_KEYS.all, 'summary', filters] as const,
  serviceLines: (serviceLineFilter?: string) => 
    [...FORECAST_KEYS.all, 'service-lines', serviceLineFilter] as const,
  activeServiceLines: () => 
    [...FORECAST_KEYS.all, 'active-service-lines'] as const,
};

// Get forecast summary
export function useForecastSummary(filters?: { stage?: string; category?: string; service_line?: string }) {
  return useQuery({
    queryKey: FORECAST_KEYS.summary(filters),
    queryFn: () => api.getForecastSummary(filters),
    staleTime: 60000, // Consider data stale after 1 minute
    refetchOnWindowFocus: false,
  });
}

// Get service line forecast
export function useServiceLineForecast(serviceLineFilter?: string) {
  return useQuery({
    queryKey: FORECAST_KEYS.serviceLines(serviceLineFilter),
    queryFn: () => api.getServiceLineForecast(serviceLineFilter),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

// Get active service lines count
export function useActiveServiceLines() {
  return useQuery({
    queryKey: FORECAST_KEYS.activeServiceLines(),
    queryFn: () => api.getActiveServiceLines(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}