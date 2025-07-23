import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Eye } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import type { OpportunityFilters, Opportunity, OpportunityCategory } from '../types/index.js';
import { SALES_STAGES, STAGE_ORDER, CATEGORY_ORDER, SERVICE_LINES } from '../types/index.js';
import { getSecurityClearanceColorClass } from '../utils/securityClearance';
import LoadingSpinner from '../components/LoadingSpinner';
import MultiSelect, { type MultiSelectOption } from '../components/MultiSelect';

// Helper function to calculate opportunity category based on TCV using backend categories
const getOpportunityCategory = (tcvMillions: number | undefined, categories: OpportunityCategory[]): string => {
  if (!tcvMillions || tcvMillions < 0) return 'Uncategorized';
  if (!categories || categories.length === 0) return 'Uncategorized';
  
  // Find the category where TCV falls within the min/max range
  // Categories should be ordered by min_tcv
  for (const category of categories.sort((a, b) => a.min_tcv - b.min_tcv)) {
    if (tcvMillions >= category.min_tcv && 
        (category.max_tcv === null || tcvMillions < (category.max_tcv || Infinity))) {
      return category.name;
    }
  }
  
  // If no category matches, return the highest category (usually Cat A)
  const highestCategory = categories.find(cat => cat.max_tcv === null);
  return highestCategory?.name || 'Uncategorized';
};

// Helper function to map API opportunity to display format
const mapOpportunityForDisplay = (opp: Opportunity, categories: OpportunityCategory[]) => {
  return {
    ...opp,
    name: opp.opportunity_name,
    amount: opp.tcv_millions || 0,
    close_date: opp.decision_date,
    stage: opp.sales_stage,
    category: getOpportunityCategory(opp.tcv_millions, categories),
    assigned_resource: opp.opportunity_owner,
    status: opp.in_forecast === 'Y' ? 'Active' : opp.in_forecast === 'N' ? 'Inactive' : 'Unknown'
  };
};

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
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchTerm || undefined,
      skip: 0, // Reset to first page
    }));
  };

  const handleFilterChange = (key: keyof OpportunityFilters, value: string | string[]) => {
    let filterValue: string | string[] | undefined = value;
    
    if (Array.isArray(value)) {
      filterValue = value.length > 0 ? value : undefined;
    } else {
      filterValue = value || undefined;
    }
    
    setFilters(prev => ({
      ...prev,
      [key]: filterValue,
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
    if (!opportunities || !categories) {
      return [];
    }
    
    if (!sortBy) {
      return opportunities.map(opp => mapOpportunityForDisplay(opp, categories));
    }
    
    // Map opportunities to display format and sort
    return [...opportunities].map(opp => mapOpportunityForDisplay(opp, categories)).sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'stage':
          aVal = STAGE_ORDER[a.stage || ''] ?? 999;
          bVal = STAGE_ORDER[b.stage || ''] ?? 999;
          break;
        case 'amount':
          aVal = a.amount || 0;
          bVal = b.amount || 0;
          break;
        case 'close_date':
          aVal = a.close_date ? new Date(a.close_date) : new Date(0);
          bVal = b.close_date ? new Date(b.close_date) : new Date(0);
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
  }, [opportunities, categories, sortBy, sortOrder]);

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const formatCurrency = (value: number) => {
    if (!value || isNaN(value)) return '$0M';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value) + 'M'; // Value is already in millions
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'No Date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  if (isLoading || categoriesLoading) {
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
            {((Array.isArray(filters.stage) && filters.stage.length) || 
              (Array.isArray(filters.category) && filters.category.length) || 
              (Array.isArray(filters.service_line) && filters.service_line.length) || 
              (Array.isArray(filters.status) && filters.status.length)) && (
              <span className="bg-dxc-bright-teal text-white text-xs px-2 py-1 rounded-full ml-1">
                {(Array.isArray(filters.stage) ? filters.stage.length : 0) + 
                 (Array.isArray(filters.category) ? filters.category.length : 0) + 
                 (Array.isArray(filters.service_line) ? filters.service_line.length : 0) + 
                 (Array.isArray(filters.status) ? filters.status.length : 0)}
              </span>
            )}
          </button>
        </div>
        
        {/* Active Filter Summary */}
        {((Array.isArray(filters.stage) && filters.stage.length) || 
          (Array.isArray(filters.category) && filters.category.length) || 
          (Array.isArray(filters.service_line) && filters.service_line.length) || 
          (Array.isArray(filters.status) && filters.status.length)) && (
          <div className="flex flex-wrap gap-2 items-center pt-2">
            {Array.isArray(filters.stage) && filters.stage.map(stage => (
              <span key={`stage-${stage}`} className="bg-dxc-bright-purple text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                Stage: {SALES_STAGES.find(s => s.code === stage)?.code || stage}
                <span 
                  onClick={() => handleFilterChange('stage', Array.isArray(filters.stage) ? filters.stage.filter(s => s !== stage) : [])}
                  className="hover:bg-dxc-dark-purple rounded-full cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFilterChange('stage', Array.isArray(filters.stage) ? filters.stage.filter(s => s !== stage) : []);
                    }
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            {Array.isArray(filters.category) && filters.category.map(category => (
              <span key={`category-${category}`} className="bg-dxc-blue text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {category}
                <span 
                  onClick={() => handleFilterChange('category', Array.isArray(filters.category) ? filters.category.filter(c => c !== category) : [])}
                  className="hover:bg-blue-700 rounded-full cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFilterChange('category', Array.isArray(filters.category) ? filters.category.filter(c => c !== category) : []);
                    }
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            {Array.isArray(filters.service_line) && filters.service_line.map(serviceLine => (
              <span key={`service-${serviceLine}`} className="bg-dxc-green text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {serviceLine}
                <span 
                  onClick={() => handleFilterChange('service_line', Array.isArray(filters.service_line) ? filters.service_line.filter(s => s !== serviceLine) : [])}
                  className="hover:bg-green-700 rounded-full cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFilterChange('service_line', Array.isArray(filters.service_line) ? filters.service_line.filter(s => s !== serviceLine) : []);
                    }
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            {Array.isArray(filters.status) && filters.status.map(status => (
              <span key={`status-${status}`} className="bg-dxc-orange text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {status}
                <span 
                  onClick={() => handleFilterChange('status', Array.isArray(filters.status) ? filters.status.filter(s => s !== status) : [])}
                  className="hover:bg-orange-700 rounded-full cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFilterChange('status', Array.isArray(filters.status) ? filters.status.filter(s => s !== status) : []);
                    }
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            <button
              onClick={() => setFilters(prev => ({ ...prev, stage: undefined, category: undefined, service_line: undefined, status: undefined }))}
              className="text-dxc-purple hover:text-dxc-purple/80 text-sm underline"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Filter Controls */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dxc-light-gray">
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Stage
              </label>
              <MultiSelect
                options={SALES_STAGES.map((stage): MultiSelectOption => ({
                  value: stage.code,
                  label: stage.label
                }))}
                selected={Array.isArray(filters.stage) ? filters.stage : (filters.stage ? [filters.stage] : [])}
                onChange={(values) => handleFilterChange('stage', values)}
                placeholder="All Stages"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Status
              </label>
              <MultiSelect
                options={[
                  { value: 'In Forecast', label: 'In Forecast' },
                  { value: 'Not In Forecast', label: 'Not In Forecast' }
                ]}
                selected={Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : [])}
                onChange={(values) => handleFilterChange('status', values)}
                placeholder="All Statuses"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Category
              </label>
              <MultiSelect
                options={[
                  ...(categories?.map((category): MultiSelectOption => ({
                    value: category.name,
                    label: category.name
                  })) || []),
                  { value: 'Uncategorized', label: 'Uncategorized' }
                ]}
                selected={Array.isArray(filters.category) ? filters.category : (filters.category ? [filters.category] : [])}
                onChange={(values) => handleFilterChange('category', values)}
                placeholder="All Categories"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                Service Line (Lead Offering)
              </label>
              <MultiSelect
                options={SERVICE_LINES.map((serviceLine): MultiSelectOption => ({
                  value: serviceLine,
                  label: serviceLine
                }))}
                selected={Array.isArray(filters.service_line) ? filters.service_line : (filters.service_line ? [filters.service_line] : [])}
                onChange={(values) => handleFilterChange('service_line', values)}
                placeholder="All Service Lines"
                className="w-full"
              />
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
              <th>Account</th>
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
                  <div className={`font-semibold ${getSecurityClearanceColorClass(opportunity.security_clearance) || 'text-dxc-dark-gray'}`}>
                    {opportunity.account_name || (
                      <span className="text-dxc-medium-gray italic">No account</span>
                    )}
                  </div>
                </td>
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