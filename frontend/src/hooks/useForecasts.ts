import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// Query keys
const FORECAST_KEYS = {
  all: ['forecasts'] as const,
  summary: (filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }) => 
    [...FORECAST_KEYS.all, 'summary', filters] as const,
  serviceLines: (filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }) => 
    [...FORECAST_KEYS.all, 'service-lines', filters] as const,
  leadOfferings: (filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }) => 
    [...FORECAST_KEYS.all, 'lead-offerings', filters] as const,
  activeServiceLines: () => 
    [...FORECAST_KEYS.all, 'active-service-lines'] as const,
};

// Get forecast summary
export function useForecastSummary(filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }) {
  return useQuery({
    queryKey: FORECAST_KEYS.summary(filters),
    queryFn: () => api.getForecastSummary(filters),
    staleTime: 60000, // Consider data stale after 1 minute
    refetchOnWindowFocus: false,
  });
}

// Get service line forecast
export function useServiceLineForecast(filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }) {
  return useQuery({
    queryKey: FORECAST_KEYS.serviceLines(filters),
    queryFn: () => api.getServiceLineForecast(filters),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

// Get lead offering forecast
export function useLeadOfferingForecast(filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }) {
  return useQuery({
    queryKey: FORECAST_KEYS.leadOfferings(filters),
    queryFn: () => api.getLeadOfferingForecast(filters),
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