import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, BarChart3, Eye, Filter } from 'lucide-react';
import { useForecastSummary, useServiceLineForecast, useLeadOfferingForecast, useActiveServiceLines } from '../hooks/useForecasts';
import { useCategories } from '../hooks/useConfig';
import { DXC_COLORS, SERVICE_LINES, SALES_STAGES, OPPORTUNITY_CATEGORIES, type ServiceLine } from '../types/index.js';
import LoadingSpinner from '../components/LoadingSpinner';
import TCVServiceLineTimelineChart from '../components/charts/TCVServiceLineTimelineChart';
import ServiceLineAnalysisChart from '../components/charts/ServiceLineAnalysisChart';
import ResourceForecastChart from '../components/charts/ResourceForecastChart';
import StageResourceTimelineChart from '../components/charts/StageResourceTimelineChart';
import MultiSelect, { type MultiSelectOption } from '../components/MultiSelect';

const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'forecast' | 'resources' | 'timeline'>('overview');
  // const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('quarter');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{ stage?: string[]; category?: string[]; service_line?: string[]; lead_offering?: string[] }>({});
  
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

  const handleFilterChange = (key: string, values: string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: values.length > 0 ? values : undefined,
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
      : [];


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

    return Object.entries(leadOfferingForecast.lead_offering_data as Record<string, any>).map(([leadOffering, data]) => ({
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

  // const generateTimelineData = () => {
  //   const periods = timeRange === 'week' ? 12 : timeRange === 'month' ? 12 : timeRange === 'quarter' ? 4 : 3;
  //   const baseValue = (forecastSummary?.total_value || 0) / periods;
  //   
  //   return Array.from({ length: periods }, (_, i) => ({
  //     date: new Date(2024, i, 1).toISOString(),
  //     period: timeRange === 'week' ? `Week ${i + 1}` :
  //             timeRange === 'month' ? `Month ${i + 1}` :
  //             timeRange === 'quarter' ? `Q${i + 1}` : `Year ${2024 + i}`,
  //     revenue: Math.round(baseValue * (0.8 + Math.random() * 0.4)),
  //     opportunities: Math.round((forecastSummary?.total_opportunities || 0) / periods * (0.8 + Math.random() * 0.4)),
  //     won: 0, // No mock data
  //     lost: 0, // No mock data  
  //     pipeline: Math.round(baseValue * 1.2 * (0.8 + Math.random() * 0.4)),
  //     forecast: Math.round(baseValue * 1.1 * (0.8 + Math.random() * 0.4)),
  //     target: Math.round(baseValue * 1.15)
  //   }));
  // };


  const serviceLineData = generateServiceLineData();
  const leadOfferingData = generateLeadOfferingData();
  // const timelineData = generateTimelineData();


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
                      formatter={(value, _, props) => {
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
                      formatter={(value, _, props) => {
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

            {/* Service Line & Lead Offering Analysis */}
            <ServiceLineAnalysisChart 
              serviceLineData={serviceLineData.filter(item => item.revenue > 0)}
              leadOfferingData={leadOfferingData.filter(item => item.revenue > 0)} 
              title="Service Line & Lead Offering Analysis"
            />

            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-bright-purple/5 to-transparent border-l-4 border-dxc-bright-purple rounded-dxc p-6">
              <h4 className="text-lg font-semibold text-dxc-bright-purple mb-3">About This Dashboard</h4>
              <p className="text-dxc-body text-dxc-dark-gray leading-relaxed">
                The Portfolio Overview shows comprehensive opportunity metrics and distribution patterns across sales stages, categories, and service lines. 
                Key metrics include total opportunities, revenue values, and service line performance. The analysis chart provides multiple visualization 
                modes and can toggle between Service Line (revenue by DXC service areas) and Lead Offering (primary service driving each opportunity) views. 
                Data is calculated from active opportunities in the system and updates based on your selected filters.
              </p>
            </div>
          </div>
        );

      case 'forecast':
        return (
          <div className="space-y-8">
            <TCVServiceLineTimelineChart filters={filters} />
            
            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-bright-teal/5 to-transparent border-l-4 border-dxc-bright-teal rounded-dxc p-6">
              <h4 className="text-lg font-semibold text-dxc-bright-teal mb-3">About Revenue Timeline</h4>
              <p className="text-dxc-body text-dxc-dark-gray leading-relaxed">
                The Revenue Timeline displays total contract value (TCV) trends over time, broken down by service line for accurate forecasting. 
                Charts show historical and projected revenue patterns across DXC's six service lines (CES, INS, BPS, SEC, ITOC, MW). 
                Data is based on opportunity decision dates and can be viewed in different time periods (weekly, monthly, quarterly) and chart types (line, bar, area). 
                Use filters to focus on specific stages, categories, or service lines to refine your revenue forecasting analysis.
              </p>
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className="space-y-8">
            <ResourceForecastChart filters={filters} />
            
            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-green/5 to-transparent border-l-4 border-dxc-green rounded-dxc p-6">
              <h4 className="text-lg font-semibold text-dxc-green mb-3">About Resource Forecast</h4>
              <p className="text-dxc-body text-dxc-dark-gray leading-relaxed">
                The Resource Forecast projects FTE (Full-Time Equivalent) resource requirements across time periods based on opportunity stages and service line templates. 
                This analysis helps identify capacity needs and resource allocation patterns for successful opportunity delivery. 
                Charts display resource demand by service line over time, calculated from opportunity timelines and effort estimates configured in the system. 
                Resource projections are particularly detailed for MW (Modern Workplace) and ITOC (Infrastructure & Cloud) service lines with established effort templates.
              </p>
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div className="space-y-8">
            <StageResourceTimelineChart filters={filters} />
            
            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-orange/5 to-transparent border-l-4 border-dxc-orange rounded-dxc p-6">
              <h4 className="text-lg font-semibold text-dxc-orange mb-3">About Stage Planning</h4>
              <p className="text-dxc-body text-dxc-dark-gray leading-relaxed">
                Stage Planning shows resource allocation needs by sales stage, helping identify capacity requirements during different deal phases. 
                This view displays FTE resource demand across the eight-stage DXC sales process (01: Understand Customer through 06: Deploy & Extend). 
                Charts break down resource needs by service line and sales stage, enabling better capacity planning and resource scheduling. 
                Data is calculated from opportunities with established timelines and helps optimize resource allocation during peak demand periods in the sales cycle.
              </p>
            </div>
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
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-dxc-bright-purple text-white' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(filters.stage?.length || filters.category?.length || filters.service_line?.length || filters.lead_offering?.length) && (
              <span className="bg-dxc-bright-teal text-white text-xs px-2 py-1 rounded-full ml-1">
                {(filters.stage?.length || 0) + (filters.category?.length || 0) + (filters.service_line?.length || 0) + (filters.lead_offering?.length || 0)}
              </span>
            )}
          </button>
          
          {/* Active Filter Summary */}
          {(filters.stage?.length || filters.category?.length || filters.service_line?.length || filters.lead_offering?.length) && (
            <div className="flex flex-wrap gap-2 items-center">
              {filters.stage?.map(stage => (
                <span key={`stage-${stage}`} className="bg-dxc-bright-purple text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  Stage: {SALES_STAGES.find(s => s.code === stage)?.code || stage}
                  <span 
                    onClick={() => handleFilterChange('stage', filters.stage?.filter(s => s !== stage) || [])}
                    className="hover:bg-dxc-dark-purple rounded-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFilterChange('stage', filters.stage?.filter(s => s !== stage) || []);
                      }
                    }}
                  >
                    ×
                  </span>
                </span>
              ))}
              {filters.category?.map(category => (
                <span key={`category-${category}`} className="bg-dxc-blue text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {category}
                  <span 
                    onClick={() => handleFilterChange('category', filters.category?.filter(c => c !== category) || [])}
                    className="hover:bg-blue-700 rounded-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFilterChange('category', filters.category?.filter(c => c !== category) || []);
                      }
                    }}
                  >
                    ×
                  </span>
                </span>
              ))}
              {filters.service_line?.map(serviceLine => (
                <span key={`service-${serviceLine}`} className="bg-dxc-green text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {serviceLine}
                  <span 
                    onClick={() => handleFilterChange('service_line', filters.service_line?.filter(s => s !== serviceLine) || [])}
                    className="hover:bg-green-700 rounded-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFilterChange('service_line', filters.service_line?.filter(s => s !== serviceLine) || []);
                      }
                    }}
                  >
                    ×
                  </span>
                </span>
              ))}
              {filters.lead_offering?.map(leadOffering => (
                <span key={`lead-${leadOffering}`} className="bg-dxc-orange text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  Lead: {leadOffering}
                  <span 
                    onClick={() => handleFilterChange('lead_offering', filters.lead_offering?.filter(l => l !== leadOffering) || [])}
                    className="hover:bg-orange-700 rounded-full cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFilterChange('lead_offering', filters.lead_offering?.filter(l => l !== leadOffering) || []);
                      }
                    }}
                  >
                    ×
                  </span>
                </span>
              ))}
              <button
                onClick={clearFilters}
                className="text-dxc-purple hover:text-dxc-purple/80 text-sm underline"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dxc-light-gray">
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Stage
              </label>
              <MultiSelect
                options={SALES_STAGES.map((stage): MultiSelectOption => ({
                  value: stage.code,
                  label: stage.label
                }))}
                selected={filters.stage || []}
                onChange={(values) => handleFilterChange('stage', values)}
                placeholder="All Stages"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Category
              </label>
              <MultiSelect
                options={[
                  ...(categories?.map((category): MultiSelectOption => ({
                    value: category.name,
                    label: category.name
                  })) || []),
                  { value: 'Uncategorized', label: 'Uncategorized' }
                ]}
                selected={filters.category || []}
                onChange={(values) => handleFilterChange('category', values)}
                placeholder="All Categories"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Service Line
              </label>
              <MultiSelect
                options={SERVICE_LINES.map((serviceLine): MultiSelectOption => ({
                  value: serviceLine,
                  label: serviceLine
                }))}
                selected={filters.service_line || []}
                onChange={(values) => handleFilterChange('service_line', values)}
                placeholder="All Service Lines"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Lead Offering
              </label>
              <MultiSelect
                options={SERVICE_LINES.map((serviceLine): MultiSelectOption => ({
                  value: serviceLine,
                  label: serviceLine
                }))}
                selected={filters.lead_offering || []}
                onChange={(values) => handleFilterChange('lead_offering', values)}
                placeholder="All Lead Offerings"
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="tabs flex">
        {[
          { key: 'overview', label: 'Portfolio Overview', icon: BarChart3 },
          { key: 'forecast', label: 'Revenue Timeline', icon: TrendingUp },
          { key: 'resources', label: 'Resource Forecast', icon: Users },
          { key: 'timeline', label: 'Stage Planning', icon: Calendar }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as 'overview' | 'forecast' | 'resources' | 'timeline')}
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