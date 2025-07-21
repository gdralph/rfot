import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Eye } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import type { OpportunityFilters } from '../types/index.js';
import { SALES_STAGES, STAGE_ORDER, OPPORTUNITY_CATEGORIES, CATEGORY_ORDER, SERVICE_LINES } from '../types/index.js';
import LoadingSpinner from '../components/LoadingSpinner';

const Opportunities: React.FC = () => {
  const [filters, setFilters] = useState<OpportunityFilters>({
    skip: 0,
    limit: 50,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: opportunities, isLoading, error } = useOpportunities(filters);

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchTerm || undefined,
      skip: 0, // Reset to first page
    }));
  };

  const handleFilterChange = (key: keyof OpportunityFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      skip: 0, // Reset to first page
    }));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc'); // Default to desc for new fields
    }
  };

  const sortedOpportunities = React.useMemo(() => {
    if (!opportunities || !sortBy) return opportunities;
    
    // Create a stable copy to avoid sorting the original array
    return [...opportunities].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'stage':
          aVal = STAGE_ORDER[a.stage] ?? 999;
          bVal = STAGE_ORDER[b.stage] ?? 999;
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'close_date':
          aVal = new Date(a.close_date);
          bVal = new Date(b.close_date);
          break;
        case 'category':
          aVal = CATEGORY_ORDER[a.category || ''] ?? 999;
          bVal = CATEGORY_ORDER[b.category || ''] ?? 999;
          break;
        case 'assigned_resource':
          aVal = a.assigned_resource || '';
          bVal = b.assigned_resource || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [opportunities, sortBy, sortOrder]);

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading opportunities..." />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-dxc-slide mb-4">Opportunities</h2>
        <div className="bg-red-50 border border-red-200 rounded-dxc p-4">
          <p className="text-red-700">Error loading opportunities. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-dxc-section mb-2">Opportunities</h1>
          <p className="text-dxc-dark-gray">Manage and track sales opportunities</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-dxc p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dxc-medium-gray w-4 h-4" />
            <input
              type="text"
              placeholder="Search by opportunity name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="input pl-10 w-full"
            />
          </div>
          <button
            onClick={handleSearch}
            className="btn-primary"
          >
            Search
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-dxc-bright-purple text-white' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dxc-light-gray">
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Stage
              </label>
              <select
                value={filters.stage || ''}
                onChange={(e) => handleFilterChange('stage', e.target.value)}
                className="input w-full"
              >
                <option value="">All Stages</option>
                {SALES_STAGES.map((stage) => (
                  <option key={stage.code} value={stage.code}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input w-full"
              >
                <option value="">All Statuses</option>
                <option value="In Forecast">In Forecast (1,629)</option>
                <option value="Not In Forecast">Not In Forecast (2,402)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="input w-full"
              >
                <option value="">All Categories</option>
                {OPPORTUNITY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Service Line
              </label>
              <select
                value={filters.service_line || ''}
                onChange={(e) => handleFilterChange('service_line', e.target.value)}
                className="input w-full"
              >
                <option value="">All Service Lines</option>
                {SERVICE_LINES.map((serviceLine) => (
                  <option key={serviceLine} value={serviceLine}>
                    {serviceLine}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center text-sm text-dxc-dark-gray">
        <div>
          Showing {sortedOpportunities?.length || 0} opportunities
          {sortBy && (
            <span className="ml-2 text-dxc-purple">
              (sorted by {sortBy.replace('_', ' ')} {sortOrder === 'asc' ? '↑' : '↓'})
            </span>
          )}
        </div>
        {sortBy && (
          <button
            onClick={() => {
              setSortBy('');
              setSortOrder('desc');
            }}
            className="text-dxc-purple hover:text-dxc-purple/80 text-sm"
          >
            Clear Sort
          </button>
        )}
      </div>

      {/* Opportunities Table */}
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>
                <button 
                  onClick={() => handleSort('name')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Opportunity {getSortIcon('name')}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('stage')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Stage {getSortIcon('stage')}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('amount')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Amount {getSortIcon('amount')}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('close_date')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Close Date {getSortIcon('close_date')}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('category')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Category {getSortIcon('category')}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('assigned_resource')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Assigned Resource {getSortIcon('assigned_resource')}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('status')}
                  className="text-left hover:text-dxc-purple font-semibold"
                >
                  Status {getSortIcon('status')}
                </button>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedOpportunities?.map((opportunity) => (
              <tr key={opportunity.id}>
                <td>
                  <div>
                    <div className="font-semibold text-dxc-dark-gray">
                      {opportunity.name}
                    </div>
                    <div className="text-sm text-dxc-medium-gray">
                      {opportunity.opportunity_id}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-dxc-bright-purple text-white">
                    {opportunity.stage}
                  </span>
                </td>
                <td className="font-semibold">
                  {formatCurrency(opportunity.amount)}
                </td>
                <td>
                  {formatDate(opportunity.close_date)}
                </td>
                <td>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    opportunity.category === 'Cat A' ? 'bg-dxc-green text-white' :
                    opportunity.category === 'Cat B' ? 'bg-dxc-blue text-white' :
                    opportunity.category === 'Cat C' ? 'bg-dxc-orange text-white' :
                    opportunity.category === 'Negative' ? 'bg-red-500 text-white' :
                    'bg-dxc-light-gray text-dxc-dark-gray'
                  }`}>
                    {opportunity.category || 'Unassigned'}
                  </span>
                </td>
                <td>
                  {opportunity.assigned_resource || (
                    <span className="text-dxc-medium-gray italic">Unassigned</span>
                  )}
                </td>
                <td>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    opportunity.status === 'Active' ? 'bg-green-100 text-green-800' :
                    opportunity.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                    opportunity.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {opportunity.status || 'Unknown'}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <Link
                      to={`/opportunity/${opportunity.id}`}
                      className="text-dxc-bright-purple hover:text-dxc-dark-purple"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {sortedOpportunities && sortedOpportunities.length === 0 && (
        <div className="text-center py-12">
          <div className="text-dxc-medium-gray">
            <Search className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg mb-2">No opportunities found</p>
            <p className="text-sm">Try adjusting your search criteria or filters</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Opportunities;