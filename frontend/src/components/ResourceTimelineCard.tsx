import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, TrendingUp, BarChart3, Layers, AlertCircle } from 'lucide-react';
import { usePortfolioResourceForecast, useTimelineDataBounds } from '../hooks/usePortfolioResourceForecast';
import { DXC_COLORS, SERVICE_LINES, type ServiceLine } from '../types/index.js';
import LoadingSpinner from './LoadingSpinner';

type ChartType = 'line' | 'bar' | 'area';
type TimePeriod = 'week' | 'month' | 'quarter';

interface ResourceTimelineCardProps {
  className?: string;
  filters?: {
    stage?: string;
    category?: string;
    service_line?: string;
    lead_offering?: string;
  };
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}

const ResourceTimelineCard: React.FC<ResourceTimelineCardProps> = ({ className = '', filters, timeRange: dashboardTimeRange }) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [dateRange, setDateRange] = useState<'3m' | '6m' | '12m' | 'all'>('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  // Get actual timeline data bounds
  const { data: dataBounds } = useTimelineDataBounds();

  // Always use local timePeriod - let users control their own view
  const effectiveTimePeriod = timePeriod;

  // Calculate date range - use actual data bounds when available, otherwise reasonable defaults
  const { startDate, endDate } = useMemo(() => {
    // Use hardcoded ranges for optimal data coverage
    let start: Date, end: Date;
    
    switch (dateRange) {
      case '3m':
        // Jul-Sep 2025 (peak resource activity period)
        start = new Date(Date.UTC(2025, 6, 1));  // July 1, 2025 (month 6 = July)
        end = new Date(Date.UTC(2025, 8, 30));   // September 30, 2025 (month 8 = September)
        break;
      case '6m':
        // Apr-Sep 2025 (ramp-up through peak period)
        start = new Date(Date.UTC(2025, 3, 1));  // April 1, 2025 (month 3 = April)
        end = new Date(Date.UTC(2025, 8, 30));   // September 30, 2025 (month 8 = September)
        break;
      case '12m':
        // Dec 2024-Nov 2025 (full year of activity)
        start = new Date(Date.UTC(2024, 11, 1)); // December 1, 2024 (month 11 = December)
        end = new Date(Date.UTC(2025, 10, 30));  // November 30, 2025 (month 10 = November)
        break;
      case 'all':
        // Use full data range if available, otherwise broad range
        if (dataBounds?.earliest_date && dataBounds?.latest_date) {
          start = new Date(dataBounds.earliest_date);
          end = new Date(dataBounds.latest_date);
        } else {
          start = new Date(Date.UTC(2024, 10, 15)); // November 15, 2024
          end = new Date(Date.UTC(2027, 2, 31));    // March 31, 2027
        }
        break;
    }
    
    return { startDate: start, endDate: end };
  }, [dateRange, dataBounds]);

  const { data, isLoading, error } = usePortfolioResourceForecast({
    startDate,
    endDate,
    timePeriod: effectiveTimePeriod,
    filters,
  });

  // Debug logging for date range issues
  console.log('ResourceTimeline Debug:', {
    dateRange,
    dataBounds,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    hasData: !!data?.monthly_forecast,
    dataLength: data?.monthly_forecast?.length,
    nonZeroCount: data?.monthly_forecast?.filter(p => p.total_fte > 0).length,
    isLoading,
    error: !!error
  });

  // Service line colors mapping
  const serviceLineColors: Record<ServiceLine, string> = {
    'CES': DXC_COLORS[0], // Bright Purple
    'INS': DXC_COLORS[1], // Bright Teal
    'BPS': DXC_COLORS[2], // Blue
    'SEC': DXC_COLORS[6], // Gold
    'ITOC': DXC_COLORS[4], // Green
    'MW': DXC_COLORS[5], // Orange
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data?.monthly_forecast) return [];
    
    const result = data.monthly_forecast.map(period => {
      let displayLabel = period.month;
      
      // Format display label based on time period
      if (effectiveTimePeriod === 'week') {
        if (period.month.includes('/')) {
          // Week data comes as MM/DD format from backend - convert to week number
          try {
            const [month, day] = period.month.split('/').map(Number);
            const currentYear = new Date().getFullYear();
            const date = new Date(currentYear, month - 1, day);
            
            // Calculate week number of the year (ISO week)
            const startOfYear = new Date(currentYear, 0, 1);
            const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
            const weekOfYear = Math.ceil((dayOfYear - date.getDay() + 10) / 7);
            
            displayLabel = `W${weekOfYear}`;
          } catch {
            displayLabel = period.month; // Fallback to MM/DD format
          }
        } else {
          // Keep existing format if already processed
          displayLabel = period.month;
        }
      } else if (effectiveTimePeriod === 'quarter') {
        // Quarter data comes as YYYY-QN format from backend
        displayLabel = period.month; // Keep as-is (e.g., "2024-Q1")
      } else if (effectiveTimePeriod === 'month') {
        // Month data comes as "Jan 24" format from backend - expand to full year
        try {
          if (period.month.includes(' ')) {
            // Format like "Jan 24" - expand to "Jan 2024"
            const parts = period.month.split(' ');
            if (parts.length === 2) {
              const monthName = parts[0];
              const shortYear = parts[1];
              const fullYear = shortYear.length === 2 ? `20${shortYear}` : shortYear;
              displayLabel = `${monthName} ${fullYear}`;
            } else {
              displayLabel = period.month;
            }
          } else {
            // Keep as-is for other formats
            displayLabel = period.month;
          }
        } catch {
          displayLabel = period.month; // Fallback to original
        }
      }
      
      return {
        period: displayLabel,
        total: period.total_fte,
        ...period.service_lines,
      };
    });
    
    return result;
  }, [data, effectiveTimePeriod]);

  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-dxc-gray">
          <AlertCircle className="w-12 h-12 mb-3" />
          <p className="text-center">No resource timeline data available</p>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Generate timelines for opportunities to see resource forecasts
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
      yAxis: <YAxis tick={{ fontSize: 12 }} label={{ value: 'FTE', angle: -90, position: 'insideLeft' }} />,
      grid: <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />,
      tooltip: (
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #D9D9D6',
            borderRadius: '8px',
          }}
          formatter={(value: number, name: string) => [
            value.toFixed(1), 
            name === 'total' ? 'Total FTE' : name
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
              name="Total FTE"
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
        <LoadingSpinner text="Loading resource timeline..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
        <div className="text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Error loading resource timeline</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <Calendar className="w-6 h-6 text-dxc-bright-purple" />
          <h3 className="text-xl font-semibold text-dxc-dark-gray">Resource Timeline</h3>
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
                  effectiveTimePeriod === period
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
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Total Opportunities</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {data.total_opportunities_processed}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Total Effort</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {data.total_effort_weeks.toFixed(1)} weeks
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Timelines Available</p>
            <p className="text-xl font-semibold text-dxc-bright-purple">
              {data.forecast_period.timeline_opportunities}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-dxc-gray mb-1">Missing Timelines</p>
            <p className="text-xl font-semibold text-orange-600">
              {data.forecast_period.missing_timelines}
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

export default ResourceTimelineCard;