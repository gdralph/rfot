import type {
  Opportunity,
  OpportunityLineItem,
  OpportunityUpdate,
  OpportunityFilters,
  OpportunityCategory,
  ServiceLineCategory,
  ServiceLineStageEffort,
  ServiceLineOfferingThreshold,
  ServiceLineInternalServiceMapping,
  ForecastSummary,
  ServiceLineForecast,
  ActiveServiceLines,
  ImportTask,
  APIError,
  // OpportunityResourceTimeline,
  OpportunityEffortPrediction
} from '../types/index.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData: APIError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        }));
        
        // Special handling for timeline endpoints - 404s are expected when no timeline exists
        if (response.status === 404 && endpoint.includes('/timeline')) {
          // For timeline endpoints, don't throw on 404 - this is expected behavior
          throw new Error('No timeline found for opportunity');
        }
        
        // Retry on 5xx errors (server errors)
        if (response.status >= 500 && retryCount < this.maxRetries) {
          await this.delay(this.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        throw new Error(errorData.detail || 'An error occurred');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        // Retry on network errors
        if (retryCount < this.maxRetries && this.isRetryableError(error)) {
          await this.delay(this.retryDelay * Math.pow(2, retryCount));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'Failed to fetch',
      'NetworkError',
      'TypeError',
      'fetch'
    ];
    return retryableMessages.some(msg => error.message.includes(msg));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check
  async healthCheck(): Promise<{ status: string; app: string; version: string }> {
    return this.request('/api/health');
  }

  // Opportunities API
  async getOpportunities(filters?: OpportunityFilters): Promise<Opportunity[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // For arrays, append each value separately for multi-select support
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/opportunities/${query}`);
  }

  async getOpportunity(id: number): Promise<Opportunity> {
    return this.request(`/api/opportunities/${id}`);
  }

  async updateOpportunity(id: number, data: OpportunityUpdate): Promise<Opportunity> {
    return this.request(`/api/opportunities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getOpportunityLineItems(id: number): Promise<OpportunityLineItem[]> {
    return this.request(`/api/opportunities/${id}/line-items`);
  }

  // Forecast API
  async getForecastSummary(filters?: { stage?: string | string[]; category?: string | string[]; service_line?: string | string[]; lead_offering?: string | string[] }): Promise<ForecastSummary> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/forecast/summary${query}`);
  }

  async getServiceLineForecast(filters?: { stage?: string | string[]; category?: string | string[]; service_line?: string | string[]; lead_offering?: string | string[] }): Promise<ServiceLineForecast> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/forecast/service-lines${query}`);
  }

  async getLeadOfferingForecast(filters?: { stage?: string | string[]; category?: string | string[]; service_line?: string | string[]; lead_offering?: string | string[] }): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/forecast/lead-offerings${query}`);
  }

  async getActiveServiceLines(): Promise<ActiveServiceLines> {
    return this.request('/api/forecast/active-service-lines');
  }

  // Configuration API
  async getCategories(): Promise<OpportunityCategory[]> {
    return this.request('/api/config/categories');
  }

  async createCategory(data: Omit<OpportunityCategory, 'id'>): Promise<OpportunityCategory> {
    return this.request('/api/config/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: number, data: Omit<OpportunityCategory, 'id'>): Promise<OpportunityCategory> {
    return this.request(`/api/config/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: number): Promise<void> {
    return this.request(`/api/config/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Service Line Categories
  async getServiceLineCategories(serviceLine?: string): Promise<ServiceLineCategory[]> {
    const params = new URLSearchParams();
    if (serviceLine) params.append('service_line', serviceLine);
    
    const queryString = params.toString();
    return this.request(`/api/config/service-line-categories${queryString ? '?' + queryString : ''}`);
  }

  async createServiceLineCategory(data: Omit<ServiceLineCategory, 'id'>): Promise<ServiceLineCategory> {
    return this.request('/api/config/service-line-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceLineCategory(id: number, data: Omit<ServiceLineCategory, 'id'>): Promise<ServiceLineCategory> {
    return this.request(`/api/config/service-line-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceLineCategory(id: number): Promise<void> {
    return this.request(`/api/config/service-line-categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Service Line Stage Efforts
  async getServiceLineStageEfforts(serviceLine?: string, serviceLineCategoryId?: number): Promise<ServiceLineStageEffort[]> {
    const params = new URLSearchParams();
    if (serviceLine) params.append('service_line', serviceLine);
    if (serviceLineCategoryId) params.append('service_line_category_id', serviceLineCategoryId.toString());
    
    const queryString = params.toString();
    return this.request(`/api/config/service-line-stage-efforts${queryString ? '?' + queryString : ''}`);
  }

  async createServiceLineStageEffort(data: Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>): Promise<ServiceLineStageEffort> {
    return this.request('/api/config/service-line-stage-efforts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceLineStageEffort(id: number, data: Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>): Promise<ServiceLineStageEffort> {
    return this.request(`/api/config/service-line-stage-efforts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceLineStageEffort(id: number): Promise<void> {
    return this.request(`/api/config/service-line-stage-efforts/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateServiceLineStageEfforts(data: Array<Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>>): Promise<ServiceLineStageEffort[]> {
    return this.request('/api/config/service-line-stage-efforts/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Service Line Offering Thresholds
  async getServiceLineOfferingThresholds(serviceLine?: string, stageName?: string): Promise<ServiceLineOfferingThreshold[]> {
    const params = new URLSearchParams();
    if (serviceLine) params.append('service_line', serviceLine);
    if (stageName) params.append('stage_name', stageName);
    
    const queryString = params.toString();
    const url = queryString ? `/api/config/service-line-offering-thresholds?${queryString}` : '/api/config/service-line-offering-thresholds';
    
    return this.request(url);
  }

  async createServiceLineOfferingThreshold(data: Omit<ServiceLineOfferingThreshold, 'id'>): Promise<ServiceLineOfferingThreshold> {
    return this.request('/api/config/service-line-offering-thresholds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceLineOfferingThreshold(id: number, data: Omit<ServiceLineOfferingThreshold, 'id'>): Promise<ServiceLineOfferingThreshold> {
    return this.request(`/api/config/service-line-offering-thresholds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceLineOfferingThreshold(id: number): Promise<void> {
    return this.request(`/api/config/service-line-offering-thresholds/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateServiceLineOfferingThresholds(data: Array<Omit<ServiceLineOfferingThreshold, 'id'>>): Promise<ServiceLineOfferingThreshold[]> {
    return this.request('/api/config/service-line-offering-thresholds/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Service Line Internal Service Mappings
  async getServiceLineInternalServiceMappings(serviceLine?: string): Promise<ServiceLineInternalServiceMapping[]> {
    const params = new URLSearchParams();
    if (serviceLine) params.append('service_line', serviceLine);
    
    const url = params.toString() 
      ? `/api/config/service-line-internal-service-mappings?${params}`
      : '/api/config/service-line-internal-service-mappings';
    
    return this.request(url);
  }

  async createServiceLineInternalServiceMapping(data: Omit<ServiceLineInternalServiceMapping, 'id'>): Promise<ServiceLineInternalServiceMapping> {
    return this.request('/api/config/service-line-internal-service-mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateServiceLineInternalServiceMapping(id: number, data: Omit<ServiceLineInternalServiceMapping, 'id'>): Promise<ServiceLineInternalServiceMapping> {
    return this.request(`/api/config/service-line-internal-service-mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteServiceLineInternalServiceMapping(id: number): Promise<void> {
    return this.request(`/api/config/service-line-internal-service-mappings/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateServiceLineInternalServiceMappings(data: Array<Omit<ServiceLineInternalServiceMapping, 'id'>>): Promise<ServiceLineInternalServiceMapping[]> {
    return this.request('/api/config/service-line-internal-service-mappings/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Import API
  async importExcel(file: File): Promise<{ task_id: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/api/import/excel', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async importLineItems(file: File): Promise<{ task_id: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/api/import/line-items', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async getImportStatus(taskId: string): Promise<ImportTask> {
    return this.request(`/api/import/status/${taskId}`);
  }

  // Resource Timeline API
  async calculateResourceTimeline(opportunityId: number): Promise<OpportunityEffortPrediction> {
    return this.request(`/api/resources/calculate-timeline/${opportunityId}`, {
      method: 'POST',
    });
  }

  async getResourceTimeline(opportunityId: number): Promise<OpportunityEffortPrediction> {
    return this.request(`/api/resources/opportunity/${opportunityId}/timeline`);
  }

  async deleteResourceTimeline(opportunityId: number): Promise<void> {
    return this.request(`/api/resources/opportunity/${opportunityId}/timeline`, {
      method: 'DELETE',
    });
  }

  async updateResourceTimelineStatus(
    opportunityId: number, 
    resourceStatus: string, 
    options?: { serviceLine?: string; stageName?: string }
  ): Promise<{ message: string; opportunity_id: string; status: string }> {
    const params = new URLSearchParams();
    if (options?.serviceLine) params.append('service_line', options.serviceLine);
    if (options?.stageName) params.append('stage_name', options.stageName);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/resources/opportunity/${opportunityId}/timeline/status${query}`, {
      method: 'PATCH',
      body: JSON.stringify({ resource_status: resourceStatus }),
    });
  }

  async updateResourceTimelineData(
    opportunityId: number,
    serviceLine: string,
    stageName: string,
    data: {
      stage_start_date: string;
      stage_end_date: string;
      duration_weeks: number;
      fte_required: number;
      resource_status: string;
    }
  ): Promise<{ message: string; opportunity_id: string }> {
    const params = new URLSearchParams();
    params.append('service_line', serviceLine);
    params.append('stage_name', stageName);
    
    return this.request(`/api/resources/opportunity/${opportunityId}/timeline/data?${params.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getPortfolioResourceForecast(options: {
    startDate?: Date;
    endDate?: Date;
    timePeriod?: string;
    serviceLines?: string[];
    category?: string;
    stage?: string;
    filters?: {
      stage?: string | string[];
      category?: string | string[];
      service_line?: string | string[];
      lead_offering?: string | string[];
    };
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.startDate) params.append('start_date', options.startDate.toISOString());
    if (options.endDate) params.append('end_date', options.endDate.toISOString());
    if (options.timePeriod) params.append('time_period', options.timePeriod);
    if (options.serviceLines?.length) params.append('service_line', options.serviceLines.join(','));
    if (options.category) params.append('category', options.category);
    if (options.stage) params.append('stage', options.stage);
    
    // Add filters from the filters object
    if (options.filters) {
      if (options.filters.stage) {
        if (Array.isArray(options.filters.stage)) {
          options.filters.stage.forEach(s => params.append('stage', s));
        } else {
          params.append('stage', options.filters.stage);
        }
      }
      if (options.filters.category) {
        if (Array.isArray(options.filters.category)) {
          options.filters.category.forEach(c => params.append('category', c));
        } else {
          params.append('category', options.filters.category);
        }
      }
      if (options.filters.service_line) {
        if (Array.isArray(options.filters.service_line)) {
          options.filters.service_line.forEach(sl => params.append('service_line', sl));
        } else {
          params.append('service_line', options.filters.service_line);
        }
      }
      if (options.filters.lead_offering) {
        if (Array.isArray(options.filters.lead_offering)) {
          options.filters.lead_offering.forEach(lo => params.append('lead_offering', lo));
        } else {
          params.append('lead_offering', options.filters.lead_offering);
        }
      }
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/resources/portfolio/resource-forecast${query}`);
  }

  async getStageResourceTimeline(options: {
    startDate?: Date;
    endDate?: Date;
    timePeriod?: string;
    filters?: {
      stage?: string | string[];
      category?: string | string[];
      service_line?: string | string[];
      lead_offering?: string | string[];
    };
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.startDate) params.append('start_date', options.startDate.toISOString());
    if (options.endDate) params.append('end_date', options.endDate.toISOString());
    if (options.timePeriod) params.append('time_period', options.timePeriod);
    
    
    // Add filters from the filters object
    if (options.filters) {
      if (options.filters.stage) {
        if (Array.isArray(options.filters.stage)) {
          options.filters.stage.forEach(s => params.append('stage', s));
        } else {
          params.append('stage', options.filters.stage);
        }
      }
      if (options.filters.category) {
        if (Array.isArray(options.filters.category)) {
          options.filters.category.forEach(c => params.append('category', c));
        } else {
          params.append('category', options.filters.category);
        }
      }
      if (options.filters.service_line) {
        if (Array.isArray(options.filters.service_line)) {
          options.filters.service_line.forEach(sl => params.append('service_line', sl));
        } else {
          params.append('service_line', options.filters.service_line);
        }
      }
      if (options.filters.lead_offering) {
        if (Array.isArray(options.filters.lead_offering)) {
          options.filters.lead_offering.forEach(lo => params.append('lead_offering', lo));
        } else {
          params.append('lead_offering', options.filters.lead_offering);
        }
      }
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const finalUrl = `/api/resources/portfolio/stage-resource-timeline${query}`;
    return this.request(finalUrl);
  }

  // Timeline Generation APIs
  async getTimelineGenerationStats() {
    return this.request('/api/resources/timeline-generation/stats');
  }

  // Get date bounds of actual timeline data
  async getTimelineDataBounds(): Promise<{earliest_date: string | null, latest_date: string | null}> {
    return this.request('/api/resources/timeline-data-bounds');
  }

  async generateBulkTimelines(options: { regenerateAll?: boolean } = {}) {
    return this.request('/api/resources/timeline-generation/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
  }

  async clearPredictedTimelines() {
    return this.request('/api/resources/timeline-generation/clear-predicted', {
      method: 'DELETE',
    });
  }

  // Reports API methods
  async getAvailableReports(): Promise<any> {
    return this.request('/api/reports/available-reports');
  }

  async generateReport(reportId: string, filters?: Record<string, any>): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }
    return this.request(`/api/reports/${reportId}?${params.toString()}`);
  }
}

// Export singleton instance
export const api = new ApiClient();
export default api;