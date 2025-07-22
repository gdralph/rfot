import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import { Calendar, Clock, TrendingUp } from 'lucide-react';

interface TimelineDataPoint {
  date: string;
  period: string;
  revenue: number;
  opportunities: number;
  won: number;
  lost: number;
  pipeline: number;
  forecast: number;
  target: number;
  serviceLine?: string;
  stage?: string;
  category?: string;
}

interface TimelineViewProps {
  data: TimelineDataPoint[];
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
  showFilters?: boolean;
  height?: number;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  showFilters = true,
  height = 400
}) => {
  const [viewType, setViewType] = useState<'revenue' | 'opportunities' | 'conversion'>('revenue');
  // const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPeriod] = useState<string>('');

  // Calculate comparison data (previous year/quarter/month)
  const comparisonData = useMemo(() => {
    if (!showComparison || !comparisonPeriod) return [];
    
    return data.map(point => {
      const currentDate = new Date(point.date);
      const comparisonDate = new Date(currentDate);
      
      // Calculate comparison period based on time range
      switch (timeRange) {
        case 'week':
          comparisonDate.setDate(comparisonDate.getDate() - 7);
          break;
        case 'month':
          comparisonDate.setMonth(comparisonDate.getMonth() - 1);
          break;
        case 'quarter':
          comparisonDate.setMonth(comparisonDate.getMonth() - 3);
          break;
        case 'year':
          comparisonDate.setFullYear(comparisonDate.getFullYear() - 1);
          break;
      }
      
      // Mock comparison data (in real app, this would come from API)
      return {
        ...point,
        comparisonRevenue: point.revenue * (0.8 + Math.random() * 0.4),
        comparisonOpportunities: Math.round(point.opportunities * (0.8 + Math.random() * 0.4)),
        comparisonPipeline: point.pipeline * (0.8 + Math.random() * 0.4)
      };
    });
  }, [data, showComparison, comparisonPeriod, timeRange]);

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

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'week': return 'Weekly';
      case 'month': return 'Monthly';
      case 'quarter': return 'Quarterly';
      case 'year': return 'Yearly';
      default: return '';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-white p-4 border border-dxc-light-gray rounded-dxc shadow-lg">
          <p className="font-semibold text-dxc-bright-purple mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-dxc-dark-gray">
                {entry.name}: {
                  entry.name.includes('Revenue') || entry.name.includes('Pipeline') || entry.name.includes('Forecast')
                    ? formatCurrency(entry.value)
                    : formatNumber(entry.value)
                }
              </span>
            </div>
          ))}
          
          {/* Additional metrics */}
          {data && (
            <div className="mt-2 pt-2 border-t border-dxc-light-gray text-xs text-dxc-medium-gray">
              <div>Win Rate: {data.won > 0 ? ((data.won / (data.won + data.lost)) * 100).toFixed(1) : 0}%</div>
              {showComparison && (
                <div className="mt-1">
                  vs Previous: {data.comparisonRevenue ? 
                    (((data.revenue - data.comparisonRevenue) / data.comparisonRevenue) * 100).toFixed(1) + '%'
                    : 'N/A'
                  }
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const chartData = showComparison ? comparisonData : data;

    switch (viewType) {
      case 'revenue':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                angle={timeRange === 'week' ? -45 : 0}
                textAnchor={timeRange === 'week' ? 'end' : 'middle'}
              />
              <YAxis tick={{ fontSize: 12 }} />
              
              {/* Target reference line */}
              <ReferenceLine 
                y={data.reduce((sum, d) => sum + d.target, 0) / data.length}
                stroke="#00968F"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
              
              <Area
                type="monotone"
                dataKey="pipeline"
                stackId="1"
                stroke="#E0E0E0"
                fill="rgba(224, 224, 224, 0.6)"
                name="Pipeline"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stackId="1"
                stroke="#5F249F"
                fill="rgba(95, 36, 159, 0.6)"
                name="Revenue"
              />
              
              {showComparison && (
                <Area
                  type="monotone"
                  dataKey="comparisonRevenue"
                  stroke="#00A3E1"
                  fill="rgba(0, 163, 225, 0.3)"
                  name="Previous Period"
                />
              )}
              
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#00968F"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                name="Forecast"
              />
              
              <Tooltip content={<CustomTooltip />} />
              <Brush dataKey="period" height={30} stroke="#5F249F" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'opportunities':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                angle={timeRange === 'week' ? -45 : 0}
                textAnchor={timeRange === 'week' ? 'end' : 'middle'}
              />
              <YAxis tick={{ fontSize: 12 }} />
              
              <Line
                type="monotone"
                dataKey="opportunities"
                stroke="#5F249F"
                strokeWidth={3}
                dot={{ fill: '#5F249F', strokeWidth: 2, r: 4 }}
                name="Total Opportunities"
              />
              
              <Line
                type="monotone"
                dataKey="won"
                stroke="#6CC24A"
                strokeWidth={2}
                dot={{ fill: '#6CC24A', r: 3 }}
                name="Won"
              />
              
              <Line
                type="monotone"
                dataKey="lost"
                stroke="#FF6B6B"
                strokeWidth={2}
                dot={{ fill: '#FF6B6B', r: 3 }}
                name="Lost"
              />
              
              {showComparison && (
                <Line
                  type="monotone"
                  dataKey="comparisonOpportunities"
                  stroke="#00A3E1"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ fill: '#00A3E1', r: 3 }}
                  name="Previous Period"
                />
              )}
              
              <Tooltip content={<CustomTooltip />} />
              <Brush dataKey="period" height={30} stroke="#5F249F" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'conversion':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData.map(d => ({
              ...d,
              winRate: d.won + d.lost > 0 ? (d.won / (d.won + d.lost)) * 100 : 0,
              velocityIndex: d.revenue / (d.opportunities || 1) * 0.01 // Simplified velocity
            }))} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                angle={timeRange === 'week' ? -45 : 0}
                textAnchor={timeRange === 'week' ? 'end' : 'middle'}
              />
              <YAxis tick={{ fontSize: 12 }} />
              
              <Line
                type="monotone"
                dataKey="winRate"
                stroke="#6CC24A"
                strokeWidth={3}
                dot={{ fill: '#6CC24A', strokeWidth: 2, r: 4 }}
                name="Win Rate %"
              />
              
              <Line
                type="monotone"
                dataKey="velocityIndex"
                stroke="#ED9B33"
                strokeWidth={2}
                dot={{ fill: '#ED9B33', r: 3 }}
                name="Velocity Index"
              />
              
              <ReferenceLine y={75} stroke="#00968F" strokeDasharray="5 5" strokeWidth={1} />
              
              <Tooltip 
                content={<CustomTooltip />}
                formatter={(value, name) => [
                  name === 'Win Rate %' ? `${Number(value).toFixed(1)}%` : Number(value).toFixed(2),
                  name
                ]}
              />
              <Brush dataKey="period" height={30} stroke="#5F249F" />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // const currentPeriodData = selectedPeriod ? data.find(d => d.period === selectedPeriod) : null;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-dxc-bright-purple" />
          <div>
            <h3 className="text-dxc-subtitle font-semibold">Timeline Analysis</h3>
            <p className="text-sm text-dxc-medium-gray">{getTimeRangeLabel()} performance trends</p>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {/* Time Range Selector */}
            <div className="flex rounded-dxc border border-dxc-light-gray overflow-hidden">
              {['week', 'month', 'quarter', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => onTimeRangeChange(range as any)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-dxc-bright-purple text-white'
                      : 'bg-white text-dxc-dark-gray hover:bg-gray-50'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>

            {/* View Type Selector */}
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as any)}
              className="input text-sm"
            >
              <option value="revenue">Revenue & Pipeline</option>
              <option value="opportunities">Opportunity Volume</option>
              <option value="conversion">Win Rate & Velocity</option>
            </select>

            {/* Comparison Toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-4 py-2 text-sm font-medium rounded-dxc transition-colors ${
                showComparison
                  ? 'bg-dxc-blue text-white'
                  : 'bg-white border border-dxc-light-gray text-dxc-dark-gray hover:bg-gray-50'
              }`}
            >
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-dxc-lg shadow-lg border border-dxc-light-gray p-6">
        {renderChart()}
      </div>

      {/* Period-over-Period Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Metrics */}
        <div className="bg-white rounded-dxc border border-dxc-light-gray p-4">
          <h4 className="font-semibold text-dxc-dark-gray mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-dxc-bright-purple" />
            Performance Summary
          </h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-dxc-medium-gray">Total Revenue</span>
              <span className="font-semibold text-dxc-bright-purple">
                {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0))}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-dxc-medium-gray">Total Opportunities</span>
              <span className="font-semibold text-dxc-blue">
                {formatNumber(data.reduce((sum, d) => sum + d.opportunities, 0))}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-dxc-medium-gray">Avg Win Rate</span>
              <span className="font-semibold text-dxc-green">
                {data.length > 0 ? (
                  ((data.reduce((sum, d) => sum + d.won, 0) / 
                    data.reduce((sum, d) => sum + (d.won + d.lost), 0)) * 100).toFixed(1)
                ) : 0}%
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-dxc-medium-gray">Pipeline Health</span>
              <span className="font-semibold text-dxc-bright-teal">
                {formatCurrency(data.reduce((sum, d) => sum + d.pipeline, 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Trend Analysis */}
        <div className="bg-white rounded-dxc border border-dxc-light-gray p-4">
          <h4 className="font-semibold text-dxc-dark-gray mb-3">Trend Analysis</h4>
          
          <div className="space-y-3">
            {/* Revenue trend */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-dxc-medium-gray">Revenue Trend</span>
                <span className="text-sm font-medium text-dxc-green">+12.4%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-dxc-green h-2 rounded-full" style={{ width: '62.4%' }} />
              </div>
            </div>

            {/* Opportunity trend */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-dxc-medium-gray">Opportunity Growth</span>
                <span className="text-sm font-medium text-dxc-blue">+8.7%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-dxc-blue h-2 rounded-full" style={{ width: '58.7%' }} />
              </div>
            </div>

            {/* Win rate trend */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-dxc-medium-gray">Win Rate Change</span>
                <span className="text-sm font-medium text-orange-500">-2.1%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: '47.9%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Forecast Accuracy */}
        <div className="bg-white rounded-dxc border border-dxc-light-gray p-4">
          <h4 className="font-semibold text-dxc-dark-gray mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-dxc-bright-purple" />
            Forecast Accuracy
          </h4>
          
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-dxc-bright-purple">84.2%</div>
              <div className="text-sm text-dxc-medium-gray">Overall Accuracy</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dxc-medium-gray">This {timeRange}:</span>
                <span className="font-medium text-dxc-green">91.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dxc-medium-gray">Last {timeRange}:</span>
                <span className="font-medium text-dxc-blue">87.3%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dxc-medium-gray">Trend:</span>
                <span className="font-medium text-dxc-green">↗ Improving</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;