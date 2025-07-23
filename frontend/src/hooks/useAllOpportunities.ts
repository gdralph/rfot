import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { OpportunityFilters, Opportunity } from '../types/index.js';

const OPPORTUNITY_KEYS = {
  all: ['opportunities', 'all'] as const,
  allWithFilters: (filters?: OpportunityFilters) => [...OPPORTUNITY_KEYS.all, filters] as const,
};

// Custom hook to fetch ALL opportunities using pagination
export function useAllOpportunities(filters?: OpportunityFilters) {
  return useQuery({
    queryKey: OPPORTUNITY_KEYS.allWithFilters(filters),
    queryFn: async (): Promise<Opportunity[]> => {
      const allOpportunities: Opportunity[] = [];
      let skip = 0;
      const limit = 1000; // Use maximum allowed limit per request
      let hasMore = true;

      while (hasMore) {
        const batch = await api.getOpportunities({
          ...filters,
          skip,
          limit,
        });

        allOpportunities.push(...batch);

        // If we got fewer records than requested, we've reached the end
        hasMore = batch.length === limit;
        skip += limit;

        // Safety break to prevent infinite loops (adjust based on expected data size)
        if (skip > 50000) {
          // console.warn('useAllOpportunities: Hit safety limit of 50,000 records');
          break;
        }
      }

      return allOpportunities;
    },
    staleTime: 300000, // Cache for 5 minutes since this is expensive
    refetchOnWindowFocus: false,
    // Only enable when we have filters (to avoid massive queries on page load)
    enabled: true,
  });
}