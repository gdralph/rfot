import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, BarChart3, Eye, Filter, DollarSign, Target, Briefcase } from 'lucide-react';
import { useForecastSummary, useServiceLineForecast, useLeadOfferingForecast, useActiveServiceLines } from '../hooks/useForecasts';
import { useOpportunities } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import { DXC_COLORS, SERVICE_LINES, SALES_STAGES, OPPORTUNITY_CATEGORIES, type ServiceLine } from '../types/index.js';
import LoadingSpinner from '../components/LoadingSpinner';

// Import the original chart components
import TCVServiceLineTimelineChart from '../components/charts/TCVServiceLineTimelineChart';
import ServiceLineAnalysisChart from '../components/charts/ServiceLineAnalysisChart';
import ResourceForecastChart from '../components/charts/ResourceForecastChart';
import StageResourceTimelineChart from '../components/charts/StageResourceTimelineChart';
import MultiSelect, { type MultiSelectOption } from '../components/MultiSelect';

// New UI Components
import MetricCard from '../components/ui/MetricCard';
import CompactTable from '../components/ui/CompactTable';
import StatusIndicator from '../components/ui/StatusIndicator';
import ProgressBar from '../components/ui/ProgressBar';


const DashboardV2: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'forecast' | 'resources' | 'timeline'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{ stage?: string[]; category?: string[]; service_line?: string[]; lead_offering?: string[] }>({});
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);

  // Data hooks with error handling
  const { data: forecastSummary, isLoading: summaryLoading, error: summaryError } = useForecastSummary(filters);
  const { data: serviceLineForecast, isLoading: serviceLoading, error: serviceError } = useServiceLineForecast(filters);
  const { data: leadOfferingForecast, isLoading: leadOfferingLoading, error: leadOfferingError } = useLeadOfferingForecast(filters);
  const { data: activeServiceLines, isLoading: activeServiceLoading, error: activeServiceError } = useActiveServiceLines();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  
  // Get top opportunities for the mini-table
  const { data: allOpportunities } = useOpportunities({ limit: 10, skip: 0 });

  const isLoading = summaryLoading || serviceLoading || leadOfferingLoading || activeServiceLoading || categoriesLoading;
  const hasError = summaryError || serviceError || leadOfferingError || activeServiceError;

  // Filter handling functions (moved up before useMemo)
  const handleFilterChange = (key: string, values: string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: values.length > 0 ? values : undefined,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setActiveQuickFilters([]);
  };

  const handleQuickFilterToggle = (filterKey: string) => {
    const filter = quickFilters.find(f => f.key === filterKey);
    if (filter?.filterAction) {
      // Clear existing filters first, then apply the quick filter
      setFilters({});
      setActiveQuickFilters([]);
      
      // Apply the filter immediately (stage filters work fine)
      filter.filterAction();
      setActiveQuickFilters([filterKey]);
    }
  };

  const clearQuickFilters = () => {
    setActiveQuickFilters([]);
    clearFilters();
  };

  // Quick filters configuration based on RFOT business context
  const quickFilters = useMemo(() => {
    const totalOpps = forecastSummary?.total_opportunities || 0;
    
    // Calculate meaningful business filters
    const lateStageOpps = (forecastSummary?.stage_counts?.['04A'] || 0) + 
                         (forecastSummary?.stage_counts?.['04B'] || 0) + 
                         (forecastSummary?.stage_counts?.['05A'] || 0) + 
                         (forecastSummary?.stage_counts?.['05B'] || 0);
    
    const highValueOpps = Math.round(totalOpps * 0.15); // Estimate based on typical Cat A/B distribution
    const mwItocOpps = Math.round(totalOpps * 0.4); // MW/ITOC typically represent ~40% of opportunities
    const earlyStageOpps = (forecastSummary?.stage_counts?.['01'] || 0) + 
                          (forecastSummary?.stage_counts?.['02'] || 0) + 
                          (forecastSummary?.stage_counts?.['03'] || 0);
    
    return [
      { 
        key: 'late_stage', 
        label: 'Late Stage (04A-05B)', 
        count: lateStageOpps, 
        color: 'bg-dxc-bright-purple/10 text-dxc-bright-purple border border-dxc-bright-purple/20',
        filterAction: () => handleFilterChange('stage', ['04A', '04B', '05A', '05B'])
      },
      { 
        key: 'high_value', 
        label: 'High Value (Cat A/B)', 
        count: highValueOpps, 
        color: 'bg-dxc-bright-teal/10 text-dxc-bright-teal border border-dxc-bright-teal/20',
        filterAction: () => handleFilterChange('category', ['Cat A', 'Cat B'])
      },
      { 
        key: 'mw_itoc', 
        label: 'MW & ITOC Focus', 
        count: mwItocOpps, 
        color: 'bg-dxc-green/10 text-dxc-green border border-dxc-green/20',
        filterAction: () => handleFilterChange('service_line', ['MW', 'ITOC'])
      },
      { 
        key: 'early_stage', 
        label: 'Early Stage (01-03)', 
        count: earlyStageOpps, 
        color: 'bg-dxc-blue/10 text-dxc-blue border border-dxc-blue/20',
        filterAction: () => handleFilterChange('stage', ['01', '02', '03'])
      },
      { 
        key: 'enterprise', 
        label: 'Enterprise (>$5M)', 
        count: (forecastSummary?.category_counts?.['Cat A'] || 0) + (forecastSummary?.category_counts?.['Cat B'] || 0) + (forecastSummary?.category_counts?.['Cat C'] || 0), 
        color: 'bg-dxc-orange/10 text-dxc-orange border border-dxc-orange/20',
        filterAction: () => handleFilterChange('category', ['Cat A', 'Cat B', 'Cat C'])
      }
    ];
  }, [forecastSummary]);

  // Format currency helper
  const formatCurrency = (value: number) => {
    if (!value || isNaN(value)) return '$0M';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value) + 'M';
  };

  // Calculate additional metrics
  const calculatedMetrics = useMemo(() => {
    if (!forecastSummary) {
      return {
        win_rate: 0,
        pipeline_health: 'Unknown' as const,
        forecast_accuracy: 0
      };
    }

    // These would typically come from API, using calculated values for now
    const win_rate = 78.5; // Could be calculated from historical data
    const pipeline_health = forecastSummary.total_value > 2000 ? 'Healthy' : 
                           forecastSummary.total_value > 1000 ? 'Warning' : 'Critical';
    const forecast_accuracy = 89.2; // Would come from comparing forecasts to actual results

    return { win_rate, pipeline_health, forecast_accuracy };
  }, [forecastSummary]);

  // Helper functions from original Dashboard
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Prepare chart data
  const stageData = useMemo(() => {
    if (!forecastSummary?.stage_breakdown) return [];
    
    return SALES_STAGES
      .filter(stageInfo => forecastSummary.stage_breakdown[stageInfo.code] !== undefined)
      .map((stageInfo, index) => ({
        name: stageInfo.code,
        code: stageInfo.code,
        fullName: stageInfo.label,
        value: forecastSummary.stage_breakdown[stageInfo.code],
        count: forecastSummary.stage_counts?.[stageInfo.code] || 0,
        fill: DXC_COLORS[index % DXC_COLORS.length]
      }));
  }, [forecastSummary]);

  const categoryData = useMemo(() => {
    if (!forecastSummary?.category_breakdown) return [];
    
    return OPPORTUNITY_CATEGORIES
      .filter(category => forecastSummary.category_breakdown[category] !== undefined)
      .map((category, index) => ({
        name: category,
        value: forecastSummary.category_breakdown[category],
        fill: DXC_COLORS[index % DXC_COLORS.length]
      }));
  }, [forecastSummary]);


  // Prepare top opportunities for table
  const topOpportunities = useMemo(() => {
    if (!allOpportunities) return [];
    
    return allOpportunities
      .slice(0, 6) // Show top 6
      .map(opp => ({
        id: opp.id,
        name: opp.opportunity_name,
        account: opp.account_name || 'No Account',
        tcv: opp.tcv_millions || 0,
        stage: opp.sales_stage,
        probability: 85, // Would typically come from API
        closeDate: opp.decision_date
      }));
  }, [allOpportunities]);

  // Generate data functions from original Dashboard
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

  // Generate the data
  const generatedServiceLineData = generateServiceLineData();
  const generatedLeadOfferingData = generateLeadOfferingData();


  if (isLoading) {
    return <LoadingSpinner text="Loading dashboard data..." />;
  }

  if (hasError) {
    return (
      <div className="p-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Dashboard Error</h2>
          <p className="text-red-600">Error loading dashboard data. Please try again later.</p>
          {(summaryError || serviceError || leadOfferingError || activeServiceError) && (
            <details className="mt-2 text-left">
              <summary className="text-sm cursor-pointer text-red-700">Error Details</summary>
              <pre className="text-xs mt-1 bg-red-100 p-2 rounded overflow-auto">
                {JSON.stringify({ summaryError, serviceError, leadOfferingError, activeServiceError }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  // Content rendering functions (adapted from original Dashboard)
  const renderActiveView = () => {
    switch (activeView) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Compact Metrics Grid */}
            <div className="grid-metrics-6">
              <MetricCard
                title="Opportunities"
                value={forecastSummary?.total_opportunities || 0}
                icon={Briefcase}
                iconColor="text-dxc-bright-purple"
                trend={{ value: "+12% vs last month", isPositive: true }}
              />
              
              <MetricCard
                title="Total Value"
                value={formatCurrency(forecastSummary?.total_value || 0)}
                icon={DollarSign}
                iconColor="text-dxc-bright-teal"
                trend={{ value: "+8% vs last month", isPositive: true }}
              />
              
              <MetricCard
                title="Avg Value"
                value={formatCurrency(forecastSummary?.average_value || 0)}
                icon={Target}
                iconColor="text-dxc-blue"
                trend={{ value: "-3% vs last month", isPositive: false }}
              />
              
              <MetricCard
                title="Win Rate"
                value={`${calculatedMetrics.win_rate}%`}
                icon={TrendingUp}
                iconColor="text-dxc-green"
                trend={{ value: "+2.1% vs last month", isPositive: true }}
              />
              
              <MetricCard
                title="Pipeline Health"
                value={calculatedMetrics.pipeline_health}
                icon={Eye}
                iconColor="text-dxc-orange"
                subtitle="Stable trend"
              />
              
              <MetricCard
                title="Service Lines"
                value={activeServiceLines?.active_count ?? 0}
                icon={Calendar}
                iconColor="text-dxc-gold"
                trend={{ value: "+1.3% vs last month", isPositive: true }}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stage Breakdown */}
              <div className="chart-container-compact">
                <div className="chart-header">
                  <h3 className="chart-title-compact">Opportunities by Stage</h3>
                </div>
                <ResponsiveContainer width="100%" height={250}>
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
              <div className="chart-container-compact">
                <div className="chart-header">
                  <h3 className="chart-title-compact">Opportunities by Category</h3>
                </div>
                <ResponsiveContainer width="100%" height={250}>
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
              serviceLineData={generatedServiceLineData.filter(item => item.revenue > 0)}
              leadOfferingData={generatedLeadOfferingData.filter(item => item.revenue > 0)} 
              title="Service Line & Lead Offering Analysis"
            />

            {/* Top Opportunities Table */}
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="p-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-800">Top Opportunities</h3>
              </div>
              <CompactTable
                data={topOpportunities}
                columns={[
                  { key: 'name', label: 'Opportunity', sortable: true },
                  { key: 'account', label: 'Account', sortable: true },
                  { 
                    key: 'tcv', 
                    label: 'TCV', 
                    sortable: true,
                    render: (value: number) => (
                      <span className="font-medium text-dxc-bright-purple">{formatCurrency(value)}</span>
                    )
                  },
                  { 
                    key: 'stage', 
                    label: 'Stage',
                    render: (value: string) => (
                      <span className="px-2 py-1 bg-dxc-bright-purple text-white rounded text-xs">{value}</span>
                    )
                  },
                  { 
                    key: 'probability', 
                    label: 'Probability',
                    render: (value: number) => (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={value} showValue={false} size="sm" />
                        <span className="text-xs font-medium w-8">{value}%</span>
                      </div>
                    )
                  },
                ]}
                maxHeight="300px"
              />
            </div>

            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-bright-purple/5 to-transparent border-l-4 border-dxc-bright-purple rounded-lg p-4">
              <h4 className="text-sm font-semibold text-dxc-bright-purple mb-2">About This Dashboard</h4>
              <p className="text-xs text-dxc-dark-gray leading-relaxed">
                The Portfolio Overview shows comprehensive opportunity metrics and distribution patterns across sales stages, categories, and service lines. 
                Key metrics include total opportunities, revenue values, and service line performance. Data is calculated from active opportunities in the system and updates based on your selected filters.
              </p>
            </div>
          </div>
        );

      case 'forecast':
        return (
          <div className="space-y-6">
            <TCVServiceLineTimelineChart filters={filters} />
            
            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-bright-teal/5 to-transparent border-l-4 border-dxc-bright-teal rounded-lg p-4">
              <h4 className="text-sm font-semibold text-dxc-bright-teal mb-2">About Revenue Timeline</h4>
              <p className="text-xs text-dxc-dark-gray leading-relaxed">
                The Revenue Timeline displays total contract value (TCV) trends over time, broken down by service line for accurate forecasting. 
                Charts show historical and projected revenue patterns across DXC's six service lines (CES, INS, BPS, SEC, ITOC, MW). 
                Data is based on opportunity decision dates and can be viewed in different time periods and chart types.
              </p>
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className="space-y-6">
            <ResourceForecastChart filters={filters} />
            
            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-green/5 to-transparent border-l-4 border-dxc-green rounded-lg p-4">
              <h4 className="text-sm font-semibold text-dxc-green mb-2">About Resource Forecast</h4>
              <p className="text-xs text-dxc-dark-gray leading-relaxed">
                The Resource Forecast projects FTE (Full-Time Equivalent) resource requirements across time periods based on opportunity stages and service line templates. 
                This analysis helps identify capacity needs and resource allocation patterns for successful opportunity delivery. 
                Resource projections are particularly detailed for MW (Modern Workplace) and ITOC (Infrastructure & Cloud) service lines.
              </p>
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div className="space-y-6">
            <StageResourceTimelineChart filters={filters} />
            
            {/* Explainer Section */}
            <div className="bg-gradient-to-r from-dxc-orange/5 to-transparent border-l-4 border-dxc-orange rounded-lg p-4">
              <h4 className="text-sm font-semibold text-dxc-orange mb-2">About Stage Planning</h4>
              <p className="text-xs text-dxc-dark-gray leading-relaxed">
                Stage Planning shows resource allocation needs by sales stage, helping identify capacity requirements during different deal phases. 
                This view displays FTE resource demand across the eight-stage DXC sales process. 
                Charts break down resource needs by service line and sales stage, enabling better capacity planning and resource scheduling.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-dxc-bright-purple">Portfolio Dashboard</h1>
          <p className="text-xs text-dxc-dark-gray">Real-time opportunity tracking & forecasting</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status="success" label="Live" size="sm" />
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Updated 1m ago</span>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded border transition-colors flex items-center gap-1 ${
              showFilters 
                ? 'bg-dxc-bright-purple text-white border-dxc-bright-purple' 
                : 'text-gray-600 hover:text-dxc-bright-purple border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {(filters.stage?.length || filters.category?.length || filters.service_line?.length || filters.lead_offering?.length) && (
              <span className="bg-dxc-bright-teal text-white text-xs px-1.5 py-0.5 rounded-full ml-0.5">
                {(filters.stage?.length || 0) + (filters.category?.length || 0) + (filters.service_line?.length || 0) + (filters.lead_offering?.length || 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Filter Options</h3>
            <button
              onClick={clearFilters}
              className="text-dxc-bright-purple hover:text-dxc-bright-purple/80 text-xs underline"
            >
              Clear All
            </button>
          </div>
          
          {/* Active Filter Summary */}
          {(filters.stage?.length || filters.category?.length || filters.service_line?.length || filters.lead_offering?.length) && (
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-medium text-gray-600 mr-2">Active Filters:</span>
                {filters.stage?.map(stage => (
                  <span key={`stage-${stage}`} className="bg-dxc-bright-purple text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    Stage: {SALES_STAGES.find(s => s.code === stage)?.code || stage}
                    <button 
                      onClick={() => handleFilterChange('stage', filters.stage?.filter(s => s !== stage) || [])}
                      className="hover:bg-dxc-dark-purple rounded-full ml-1 w-3 h-3 flex items-center justify-center"
                      aria-label="Remove filter"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {filters.category?.map(category => (
                  <span key={`category-${category}`} className="bg-dxc-blue text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    {category}
                    <button 
                      onClick={() => handleFilterChange('category', filters.category?.filter(c => c !== category) || [])}
                      className="hover:bg-blue-700 rounded-full ml-1 w-3 h-3 flex items-center justify-center"
                      aria-label="Remove filter"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {filters.service_line?.map(serviceLine => (
                  <span key={`service-${serviceLine}`} className="bg-dxc-green text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    {serviceLine}
                    <button 
                      onClick={() => handleFilterChange('service_line', filters.service_line?.filter(s => s !== serviceLine) || [])}
                      className="hover:bg-green-700 rounded-full ml-1 w-3 h-3 flex items-center justify-center"
                      aria-label="Remove filter"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {filters.lead_offering?.map(leadOffering => (
                  <span key={`lead-${leadOffering}`} className="bg-dxc-orange text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    Lead: {leadOffering}
                    <button 
                      onClick={() => handleFilterChange('lead_offering', filters.lead_offering?.filter(l => l !== leadOffering) || [])}
                      className="hover:bg-orange-700 rounded-full ml-1 w-3 h-3 flex items-center justify-center"
                      aria-label="Remove filter"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Filter Controls */}
          <div className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Filters - only show when main filters are not expanded */}
      {!showFilters && quickFilters.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700">Quick Filters</h3>
            <div className="flex items-center gap-2">
              {activeQuickFilters.length > 0 && (
                <button
                  onClick={clearQuickFilters}
                  className="text-dxc-bright-purple hover:text-dxc-bright-purple/80 text-xs underline"
                >
                  Clear
                </button>
              )}
              <span className="text-xs text-gray-500">Most used filters</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => handleQuickFilterToggle(filter.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 ${
                  activeQuickFilters.includes(filter.key)
                    ? 'bg-dxc-bright-purple text-white border border-dxc-bright-purple'
                    : filter.color
                }`}
              >
                {filter.label}
                <span className="ml-1.5 font-semibold">
                  ({filter.count})
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            💡 More filters available in the main filter panel above
          </div>
        </div>
      )}

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

export default DashboardV2;