import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  maxDisplayCount?: number;
  emptyMessage?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  className = '',
  disabled = false,
  searchable = true,
  clearable = true,
  maxDisplayCount = 3,
  emptyMessage = 'No options found'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Filter options based on search term
  const filteredOptions = searchTerm
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  };

  const handleOptionClick = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter(value => value !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allValues = filteredOptions
      .filter(opt => !opt.disabled)
      .map(opt => opt.value);
    onChange(allValues);
  };

  const handleRemoveSelected = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(value => value !== valueToRemove));
  };

  const getSelectedLabels = () => {
    return selected
      .map(value => options.find(opt => opt.value === value)?.label || value)
      .filter(Boolean);
  };

  const renderSelectedDisplay = () => {
    const selectedLabels = getSelectedLabels();
    
    if (selectedLabels.length === 0) {
      return (
        <span className="text-dxc-medium-gray">
          {placeholder}
        </span>
      );
    }

    if (selectedLabels.length <= maxDisplayCount) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedLabels.map((label, index) => {
            const value = selected[index];
            return (
              <span
                key={value}
                className="bg-dxc-bright-purple text-white px-2 py-1 rounded-full text-xs flex items-center gap-1"
              >
                {label}
                <span
                  onClick={(e) => handleRemoveSelected(value, e)}
                  className="hover:bg-dxc-dark-purple rounded-full p-0.5 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRemoveSelected(value, e);
                    }
                  }}
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="bg-dxc-bright-purple text-white px-2 py-1 rounded-full text-xs">
          {selectedLabels.length} selected
        </span>
        {clearable && (
          <span
            onClick={handleClearAll}
            className="text-dxc-medium-gray hover:text-dxc-dark-gray cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClearAll(e);
              }
            }}
          >
            <X className="w-4 h-4" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Main Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          input w-full text-left flex items-center justify-between gap-2
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:border-dxc-bright-purple'}
          ${isOpen ? 'border-dxc-bright-purple ring-1 ring-dxc-bright-purple' : ''}
        `}
      >
        <div className="flex-1 overflow-hidden">
          {renderSelectedDisplay()}
        </div>
        <div className="flex items-center gap-2 ml-2">
          {selected.length > 0 && clearable && !disabled && (
            <span
              onClick={handleClearAll}
              className="text-dxc-medium-gray hover:text-dxc-dark-gray p-1 cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClearAll(e);
                }
              }}
            >
              <X className="w-4 h-4" />
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-dxc-medium-gray" />
          ) : (
            <ChevronDown className="w-4 h-4 text-dxc-medium-gray" />
          )}
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-dxc-light-gray rounded-dxc shadow-lg max-h-64 overflow-hidden">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-dxc-light-gray">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-dxc-medium-gray w-4 h-4" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2 py-1 border border-dxc-light-gray rounded text-sm focus:outline-none focus:border-dxc-bright-purple"
                />
              </div>
            </div>
          )}

          {/* Control Buttons */}
          {filteredOptions.length > 0 && (
            <div className="p-2 border-b border-dxc-light-gray flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-dxc-bright-purple hover:text-dxc-dark-purple"
                type="button"
              >
                Select All
              </button>
              {selected.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-dxc-medium-gray hover:text-dxc-dark-gray"
                  type="button"
                >
                  Clear All
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-dxc-medium-gray text-sm">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !option.disabled && handleOptionClick(option.value)}
                    disabled={option.disabled}
                    className={`
                      w-full text-left px-3 py-2 text-sm flex items-center gap-2
                      ${option.disabled 
                        ? 'text-dxc-light-gray cursor-not-allowed' 
                        : 'hover:bg-dxc-light-gray/50 cursor-pointer'
                      }
                      ${isSelected ? 'bg-dxc-bright-purple/10 text-dxc-bright-purple' : 'text-dxc-dark-gray'}
                    `}
                  >
                    <div
                      className={`
                        w-4 h-4 border-2 rounded flex items-center justify-center
                        ${isSelected 
                          ? 'border-dxc-bright-purple bg-dxc-bright-purple' 
                          : 'border-dxc-medium-gray'
                        }
                        ${option.disabled ? 'border-dxc-light-gray' : ''}
                      `}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path 
                            fillRule="evenodd" 
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;