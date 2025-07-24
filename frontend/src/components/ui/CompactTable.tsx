import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
}

interface CompactTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  className?: string;
  maxHeight?: string;
}

type SortOrder = 'asc' | 'desc' | null;

function CompactTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  className = '',
  maxHeight = '400px'
}: CompactTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : sortOrder === 'desc' ? null : 'asc');
      if (sortOrder === 'desc') {
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortOrder) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortOrder]);

  const getSortIcon = (key: keyof T) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    if (sortOrder === 'asc') return <ArrowUp className="w-3 h-3" />;
    if (sortOrder === 'desc') return <ArrowDown className="w-3 h-3" />;
    return <ArrowUpDown className="w-3 h-3 opacity-50" />;
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto" style={{ maxHeight }}>
        <table className="table-compact">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''} ${column.width || ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr
                key={index}
                className={onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className={column.width || ''}>
                    {column.render 
                      ? column.render(item[column.key], item)
                      : String(item[column.key] || '')
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No data available
        </div>
      )}
    </div>
  );
}

export default CompactTable;