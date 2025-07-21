import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ImportTask } from '../types/index.js';

// Query keys
const IMPORT_KEYS = {
  all: ['imports'] as const,
  status: (taskId: string) => [...IMPORT_KEYS.all, 'status', taskId] as const,
};

// Import Excel file
export function useImportExcel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => api.importExcel(file),
    onSuccess: () => {
      // Invalidate opportunities data after successful import
      queryClient.invalidateQueries({
        queryKey: ['opportunities'],
      });
      queryClient.invalidateQueries({
        queryKey: ['forecasts'],
      });
    },
  });
}

// Import line items file
export function useImportLineItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => api.importLineItems(file),
    onSuccess: () => {
      // Invalidate opportunities and forecast data after successful import
      queryClient.invalidateQueries({
        queryKey: ['opportunities'],
      });
      queryClient.invalidateQueries({
        queryKey: ['forecasts'],
      });
    },
  });
}

// Get import task status
export function useImportStatus(taskId: string, enabled = false) {
  return useQuery({
    queryKey: IMPORT_KEYS.status(taskId),
    queryFn: () => api.getImportStatus(taskId),
    enabled: enabled && !!taskId,
    refetchInterval: (data) => {
      // Poll every second while processing, stop when completed or failed
      if (!data || data.status === 'processing' || data.status === 'pending') {
        return 1000;
      }
      return false;
    },
    refetchOnWindowFocus: false,
  });
}