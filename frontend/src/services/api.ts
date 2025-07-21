import type {
  Opportunity,
  OpportunityLineItem,
  OpportunityUpdate,
  OpportunityFilters,
  OpportunityCategory,
  StageEffortEstimate,
  SMEAllocationRule,
  ForecastSummary,
  ServiceLineForecast,
  ImportTask,
  APIError
} from '../types/index.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
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
        throw new Error(errorData.detail || 'An error occurred');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
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
  async getForecastSummary(filters?: { stage?: string; category?: string }): Promise<ForecastSummary> {
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

  async getServiceLineForecast(serviceLinFilter?: string): Promise<ServiceLineForecast> {
    const params = serviceLinFilter ? `?service_line=${serviceLinFilter}` : '';
    return this.request(`/api/forecast/service-lines${params}`);
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

  async getStageEffortEstimates(): Promise<StageEffortEstimate[]> {
    return this.request('/api/config/stage-effort');
  }

  async createStageEffortEstimate(data: Omit<StageEffortEstimate, 'id'>): Promise<StageEffortEstimate> {
    return this.request('/api/config/stage-effort', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSMERules(): Promise<SMEAllocationRule[]> {
    return this.request('/api/config/sme-rules');
  }

  async createSMERule(data: Omit<SMEAllocationRule, 'id'>): Promise<SMEAllocationRule> {
    return this.request('/api/config/sme-rules', {
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
}

// Export singleton instance
export const api = new ApiClient();
export default api;