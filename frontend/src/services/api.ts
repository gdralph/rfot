import type {
  Opportunity,
  OpportunityLineItem,
  OpportunityUpdate,
  OpportunityFilters,
  OpportunityCategory,
  ServiceLineStageEffort,
  ForecastSummary,
  ServiceLineForecast,
  ActiveServiceLines,
  ImportTask,
  APIError,
  OpportunityResourceTimeline,
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
          params.append(key, String(value));
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
  async getForecastSummary(filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }): Promise<ForecastSummary> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/forecast/summary${query}`);
  }

  async getServiceLineForecast(filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }): Promise<ServiceLineForecast> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/forecast/service-lines${query}`);
  }

  async getLeadOfferingForecast(filters?: { stage?: string; category?: string; service_line?: string; lead_offering?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
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

  // Service Line Stage Efforts
  async getServiceLineStageEfforts(serviceLine?: string, categoryId?: number): Promise<ServiceLineStageEffort[]> {
    const params = new URLSearchParams();
    if (serviceLine) params.append('service_line', serviceLine);
    if (categoryId) params.append('category_id', categoryId.toString());
    
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
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.startDate) params.append('start_date', options.startDate.toISOString());
    if (options.endDate) params.append('end_date', options.endDate.toISOString());
    if (options.timePeriod) params.append('time_period', options.timePeriod);
    if (options.serviceLines?.length) params.append('service_line', options.serviceLines.join(','));
    if (options.category) params.append('category', options.category);
    if (options.stage) params.append('stage', options.stage);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/resources/portfolio/resource-forecast${query}`);
  }
}

// Export singleton instance
export const api = new ApiClient();
export default api;