import React from 'react';

type TimePeriod = 'week' | 'month' | 'quarter';

interface TimelinePeriodSelectorProps {
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  isLoading: boolean;
  startDate: Date;
  endDate: Date;
  getPeriodBoundaries: {
    quarter: (date: Date) => { start: Date; end: Date };
    month: (date: Date) => { start: Date; end: Date };
    week: (date: Date) => { start: Date; end: Date };
  };
}

const TimelinePeriodSelector: React.FC<TimelinePeriodSelectorProps> = ({
  timePeriod,
  onTimePeriodChange,
  isLoading,
  startDate,
  endDate,
  getPeriodBoundaries,
}) => {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
      {(['week', 'month', 'quarter'] as const).map(period => {
        const isCurrentPeriod = (() => {
          const now = new Date();
          const currentBoundary = getPeriodBoundaries[period](now);
          return startDate <= currentBoundary.start && endDate >= currentBoundary.end;
        })();
        
        return (
          <button
            key={period}
            onClick={() => onTimePeriodChange(period)}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-all relative ${
              timePeriod === period
                ? 'bg-dxc-bright-purple text-white shadow-md'
                : 'text-dxc-gray hover:text-dxc-dark-gray hover:bg-gray-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}s
            {isCurrentPeriod && timePeriod === period && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-dxc-bright-teal rounded-full" title="Includes current period" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TimelinePeriodSelector;