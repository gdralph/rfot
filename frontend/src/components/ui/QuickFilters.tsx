import React from 'react';
import { Filter } from 'lucide-react';

interface QuickFilter {
  key: string;
  label: string;
  count?: number;
  color?: string;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  activeFilters: string[];
  onFilterToggle: (filterKey: string) => void;
  onClearAll?: () => void;
  className?: string;
}

const QuickFilters: React.FC<QuickFiltersProps> = ({
  filters,
  activeFilters,
  onFilterToggle,
  onClearAll,
  className = ''
}) => {
  const getFilterStyles = (filter: QuickFilter, isActive: boolean) => {
    if (isActive) {
      return `filter-chip-active ${filter.color || 'bg-dxc-bright-purple text-white'}`;
    }
    return 'filter-chip-inactive';
  };

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      <div className="flex items-center gap-1 text-xs text-gray-600 mr-2">
        <Filter className="w-3 h-3" />
        <span>Quick Filters:</span>
      </div>
      
      {filters.map((filter) => {
        const isActive = activeFilters.includes(filter.key);
        
        return (
          <button
            key={filter.key}
            onClick={() => onFilterToggle(filter.key)}
            className={`filter-chip ${getFilterStyles(filter, isActive)}`}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className={`ml-1 ${isActive ? 'text-white' : 'text-gray-500'}`}>
                ({filter.count})
              </span>
            )}
          </button>
        );
      })}
      
      {activeFilters.length > 0 && onClearAll && (
        <button
          onClick={onClearAll}
          className="text-xs text-dxc-bright-purple hover:text-dxc-dark-purple underline ml-2"
        >
          Clear All
        </button>
      )}
    </div>
  );
};

export default QuickFilters;