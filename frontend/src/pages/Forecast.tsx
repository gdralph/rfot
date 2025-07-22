import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area, AreaChart } from 'recharts';
import { TrendingUp, Users, DollarSign, Target, Clock, Zap } from 'lucide-react';
import { useForecastSummary, useServiceLineForecast } from '../hooks/useForecasts';
import { useCategories } from '../hooks/useConfig';
import { DXC_COLORS, SERVICE_LINES, SALES_STAGES, OPPORTUNITY_CATEGORIES } from '../types/index';
import LoadingSpinner from '../components/LoadingSpinner';

type TimeRange = 'week' | 'month' | 'quarter' | 'year';
type ViewType = 'revenue' | 'opportunities' | 'resource' | 'timeline';

const Forecast: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('quarter');
  const [viewType, setViewType] = useState<ViewType>('revenue');
  const [selectedServiceLine, setSelectedServiceLine] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const { data: forecastSummary, isLoading: summaryLoading } = useForecastSummary({
    stage: selectedStage || undefined,
    category: selectedCategory || undefined
  });
  
  const { data: serviceLineForecast, isLoading: serviceLoading } = useServiceLineForecast({
    service_line: selectedServiceLine || undefined
  });
  
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const isLoading = summaryLoading || serviceLoading || categoriesLoading;

  if (isLoading) {
    return <LoadingSpinner text="Loading forecast data..." />;
  }

  // Generate mock time series data for demonstration
  const generateTimeSeriesData = () => {
    const periods = timeRange === 'week' ? 12 : timeRange === 'month' ? 12 : timeRange === 'quarter' ? 4 : 3;
    const baseValue = (forecastSummary?.total_value || 1000000) / periods;
    
    return Array.from({ length: periods }, (_, i) => {
      const variance = 0.8 + Math.random() * 0.4; // Random variance between 0.8 and 1.2
      return {
        period: timeRange === 'week' ? `Week ${i + 1}` :
                timeRange === 'month' ? `Month ${i + 1}` :
                timeRange === 'quarter' ? `Q${i + 1}` : `Year ${2024 + i}`,
        value: Math.round(baseValue * variance),
        opportunities: Math.round((forecastSummary?.total_opportunities || 100) / periods * variance),
        target: Math.round(baseValue * 1.1), // 10% growth target
        actual: i < periods - 2 ? Math.round(baseValue * variance * 0.95) : null
      };
    });
  };

  const timeSeriesData = generateTimeSeriesData();

  // Resource allocation data (simplified without stage efforts)
  const resourceAllocationData = categories?.map((category, index) => {
    // Provide stub data since stage efforts were removed
    const totalEffort = Math.random() * 50 + 10; // Random effort for demo
    const totalDuration = Math.random() * 20 + 5; // Random duration for demo
    
    return {
      name: category.name,
      effort: totalEffort,
      duration: totalDuration,
      opportunities: Math.round(Math.random() * 50 + 10), // Mock data
      fill: DXC_COLORS[index % DXC_COLORS.length]
    };
  }) || [];

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

  const getKPICards = () => {
    const totalValue = forecastSummary?.total_value || 0;
    // const totalOpportunities = forecastSummary?.total_opportunities || 0;
    // const avgValue = forecastSummary?.average_value || 0;
    const completionRate = 0.73; // Mock data
    
    return [
      {
        title: 'Total Pipeline Value',
        value: formatCurrency(totalValue),
        icon: DollarSign,
        color: 'text-dxc-bright-purple',
        bgColor: 'bg-purple-50'
      },
      {
        title: 'Win Rate Forecast',
        value: `${(completionRate * 100).toFixed(1)}%`,
        icon: Target,
        color: 'text-dxc-green',
        bgColor: 'bg-green-50'
      },
      {
        title: 'Resource Utilization',
        value: '87%',
        icon: Users,
        color: 'text-dxc-blue',
        bgColor: 'bg-blue-50'
      },
      {
        title: 'Avg Deal Cycle',
        value: '14.2 weeks',
        icon: Clock,
        color: 'text-dxc-bright-teal',
        bgColor: 'bg-teal-50'
      }
    ];
  };

  const renderChart = () => {
    switch (viewType) {
      case 'revenue':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === 'number' ? formatCurrency(value) : value,
                  name === 'value' ? 'Forecast' : name === 'target' ? 'Target' : 'Actual'
                ]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #D9D9D6',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" fill="#5F249F" name="Forecast" />
              <Line type="monotone" dataKey="target" stroke="#00968F" strokeWidth={2} name="Target" />
              {timeSeriesData.some(d => d.actual) && (
                <Line type="monotone" dataKey="actual" stroke="#6CC24A" strokeWidth={2} name="Actual" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'opportunities':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [formatNumber(Number(value)), 'Opportunities']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #D9D9D6',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="opportunities"
                stroke="#00A3E1"
                fill="#00A3E1"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'resource':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={resourceAllocationData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
              <Tooltip
                formatter={(value, name) => [
                  `${value} weeks`,
                  name === 'effort' ? 'Total Effort' : 'Avg Duration'
                ]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #D9D9D6',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="effort" name="Total Effort" />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-center py-8 text-dxc-medium-gray">Chart type not implemented</div>;
    }
  };

  const kpiCards = getKPICards();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-dxc-bright-purple" />
          <div>
            <h1 className="text-dxc-section mb-1">Advanced Forecasting</h1>
            <p className="text-dxc-dark-gray">Revenue forecasting, resource planning, and performance analytics</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-dxc shadow-sm border border-dxc-light-gray p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-2">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="input w-full"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </div>

          {/* View Type */}
          <div>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-2">View Type</label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
              className="input w-full"
            >
              <option value="revenue">Revenue Forecast</option>
              <option value="opportunities">Opportunity Volume</option>
              <option value="resource">Resource Allocation</option>
            </select>
          </div>

          {/* Service Line Filter */}
          <div>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-2">Service Line</label>
            <select
              value={selectedServiceLine}
              onChange={(e) => setSelectedServiceLine(e.target.value)}
              className="input w-full"
            >
              <option value="">All Service Lines</option>
              {SERVICE_LINES.map((line) => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-2">Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="input w-full"
            >
              <option value="">All Stages</option>
              {SALES_STAGES.map((stage) => (
                <option key={stage.code} value={stage.code}>{stage.code}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input w-full"
            >
              <option value="">All Categories</option>
              {OPPORTUNITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <div key={index} className={`card ${kpi.bgColor}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-dxc-subtitle mb-2 text-dxc-dark-gray">{kpi.title}</h3>
                  <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
                <IconComponent className={`w-8 h-8 ${kpi.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Chart */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-dxc-bright-purple" />
          <h3 className="text-dxc-subtitle font-semibold">
            {viewType === 'revenue' && 'Revenue Forecast Analysis'}
            {viewType === 'opportunities' && 'Opportunity Volume Trends'}
            {viewType === 'resource' && 'Resource Allocation by Category'}
            {viewType === 'timeline' && 'Timeline Analysis'}
          </h3>
        </div>
        {renderChart()}
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Line Breakdown */}
        <div className="card">
          <h3 className="text-dxc-subtitle mb-4 font-semibold">
            {selectedServiceLine ? `${selectedServiceLine} Service Line Analysis` : 'Service Line Performance'}
          </h3>
          
          {selectedServiceLine && serviceLineForecast?.filtered_service_line ? (
            // Detailed view for selected service line
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-dxc">
                  <div className="text-2xl font-bold text-dxc-bright-purple">
                    {formatCurrency(serviceLineForecast.filtered_service_line.revenue)}
                  </div>
                  <div className="text-sm text-dxc-medium-gray">Total Revenue</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-dxc">
                  <div className="text-2xl font-bold text-dxc-blue">
                    {serviceLineForecast.filtered_service_line.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-dxc-medium-gray">Market Share</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-dxc">
                  <div className="text-2xl font-bold text-dxc-green">
                    {Math.round((serviceLineForecast.filtered_service_line.revenue / (forecastSummary?.average_value || 1000000)))}
                  </div>
                  <div className="text-sm text-dxc-medium-gray">Est. Opportunities</div>
                </div>
              </div>
              
              {/* Service line specific forecasting chart */}
              <div>
                <h4 className="font-semibold mb-3">Growth Projection - {selectedServiceLine}</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'Projected Revenue']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #D9D9D6',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#5F249F" 
                      strokeWidth={3}
                      dot={{ fill: '#5F249F', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            // Overview of all service lines
            serviceLineForecast?.service_line_totals && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={SERVICE_LINES.map((line, index) => ({
                      name: line,
                      value: serviceLineForecast.service_line_totals[line] || 0,
                      fill: DXC_COLORS[index % DXC_COLORS.length]
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {SERVICE_LINES.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DXC_COLORS[index % DXC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            )
          )}
        </div>

        {/* Resource Planning */}
        <div className="card">
          <h3 className="text-dxc-subtitle mb-4 font-semibold">Resource Planning Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-dxc">
              <span className="text-dxc-dark-gray">Total Resource Weeks Required</span>
              <span className="font-semibold text-dxc-bright-purple">
                {resourceAllocationData.reduce((sum, item) => sum + item.effort, 0).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-dxc">
              <span className="text-dxc-dark-gray">Average Project Duration</span>
              <span className="font-semibold text-dxc-blue">
                {(resourceAllocationData.reduce((sum, item) => sum + item.duration, 0) / resourceAllocationData.length || 0).toFixed(1)} weeks
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-dxc">
              <span className="text-dxc-dark-gray">Resource Utilization Target</span>
              <span className="font-semibold text-dxc-green">85%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forecast;