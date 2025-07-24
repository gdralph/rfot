import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  color = 'primary',
  size = 'sm',
  showValue = false,
  className = '',
  label
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const getColorStyles = (color: string) => {
    switch (color) {
      case 'primary':
        return 'bg-dxc-bright-purple';
      case 'secondary':
        return 'bg-dxc-bright-teal';
      case 'success':
        return 'bg-dxc-green';
      case 'warning':
        return 'bg-dxc-orange';
      case 'danger':
        return 'bg-red-500';
      default:
        return 'bg-dxc-purple';
    }
  };

  const getSizeStyles = (size: string) => {
    switch (size) {
      case 'sm':
        return 'h-1.5';
      case 'md':
        return 'h-2';
      case 'lg':
        return 'h-3';
      default:
        return 'h-1.5';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs font-medium text-gray-700">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-gray-600">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`progress-bar-compact ${getSizeStyles(size)}`}>
        <div
          className={`progress-fill ${getColorStyles(color)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;