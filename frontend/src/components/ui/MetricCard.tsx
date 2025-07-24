import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-dxc-bright-purple',
  trend,
  subtitle,
  onClick,
  className = ''
}) => {
  return (
    <div 
      className={`metric-card-compact ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-xs font-medium text-gray-600">{title}</span>
      </div>
      
      <div className="mb-1">
        <div className={`text-lg font-bold ${iconColor}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-500">{subtitle}</div>
        )}
      </div>
      
      {trend && (
        <div className={`text-xs font-medium ${
          trend.isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          {trend.isPositive ? '+' : ''}{trend.value}
        </div>
      )}
    </div>
  );
};

export default MetricCard;