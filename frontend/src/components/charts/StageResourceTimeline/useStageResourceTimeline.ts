import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';

type TimePeriod = 'week' | 'month' | 'quarter';

interface UseStageResourceTimelineOptions {
  startDate?: Date;
  endDate?: Date;
  timePeriod?: TimePeriod;
  filters?: any;
}

export const useStageResourceTimeline = (options: UseStageResourceTimelineOptions) => {
  return useQuery({
    queryKey: ['stage-resource-timeline', options.startDate?.toISOString(), options.endDate?.toISOString(), options.timePeriod, JSON.stringify(options.filters)],
    queryFn: () => {
      return api.getStageResourceTimeline(options);
    },
    enabled: true,
    staleTime: 0, // Force fresh data on every call
    gcTime: 10000, // 10 seconds - very short cache
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on error to see failures quickly
  });
};

export const useTimelineDataBounds = () => {
  return useQuery({
    queryKey: ['timeline-data-bounds'],
    queryFn: () => api.getTimelineDataBounds(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};