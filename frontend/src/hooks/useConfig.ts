import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { OpportunityCategory, StageEffortEstimate, SMEAllocationRule } from '../types/index';

// API functions
const configApi = {
  // Categories
  getCategories: () => api.getCategories(),
  createCategory: (data: Omit<OpportunityCategory, 'id'>) => 
    api.createCategory(data),
  
  // Stage Effort Estimates
  getStageEfforts: () => api.getStageEffortEstimates(),
  createStageEffort: (data: Omit<StageEffortEstimate, 'id'>) =>
    api.createStageEffortEstimate(data),
  
  // SME Rules
  getSMERules: () => api.getSMERules(),
  createSMERule: (data: Omit<SMEAllocationRule, 'id'>) =>
    api.createSMERule(data),
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

// Hooks for Stage Effort Estimates
export const useStageEfforts = () => {
  return useQuery({
    queryKey: ['config', 'stage-efforts'],
    queryFn: configApi.getStageEfforts,
  });
};

export const useCreateStageEffort = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.createStageEffort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'stage-efforts'] });
    },
  });
};

// Hooks for SME Rules
export const useSMERules = () => {
  return useQuery({
    queryKey: ['config', 'sme-rules'],
    queryFn: configApi.getSMERules,
  });
};

export const useCreateSMERule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: configApi.createSMERule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', 'sme-rules'] });
    },
  });
};