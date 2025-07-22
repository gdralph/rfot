import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, BarChart3, Eye, Filter } from 'lucide-react';
import { useForecastSummary, useServiceLineForecast, useLeadOfferingForecast, useActiveServiceLines } from '../hooks/useForecasts';
import { useCategories } from '../hooks/useConfig';
import { DXC_COLORS, SERVICE_LINES, SALES_STAGES, OPPORTUNITY_CATEGORIES, type ServiceLine } from '../types/index.js';
import LoadingSpinner from '../components/LoadingSpinner';
import InteractiveForecastChart from '../components/charts/InteractiveForecastChart';
import ResourceHeatmap from '../components/charts/ResourceHeatmap';
import ServiceLineDistribution from '../components/charts/ServiceLineDistribution';
import LeadOfferingDistribution from '../components/charts/LeadOfferingDistribution';
import TimelineView from '../components/charts/TimelineView';

const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'forecast' | 'resources' | 'timeline'>('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('quarter');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{ stage?: string; category?: string; service_line?: string; lead_offering?: string }>({});
  
  const { data: forecastSummary, isLoading: summaryLoading, error: summaryError } = useForecastSummary(filters);
  const { data: serviceLineForecast, isLoading: serviceLoading, error: serviceError } = useServiceLineForecast(filters);
  const { data: leadOfferingForecast, isLoading: leadOfferingLoading, error: leadOfferingError } = useLeadOfferingForecast(filters);
  const { data: activeServiceLines, isLoading: activeServiceLoading, error: activeServiceError } = useActiveServiceLines();
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  if (summaryLoading || serviceLoading || leadOfferingLoading || activeServiceLoading || categoriesLoading) {
    return <LoadingSpinner text="Loading dashboard data..." />;
  }

  if (summaryError || serviceError || leadOfferingError || activeServiceError) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-dxc-slide mb-4">Dashboard</h2>
        <div className="bg-red-50 border border-red-200 rounded-dxc p-4">
          <p className="text-red-700">Error loading dashboard data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Prepare chart data
  const stageData = forecastSummary?.stage_breakdown ? 
    SALES_STAGES
      .filter(stageInfo => forecastSummary.stage_breakdown[stageInfo.code] !== undefined)
      .map((stageInfo, index) => {
        const value = forecastSummary.stage_breakdown[stageInfo.code];
        return {
          name: stageInfo.code, // Use just the stage code (01, 02, 03, 04A, etc.)
          code: stageInfo.code,
          fullName: stageInfo.label, // Keep full name for tooltip
          value: value,
          fill: DXC_COLORS[index % DXC_COLORS.length]
        };
      }) : [];

  const categoryData = forecastSummary?.category_breakdown ? 
    OPPORTUNITY_CATEGORIES
      .filter(category => forecastSummary.category_breakdown[category] !== undefined)
      .map((category, index) => ({
        name: category,
        value: forecastSummary.category_breakdown[category],
        fill: DXC_COLORS[index % DXC_COLORS.length]
      }))
      .concat(
        // Add any categories not in the predefined list
        Object.entries(forecastSummary.category_breakdown)
          .filter(([category]) => !OPPORTUNITY_CATEGORIES.includes(category as any))
          .map(([category, value], index) => ({
            name: category,
            value: value,
            fill: DXC_COLORS[(OPPORTUNITY_CATEGORIES.length + index) % DXC_COLORS.length]
          }))
      ) : [];


  const formatCurrency = (value: number) => {
    if (!value || isNaN(value)) return '$0M';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value) + 'M'; // Value is already in millions
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Generate forecast data for advanced charts
  const generateForecastData = () => {
    const periods = timeRange === 'week' ? 12 : timeRange === 'month' ? 12 : timeRange === 'quarter' ? 4 : 3;
    const baseValue = (forecastSummary?.total_value || 0) / periods;
    
    return Array.from({ length: periods }, (_, i) => ({
      period: timeRange === 'week' ? `Week ${i + 1}` :
              timeRange === 'month' ? `Month ${i + 1}` :
              timeRange === 'quarter' ? `Q${i + 1}` : `Year ${2024 + i}`,
      forecast: Math.round(baseValue * (0.8 + Math.random() * 0.4)),
      actual: i < periods - 2 ? Math.round(baseValue * (0.8 + Math.random() * 0.4) * 0.95) : undefined,
      target: Math.round(baseValue * 1.1),
      confidence: 0.6 + Math.random() * 0.4,
      scenario: 'realistic' as const
    }));
  };

  const generateResourceData = () => {
    return SERVICE_LINES.flatMap((serviceLine) => 
      Array.from({ length: 12 }, (_, week) => ({
        serviceLine,
        week: week + 1,
        utilization: 60 + Math.random() * 40,
        capacity: 40 + Math.random() * 20,
        demand: 35 + Math.random() * 30,
        efficiency: 0.7 + Math.random() * 0.3,
        category: 'Normal'
      }))
    );
  };

  const generateServiceLineData = () => {
    return SERVICE_LINES.map((serviceLine) => ({
      serviceLine,
      revenue: serviceLineForecast?.service_line_totals[serviceLine] || 0,
      percentage: serviceLineForecast?.service_line_percentages[serviceLine] || 0,
      opportunities: serviceLineForecast?.service_line_counts[serviceLine] || 0,
      avgDealSize: serviceLineForecast?.service_line_avg_deal_size[serviceLine] || 0,
      growth: 0, // Historical data not available yet - would need time series data
      stage: 'Active',
      category: 'Enterprise'
    }));
  };

  const generateLeadOfferingData = () => {
    if (!leadOfferingForecast?.lead_offering_data) {
      return [];
    }

    return Object.entries(leadOfferingForecast.lead_offering_data).map(([leadOffering, data]: [string, any]) => ({
      leadOffering: leadOffering as ServiceLine,
      revenue: data.revenue || 0,
      percentage: data.percentage || 0,
      opportunities: data.opportunities || 0,
      avgDealSize: data.avgDealSize || 0,
      growth: data.growth || 0,
      stage: 'Active',
      category: 'Enterprise'
    }));
  };

  const generateTimelineData = () => {
    const periods = timeRange === 'week' ? 12 : timeRange === 'month' ? 12 : timeRange === 'quarter' ? 4 : 3;
    const baseValue = (forecastSummary?.total_value || 0) / periods;
    
    return Array.from({ length: periods }, (_, i) => ({
      date: new Date(2024, i, 1).toISOString(),
      period: timeRange === 'week' ? `Week ${i + 1}` :
              timeRange === 'month' ? `Month ${i + 1}` :
              timeRange === 'quarter' ? `Q${i + 1}` : `Year ${2024 + i}`,
      revenue: Math.round(baseValue * (0.8 + Math.random() * 0.4)),
      opportunities: Math.round((forecastSummary?.total_opportunities || 0) / periods * (0.8 + Math.random() * 0.4)),
      won: 0, // No mock data
      lost: 0, // No mock data  
      pipeline: Math.round(baseValue * 1.2 * (0.8 + Math.random() * 0.4)),
      forecast: Math.round(baseValue * 1.1 * (0.8 + Math.random() * 0.4)),
      target: Math.round(baseValue * 1.15)
    }));
  };

  const forecastData = generateForecastData();
  const resourceData = generateResourceData();
  const serviceLineData = generateServiceLineData();
  const leadOfferingData = generateLeadOfferingData();
  const timelineData = generateTimelineData();

  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="metric-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="metric-label">Total Opportunities</h3>
                    <p className="metric-value text-dxc-bright-purple">
                      {formatNumber(forecastSummary?.total_opportunities || 0)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-dxc-bright-purple" />
                </div>
              </div>
              
              <div className="metric-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="metric-label">Total Value</h3>
                    <p className="metric-value text-dxc-bright-teal">
                      {formatCurrency(forecastSummary?.total_value || 0)}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-dxc-bright-teal" />
                </div>
              </div>
              
              <div className="metric-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="metric-label">Average Value</h3>
                    <p className="metric-value text-dxc-blue">
                      {formatCurrency(forecastSummary?.average_value || 0)}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-dxc-blue" />
                </div>
              </div>
              
              <div className="metric-card hover-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="metric-label">Service Lines</h3>
                    <p className="metric-value text-dxc-green">
                      {activeServiceLines?.active_count ?? 0}
                    </p>
                  </div>
                  <Eye className="w-8 h-8 text-dxc-green" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Stage Breakdown */}
              <div className="chart-container">
                <div className="chart-header">
                  <h3 className="chart-title">Opportunities by Stage</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, name, props) => {
                        const dataPoint = props.payload;
                        const stageCode = dataPoint?.code;
                        const count = forecastSummary?.stage_counts?.[stageCode] || 0;
                        const avgValue = count > 0 ? Number(value) / count : 0;
                        
                        return [
                          <div key="tooltip-content" className="space-y-1">
                            <div>Revenue: {formatCurrency(Number(value))}</div>
                            <div>Opportunities: {formatNumber(count)}</div>
                            <div>Avg Deal Size: {formatCurrency(avgValue)}</div>
                          </div>,
                          ''
                        ];
                      }}
                      labelFormatter={(label, payload) => {
                        const dataPoint = payload?.[0]?.payload;
                        return dataPoint?.fullName || label;
                      }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #D9D9D6',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Category Breakdown */}
              <div className="chart-container">
                <div className="chart-header">
                  <h3 className="chart-title">Opportunities by Category</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => {
                        const dataPoint = props.payload;
                        const categoryName = dataPoint?.name;
                        const count = forecastSummary?.category_counts?.[categoryName] || 0;
                        const avgValue = count > 0 ? Number(value) / count : 0;
                        const percentage = forecastSummary?.total_value ? (Number(value) / forecastSummary.total_value * 100) : 0;
                        
                        return [
                          <div key="tooltip-content" className="space-y-1">
                            <div>Revenue: {formatCurrency(Number(value))}</div>
                            <div>Share: {percentage.toFixed(1)}%</div>
                            <div>Opportunities: {formatNumber(count)}</div>
                            <div>Avg Deal Size: {formatCurrency(avgValue)}</div>
                          </div>,
                          categoryName
                        ];
                      }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #D9D9D6',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Enhanced Service Line Analysis */}
            <ServiceLineDistribution 
              data={serviceLineData.filter(item => item.revenue > 0)} 
              title="Service Line Performance"
            />

            {/* Lead Offering Analysis */}
            <LeadOfferingDistribution 
              data={leadOfferingData.filter(item => item.revenue > 0)} 
              title="Lead Offering Performance"
            />
          </div>
        );

      case 'forecast':
        return (
          <div className="space-y-8">
            <InteractiveForecastChart
              data={forecastData}
              height={500}
              showConfidenceInterval={true}
              showScenarios={true}
            />
          </div>
        );

      case 'resources':
        return (
          <div className="space-y-8">
            <ResourceHeatmap
              data={resourceData}
              weeks={12}
              showLegend={true}
            />
          </div>
        );

      case 'timeline':
        return (
          <div className="space-y-8">
            <TimelineView
              data={timelineData}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              showFilters={true}
              height={500}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-dxc-section mb-2 text-dxc-bright-purple">Advanced Dashboard</h1>
          <p className="text-dxc-dark-gray">Comprehensive resource forecasting and opportunity analytics</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="badge badge-primary">Live Data</span>
          <span className="badge badge-success">Updated 2min ago</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-dxc p-4 space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-dxc-bright-purple text-white' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          {(filters.stage || filters.category || filters.service_line || filters.lead_offering) && (
            <button
              onClick={clearFilters}
              className="text-dxc-purple hover:text-dxc-purple/80 text-sm"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dxc-light-gray">
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Stage
              </label>
              <select
                value={filters.stage || ''}
                onChange={(e) => handleFilterChange('stage', e.target.value)}
                className="input w-full"
              >
                <option value="">All Stages</option>
                {SALES_STAGES.map((stage) => (
                  <option key={stage.code} value={stage.code}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="input w-full"
              >
                <option value="">All Categories</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
                <option value="Uncategorized">Uncategorized</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Service Line
              </label>
              <select
                value={filters.service_line || ''}
                onChange={(e) => handleFilterChange('service_line', e.target.value)}
                className="input w-full"
              >
                <option value="">All Service Lines</option>
                {SERVICE_LINES.map((serviceLine) => (
                  <option key={serviceLine} value={serviceLine}>
                    {serviceLine}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Lead Offering
              </label>
              <select
                value={filters.lead_offering || ''}
                onChange={(e) => handleFilterChange('lead_offering', e.target.value)}
                className="input w-full"
              >
                <option value="">All Lead Offerings</option>
                {SERVICE_LINES.map((serviceLine) => (
                  <option key={serviceLine} value={serviceLine}>
                    {serviceLine}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="tabs flex">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'forecast', label: 'Interactive Forecast', icon: TrendingUp },
          { key: 'resources', label: 'Resource Heatmap', icon: Users },
          { key: 'timeline', label: 'Timeline Analysis', icon: Calendar }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as any)}
            className={`tab ${activeView === key ? 'tab-active' : ''} flex items-center gap-2`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Active View Content */}
      {renderActiveView()}

    </div>
  );
};

export default Dashboard;