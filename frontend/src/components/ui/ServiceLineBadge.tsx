import type { ServiceLine } from '../../types/index.js';

interface ServiceLineBadgeProps {
  serviceLine: ServiceLine;
  size?: 'sm' | 'xs';
  className?: string;
}

const SERVICE_LINE_COLORS: Record<ServiceLine, string> = {
  CES: 'bg-blue-100 text-blue-800',
  INS: 'bg-green-100 text-green-800', 
  BPS: 'bg-orange-100 text-orange-800',
  SEC: 'bg-red-100 text-red-800',
  ITOC: 'bg-purple-100 text-purple-800',
  MW: 'bg-teal-100 text-teal-800'
};

export function ServiceLineBadge({ serviceLine, size = 'xs', className = '' }: ServiceLineBadgeProps) {
  const colorClass = SERVICE_LINE_COLORS[serviceLine];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : 'text-2xs px-1.5 py-0.5';
  
  return (
    <span 
      className={`inline-flex items-center rounded-md font-medium ${colorClass} ${sizeClass} ${className}`}
      title={`Service Line: ${serviceLine}`}
    >
      {serviceLine}
    </span>
  );
}