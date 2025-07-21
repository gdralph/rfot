import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { OpportunityCategory, ServiceLineStageEffort } from '../types/index';

// API functions
const configApi = {
  // Categories
  getCategories: () => api.getCategories(),
  createCategory: (data: Omit<OpportunityCategory, 'id'>) => 
    api.createCategory(data),
  updateCategory: (id: number, data: Omit<OpportunityCategory, 'id'>) =>
    api.updateCategory(id, data),
  deleteCategory: (id: number) => api.deleteCategory(id),
  
  
  
  // Service Line Stage Efforts
  getServiceLineStageEfforts: (serviceLine?: string, categoryId?: number) =>
    api.getServiceLineStageEfforts(serviceLine, categoryId),
  createServiceLineStageEffort: (data: Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>) =>
    api.createServiceLineStageEffort(data),
  updateServiceLineStageEffort: (id: number, data: Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>) =>
    api.updateServiceLineStageEffort(id, data),
  deleteServiceLineStageEffort: (id: number) => api.deleteServiceLineStageEffort(id),
  bulkCreateServiceLineStageEfforts: (data: Array<Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>>) =>
    api.bulkCreateServiceLineStageEfforts(data),
};

// Hooks for Categories
export const useCategories = () => {
  return useQuery({
    queryKey: ['config', 'categories'],
    queryFn: configApi.getCategories,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'categories'] });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<OpportunityCategory, 'id'> }) =>
      configApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'categories'] });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'categories'] });
    },
  });
};



// Hooks for Service Line Stage Efforts
export const useServiceLineStageEfforts = (serviceLine?: string, categoryId?: number) => {
  return useQuery({
    queryKey: ['config', 'service-line-stage-efforts', serviceLine, categoryId],
    queryFn: () => configApi.getServiceLineStageEfforts(serviceLine, categoryId),
  });
};

export const useCreateServiceLineStageEffort = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.createServiceLineStageEffort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-stage-efforts'] });
    },
  });
};

export const useUpdateServiceLineStageEffort = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'> }) =>
      configApi.updateServiceLineStageEffort(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-stage-efforts'] });
    },
  });
};

export const useDeleteServiceLineStageEffort = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.deleteServiceLineStageEffort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-stage-efforts'] });
    },
  });
};

export const useBulkCreateServiceLineStageEfforts = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.bulkCreateServiceLineStageEfforts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-stage-efforts'] });
    },
  });
};