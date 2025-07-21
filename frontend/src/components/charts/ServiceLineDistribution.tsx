import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Treemap
} from 'recharts';
import { PieChart as PieChartIcon, BarChart3, Grid3X3, Eye } from 'lucide-react';
import { DXC_COLORS, type ServiceLine } from '../../types/index';

interface ServiceLineData {
  serviceLine: ServiceLine;
  revenue: number;
  percentage: number;
  opportunities: number;
  avgDealSize: number;
  growth: number;
  stage: string;
  category: string;
}

interface ServiceLineDistributionProps {
  data: ServiceLineData[];
  title?: string;
  showControls?: boolean;
  onServiceLineClick?: (serviceLine: ServiceLine) => void;
}

type ViewMode = 'pie' | 'bar' | 'treemap' | 'detailed';

const ServiceLineDistribution: React.FC<ServiceLineDistributionProps> = ({
  data,
  title = "Service Line Distribution",
  showControls = true,
  onServiceLineClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('pie');
  const [sortBy, setSortBy] = useState<'revenue' | 'opportunities' | 'growth'>('revenue');
  const [showDetails] = useState(false);

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

  // Sort data based on selected criteria
  const sortedData = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'revenue':
        return b.revenue - a.revenue;
      case 'opportunities':
        return b.opportunities - a.opportunities;
      case 'growth':
        return b.growth - a.growth;
      default:
        return 0;
    }
  });

  // Prepare data for treemap
  const treemapData = sortedData.map((item, index) => ({
    name: item.serviceLine,
    size: item.revenue,
    fill: DXC_COLORS[index % DXC_COLORS.length],
    ...item
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-dxc-light-gray rounded-dxc shadow-lg max-w-xs">
          <h4 className="font-semibold text-dxc-bright-purple mb-2">{data.serviceLine}</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Revenue:</span>
              <span className="font-medium">{formatCurrency(data.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Share:</span>
              <span className="font-medium">{data.percentage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Opportunities:</span>
              <span className="font-medium">{formatNumber(data.opportunities)}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Deal Size:</span>
              <span className="font-medium">{formatCurrency(data.avgDealSize)}</span>
            </div>
            <div className="flex justify-between">
              <span>Growth:</span>
              <span className={`font-medium ${data.growth >= 0 ? 'text-dxc-green' : 'text-red-500'}`}>
                {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const TreemapContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, colors, rank, name } = props;
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: payload.fill,
            fillOpacity: 0.8,
            stroke: '#fff',
            strokeWidth: 2,
            cursor: 'pointer'
          }}
          onClick={() => onServiceLineClick?.(payload.serviceLine)}
        />
        {width > 80 && height > 40 && (
          <>
            <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">
              {name}
            </text>
            <text x={x + width / 2} y={y + height / 2 + 8} textAnchor="middle" fill="#fff" fontSize="10">
              {formatCurrency(payload.revenue)}
            </text>
          </>
        )}
      </g>
    );
  };

  const renderChart = () => {
    switch (viewMode) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={sortedData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={60}
                dataKey="revenue"
                label={({ serviceLine, percentage }) => `${serviceLine} (${percentage.toFixed(1)}%)`}
                labelLine={false}
              >
                {sortedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={DXC_COLORS[index % DXC_COLORS.length]}
                    onClick={() => onServiceLineClick?.(entry.serviceLine)}
                    className="cursor-pointer hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
              <XAxis dataKey="serviceLine" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="revenue" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => onServiceLineClick?.(data.serviceLine)}
                className="cursor-pointer"
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={DXC_COLORS[index % DXC_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'treemap':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={treemapData}
              dataKey="size"
              ratio={4/3}
              stroke="#fff"
              content={<TreemapContent />}
            />
          </ResponsiveContainer>
        );

      case 'detailed':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedData.map((item, index) => (
              <div
                key={item.serviceLine}
                className="bg-white border border-dxc-light-gray rounded-dxc p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onServiceLineClick?.(item.serviceLine)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: DXC_COLORS[index % DXC_COLORS.length] }}
                  />
                  <h4 className="font-semibold text-dxc-bright-purple">{item.serviceLine}</h4>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dxc-medium-gray">Revenue</span>
                    <span className="font-semibold">{formatCurrency(item.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dxc-medium-gray">Market Share</span>
                    <span className="font-semibold">{item.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dxc-medium-gray">Opportunities</span>
                    <span className="font-semibold">{formatNumber(item.opportunities)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dxc-medium-gray">Avg Deal Size</span>
                    <span className="font-semibold">{formatCurrency(item.avgDealSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dxc-medium-gray">Growth</span>
                    <span className={`font-semibold ${item.growth >= 0 ? 'text-dxc-green' : 'text-red-500'}`}>
                      {item.growth >= 0 ? '+' : ''}{item.growth.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bars for visual comparison */}
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-dxc-medium-gray mb-1">
                      <span>Revenue Share</span>
                      <span>{item.percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: DXC_COLORS[index % DXC_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  // Show empty state when no data
  if (!data || data.length === 0 || data.every(item => item.revenue <= 0)) {
    return (
      <div className="space-y-4">
        <h3 className="text-dxc-subtitle font-semibold flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-dxc-bright-purple" />
          {title}
        </h3>
        <div className="bg-white rounded-dxc-lg shadow-lg border border-dxc-light-gray p-12 text-center">
          <div className="text-dxc-medium-gray">
            <PieChartIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h4 className="text-lg font-medium mb-2">No Service Line Data</h4>
            <p className="text-sm">No opportunities with service line revenue found. Import opportunities to see service line distribution.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      {showControls && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-dxc-subtitle font-semibold flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-dxc-bright-purple" />
            {title}
          </h3>

          <div className="flex flex-wrap gap-2">
            {/* View Mode Controls */}
            <div className="flex rounded-dxc border border-dxc-light-gray overflow-hidden">
              {[
                { mode: 'pie', icon: PieChartIcon, label: 'Pie' },
                { mode: 'bar', icon: BarChart3, label: 'Bar' },
                { mode: 'treemap', icon: Grid3X3, label: 'Tree' },
                { mode: 'detailed', icon: Eye, label: 'Detail' }
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as ViewMode)}
                  className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === mode
                      ? 'bg-dxc-bright-purple text-white'
                      : 'bg-white text-dxc-dark-gray hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Sort Controls */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input text-sm"
            >
              <option value="revenue">Sort by Revenue</option>
              <option value="opportunities">Sort by Opportunities</option>
              <option value="growth">Sort by Growth</option>
            </select>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="bg-white rounded-dxc-lg shadow-lg border border-dxc-light-gray p-6">
        {renderChart()}
      </div>

    </div>
  );
};

export default ServiceLineDistribution;