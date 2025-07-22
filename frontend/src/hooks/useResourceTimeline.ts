import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { OpportunityResourceTimeline, OpportunityEffortPrediction } from '../types/index.js';

// Query keys
const RESOURCE_TIMELINE_KEYS = {
  all: ['resource-timeline'] as const,
  timeline: (opportunityId: number) => [...RESOURCE_TIMELINE_KEYS.all, 'timeline', opportunityId] as const,
  calculation: (opportunityId: number) => [...RESOURCE_TIMELINE_KEYS.all, 'calculation', opportunityId] as const,
};

// Get existing resource timeline for an opportunity
export function useResourceTimeline(opportunityId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: RESOURCE_TIMELINE_KEYS.timeline(opportunityId),
    queryFn: () => api.getResourceTimeline(opportunityId),
    enabled: !!opportunityId && enabled,
    staleTime: 60000, // Consider data stale after 1 minute
    gcTime: 300000, // Keep data in cache for 5 minutes to prevent unwanted refetches
    refetchOnWindowFocus: false, // Prevent refetch when window regains focus
    refetchOnMount: true, // Allow refetch on component mount for fresh data
  });
}

// Calculate/generate resource timeline for an opportunity
export function useCalculateResourceTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opportunityId: number) => api.calculateResourceTimeline(opportunityId),
    onSuccess: (calculationResult, opportunityId) => {
      // Invalidate existing timeline to refetch updated data
      queryClient.invalidateQueries({
        queryKey: RESOURCE_TIMELINE_KEYS.timeline(opportunityId),
      });
    },
  });
}

// Delete resource timeline for an opportunity
export function useDeleteResourceTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opportunityId: number) => api.deleteResourceTimeline(opportunityId),
    onSuccess: (_, opportunityId) => {
      // Set the cache to null to represent deleted/non-existent state
      queryClient.setQueryData(
        RESOURCE_TIMELINE_KEYS.timeline(opportunityId),
        null
      );
      
      // Invalidate to trigger a fresh check (which will return null gracefully)
      queryClient.invalidateQueries({
        queryKey: RESOURCE_TIMELINE_KEYS.timeline(opportunityId),
        exact: true,
      });
    },
  });
}

// Prefetch resource timeline
export function usePrefetchResourceTimeline() {
  const queryClient = useQueryClient();

  return (opportunityId: number) => {
    queryClient.prefetchQuery({
      queryKey: RESOURCE_TIMELINE_KEYS.timeline(opportunityId),
      queryFn: () => api.getResourceTimeline(opportunityId),
      staleTime: 60000,
    });
  };
}