import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, BarChart3, Layers, AlertCircle, DollarSign } from 'lucide-react';
import { useAllOpportunities } from '../../hooks/useAllOpportunities';
import { DXC_COLORS, SERVICE_LINES, type ServiceLine } from '../../types/index.js';
import LoadingSpinner from '../LoadingSpinner';

type ChartType = 'line' | 'bar' | 'area';
type TimePeriod = 'week' | 'month' | 'quarter';

interface TCVServiceLineTimelineChartProps {
  className?: string;
  filters?: {
    stage?: string | string[];
    category?: string | string[];
    service_line?: string | string[];
    lead_offering?: string | string[];
  };
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}

interface TCVTimelineDataPoint {
  period: string;
  total: number;
  CES: number;
  INS: number;
  BPS: number;
  SEC: number;
  ITOC: number;
  MW: number;
}

const TCVServiceLineTimelineChart: React.FC<TCVServiceLineTimelineChartProps> = ({ 
  className = '', 
  filters 
}) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [dateRange, setDateRange] = useState<'3m' | '6m' | '12m' | 'all'>('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  // Get ALL opportunities data with current filters (no pagination limits)
  const { data: opportunities, isLoading, error } = useAllOpportunities(filters);

  // Service line colors mapping
  const serviceLineColors: Record<ServiceLine, string> = {
    'CES': DXC_COLORS[0], // Bright Purple
    'INS': DXC_COLORS[1], // Bright Teal
    'BPS': DXC_COLORS[2], // Blue
    'SEC': DXC_COLORS[6], // Gold
    'ITOC': DXC_COLORS[4], // Green
    'MW': DXC_COLORS[5], // Orange
  };

  // Process opportunities data into TCV timeline
  const chartData = useMemo((): TCVTimelineDataPoint[] => {
    if (!opportunities || opportunities.length === 0) return [];

    // Group opportunities by time period based on decision_date
    const timeGroups: Record<string, TCVTimelineDataPoint & { sortKey: string }> = {};

    opportunities.forEach(opp => {
      if (!opp.decision_date) return;

      const decisionDate = new Date(opp.decision_date);
      let periodKey: string;
      let sortKey: string;

      // Generate period key and sort key based on selected time period
      switch (timePeriod) {
        case 'week': {
          // Get week number of the year
          const startOfYear = new Date(decisionDate.getFullYear(), 0, 1);
          const dayOfYear = Math.floor((decisionDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
          const weekOfYear = Math.ceil((dayOfYear - decisionDate.getDay() + 10) / 7);
          periodKey = `W${weekOfYear} ${decisionDate.getFullYear()}`;
          // Sort key: YYYY-WW format for proper chronological sorting
          sortKey = `${decisionDate.getFullYear()}-${weekOfYear.toString().padStart(2, '0')}`;
          break;
        }
        case 'quarter': {
          const quarter = Math.floor(decisionDate.getMonth() / 3) + 1;
          periodKey = `Q${quarter} ${decisionDate.getFullYear()}`;
          // Sort key: YYYY-Q format for proper chronological sorting
          sortKey = `${decisionDate.getFullYear()}-${quarter}`;
          break;
        }
        case 'month':
        default: {
          periodKey = decisionDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          // Sort key: YYYY-MM format for proper chronological sorting
          sortKey = `${decisionDate.getFullYear()}-${(decisionDate.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        }
      }

      // Filter by date range if needed
      let includeInRange = true;
      
      if (dateRange !== 'all') {
        const monthsBack = dateRange === '3m' ? 3 : dateRange === '6m' ? 6 : 12;
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
        includeInRange = decisionDate >= cutoffDate;
      }

      if (!includeInRange) return;

      // Initialize period group if it doesn't exist
      if (!timeGroups[periodKey]) {
        timeGroups[periodKey] = {
          period: periodKey,
          sortKey,
          total: 0,
          CES: 0,
          INS: 0,
          BPS: 0,
          SEC: 0,
          ITOC: 0,
          MW: 0,
        };
      }

      // Add TCV values for each service line (values are already in millions)
      const group = timeGroups[periodKey];
      
      // Check if there's any explicit service line TCV data
      const hasServiceLineTCV = (opp.ces_millions && opp.ces_millions > 0) ||
                               (opp.ins_millions && opp.ins_millions > 0) ||
                               (opp.bps_millions && opp.bps_millions > 0) ||
                               (opp.sec_millions && opp.sec_millions > 0) ||
                               (opp.itoc_millions && opp.itoc_millions > 0) ||
                               (opp.mw_millions && opp.mw_millions > 0);
      
      if (hasServiceLineTCV) {
        // Use explicit service line TCV values from opportunity
        group.CES += opp.ces_millions || 0;
        group.INS += opp.ins_millions || 0;
        group.BPS += opp.bps_millions || 0;
        group.SEC += opp.sec_millions || 0;
        group.ITOC += opp.itoc_millions || 0;
        group.MW += opp.mw_millions || 0;
        
        // Use the sum of service line TCV as the total for this opportunity
        const serviceLineTCVSum = (opp.ces_millions || 0) + (opp.ins_millions || 0) + 
                                 (opp.bps_millions || 0) + (opp.sec_millions || 0) + 
                                 (opp.itoc_millions || 0) + (opp.mw_millions || 0);
        group.total += serviceLineTCVSum;
      } else {
        // No service line TCV data, use lead offering and opportunity TCV
        const leadOffering = opp.lead_offering_l1;
        const totalOpportunityTCV = opp.tcv_millions || 0;
        
        if (leadOffering && SERVICE_LINES.includes(leadOffering as ServiceLine) && totalOpportunityTCV > 0) {
          // Assign all opportunity TCV to the lead offering service line
          switch (leadOffering as ServiceLine) {
            case 'CES':
              group.CES += totalOpportunityTCV;
              break;
            case 'INS':
              group.INS += totalOpportunityTCV;
              break;
            case 'BPS':
              group.BPS += totalOpportunityTCV;
              break;
            case 'SEC':
              group.SEC += totalOpportunityTCV;
              break;
            case 'ITOC':
              group.ITOC += totalOpportunityTCV;
              break;
            case 'MW':
              group.MW += totalOpportunityTCV;
              break;
          }
          group.total += totalOpportunityTCV;
        } else if (totalOpportunityTCV > 0) {
          // No lead offering mapping, just add to total without service line breakdown
          group.total += totalOpportunityTCV;
        }
      }
    });

    // Convert to array and sort chronologically using sortKey
    const result = Object.values(timeGroups)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey, ...data }) => data); // Remove sortKey from final result

    return result;
  }, [opportunities, timePeriod, dateRange]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!opportunities) return null;

    const totalOpportunities = opportunities.length;
    let totalTCV = 0;
    let opportunitiesWithTCV = 0;
    
    opportunities.forEach(opp => {
      // Check if there's any explicit service line TCV data
      const hasServiceLineTCV = (opp.ces_millions && opp.ces_millions > 0) ||
                               (opp.ins_millions && opp.ins_millions > 0) ||
                               (opp.bps_millions && opp.bps_millions > 0) ||
                               (opp.sec_millions && opp.sec_millions > 0) ||
                               (opp.itoc_millions && opp.itoc_millions > 0) ||
                               (opp.mw_millions && opp.mw_millions > 0);
      
      if (hasServiceLineTCV) {
        // Use sum of service line TCV
        const serviceLineTCVSum = (opp.ces_millions || 0) + (opp.ins_millions || 0) + 
                                 (opp.bps_millions || 0) + (opp.sec_millions || 0) + 
                                 (opp.itoc_millions || 0) + (opp.mw_millions || 0);
        totalTCV += serviceLineTCVSum;
        if (serviceLineTCVSum > 0) opportunitiesWithTCV++;
      } else if (opp.tcv_millions && opp.tcv_millions > 0) {
        // Use opportunity TCV only when no service line data
        totalTCV += opp.tcv_millions;
        opportunitiesWithTCV++;
      }
    });
    
    const avgDealSize = opportunitiesWithTCV > 0 ? totalTCV / opportunitiesWithTCV : 0;

    return {
      totalOpportunities,
      totalTCV,
      avgDealSize,
      opportunitiesWithTCV
    };
  }, [opportunities]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + 'M';
  };

  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-dxc-gray">
          <AlertCircle className="w-12 h-12 mb-3" />
          <p className="text-center">No TCV timeline data available</p>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Opportunities need decision dates and TCV values to display timeline data
          </p>
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    const commonAxisProps = {
      xAxis: <XAxis dataKey="period" tick={{ fontSize: 12 }} />,
      yAxis: <YAxis tick={{ fontSize: 12 }} label={{ value: 'TCV ($M)', angle: -90, position: 'insideLeft' }} />,
      grid: <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />,
      tooltip: (
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #D9D9D6',
            borderRadius: '8px',
          }}
          formatter={(value: number, name: string) => [
            formatCurrency(value), 
            name === 'total' ? 'Total TCV' : name
          ]}
        />
      ),
      legend: <Legend wrapperStyle={{ paddingTop: '20px' }} />,
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            {commonAxisProps.legend}
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke={DXC_COLORS[0]} 
              name="Total TCV"
              strokeWidth={3}
              strokeDasharray="5 5"
            />
            {SERVICE_LINES.map(serviceLine => (
              <Line
                key={serviceLine}
                type="monotone"
                dataKey={serviceLine}
                stroke={serviceLineColors[serviceLine]}
                name={serviceLine}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            {commonAxisProps.legend}
            {SERVICE_LINES.map(serviceLine => (
              <Bar
                key={serviceLine}
                dataKey={serviceLine}
                stackId="a"
                fill={serviceLineColors[serviceLine]}
                name={serviceLine}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            {commonAxisProps.legend}
            {SERVICE_LINES.map(serviceLine => (
              <Area
                key={serviceLine}
                type="monotone"
                dataKey={serviceLine}
                stackId="1"
                stroke={serviceLineColors[serviceLine]}
                fill={serviceLineColors[serviceLine]}
                fillOpacity={0.6}
                name={serviceLine}
              />
            ))}
          </AreaChart>
        );
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
        <LoadingSpinner text="Loading complete TCV dataset..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
        <div className="text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Error loading TCV timeline</p>
          <p className="text-sm text-gray-500 mt-2">
            {error.message.includes('422') || error.message.includes('Unprocessable') 
              ? 'Note: Using limited data due to API constraints. Some results may be incomplete.' 
              : 'Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <DollarSign className="w-6 h-6 text-dxc-bright-purple" />
          <h3 className="text-xl font-semibold text-dxc-dark-gray">TCV Service Line Timeline</h3>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {/* Time Period Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['week', 'month', 'quarter'] as const).map(period => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-white text-dxc-bright-purple shadow-sm'
                    : 'text-dxc-gray hover:text-dxc-dark-gray'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}s
              </button>
            ))}
          </div>

          {/* Date Range Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['3m', '6m', '12m', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-white text-dxc-bright-purple shadow-sm'
                    : 'text-dxc-gray hover:text-dxc-dark-gray'
                }`}
              >
                {range === 'all' ? 'All' : range.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded transition-colors ${
                chartType === 'line'
                  ? 'bg-white text-dxc-bright-purple shadow-sm'
                  : 'text-dxc-gray hover:text-dxc-dark-gray'
              }`}
              title="Line Chart"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded transition-colors ${
                chartType === 'bar'
                  ? 'bg-white text-dxc-bright-purple shadow-sm'
                  : 'text-dxc-gray hover:text-dxc-dark-gray'
              }`}
              title="Bar Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-2 rounded transition-colors ${
                chartType === 'area'
                  ? 'bg-white text-dxc-bright-purple shadow-sm'
                  : 'text-dxc-gray hover:text-dxc-dark-gray'
              }`}
              title="Area Chart"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Total Opportunities</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {summaryStats.totalOpportunities}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Total TCV</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {formatCurrency(summaryStats.totalTCV)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Avg Deal Size</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {formatCurrency(summaryStats.avgDealSize)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">With TCV Data</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {summaryStats.opportunitiesWithTCV}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TCVServiceLineTimelineChart;