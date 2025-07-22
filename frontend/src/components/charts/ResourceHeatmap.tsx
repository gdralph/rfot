import React, { useState } from 'react';
import { Users, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { SERVICE_LINES, type ServiceLine } from '../../types/index';

interface ResourceAllocation {
  serviceLine: ServiceLine;
  week: number;
  utilization: number;
  capacity: number;
  demand: number;
  efficiency: number;
  category: string;
}

interface ResourceHeatmapProps {
  data: ResourceAllocation[];
  weeks?: number;
  showLegend?: boolean;
  onCellClick?: (allocation: ResourceAllocation) => void;
  filters?: {
    stage?: string;
    category?: string;
    service_line?: string;
    lead_offering?: string;
  };
}

const ResourceHeatmap: React.FC<ResourceHeatmapProps> = ({
  data,
  weeks = 12,
  showLegend = true,
  onCellClick,
  filters
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'utilization' | 'demand' | 'efficiency'>('utilization');
  const [hoveredCell, setHoveredCell] = useState<ResourceAllocation | null>(null);

  // Generate complete grid data
  const generateHeatmapData = () => {
    const heatmapData: ResourceAllocation[][] = [];
    
    // Filter service lines based on filters
    const filteredServiceLines = filters?.service_line 
      ? SERVICE_LINES.filter(sl => sl === filters.service_line)
      : SERVICE_LINES;
    
    filteredServiceLines.forEach((serviceLine) => {
      const serviceData: ResourceAllocation[] = [];
      
      for (let week = 1; week <= weeks; week++) {
        let existingData = data.find(d => d.serviceLine === serviceLine && d.week === week);
        
        // Apply additional filters if data exists
        if (existingData && filters) {
          if (filters.category && existingData.category !== filters.category) {
            existingData = undefined;
          }
        }
        
        if (existingData) {
          serviceData.push(existingData);
        } else {
          // Generate mock data for missing weeks
          serviceData.push({
            serviceLine,
            week,
            utilization: Math.random() * 100,
            capacity: 40 + Math.random() * 20, // 40-60 person weeks
            demand: 35 + Math.random() * 30,   // 35-65 person weeks
            efficiency: 0.7 + Math.random() * 0.3, // 70-100%
            category: filters?.category || 'Normal'
          });
        }
      }
      
      heatmapData.push(serviceData);
    });
    
    return heatmapData;
  };

  const heatmapData = generateHeatmapData();
  
  // Get filtered service lines for row rendering
  const filteredServiceLines = filters?.service_line 
    ? SERVICE_LINES.filter(sl => sl === filters.service_line)
    : SERVICE_LINES;

  const getIntensityColor = (value: number, metric: string) => {
    let normalizedValue: number;
    
    switch (metric) {
      case 'utilization':
        normalizedValue = Math.min(value / 100, 1);
        break;
      case 'demand':
        normalizedValue = Math.min(value / 80, 1); // Assuming max demand of 80
        break;
      case 'efficiency':
        normalizedValue = value; // Already 0-1
        break;
      default:
        normalizedValue = 0;
    }
    
    // Generate color intensity based on value
    if (normalizedValue < 0.3) {
      return `rgba(108, 194, 74, ${0.2 + normalizedValue * 0.6})`; // Green for low
    } else if (normalizedValue < 0.7) {
      return `rgba(237, 155, 51, ${0.3 + normalizedValue * 0.5})`; // Orange for medium
    } else {
      return `rgba(95, 36, 159, ${0.4 + normalizedValue * 0.4})`; // Purple for high
    }
  };

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'utilization':
        return `${Math.round(value)}%`;
      case 'demand':
        return `${Math.round(value)}pw`; // person weeks
      case 'efficiency':
        return `${Math.round(value * 100)}%`;
      default:
        return value.toString();
    }
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'utilization':
        return 'Resource Utilization';
      case 'demand':
        return 'Demand (Person Weeks)';
      case 'efficiency':
        return 'Efficiency Rating';
      default:
        return metric;
    }
  };

  const getStatusIcon = (allocation: ResourceAllocation) => {
    if (allocation.utilization > 90) {
      return <AlertTriangle className="w-3 h-3 text-red-500" />;
    } else if (allocation.utilization > 75) {
      return <TrendingUp className="w-3 h-3 text-orange-500" />;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-dxc-bright-purple" />
          <div>
            <h3 className="text-dxc-subtitle font-semibold">Resource Allocation Heatmap</h3>
            <p className="text-sm text-dxc-medium-gray">
              {weeks}-week resource planning across service lines
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {['utilization', 'demand', 'efficiency'].map((metric) => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric as 'utilization' | 'demand' | 'efficiency')}
              className={`px-3 py-1 rounded-dxc text-sm font-medium transition-colors ${
                selectedMetric === metric
                  ? 'bg-dxc-bright-purple text-white'
                  : 'bg-gray-100 text-dxc-dark-gray hover:bg-gray-200'
              }`}
            >
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-white rounded-dxc-lg shadow-lg border border-dxc-light-gray overflow-hidden">
        <div className="p-4">
          <div className="overflow-x-auto">
            <div className="grid grid-cols-1 gap-4" style={{ minWidth: `${200 + weeks * 70}px` }}>
            {/* Week headers */}
            <div 
              className="grid gap-1"
              style={{ gridTemplateColumns: `200px repeat(${weeks}, minmax(60px, 1fr))` }}
            >
              <div className="text-xs font-semibold text-dxc-dark-gray p-2">Service Line</div>
              {Array.from({ length: weeks }, (_, i) => (
                <div key={i} className="text-xs font-semibold text-dxc-dark-gray p-2 text-center">
                  W{i + 1}
                </div>
              ))}
            </div>

            {/* Heatmap rows */}
            {heatmapData.map((serviceData, serviceIndex) => (
              <div 
                key={filteredServiceLines[serviceIndex]} 
                className="grid gap-1"
                style={{ gridTemplateColumns: `200px repeat(${weeks}, minmax(60px, 1fr))` }}
              >
                {/* Service line label */}
                <div className="flex items-center p-2 font-semibold text-dxc-dark-gray bg-gray-50 rounded-dxc">
                  {filteredServiceLines[serviceIndex]}
                </div>
                
                {/* Week cells */}
                {serviceData.map((allocation, weekIndex) => (
                  <div
                    key={`${serviceIndex}-${weekIndex}`}
                    className="relative p-2 rounded cursor-pointer transition-all duration-200 hover:scale-105 hover:z-10 hover:shadow-lg"
                    style={{
                      backgroundColor: getIntensityColor(
                        selectedMetric === 'utilization' ? allocation.utilization :
                        selectedMetric === 'demand' ? allocation.demand :
                        allocation.efficiency,
                        selectedMetric
                      )
                    }}
                    onClick={() => onCellClick?.(allocation)}
                    onMouseEnter={() => setHoveredCell(allocation)}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <div className="text-xs font-medium text-center">
                      {formatValue(
                        selectedMetric === 'utilization' ? allocation.utilization :
                        selectedMetric === 'demand' ? allocation.demand :
                        allocation.efficiency,
                        selectedMetric
                      )}
                    </div>
                    
                    {/* Status indicator */}
                    <div className="absolute top-0 right-0 p-0.5">
                      {getStatusIcon(allocation)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend and Stats */}
      {showLegend && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Color Legend */}
          <div className="bg-white rounded-dxc border border-dxc-light-gray p-4">
            <h4 className="font-semibold text-dxc-dark-gray mb-3">
              {getMetricLabel(selectedMetric)} Scale
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(108, 194, 74, 0.6)' }} />
                <span className="text-sm text-dxc-dark-gray">Low (0-30%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(237, 155, 51, 0.6)' }} />
                <span className="text-sm text-dxc-dark-gray">Medium (30-70%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(95, 36, 159, 0.6)' }} />
                <span className="text-sm text-dxc-dark-gray">High (70-100%)</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-dxc border border-dxc-light-gray p-4">
            <h4 className="font-semibold text-dxc-dark-gray mb-3">Quick Stats</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dxc-medium-gray">Peak Utilization:</span>
                <span className="font-medium text-dxc-bright-purple">
                  {Math.max(...data.map(d => d.utilization)).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dxc-medium-gray">Avg Efficiency:</span>
                <span className="font-medium text-dxc-blue">
                  {(data.reduce((sum, d) => sum + d.efficiency, 0) / data.length * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dxc-medium-gray">Total Demand:</span>
                <span className="font-medium text-dxc-green">
                  {Math.round(data.reduce((sum, d) => sum + d.demand, 0))} pw
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover Details */}
      {hoveredCell && (
        <div className="bg-dxc-bright-purple text-white p-4 rounded-dxc shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="font-semibold">
              {hoveredCell.serviceLine} - Week {hoveredCell.week}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="opacity-75">Utilization</div>
              <div className="font-semibold">{hoveredCell.utilization.toFixed(0)}%</div>
            </div>
            <div>
              <div className="opacity-75">Demand</div>
              <div className="font-semibold">{hoveredCell.demand.toFixed(0)} pw</div>
            </div>
            <div>
              <div className="opacity-75">Efficiency</div>
              <div className="font-semibold">{(hoveredCell.efficiency * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceHeatmap;