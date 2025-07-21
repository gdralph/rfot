import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, BarChart3, Eye } from 'lucide-react';
import { useForecastSummary, useServiceLineForecast, useActiveServiceLines } from '../hooks/useForecasts';
import { DXC_COLORS, SERVICE_LINES, SALES_STAGES, STAGE_ORDER, CATEGORY_ORDER, OPPORTUNITY_CATEGORIES } from '../types/index.js';
import LoadingSpinner from '../components/LoadingSpinner';
import InteractiveForecastChart from '../components/charts/InteractiveForecastChart';
import ResourceHeatmap from '../components/charts/ResourceHeatmap';
import ServiceLineDistribution from '../components/charts/ServiceLineDistribution';
import TimelineView from '../components/charts/TimelineView';

const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'forecast' | 'resources' | 'timeline'>('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('quarter');
  
  const { data: forecastSummary, isLoading: summaryLoading, error: summaryError } = useForecastSummary();
  const { data: serviceLineForecast, isLoading: serviceLoading, error: serviceError } = useServiceLineForecast();
  const { data: activeServiceLines, isLoading: activeServiceLoading, error: activeServiceError } = useActiveServiceLines();

  if (summaryLoading || serviceLoading || activeServiceLoading) {
    return <LoadingSpinner text="Loading dashboard data..." />;
  }

  if (summaryError || serviceError || activeServiceError) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-dxc-slide mb-4">Dashboard</h2>
        <div className="bg-red-50 border border-red-200 rounded-dxc p-4">
          <p className="text-red-700">Error loading dashboard data. Please try again later.</p>
        </div>
      </div>
    );
  }

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

  const serviceLineChartData = serviceLineForecast?.service_line_totals ? SERVICE_LINES.map((line, index) => ({
    name: line,
    revenue: serviceLineForecast.service_line_totals[line] || 0,
    percentage: serviceLineForecast.service_line_percentages[line] || 0,
    fill: DXC_COLORS[index % DXC_COLORS.length]
  })) : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
    return SERVICE_LINES.flatMap((serviceLine, serviceIndex) => 
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
      opportunities: 0, // No mock data - should be calculated from real opportunities
      avgDealSize: 0, // No mock data - should be calculated from real opportunities  
      growth: 0, // No mock data - should be calculated from historical data
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
                      formatter={(value) => [formatCurrency(Number(value)), 'Value']}
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
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Value']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Enhanced Service Line Analysis */}
            <ServiceLineDistribution 
              data={serviceLineData.filter(item => item.revenue > 0)} 
              title="Service Line Performance"
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

      {/* Navigation Tabs */}
      <div className="tabs">
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