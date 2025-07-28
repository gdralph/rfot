import React from 'react';

type TimePeriod = 'week' | 'month' | 'quarter';

interface DateRangeSelectorProps {
  timePeriod: TimePeriod;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  isLoading: boolean;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  timePeriod,
  dateRange,
  onDateRangeChange,
  isLoading,
}) => {
  // Define period-specific range options
  const rangeOptions = {
    quarter: [
      { key: '2Q', label: '2Q' }, 
      { key: '4Q', label: '4Q' }, 
      { key: '6Q', label: '6Q' }, 
      { key: 'all', label: 'All' }
    ],
    month: [
      { key: '6M', label: '6M' }, 
      { key: '12M', label: '12M' }, 
      { key: '18M', label: '18M' }, 
      { key: 'all', label: 'All' }
    ],
    week: [
      { key: '12W', label: '12W' }, 
      { key: '26W', label: '26W' }, 
      { key: '52W', label: '52W' }, 
      { key: 'all', label: 'All' }
    ]
  };

  return (
    <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
      {rangeOptions[timePeriod].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onDateRangeChange(key)}
          disabled={isLoading}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
            dateRange === key
              ? 'bg-dxc-bright-teal text-white shadow-md'
              : 'text-dxc-gray hover:text-dxc-dark-gray hover:bg-gray-200'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default DateRangeSelector;