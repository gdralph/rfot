import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Opportunity, OpportunityFilters, OpportunityUpdate } from '../types/index.js';

// Query keys
const OPPORTUNITY_KEYS = {
  all: ['opportunities'] as const,
  lists: () => [...OPPORTUNITY_KEYS.all, 'list'] as const,
  list: (filters?: OpportunityFilters) => [...OPPORTUNITY_KEYS.lists(), filters] as const,
  details: () => [...OPPORTUNITY_KEYS.all, 'detail'] as const,
  detail: (id: number) => [...OPPORTUNITY_KEYS.details(), id] as const,
  lineItems: (id: number) => [...OPPORTUNITY_KEYS.all, 'line-items', id] as const,
};

// Get opportunities with filters
export function useOpportunities(filters?: OpportunityFilters) {
  return useQuery({
    queryKey: OPPORTUNITY_KEYS.list(filters),
    queryFn: () => api.getOpportunities(filters),
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: false,
  });
}

// Get single opportunity
export function useOpportunity(id: number) {
  return useQuery({
    queryKey: OPPORTUNITY_KEYS.detail(id),
    queryFn: () => api.getOpportunity(id),
    enabled: !!id,
    staleTime: 60000, // Consider data stale after 1 minute
  });
}

// Get opportunity line items
export function useOpportunityLineItems(id: number) {
  return useQuery({
    queryKey: OPPORTUNITY_KEYS.lineItems(id),
    queryFn: () => api.getOpportunityLineItems(id),
    enabled: !!id,
    staleTime: 60000,
  });
}

// Update opportunity mutation
export function useUpdateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: OpportunityUpdate }) =>
      api.updateOpportunity(id, data),
    onSuccess: (updatedOpportunity) => {
      // Update the specific opportunity in cache
      queryClient.setQueryData(
        OPPORTUNITY_KEYS.detail(updatedOpportunity.id!),
        updatedOpportunity
      );

      // Invalidate lists to refetch with updated data
      queryClient.invalidateQueries({
        queryKey: OPPORTUNITY_KEYS.lists(),
      });
    },
  });
}

// Prefetch opportunity details
export function usePrefetchOpportunity() {
  const queryClient = useQueryClient();

  return (id: number) => {
    queryClient.prefetchQuery({
      queryKey: OPPORTUNITY_KEYS.detail(id),
      queryFn: () => api.getOpportunity(id),
      staleTime: 60000,
    });
  };
}