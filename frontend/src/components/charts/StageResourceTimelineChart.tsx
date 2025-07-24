import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, AlertCircle } from 'lucide-react';
import { DXC_COLORS, SALES_STAGES, type ServiceLine } from '../../types/index.js';
import { api } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';

type TimePeriod = 'week' | 'month' | 'quarter';

// interface StageServiceLineData {
//   [serviceLineAndStage: string]: number; // Format: "CES_01", "INS_02", etc.
// }

// interface PeriodData {
//   period: string;
//   total_fte: number;
//   service_line_stage_breakdown: StageServiceLineData;
// }

// interface StageResourceTimelineData {
//   monthly_forecast: PeriodData[];
//   total_opportunities_processed: number;
//   total_effort_weeks: number;
//   service_line_breakdown: Record<string, number>;
//   stage_breakdown: Record<string, number>;
//   forecast_period: {
//     start_date: string;
//     end_date: string;
//     timeline_opportunities: number;
//     missing_timelines: number;
//   };
// }

interface StageResourceTimelineChartProps {
  className?: string;
  filters?: {
    stage?: string | string[];
    category?: string | string[];
    service_line?: string | string[];
    lead_offering?: string | string[];
  };
}

// Real API hook
const useStageResourceTimeline = (options: {
  startDate?: Date;
  endDate?: Date;
  timePeriod?: TimePeriod;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: any;
}) => {
  return useQuery({
    queryKey: ['stage-resource-timeline', options.startDate?.toISOString(), options.endDate?.toISOString(), options.timePeriod, JSON.stringify(options.filters)],
    queryFn: () => {
      console.log('🌐 API Call: getStageResourceTimeline with options:', options);
      return api.getStageResourceTimeline(options);
    },
    enabled: true,
    staleTime: 0, // Force fresh data on every call
    gcTime: 10000, // 10 seconds - very short cache
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on error to see failures quickly
  });
};

const StageResourceTimelineChart: React.FC<StageResourceTimelineChartProps> = ({ 
  className = '', 
  filters 
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [dateRange, setDateRange] = useState<'3m' | '6m' | '12m' | 'all'>('all');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    
    switch (dateRange) {
      case '3m':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
        break;
      case '6m':
        start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
        break;
      case '12m':
        start = new Date(now.getFullYear(), now.getMonth() - 12, 1);   
        end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
        break;
      case 'all':
        start = new Date(2024, 10, 15);
        end = new Date(2027, 2, 31);
        break;
    }
    
    return { startDate: start, endDate: end };
  }, [dateRange]);

  const { data, isLoading, error, refetch } = useStageResourceTimeline({
    startDate,
    endDate,
    timePeriod,
    filters,
  });

  // Debug effect to see when time period changes
  useEffect(() => {
    console.log('📊 StageResourceTimelineChart: Time period changed to:', timePeriod);
    console.log('📊 StageResourceTimelineChart: Date range:', dateRange);
    console.log('📊 StageResourceTimelineChart: External filters from dashboard:', filters);
    console.log('📊 StageResourceTimelineChart: API call params:', { startDate, endDate, timePeriod, filters });
  }, [timePeriod, dateRange, startDate, endDate, filters]);

  // Debug effect to see when data changes
  useEffect(() => {
    if (data) {
      console.log('📈 StageResourceTimelineChart: Data received for timePeriod:', timePeriod);
      console.log('📈 StageResourceTimelineChart: Total periods in forecast:', data.monthly_forecast?.length);
      console.log('📈 StageResourceTimelineChart: Total opportunities processed:', data.total_opportunities_processed);
      if (data.monthly_forecast?.length > 0) {
        // console.log('📈 StageResourceTimelineChart: First few periods:', data.monthly_forecast.slice(0, 3).map((p: any) => p.period));
        console.log('📈 StageResourceTimelineChart: First period example:', data.monthly_forecast[0]);
      }
    }
  }, [data, timePeriod]);

  // Create color mapping for service line + stage combinations
  // const getStageColor = (stage: SalesStage): string => {
  //   const stageColors: Record<SalesStage, string> = {
  //     '01': '#E8F4FD', // Light blue
  //     '02': '#B3E0FF', // Medium blue  
  //     '03': '#7CC7FF', // Bright blue
  //     '04A': '#4DAAFF', // Strong blue
  //     '04B': '#1A8CFF', // Deep blue
  //     '05A': '#0066CC', // Darker blue
  //     '05B': '#004499', // Dark blue
  //     '06': '#002266', // Very dark blue
  //   };
  //   return stageColors[stage] || '#CCCCCC';
  // };

  const getServiceLineBaseColor = (serviceLine: ServiceLine): string => {
    const serviceLineColors: Record<ServiceLine, string> = {
      'CES': DXC_COLORS[0], // Bright Purple
      'INS': DXC_COLORS[1], // Bright Teal
      'BPS': DXC_COLORS[2], // Blue
      'SEC': DXC_COLORS[6], // Gold
      'ITOC': DXC_COLORS[4], // Green
      'MW': DXC_COLORS[5], // Orange
    };
    return serviceLineColors[serviceLine];
  };

  // Transform data for separate service line charts
  const serviceLineData = useMemo(() => {
    if (!data?.monthly_forecast) return {};
    
    const serviceLines = ['CES', 'INS', 'BPS', 'SEC', 'ITOC', 'MW'];
    const result: Record<string, any[]> = {};
    
    serviceLines.forEach(serviceLine => {
      result[serviceLine] = data.monthly_forecast.map((period: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chartItem: any = {
          period: period.period,
          total: 0,
        };

        // Add stage breakdown for this service line
        Object.entries(period.service_line_stage_breakdown || {}).forEach(([key, value]) => {
          if (key.startsWith(`${serviceLine}_`) && (value as number) > 0) {
            const stage = key.split('_')[1];
            chartItem[stage] = value;
            chartItem.total += (value as number);
          }
        });

        return chartItem;
      });
    });
    
    return result;
  }, [data]);

  // Generate unique stages for each service line
  const serviceLineStages = useMemo(() => {
    const result: Record<string, string[]> = {};
    
    Object.entries(serviceLineData).forEach(([serviceLine, periods]) => {
      const stages = new Set<string>();
      periods.forEach(period => {
        Object.keys(period).forEach(key => {
          if (key !== 'period' && key !== 'total' && period[key] > 0) {
            stages.add(key);
          }
        });
      });
      result[serviceLine] = Array.from(stages).sort();
    });
    
    return result;
  }, [serviceLineData]);

  const renderCharts = () => {
    if (!data?.monthly_forecast?.length) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-dxc-gray">
          <AlertCircle className="w-12 h-12 mb-3" />
          <p className="text-center">No resource timeline data available</p>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Generate timelines for opportunities to see resource forecasts by current stage
          </p>
        </div>
      );
    }

    // Filter service lines that have data
    const activeServiceLines = Object.entries(serviceLineData).filter(([, periods]) => 
      periods.some(period => period.total > 0)
    );

    if (activeServiceLines.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-dxc-gray">
          <AlertCircle className="w-12 h-12 mb-3" />
          <p className="text-center">No resource data available for selected filters</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {activeServiceLines.map(([serviceLine, periods]) => {
          const stages = serviceLineStages[serviceLine] || [];
          const baseColor = getServiceLineBaseColor(serviceLine as ServiceLine);
          
          if (stages.length === 0) return null;

          return (
            <div key={serviceLine} className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-dxc-dark-gray mb-4 flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: baseColor }}
                />
                {serviceLine} Service Line Resource Timeline
              </h4>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={periods}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }} 
                      interval="preserveStartEnd"
                      angle={timePeriod === 'week' ? -45 : 0}
                      textAnchor={timePeriod === 'week' ? 'end' : 'middle'}
                      height={timePeriod === 'week' ? 80 : 60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      label={{ value: 'FTE', angle: -90, position: 'insideLeft' }} 
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #D9D9D6',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'total') return [value.toFixed(1), 'Total FTE'];
                        
                        const stageInfo = SALES_STAGES.find(s => s.code === name);
                        return [
                          value.toFixed(1), 
                          `${stageInfo?.label || `Stage ${name}`}`
                        ];
                      }}
                      labelFormatter={(label) => `${label} (${timePeriod}ly view)`}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value: string) => {
                        const stageInfo = SALES_STAGES.find(s => s.code === value);
                        return stageInfo?.label || `Stage ${value}`;
                      }}
                    />
                    
                    {/* Create bars for each stage in this service line */}
                    {stages.map((stage) => {
                      // Vary opacity based on stage to differentiate within service line
                      const stageIndex = SALES_STAGES.findIndex(s => s.code === stage);
                      const opacity = 0.5 + (stageIndex * 0.08); // Range from 0.5 to ~1.0
                      
                      return (
                        <Bar
                          key={stage}
                          dataKey={stage}
                          stackId="stages"
                          fill={baseColor}
                          fillOpacity={Math.min(opacity, 1.0)}
                          name={stage}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
        <LoadingSpinner text="Loading stage resource timeline..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-dxc shadow-card p-6 ${className}`}>
        <div className="text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Error loading stage resource timeline</p>
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
          <div>
            <h3 className="text-xl font-semibold text-dxc-dark-gray flex items-center gap-2">
              Resource Timeline by Current Opportunity Stage
              {isLoading && (
                <div className="w-4 h-4 border-2 border-dxc-bright-purple border-t-transparent rounded-full animate-spin"></div>
              )}
            </h3>
            <p className="text-sm text-dxc-gray mt-1">
              Viewing by <span className="font-medium capitalize">{timePeriod}</span>s • 
              Range: {dateRange === 'all' ? 'All data' : dateRange.toUpperCase()}
            </p>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {/* Time Period Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
            {(['week', 'month', 'quarter'] as const).map(period => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  timePeriod === period
                    ? 'bg-dxc-bright-purple text-white shadow-md'
                    : 'text-dxc-gray hover:text-dxc-dark-gray hover:bg-gray-200'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}s
              </button>
            ))}
          </div>
          
          {/* Debug Manual Refetch Button */}
          <button
            onClick={() => refetch()}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            title="Manual refetch for debugging"
          >
            🔄 Refetch
          </button>

          {/* Date Range Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
            {(['3m', '6m', '12m', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  dateRange === range
                    ? 'bg-dxc-bright-teal text-white shadow-md'
                    : 'text-dxc-gray hover:text-dxc-dark-gray hover:bg-gray-200'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {range === 'all' ? 'All' : range.toUpperCase()}
              </button>
            ))}
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

      {/* Charts */}
      <div>
        {renderCharts()}
      </div>
      
      {/* Legend explanation */}
      <div className="mt-4 text-sm text-dxc-medium-gray">
        <p>
          This chart shows predicted FTE resource requirements by time period, 
          broken down by service line and the current sales stage of opportunities. 
          Each color represents a different service line, with varying opacity indicating different stages.
        </p>
      </div>
    </div>
  );
};

export default StageResourceTimelineChart;