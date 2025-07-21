import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useForecastSummary, useServiceLineForecast } from '../hooks/useForecasts';
import { DXC_COLORS, SERVICE_LINES, SALES_STAGES, STAGE_ORDER, CATEGORY_ORDER, OPPORTUNITY_CATEGORIES } from '../types/index.js';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard: React.FC = () => {
  const { data: forecastSummary, isLoading: summaryLoading, error: summaryError } = useForecastSummary();
  const { data: serviceLineForecast, isLoading: serviceLoading, error: serviceError } = useServiceLineForecast();

  if (summaryLoading || serviceLoading) {
    return <LoadingSpinner text="Loading dashboard data..." />;
  }

  if (summaryError || serviceError) {
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

  const serviceLineData = serviceLineForecast?.service_line_totals ? SERVICE_LINES.map((line, index) => ({
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-dxc-section mb-2">Dashboard</h1>
        <p className="text-dxc-dark-gray">Resource Forecasting & Opportunity Overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <h3 className="text-dxc-subtitle mb-2">Total Opportunities</h3>
          <p className="text-3xl font-bold text-dxc-bright-purple">
            {formatNumber(forecastSummary?.total_opportunities || 0)}
          </p>
        </div>
        
        <div className="card">
          <h3 className="text-dxc-subtitle mb-2">Total Value</h3>
          <p className="text-3xl font-bold text-dxc-bright-teal">
            {formatCurrency(forecastSummary?.total_value || 0)}
          </p>
        </div>
        
        <div className="card">
          <h3 className="text-dxc-subtitle mb-2">Average Value</h3>
          <p className="text-3xl font-bold text-dxc-blue">
            {formatCurrency(forecastSummary?.average_value || 0)}
          </p>
        </div>
        
        <div className="card">
          <h3 className="text-dxc-subtitle mb-2">Service Lines</h3>
          <p className="text-3xl font-bold text-dxc-green">
            {SERVICE_LINES.length}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stage Breakdown */}
        <div className="card">
          <h3 className="text-dxc-subtitle mb-6">Opportunities by Stage</h3>
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
        <div className="card">
          <h3 className="text-dxc-subtitle mb-6">Opportunities by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
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

      {/* Service Line Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service Line Revenue Chart */}
        <div className="card">
          <h3 className="text-dxc-subtitle mb-6">Revenue by Service Line</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  name === 'revenue' ? formatCurrency(Number(value)) : `${Number(value).toFixed(1)}%`,
                  name === 'revenue' ? 'Revenue' : 'Percentage'
                ]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #D9D9D6',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service Line Distribution */}
        <div className="card">
          <h3 className="text-dxc-subtitle mb-6">Service Line Distribution</h3>
          <div className="space-y-4">
            {serviceLineData.map((line, index) => (
              <div key={line.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-dxc">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: line.fill }}
                  />
                  <span className="font-medium text-dxc-dark-gray">{line.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-dxc-bright-purple">
                    {formatCurrency(line.revenue)}
                  </div>
                  <div className="text-sm text-dxc-medium-gray">
                    {line.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;