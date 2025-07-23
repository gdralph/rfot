import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { OpportunityCategory, ServiceLineCategory, ServiceLineStageEffort } from '../types/index';

// API functions
const configApi = {
  // Categories
  getCategories: () => api.getCategories(),
  createCategory: (data: Omit<OpportunityCategory, 'id'>) => 
    api.createCategory(data),
  updateCategory: (id: number, data: Omit<OpportunityCategory, 'id'>) =>
    api.updateCategory(id, data),
  deleteCategory: (id: number) => api.deleteCategory(id),
  
  // Service Line Categories
  getServiceLineCategories: (serviceLine?: string) => api.getServiceLineCategories(serviceLine),
  createServiceLineCategory: (data: Omit<ServiceLineCategory, 'id'>) =>
    api.createServiceLineCategory(data),
  updateServiceLineCategory: (id: number, data: Omit<ServiceLineCategory, 'id'>) =>
    api.updateServiceLineCategory(id, data),
  deleteServiceLineCategory: (id: number) => api.deleteServiceLineCategory(id),
  
  // Service Line Stage Efforts
  getServiceLineStageEfforts: (serviceLine?: string, serviceLineCategoryId?: number) =>
    api.getServiceLineStageEfforts(serviceLine, serviceLineCategoryId),
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
// Hooks for Service Line Categories
export const useServiceLineCategories = (serviceLine?: string) => {
  return useQuery({
    queryKey: ['config', 'service-line-categories', serviceLine],
    queryFn: () => configApi.getServiceLineCategories(serviceLine),
  });
};

export const useCreateServiceLineCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.createServiceLineCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-categories'] });
    },
  });
};

export const useUpdateServiceLineCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<ServiceLineCategory, 'id'> }) =>
      configApi.updateServiceLineCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-categories'] });
    },
  });
};

export const useDeleteServiceLineCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.deleteServiceLineCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'service-line-categories'] });
    },
  });
};

// Hooks for Service Line Stage Efforts
export const useServiceLineStageEfforts = (serviceLine?: string, serviceLineCategoryId?: number) => {
  return useQuery({
    queryKey: ['config', 'service-line-stage-efforts', serviceLine, serviceLineCategoryId],
    queryFn: () => configApi.getServiceLineStageEfforts(serviceLine, serviceLineCategoryId),
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