import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { SALES_STAGES, type ServiceLine } from '../../../types/index.js';

type TimePeriod = 'week' | 'month' | 'quarter';

interface ServiceLineChartProps {
  serviceLine: ServiceLine;
  periods: any[];
  stages: string[];
  baseColor: string;
  timePeriod: TimePeriod;
}

const ServiceLineChart: React.FC<ServiceLineChartProps> = ({
  serviceLine,
  periods,
  stages,
  baseColor,
  timePeriod,
}) => {
  // Calculate total FTE for this service line to show in header
  const totalServiceLineFTE = periods.reduce((sum, period) => sum + (period.total || 0), 0);

  if (stages.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
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
};

export default ServiceLineChart;