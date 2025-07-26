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

// Period boundary utility functions
const getPeriodBoundaries = {
  // Get start and end of quarter containing the given date
  quarter: (date: Date) => {
    const quarterMonth = Math.floor((date.getMonth()) / 3) * 3;
    const start = new Date(date.getFullYear(), quarterMonth, 1);
    const end = new Date(date.getFullYear(), quarterMonth + 3, 0); // Last day of quarter
    return { start, end };
  },
  
  // Get start and end of month containing the given date
  month: (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0); // Last day of month
    return { start, end };
  },
  
  // Get start and end of week containing the given date (Monday to Sunday)
  week: (date: Date) => {
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday = 0
    const start = new Date(date);
    start.setDate(date.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
};

// Calculate period count for range calculation
const getPeriodCount = (rangeOption: string): number => {
  const match = rangeOption.match(/^(\d+)[QMW]$/);
  return match ? parseInt(match[1]) : 0;
};

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
      console.log('🌐 API Call: getStageResourceTimeline with options:', {
      ...options,
      startDate: options.startDate?.toISOString(),
      endDate: options.endDate?.toISOString()
    });
      return api.getStageResourceTimeline(options);
    },
    enabled: true,
    staleTime: 0, // Force fresh data on every call
    gcTime: 10000, // 10 seconds - very short cache
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on error to see failures quickly
  });
};

// Hook to get timeline data bounds
const useTimelineDataBounds = () => {
  return useQuery({
    queryKey: ['timeline-data-bounds'],
    queryFn: () => api.getTimelineDataBounds(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

const StageResourceTimelineChart: React.FC<StageResourceTimelineChartProps> = ({ 
  className = '', 
  filters 
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [dateRange, setDateRange] = useState<string>('12M'); // Start with a reasonable default
  
  // Initialize proper date range on first load
  useEffect(() => {
    const defaultRanges = {
      quarter: '4Q',
      month: '12M', 
      week: '26W'
    };
    setDateRange(defaultRanges[timePeriod]);
  }, []); // Only run once on mount
  
  // Reset date range when time period changes to ensure appropriate defaults
  const handleTimePeriodChange = (newTimePeriod: TimePeriod) => {
    setTimePeriod(newTimePeriod);
    // Set appropriate default range for the new time period
    const defaultRanges = {
      quarter: '4Q',
      month: '12M', 
      week: '26W'
    };
    setDateRange(defaultRanges[newTimePeriod]);
  };

  // Get timeline data bounds for intelligent range calculation
  const { data: timelineBounds } = useTimelineDataBounds();

  // Calculate time-period aware date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const currentPeriod = getPeriodBoundaries[timePeriod](now);
    
    let start: Date, end: Date;
    
    if (dateRange === 'all') {
      // Use timeline data bounds if available, otherwise fallback to wide range
      if (timelineBounds?.earliest_date && timelineBounds?.latest_date) {
        const earliestDate = new Date(timelineBounds.earliest_date);
        const latestDate = new Date(timelineBounds.latest_date);
        
        // Align to period boundaries
        start = getPeriodBoundaries[timePeriod](earliestDate).start;
        end = getPeriodBoundaries[timePeriod](latestDate).end;
        
        // Ensure we include current period
        if (start > currentPeriod.start) start = currentPeriod.start;
        if (end < currentPeriod.end) end = currentPeriod.end;
      } else {
        // Fallback to wide range aligned to periods
        start = getPeriodBoundaries[timePeriod](new Date(2024, 0, 1)).start;
        end = getPeriodBoundaries[timePeriod](new Date(2027, 11, 31)).end;
      }
    } else {
      // Calculate range based on period count
      const periodCount = getPeriodCount(dateRange);
      
      if (periodCount > 0) {
        // Start from current period and go back by periodCount
        end = currentPeriod.end;
        
        let tempStart = new Date(now);
        
        // Calculate start date based on time period
        if (timePeriod === 'quarter') {
          tempStart.setMonth(tempStart.getMonth() - (periodCount * 3));
        } else if (timePeriod === 'month') {
          tempStart.setMonth(tempStart.getMonth() - periodCount);
        } else { // week
          tempStart.setDate(tempStart.getDate() - (periodCount * 7));
        }
        
        start = getPeriodBoundaries[timePeriod](tempStart).start;
      } else {
        // Fallback for unrecognized range
        start = currentPeriod.start;
        end = currentPeriod.end;
      }
    }
    
    console.log(`📅 Time-period aware date range (${timePeriod}, ${dateRange}):`, {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      timelineBounds
    });
    
    return { startDate: start, endDate: end };
  }, [dateRange, timePeriod, timelineBounds]);

  const { data, isLoading, error, refetch } = useStageResourceTimeline({
    startDate,
    endDate,
    timePeriod,
    filters,
  });
  
  // Add error logging for debugging
  useEffect(() => {
    if (error) {
      console.error('❌ StageResourceTimelineChart: API Error:', error);
      console.error('❌ StageResourceTimelineChart: Error details:', {
        timePeriod,
        dateRange,
        filters,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });
    }
  }, [error, timePeriod, dateRange, filters, startDate, endDate]);

  // Debug effect to see when time period changes
  useEffect(() => {
    console.log('📊 StageResourceTimelineChart: Configuration changed');
    console.log('  - Time period:', timePeriod);
    console.log('  - Date range selector:', dateRange);
    console.log('  - Calculated date range:', {
      start: startDate?.toISOString().split('T')[0],
      end: endDate?.toISOString().split('T')[0],
      spanDays: startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
    });
    console.log('  - External filters from dashboard:', filters);
    console.log('  - Timeline bounds available:', !!timelineBounds);
    if (timelineBounds) {
      console.log('  - Timeline data bounds:', {
        earliest: timelineBounds.earliest_date,
        latest: timelineBounds.latest_date
      });
    }
    
    // Check if current period is included
    const now = new Date();
    const currentBoundary = getPeriodBoundaries[timePeriod](now);
    const includesCurrent = startDate && endDate && startDate <= currentBoundary.start && endDate >= currentBoundary.end;
    console.log('  - Current period included:', includesCurrent, {
      current: {
        start: currentBoundary.start.toISOString().split('T')[0],
        end: currentBoundary.end.toISOString().split('T')[0]
      }
    });
  }, [timePeriod, dateRange, startDate, endDate, filters, timelineBounds]);

  // Debug effect to see when data changes
  useEffect(() => {
    if (data) {
      console.log('📈 StageResourceTimelineChart: Data received for timePeriod:', timePeriod);
      console.log('📈 StageResourceTimelineChart: Total periods in forecast:', data.monthly_forecast?.length);
      console.log('📈 StageResourceTimelineChart: Total opportunities processed:', data.total_opportunities_processed);
      if (data.monthly_forecast?.length > 0) {
        console.log('📈 StageResourceTimelineChart: First period example:', data.monthly_forecast[0]);
        console.log('📈 StageResourceTimelineChart: Service line stage breakdown keys:', Object.keys(data.monthly_forecast[0].service_line_stage_breakdown || {}));
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

  // Transform data for separate service line charts with improved smoothing
  const serviceLineData = useMemo(() => {
    if (!data?.monthly_forecast) return {};
    
    const serviceLines = ['CES', 'INS', 'BPS', 'SEC', 'ITOC', 'MW'];
    const result: Record<string, any[]> = {};
    
    serviceLines.forEach(serviceLine => {
      // Transform periods data
      const periodsData = data.monthly_forecast.map((period: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chartItem: any = {
          period: period.period,
          total: 0,
        };

        // Add stage breakdown for this service line
        Object.entries(period.service_line_stage_breakdown || {}).forEach(([key, value]) => {
          if (key.startsWith(`${serviceLine}_`) && (value as number) > 0) {
            const stage = key.split('_')[1];
            const roundedValue = Math.round((value as number) * 100) / 100; // Round to 2 decimal places
            chartItem[stage] = roundedValue;
            chartItem.total += roundedValue;
          }
        });

        // Round total to avoid floating point precision issues
        chartItem.total = Math.round(chartItem.total * 100) / 100;
        return chartItem;
      });

      // Apply smoothing for quarterly view to reduce spikes
      if (timePeriod === 'quarter' && periodsData.length > 2) {
        result[serviceLine] = periodsData.map((period: any, index: number) => {
          if (index === 0 || index === periodsData.length - 1) {
            return period; // Don't smooth first/last periods
          }
          
          const smoothedPeriod = { ...period };
          Object.keys(period).forEach(key => {
            if (key !== 'period' && key !== 'total' && typeof period[key] === 'number') {
              const prev = periodsData[index - 1][key] || 0;
              const curr = period[key] || 0;
              const next = periodsData[index + 1][key] || 0;
              
              // Apply light smoothing (70% current, 15% prev, 15% next)
              const smoothed = (curr * 0.7) + (prev * 0.15) + (next * 0.15);
              smoothedPeriod[key] = Math.round(smoothed * 100) / 100;
            }
          });
          
          // Recalculate total
          smoothedPeriod.total = Object.keys(smoothedPeriod)
            .filter(key => key !== 'period' && key !== 'total')
            .reduce((sum, key) => sum + (smoothedPeriod[key] || 0), 0);
          smoothedPeriod.total = Math.round(smoothedPeriod.total * 100) / 100;
          
          return smoothedPeriod;
        });
      } else {
        result[serviceLine] = periodsData;
      }
    });
    
    console.log('📊 serviceLineData transformation complete for timePeriod:', timePeriod);
    console.log('📊 Sample service line data (CES):', result['CES']?.slice(0, 3));
    
    return result;
  }, [data, timePeriod]);

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
    const activeServiceLines = Object.entries(serviceLineData).filter(([serviceLine, periods]) => {
      const hasData = periods.some(period => period.total > 0);
      if (hasData) {
        console.log(`✅ ${serviceLine} has data:`, periods.filter(p => p.total > 0).length, 'periods with FTE');
      }
      return hasData;
    });

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
          
          // Calculate total FTE for this service line to show in header
          const totalServiceLineFTE = periods.reduce((sum, period) => sum + (period.total || 0), 0);
          
          if (stages.length === 0) return null;

          return (
            <div key={serviceLine} className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-dxc-dark-gray mb-4 flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: baseColor }}
                />
                {serviceLine} Service Line Resource Timeline
                <span className="text-sm font-normal text-dxc-medium-gray ml-2">
                  (Total: {totalServiceLineFTE.toFixed(1)} Average Headcount)
                </span>
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
                      label={{ value: 'Average Headcount', angle: -90, position: 'insideLeft' }} 
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #D9D9D6',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'total') return [value.toFixed(1), 'Total Average Headcount'];
                        
                        const stageInfo = SALES_STAGES.find(s => s.code === name);
                        return [
                          value.toFixed(1), 
                          `${stageInfo?.label || `Stage ${name}`} Average Headcount`
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
              Resource Timeline by Sales Stage
              {isLoading && (
                <div className="w-4 h-4 border-2 border-dxc-bright-purple border-t-transparent rounded-full animate-spin"></div>
              )}
            </h3>
            <p className="text-sm text-dxc-gray mt-1">
              Viewing by <span className="font-medium capitalize">{timePeriod}</span>s • 
              Range: {dateRange === 'all' ? 'All data' : dateRange.toUpperCase()} •
              <span className="ml-1 text-dxc-bright-purple font-medium">
                {startDate.toLocaleDateString('en-US', { 
                  ...(timePeriod === 'quarter' ? { year: 'numeric', month: 'short' } : 
                      timePeriod === 'month' ? { year: 'numeric', month: 'short' } : 
                      { month: 'short', day: 'numeric' })
                })} - {endDate.toLocaleDateString('en-US', {
                  ...(timePeriod === 'quarter' ? { year: 'numeric', month: 'short' } : 
                      timePeriod === 'month' ? { year: 'numeric', month: 'short' } : 
                      { month: 'short', day: 'numeric' })
                })}
              </span>
            </p>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          {/* Time Period Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
            {(['week', 'month', 'quarter'] as const).map(period => {
              const isCurrentPeriod = (() => {
                const now = new Date();
                const currentBoundary = getPeriodBoundaries[period](now);
                return startDate <= currentBoundary.start && endDate >= currentBoundary.end;
              })();
              
              return (
                <button
                  key={period}
                  onClick={() => handleTimePeriodChange(period)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-all relative ${
                    timePeriod === period
                      ? 'bg-dxc-bright-purple text-white shadow-md'
                      : 'text-dxc-gray hover:text-dxc-dark-gray hover:bg-gray-200'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}s
                  {isCurrentPeriod && timePeriod === period && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-dxc-bright-teal rounded-full" title="Includes current period" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Debug Manual Refetch Button */}
          <button
            onClick={() => {
              console.log('🔄 Manual refetch triggered for timePeriod:', timePeriod);
              console.log('🔄 Current filters:', filters);
              console.log('🔄 Date range:', { startDate, endDate, dateRange });
              refetch();
            }}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            title="Manual refetch for debugging"
          >
            🔄 Refetch
          </button>

          {/* Date Range Selector - Period-aware options */}
          <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
            {(() => {
              // Define period-specific range options
              const rangeOptions = {
                quarter: [{ key: '2Q', label: '2Q' }, { key: '4Q', label: '4Q' }, { key: '6Q', label: '6Q' }, { key: 'all', label: 'All' }],
                month: [{ key: '6M', label: '6M' }, { key: '12M', label: '12M' }, { key: '18M', label: '18M' }, { key: 'all', label: 'All' }],
                week: [{ key: '12W', label: '12W' }, { key: '26W', label: '26W' }, { key: '52W', label: '52W' }, { key: 'all', label: 'All' }]
              };
              
              return rangeOptions[timePeriod].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateRange(key)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                    dateRange === key
                      ? 'bg-dxc-bright-teal text-white shadow-md'
                      : 'text-dxc-gray hover:text-dxc-dark-gray hover:bg-gray-200'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {label}
                </button>
              ));
            })()}
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
          This chart shows average headcount requirements by {timePeriod === 'quarter' ? 'quarter' : (timePeriod === 'week' ? 'week' : 'month')}, 
          broken down by service line and sales stage. Each service line is shown in its own chart, with stacked bars representing 
          the average number of people needed concurrently for work in different sales stages during each time period.
          {timePeriod === 'quarter' ? ' Quarterly data includes light smoothing to reduce period-to-period spikes.' : ''}
          {(() => {
            const now = new Date();
            const currentBoundary = getPeriodBoundaries[timePeriod](now);
            const includesCurrent = startDate <= currentBoundary.start && endDate >= currentBoundary.end;
            return includesCurrent ? ` 🟢 Current ${timePeriod} is included in the displayed range.` : ` ⚠️ Current ${timePeriod} is not in the displayed range.`;
          })()} 
        </p>
        {timelineBounds && (
          <p className="mt-1 text-xs text-dxc-medium-gray">
            Timeline data available from {new Date(timelineBounds.earliest_date || '').toLocaleDateString()} 
            to {new Date(timelineBounds.latest_date || '').toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default StageResourceTimelineChart;