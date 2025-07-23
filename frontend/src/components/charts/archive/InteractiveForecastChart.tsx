import React, { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Legend
} from 'recharts';
import { TrendingUp, AlertCircle, Info } from 'lucide-react';

interface ForecastDataPoint {
  period: string;
  forecast: number;
  actual?: number;
  target: number;
  confidence: number;
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
}

interface InteractiveForecastChartProps {
  data: ForecastDataPoint[];
  height?: number;
  showConfidenceInterval?: boolean;
  showScenarios?: boolean;
  onDataPointClick?: (data: ForecastDataPoint) => void;
}

const InteractiveForecastChart: React.FC<InteractiveForecastChartProps> = ({
  data,
  height = 400,
  showConfidenceInterval = true,
  showScenarios = false,
  onDataPointClick
}) => {
  const [selectedScenario, setSelectedScenario] = useState<'optimistic' | 'realistic' | 'pessimistic'>('realistic');
  const [hoveredData] = useState<ForecastDataPoint | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredData = showScenarios 
    ? data.filter(d => d.scenario === selectedScenario)
    : data;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-white p-4 border border-dxc-light-gray rounded-dxc shadow-lg">
          <p className="font-semibold text-dxc-dark-gray mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-dxc-dark-gray">
                {entry.name}: {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
          {data?.confidence && (
            <div className="mt-2 pt-2 border-t border-dxc-light-gray">
              <div className="flex items-center gap-1 text-xs text-dxc-medium-gray">
                <Info className="w-3 h-3" />
                Confidence: {(data.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;

    const confidenceColor = payload.confidence > 0.8 ? '#6CC24A' : 
                           payload.confidence > 0.6 ? '#ED9B33' : '#FF6B6B';
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={confidenceColor}
        stroke="#fff"
        strokeWidth={2}
        className="cursor-pointer hover:r-6 transition-all duration-200"
        onClick={() => onDataPointClick?.(payload)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-dxc-bright-purple" />
            <h3 className="text-dxc-subtitle font-semibold">Interactive Forecast Analysis</h3>
          </div>
          
          {showScenarios && (
            <div className="flex gap-2">
              {['optimistic', 'realistic', 'pessimistic'].map((scenario) => (
                <button
                  key={scenario}
                  onClick={() => setSelectedScenario(scenario as any)}
                  className={`px-3 py-1 rounded-dxc text-sm font-medium transition-colors ${
                    selectedScenario === scenario
                      ? 'bg-dxc-bright-purple text-white'
                      : 'bg-gray-100 text-dxc-dark-gray hover:bg-gray-200'
                  }`}
                >
                  {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-dxc-bright-purple rounded-full" />
            <span>Forecast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-dxc-green rounded-full" />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-dxc-bright-teal rounded-full" />
            <span>Target</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
          <XAxis 
            dataKey="period" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          
          {/* Confidence interval area */}
          {showConfidenceInterval && (
            <Bar
              dataKey="forecast"
              fill="rgba(95, 36, 159, 0.1)"
              stroke="none"
              name="Confidence Range"
            />
          )}
          
          {/* Target reference line */}
          <ReferenceLine 
            y={filteredData.reduce((sum, d) => sum + d.target, 0) / filteredData.length}
            stroke="#00968F"
            strokeDasharray="5 5"
            strokeWidth={2}
            label="Average Target"
          />
          
          {/* Forecast bars */}
          <Bar
            dataKey="forecast"
            fill="#5F249F"
            name="Forecast"
            opacity={0.8}
            radius={[2, 2, 0, 0]}
          />
          
          {/* Actual performance line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#6CC24A"
            strokeWidth={3}
            dot={<CustomDot />}
            name="Actual"
            connectNulls={false}
          />
          
          {/* Target line */}
          <Line
            type="monotone"
            dataKey="target"
            stroke="#00968F"
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
            name="Target"
          />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Brush for time range selection */}
          <Brush dataKey="period" height={30} stroke="#5F249F" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Insights Panel */}
      {hoveredData && (
        <div className="bg-purple-50 border border-dxc-bright-purple rounded-dxc p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-dxc-bright-purple mt-0.5" />
            <div>
              <h4 className="font-semibold text-dxc-bright-purple">Period Insights</h4>
              <p className="text-sm text-dxc-dark-gray mt-1">
                Analysis for {hoveredData.period} shows {hoveredData.confidence > 0.8 ? 'high' : 'moderate'} confidence
                in forecast accuracy. 
                {hoveredData.actual && hoveredData.forecast && (
                  hoveredData.actual > hoveredData.forecast 
                    ? ' Performance exceeded forecast.' 
                    : ' Performance below forecast expectations.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveForecastChart;