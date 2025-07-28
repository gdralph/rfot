import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { type ServiceLine } from '../../types/index.js';
import LoadingSpinner from '../LoadingSpinner';
import {
  TimelinePeriodSelector,
  DateRangeSelector,
  SummaryStatsGrid,
  ServiceLineChart,
  useStageResourceTimeline,
  useTimelineDataBounds,
  getPeriodBoundaries,
  getPeriodCount,
  getServiceLineBaseColor
} from './StageResourceTimeline';

type TimePeriod = 'week' | 'month' | 'quarter';

interface StageResourceTimelineChartProps {
  className?: string;
  filters?: {
    stage?: string | string[];
    category?: string | string[];
    service_line?: string | string[];
    lead_offering?: string | string[];
  };
}

const StageResourceTimelineChart: React.FC<StageResourceTimelineChartProps> = ({ 
  className = '', 
  filters 
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [dateRange, setDateRange] = useState<string>('12M');
  
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
      console.error('StageResourceTimelineChart: API Error:', error);
    }
  }, [error]);

  // Transform data for separate service line charts with improved smoothing
  const serviceLineData = useMemo(() => {
    if (!data?.monthly_forecast) return {};
    
    const serviceLines = ['CES', 'INS', 'BPS', 'SEC', 'ITOC', 'MW'];
    const result: Record<string, any[]> = {};
    
    serviceLines.forEach(serviceLine => {
      // Transform periods data
      const periodsData = data.monthly_forecast.map((period: any) => {
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
    const activeServiceLines = Object.entries(serviceLineData).filter(([, periods]) => {
      return periods.some(period => period.total > 0);
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

          return (
            <ServiceLineChart
              key={serviceLine}
              serviceLine={serviceLine as ServiceLine}
              periods={periods}
              stages={stages}
              baseColor={baseColor}
              timePeriod={timePeriod}
            />
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
          <TimelinePeriodSelector
            timePeriod={timePeriod}
            onTimePeriodChange={handleTimePeriodChange}
            isLoading={isLoading}
            startDate={startDate}
            endDate={endDate}
            getPeriodBoundaries={getPeriodBoundaries}
          />
          
          {/* Debug Manual Refetch Button */}
          <button
            onClick={() => refetch()}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            title="Manual refetch for debugging"
          >
            🔄 Refetch
          </button>

          <DateRangeSelector
            timePeriod={timePeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Summary Stats */}
      {data && <SummaryStatsGrid data={data} />}

      {/* Charts */}
      <div>{renderCharts()}</div>
      
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