import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Target, DollarSign, Percent } from 'lucide-react';
import { useServiceLineForecast } from '../../hooks/useForecasts';
import { useSMERules } from '../../hooks/useConfig';
import { SERVICE_LINES, DXC_COLORS } from '../../types/index';
import LoadingSpinner from '../LoadingSpinner';

const ServiceLineAllocationTab: React.FC = () => {
  const [selectedServiceLine, setSelectedServiceLine] = useState<string>('');
  const [allocationView, setAllocationView] = useState<'current' | 'projected'>('current');

  const { data: serviceLineForecast, isLoading: forecastLoading } = useServiceLineForecast();
  const { data: smeRules, isLoading: smeLoading } = useSMERules();

  const isLoading = forecastLoading || smeLoading;

  if (isLoading) {
    return <LoadingSpinner text="Loading service line allocation data..." />;
  }

  // Calculate allocation data
  const allocationData = SERVICE_LINES.map((serviceLine, index) => {
    const revenue = serviceLineForecast?.service_line_totals[serviceLine] || 0;
    const percentage = serviceLineForecast?.service_line_percentages[serviceLine] || 0;
    const smeRequirement = smeRules?.find(rule => rule.service_line === serviceLine)?.effort_per_million || 0;
    const estimatedSMEWeeks = (revenue / 1000000) * smeRequirement;
    
    return {
      serviceLine,
      revenue,
      percentage,
      smeRequirement,
      estimatedSMEWeeks,
      fill: DXC_COLORS[index % DXC_COLORS.length]
    };
  });

  // Resource allocation summary
  const resourceSummary = {
    totalRevenue: serviceLineForecast?.total_revenue || 0,
    totalSMEWeeks: allocationData.reduce((sum, item) => sum + item.estimatedSMEWeeks, 0),
    averageSMERate: allocationData.reduce((sum, item) => sum + item.smeRequirement, 0) / SERVICE_LINES.length,
    mostResourceIntensive: allocationData.reduce((max, item) => 
      item.estimatedSMEWeeks > max.estimatedSMEWeeks ? item : max, allocationData[0]
    )
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-dxc-subtitle font-semibold">Service Line Allocation</h3>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Analyze resource allocation and SME requirements across service lines
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={allocationView}
            onChange={(e) => setAllocationView(e.target.value as 'current' | 'projected')}
            className="input"
          >
            <option value="current">Current Allocation</option>
            <option value="projected">Projected Allocation</option>
          </select>
          <select
            value={selectedServiceLine}
            onChange={(e) => setSelectedServiceLine(e.target.value)}
            className="input"
          >
            <option value="">All Service Lines</option>
            {SERVICE_LINES.map((line) => (
              <option key={line} value={line}>{line}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-dxc-subtitle text-dxc-dark-gray">Total Revenue</h4>
              <p className="text-2xl font-bold text-dxc-bright-purple">
                {formatCurrency(resourceSummary.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-dxc-bright-purple" />
          </div>
        </div>
        
        <div className="card bg-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-dxc-subtitle text-dxc-dark-gray">SME Weeks Required</h4>
              <p className="text-2xl font-bold text-dxc-blue">
                {Math.round(resourceSummary.totalSMEWeeks)}
              </p>
            </div>
            <Users className="w-8 h-8 text-dxc-blue" />
          </div>
        </div>
        
        <div className="card bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-dxc-subtitle text-dxc-dark-gray">Avg SME Rate</h4>
              <p className="text-2xl font-bold text-dxc-green">
                {resourceSummary.averageSMERate.toFixed(2)}
              </p>
            </div>
            <Percent className="w-8 h-8 text-dxc-green" />
          </div>
        </div>
        
        <div className="card bg-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-dxc-subtitle text-dxc-dark-gray">Most Resource Intensive</h4>
              <p className="text-2xl font-bold text-amber-700">
                {resourceSummary.mostResourceIntensive.serviceLine}
              </p>
            </div>
            <Target className="w-8 h-8 text-amber-700" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Resource Allocation */}
        <div className="card">
          <h4 className="font-semibold mb-4">Revenue vs SME Resource Allocation</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={allocationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis dataKey="serviceLine" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'revenue') return [formatCurrency(Number(value)), 'Revenue'];
                  if (name === 'estimatedSMEWeeks') return [`${Number(value).toFixed(1)} weeks`, 'SME Effort'];
                  return [value, name];
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #D9D9D6',
                  borderRadius: '8px',
                }}
              />
              <Bar yAxisId="left" dataKey="revenue" fill="#5F249F" name="revenue" />
              <Bar yAxisId="right" dataKey="estimatedSMEWeeks" fill="#00968F" name="estimatedSMEWeeks" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service Line Distribution */}
        <div className="card">
          <h4 className="font-semibold mb-4">Service Line Revenue Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="revenue"
                label={({ serviceLine, percentage }) => `${serviceLine} (${percentage.toFixed(1)}%)`}
                labelLine={false}
              >
                {allocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Allocation Table */}
      <div className="card">
        <h4 className="font-semibold mb-4">Detailed Service Line Allocation</h4>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Service Line</th>
                <th>Revenue</th>
                <th>Market Share</th>
                <th>SME Rate (per $1M)</th>
                <th>Est. SME Weeks</th>
                <th>Resource Intensity</th>
              </tr>
            </thead>
            <tbody>
              {allocationData
                .sort((a, b) => b.revenue - a.revenue)
                .map((item) => (
                  <tr key={item.serviceLine}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="font-semibold">{item.serviceLine}</span>
                      </div>
                    </td>
                    <td className="font-medium text-dxc-bright-purple">
                      {formatCurrency(item.revenue)}
                    </td>
                    <td>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="font-medium text-dxc-blue">
                      {item.smeRequirement.toFixed(2)}
                    </td>
                    <td className="font-medium text-dxc-green">
                      {item.estimatedSMEWeeks.toFixed(1)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-dxc-bright-purple h-2 rounded-full"
                            style={{ 
                              width: `${Math.min(100, (item.estimatedSMEWeeks / Math.max(...allocationData.map(d => d.estimatedSMEWeeks))) * 100)}%` 
                            }}
                          />
                        </div>
                        <span className="text-xs text-dxc-medium-gray">
                          {((item.estimatedSMEWeeks / resourceSummary.totalSMEWeeks) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-amber-50 border border-amber-200 rounded-dxc p-4">
        <h4 className="font-semibold text-amber-900 mb-2">Resource Allocation Insights</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• <strong>{resourceSummary.mostResourceIntensive.serviceLine}</strong> requires the most SME resources ({resourceSummary.mostResourceIntensive.estimatedSMEWeeks.toFixed(1)} weeks)</li>
          <li>• Total SME capacity needed: <strong>{Math.round(resourceSummary.totalSMEWeeks)} weeks</strong> across all service lines</li>
          <li>• Average SME allocation rate: <strong>{resourceSummary.averageSMERate.toFixed(2)} weeks per $1M</strong> revenue</li>
          <li>• Consider load balancing between high-intensity service lines for optimal resource utilization</li>
        </ul>
      </div>
    </div>
  );
};

export default ServiceLineAllocationTab;