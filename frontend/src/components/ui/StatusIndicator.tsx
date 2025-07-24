import React from 'react';

type StatusType = 'active' | 'inactive' | 'pending' | 'warning' | 'error' | 'success';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'sm',
  showLabel = true,
  className = ''
}) => {
  const getStatusStyles = (status: StatusType) => {
    switch (status) {
      case 'active':
      case 'success':
        return 'bg-green-500';
      case 'pending':
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'inactive':
      default:
        return 'bg-gray-400';
    }
  };

  const getSizeStyles = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'md':
        return 'w-3 h-3';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-2 h-2';
    }
  };

  const getStatusLabel = (status: StatusType) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'pending':
        return 'Pending';
      case 'warning':
        return 'Warning';
      case 'error':
        return 'Error';
      case 'success':
        return 'Success';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`status-indicator ${getSizeStyles(size)} ${getStatusStyles(status)}`}
        title={label || getStatusLabel(status)}
      />
      {showLabel && (
        <span className="text-xs font-medium text-gray-700">
          {label || getStatusLabel(status)}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;