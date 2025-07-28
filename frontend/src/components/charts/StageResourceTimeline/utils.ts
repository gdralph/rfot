import { DXC_COLORS, type ServiceLine } from '../../../types/index.js';

// Period boundary utility functions
export const getPeriodBoundaries = {
  // Get start and end of quarter containing the given date
  quarter: (date: Date) => {
    const quarterMonth = Math.floor((date.getMonth()) / 3) * 3;
    const start = new Date(date.getFullYear(), quarterMonth, 1);
    const end = new Date(date.getFullYear(), quarterMonth + 3, 0); // Last day of quarter
    return { start, end };
  },
  
  // Get start and end of month containing the given date
  month: (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0); // Last day of month
    return { start, end };
  },
  
  // Get start and end of week containing the given date (Monday to Sunday)
  week: (date: Date) => {
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday = 0
    const start = new Date(date);
    start.setDate(date.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
};

// Calculate period count for range calculation
export const getPeriodCount = (rangeOption: string): number => {
  const match = rangeOption.match(/^(\d+)[QMW]$/);
  return match ? parseInt(match[1]) : 0;
};

export const getServiceLineBaseColor = (serviceLine: ServiceLine): string => {
  const serviceLineColors: Record<ServiceLine, string> = {
    'CES': DXC_COLORS[0], // Bright Purple
    'INS': DXC_COLORS[1], // Bright Teal
    'BPS': DXC_COLORS[2], // Blue
    'SEC': DXC_COLORS[6], // Gold
    'ITOC': DXC_COLORS[4], // Green
    'MW': DXC_COLORS[5], // Orange
  };
  return serviceLineColors[serviceLine];
};