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
import { PieChart as PieChartIcon, BarChart3, Grid3X3, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import { DXC_COLORS, type ServiceLine } from '../../types/index';

interface AnalysisData {
  serviceLine: ServiceLine;
  leadOffering: ServiceLine;
  revenue: number;
  percentage: number;
  opportunities: number;
  avgDealSize: number;
  growth: number;
  stage: string;
  category: string;
}

interface ServiceLineAnalysisChartProps {
  serviceLineData: Array<{
    serviceLine: ServiceLine;
    revenue: number;
    percentage: number;
    opportunities: number;
    avgDealSize: number;
    growth: number;
    stage: string;
    category: string;
  }>;
  leadOfferingData: Array<{
    leadOffering: ServiceLine;
    revenue: number;
    percentage: number;
    opportunities: number;
    avgDealSize: number;
    growth: number;
    stage: string;
    category: string;
  }>;
  title?: string;
  showControls?: boolean;
  onItemClick?: (item: ServiceLine) => void;
}

type ViewMode = 'pie' | 'bar' | 'treemap' | 'detailed';
type AnalysisMode = 'service_line' | 'lead_offering';

const ServiceLineAnalysisChart: React.FC<ServiceLineAnalysisChartProps> = ({
  serviceLineData,
  leadOfferingData,
  title = "Service Line Analysis",
  showControls = true,
  onItemClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('pie');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('service_line');
  const [sortBy, setSortBy] = useState<'revenue' | 'opportunities' | 'growth'>('revenue');

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

  // Convert data to unified format based on analysis mode
  const currentData: AnalysisData[] = React.useMemo(() => {
    if (analysisMode === 'service_line') {
      return serviceLineData.map(item => ({
        ...item,
        leadOffering: item.serviceLine, // For compatibility
      }));
    } else {
      return leadOfferingData.map(item => ({
        ...item,
        serviceLine: item.leadOffering, // For compatibility
      }));
    }
  }, [serviceLineData, leadOfferingData, analysisMode]);

  // Sort data based on selected criteria
  const sortedData = [...currentData].sort((a, b) => {
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
    name: analysisMode === 'service_line' ? item.serviceLine : item.leadOffering,
    size: item.revenue,
    fill: DXC_COLORS[index % DXC_COLORS.length],
    ...item
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const displayName = analysisMode === 'service_line' ? data.serviceLine : data.leadOffering;
      return (
        <div className="bg-white p-4 border border-dxc-light-gray rounded-dxc shadow-lg max-w-xs">
          <h4 className="font-semibold text-dxc-bright-purple mb-2">{displayName}</h4>
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
              <span className="font-medium">
                {data.opportunities > 0 ? formatCurrency(data.avgDealSize) : 'N/A'}
              </span>
            </div>
            {data.growth !== 0 && (
              <div className="flex justify-between">
                <span>Growth:</span>
                <span className={`font-medium ${data.growth >= 0 ? 'text-dxc-green' : 'text-red-500'}`}>
                  {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(1)}%
                </span>
              </div>
            )}
            {data.opportunities === 0 && data.revenue === 0 && (
              <div className="text-xs text-dxc-medium-gray mt-2 italic">
                No opportunities with {displayName} revenue found
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const TreemapContent = (props: any) => {
    const { x, y, width, height, index, payload, name } = props;
    
    // Return early if dimensions are invalid
    if (width <= 0 || height <= 0) {
      return null;
    }

    // Handle both direct payload and nested payload structures
    const data = payload || props;
    const displayName = name || data.name || (analysisMode === 'service_line' ? data.serviceLine : data.leadOffering);
    const fillColor = data.fill || DXC_COLORS[index % DXC_COLORS.length] || '#8884d8';
    const revenue = data.revenue || data.size || 0;
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fillColor,
            fillOpacity: 0.8,
            stroke: '#fff',
            strokeWidth: 2,
            cursor: 'pointer'
          }}
          onClick={() => onItemClick?.(displayName)}
        />
        {width > 40 && height > 30 && displayName && (
          <>
            <text 
              x={x + width / 2} 
              y={y + height / 2 - (revenue > 0 ? 8 : 0)} 
              textAnchor="middle" 
              fill="#fff" 
              fontSize="12" 
              fontWeight="bold"
            >
              {displayName}
            </text>
            {revenue > 0 && height > 50 && (
              <text 
                x={x + width / 2} 
                y={y + height / 2 + 12} 
                textAnchor="middle" 
                fill="#fff" 
                fontSize="10"
              >
                {formatCurrency(revenue)}
              </text>
            )}
          </>
        )}
      </g>
    );
  };

  const renderChart = () => {
    const dataKey = analysisMode === 'service_line' ? 'serviceLine' : 'leadOffering';
    
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
                label={({ percentage }) => {
                  const item = sortedData[0]; // Access current item
                  const displayName = analysisMode === 'service_line' ? item?.serviceLine : item?.leadOffering;
                  return `${displayName} (${percentage?.toFixed(1)}%)`;
                }}
                labelLine={false}
              >
                {sortedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={DXC_COLORS[index % DXC_COLORS.length]}
                    onClick={() => onItemClick?.(analysisMode === 'service_line' ? entry.serviceLine : entry.leadOffering)}
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
              <XAxis dataKey={dataKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="revenue" 
                radius={[4, 4, 0, 0]}
                onClick={(data: any) => onItemClick?.(analysisMode === 'service_line' ? data.serviceLine : data.leadOffering)}
                className="cursor-pointer"
              >
                {sortedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={DXC_COLORS[index % DXC_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'treemap':
        // Create test data with guaranteed non-zero values for debugging
        const testTreemapData = treemapData.length === 0 || treemapData.every(d => d.size === 0) ? [
          { name: 'CES', size: 4171.87, fill: DXC_COLORS[0], serviceLine: 'CES', leadOffering: 'CES', revenue: 4171.87, percentage: 38.4, opportunities: 1560, avgDealSize: 2.25, growth: 0, stage: 'Active', category: 'Enterprise' },
          { name: 'ITOC', size: 4047.79, fill: DXC_COLORS[1], serviceLine: 'ITOC', leadOffering: 'ITOC', revenue: 4047.79, percentage: 37.3, opportunities: 901, avgDealSize: 5.83, growth: 0, stage: 'Active', category: 'Enterprise' },
          { name: 'MW', size: 1111.10, fill: DXC_COLORS[2], serviceLine: 'MW', leadOffering: 'MW', revenue: 1111.10, percentage: 10.2, opportunities: 408, avgDealSize: 2.47, growth: 0, stage: 'Active', category: 'Enterprise' },
          { name: 'SEC', size: 866.99, fill: DXC_COLORS[3], serviceLine: 'SEC', leadOffering: 'SEC', revenue: 866.99, percentage: 7.99, opportunities: 343, avgDealSize: 1.15, growth: 0, stage: 'Active', category: 'Enterprise' },
          { name: 'INS', size: 474.48, fill: DXC_COLORS[4], serviceLine: 'INS', leadOffering: 'INS', revenue: 474.48, percentage: 4.37, opportunities: 724, avgDealSize: 0.65, growth: 0, stage: 'Active', category: 'Enterprise' },
          { name: 'BPS', size: 178.60, fill: DXC_COLORS[5], serviceLine: 'BPS', leadOffering: 'BPS', revenue: 178.60, percentage: 1.65, opportunities: 29, avgDealSize: 4.49, growth: 0, stage: 'Active', category: 'Enterprise' }
        ] : treemapData;
        
        return (
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={testTreemapData}
              dataKey="size"
              aspectRatio={4/3}
              stroke="#fff"
              content={<TreemapContent />}
            />
          </ResponsiveContainer>
        );

      case 'detailed':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedData.map((item, index) => {
              const displayName = analysisMode === 'service_line' ? item.serviceLine : item.leadOffering;
              return (
                <div
                  key={displayName}
                  className="bg-white border border-dxc-light-gray rounded-dxc p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onItemClick?.(displayName)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: DXC_COLORS[index % DXC_COLORS.length] }}
                    />
                    <h4 className="font-semibold text-dxc-bright-purple">{displayName}</h4>
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
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  // Show empty state when no data
  if (!currentData || currentData.length === 0 || currentData.every(item => item.revenue <= 0)) {
    const emptyType = analysisMode === 'service_line' ? 'Service Line' : 'Lead Offering';
    return (
      <div className="space-y-4">
        <h3 className="text-dxc-subtitle font-semibold flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-dxc-bright-purple" />
          {title}
        </h3>
        <div className="bg-white rounded-dxc-lg shadow-lg border border-dxc-light-gray p-12 text-center">
          <div className="text-dxc-medium-gray">
            <PieChartIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h4 className="text-lg font-medium mb-2">No {emptyType} Data</h4>
            <p className="text-sm">No opportunities with {emptyType.toLowerCase()} revenue found. Import opportunities to see {emptyType.toLowerCase()} distribution.</p>
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
            {/* Analysis Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-dxc border border-dxc-light-gray">
              <span className="text-sm font-medium text-dxc-dark-gray">Analysis:</span>
              <button
                onClick={() => setAnalysisMode(analysisMode === 'service_line' ? 'lead_offering' : 'service_line')}
                className="flex items-center gap-2 text-sm font-medium text-dxc-bright-purple hover:text-dxc-purple transition-colors"
              >
                {analysisMode === 'service_line' ? (
                  <>
                    <ToggleLeft className="w-4 h-4" />
                    Service Line
                  </>
                ) : (
                  <>
                    <ToggleRight className="w-4 h-4" />
                    Lead Offering
                  </>
                )}
              </button>
            </div>

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

export default ServiceLineAnalysisChart;