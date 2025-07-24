import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, Edit, Grid, List, Star, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import type { OpportunityFilters, Opportunity, OpportunityCategory } from '../types/index.js';
import { SALES_STAGES, SERVICE_LINES } from '../types/index.js';
import { getSecurityClearanceColorClass } from '../utils/securityClearance';
import LoadingSpinner from '../components/LoadingSpinner';
import MultiSelect, { type MultiSelectOption } from '../components/MultiSelect';

// Enhanced UI Components
import MetricCard from '../components/ui/MetricCard';
import CompactTable from '../components/ui/CompactTable';
import StatusIndicator from '../components/ui/StatusIndicator';

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
  // Format currency helper (used in mapping)
  const formatCurrencyForDisplay = (value: number) => {
    if (!value || isNaN(value)) return '$0.00M';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + 'M';
  };

  // Format date helper (used in mapping)
  const formatDateForDisplay = (dateString: string | undefined | null) => {
    if (!dateString) return 'TBD';
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

  return {
    ...opp,
    // Keep original id for navigation, display opportunity_id in table
    display_id: opp.opportunity_id, // For display in ID column
    name: opp.opportunity_name,
    amount: formatCurrencyForDisplay(opp.tcv_millions || 0), // Format currency in mapping
    close_date: formatDateForDisplay(opp.decision_date), // Format date in mapping
    stage: opp.sales_stage,
    category: getOpportunityCategory(opp.tcv_millions, categories),
    assigned_resource: opp.opportunity_owner || 'Unassigned',
    status: opp.in_forecast === 'Y' ? 'Active' : opp.in_forecast === 'N' ? 'Inactive' : 'Unknown',
    // Keep raw values for calculations
    raw_amount: opp.tcv_millions || 0,
    raw_close_date: opp.decision_date
  };
};

const OpportunitiesV2: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<OpportunityFilters>({
    skip: 0,
    // No limit - get ALL opportunities regardless of count
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Data hooks - get all filtered opportunities
  const { data: opportunities, isLoading: opportunitiesLoading, error: opportunitiesError } = useOpportunities(filters);
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  // Search and filter handlers
  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchTerm || undefined,
      skip: 0, // Reset to first page
    }));
    setCurrentPage(1); // Reset to first page when searching
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
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const isLoading = opportunitiesLoading || categoriesLoading;

  // Map all filtered opportunities for display and stats
  const allFilteredOpportunities = useMemo(() => {
    if (!opportunities) return [];
    
    // Map all filtered opportunities
    return opportunities.map(opp => mapOpportunityForDisplay(opp, categories || []));
  }, [opportunities, categories]);

  // Get current page of opportunities for table display
  const displayOpportunities = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return allFilteredOpportunities.slice(startIndex, endIndex);
  }, [allFilteredOpportunities, currentPage, itemsPerPage]);

  // Calculate pagination info
  const totalPages = Math.ceil(allFilteredOpportunities.length / itemsPerPage);
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, allFilteredOpportunities.length);
  const endItem = Math.min(currentPage * itemsPerPage, allFilteredOpportunities.length);

  // Calculate summary metrics from ALL filtered opportunities
  const summaryMetrics = useMemo(() => {
    const total = allFilteredOpportunities.length;
    const totalValue = allFilteredOpportunities.reduce((sum, opp) => sum + (opp.raw_amount || 0), 0);
    const avgValue = total > 0 ? totalValue / total : 0;
    const activeCount = allFilteredOpportunities.filter(opp => opp.status === 'Active').length;
    const lateStageCount = allFilteredOpportunities.filter(opp => 
      ['04A', '04B', '05A', '05B'].includes(opp.stage || '')
    ).length;
    const highValueCount = allFilteredOpportunities.filter(opp => (opp.raw_amount || 0) > 5).length;

    return {
      total,
      totalValue,
      avgValue,
      activeCount,
      lateStageCount,
      highValueCount
    };
  }, [allFilteredOpportunities]);

  // Format currency helper
  const formatCurrency = (value: number) => {
    if (!value || isNaN(value)) return '$0.00M';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + 'M';
  };


  // Get stage status color
  const getStageStatusColor = (stage: string | undefined) => {
    if (!stage) return 'text-gray-500';
    const stageIndex = SALES_STAGES.findIndex(s => s.code === stage);
    if (stageIndex >= 6) return 'text-dxc-green'; // Late stages
    if (stageIndex >= 3) return 'text-dxc-orange'; // Mid stages
    return 'text-dxc-blue'; // Early stages
  };

  // Handle bulk operations
  const handleSelectAll = () => {
    if (selectedOpportunities.length === displayOpportunities.length) {
      setSelectedOpportunities([]);
    } else {
      setSelectedOpportunities(displayOpportunities.map(opp => String(opp.id)).filter((id): id is string => id !== undefined));
    }
  };

  const handleSelectOpportunity = (id: string) => {
    setSelectedOpportunities(prev => 
      prev.includes(id) 
        ? prev.filter(oppId => oppId !== id)
        : [...prev, id]
    );
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading opportunities..." />;
  }

  if (opportunitiesError) {
    return (
      <div className="p-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Opportunities</h2>
          <p className="text-red-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-dxc-bright-purple">Opportunities</h1>
          <p className="text-xs text-dxc-dark-gray">
            {summaryMetrics.total} opportunities • {formatCurrency(summaryMetrics.totalValue)} total value
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status="success" label="Live" size="sm" />
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid-metrics-6">
        <MetricCard
          title="Total Opportunities"
          value={summaryMetrics.total}
          icon={Eye}
          iconColor="text-dxc-bright-purple"
          trend={{ value: `${summaryMetrics.activeCount} active`, isPositive: true }}
        />
        
        <MetricCard
          title="Total Value"
          value={formatCurrency(summaryMetrics.totalValue)}
          icon={Star}
          iconColor="text-dxc-bright-teal"
          trend={{ value: "+12% vs last month", isPositive: true }}
        />
        
        <MetricCard
          title="Average Value"
          value={formatCurrency(summaryMetrics.avgValue)}
          icon={Clock}
          iconColor="text-dxc-blue"
          trend={{ value: "Stable", isPositive: true }}
        />
        
        <MetricCard
          title="Late Stage"
          value={summaryMetrics.lateStageCount}
          icon={CheckCircle2}
          iconColor="text-dxc-green"
          subtitle={`${((summaryMetrics.lateStageCount / summaryMetrics.total) * 100).toFixed(0)}% of total`}
        />
        
        <MetricCard
          title="High Value (>$5M)"
          value={summaryMetrics.highValueCount}
          icon={AlertCircle}
          iconColor="text-dxc-orange"
          subtitle={`${((summaryMetrics.highValueCount / summaryMetrics.total) * 100).toFixed(0)}% of total`}
        />
        
        <MetricCard
          title="Win Rate"
          value="78.5%"
          icon={Star}
          iconColor="text-dxc-gold"
          trend={{ value: "+2.1% vs target", isPositive: true }}
        />
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-3">
        <div className="flex items-center gap-3 mb-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search opportunities, accounts, owners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-dxc-bright-purple focus:border-dxc-bright-purple"
            />
          </div>
          
          <button
            onClick={handleSearch}
            className="btn-primary text-xs px-3 py-1.5"
          >
            Search
          </button>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded border transition-colors flex items-center gap-1 ${
              showFilters 
                ? 'bg-dxc-bright-purple text-white border-dxc-bright-purple' 
                : 'text-gray-600 hover:text-dxc-bright-purple border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-dxc-bright-purple text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-dxc-bright-purple text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedOpportunities.length > 0 && (
          <div className="mb-3 p-2 bg-dxc-bright-purple/5 border border-dxc-bright-purple/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dxc-bright-purple font-medium">
                {selectedOpportunities.length} opportunities selected
              </span>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  Export Selected
                </button>
                <button className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  Bulk Edit
                </button>
                <button 
                  onClick={() => setSelectedOpportunities([])}
                  className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
                  Service Line
                </label>
                <MultiSelect
                  options={SERVICE_LINES.map((serviceLine): MultiSelectOption => ({
                    value: serviceLine,
                    label: serviceLine
                  }))}
                  selected={Array.isArray(filters.service_line) ? filters.service_line : (filters.service_line ? [filters.service_line] : [])}
                  onChange={(values) => handleFilterChange('service_line', values)}
                  placeholder="All Service Lines"
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
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
                  className="w-full text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-dxc-dark-gray mb-1">
                  Value Range
                </label>
                <select className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                  <option value="">All Values</option>
                  <option value="high">$5M+</option>
                  <option value="medium">$1M - $5M</option>
                  <option value="low">Under $1M</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Opportunities Table/Grid */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">All Opportunities</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedOpportunities.length === displayOpportunities.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300"
              />
              <span className="text-xs text-gray-500">Select All</span>
            </div>
          </div>
          
          <CompactTable
            data={displayOpportunities}
            columns={[
              { 
                key: 'account_name', 
                label: 'Account', 
                sortable: true,
                render: (value: string, item: any) => (
                  <div className={`font-semibold ${getSecurityClearanceColorClass(item.security_clearance) || 'text-dxc-dark-gray'}`}>
                    {value || <span className="text-dxc-medium-gray italic">No account</span>}
                  </div>
                )
              },
              { key: 'display_id', label: 'ID', sortable: true, width: 'w-32 min-w-32 whitespace-nowrap' },
              { key: 'name', label: 'Opportunity', sortable: true },
              { key: 'amount', label: 'TCV', sortable: true },
              { key: 'stage', label: 'Stage' },
              { key: 'category', label: 'Category' },
              { key: 'close_date', label: 'Decision Date' },
              { key: 'assigned_resource', label: 'Owner' }
            ]}
            onRowClick={(opportunity) => navigate(`/opportunity/${opportunity.id}`)}
            maxHeight="600px"
          />
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayOpportunities.map((opportunity) => (
            <div key={opportunity.id || Math.random()} className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <Link 
                    to={`/opportunities/${opportunity.id || 0}`}
                    className="font-medium text-dxc-bright-purple hover:text-dxc-dark-purple text-sm"
                  >
                    {opportunity.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-1">{opportunity.account_name}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedOpportunities.includes(String(opportunity.id || ''))}
                  onChange={() => handleSelectOpportunity(String(opportunity.id || ''))}
                  className="rounded border-gray-300"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">TCV</span>
                  <span className="font-medium text-dxc-bright-teal text-sm">
                    {opportunity.amount}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Stage</span>
                  <span className={`px-2 py-1 rounded text-xs ${getStageStatusColor(opportunity.stage)} bg-gray-100`}>
                    {opportunity.stage}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Category</span>
                  <span className="px-2 py-1 bg-dxc-blue text-white rounded text-xs">
                    {opportunity.category}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Status</span>
                  <StatusIndicator 
                    status={opportunity.status === 'Active' ? 'success' : opportunity.status === 'Inactive' ? 'error' : 'warning'} 
                    label={opportunity.status}
                    size="sm"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  {opportunity.close_date}
                </span>
                <div className="flex items-center gap-1">
                  <Link 
                    to={`/opportunities/${opportunity.id || 0}`}
                    className="p-1 text-dxc-bright-purple hover:text-dxc-dark-purple"
                  >
                    <Eye className="w-3 h-3" />
                  </Link>
                  <button className="p-1 text-gray-600 hover:text-dxc-bright-purple">
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border p-3">
          <span className="text-xs text-gray-600">
            Showing {startItem}-{endItem} of {allFilteredOpportunities.length} opportunities
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageClick(pageNum)}
                  className={`px-3 py-1 text-xs rounded ${
                    currentPage === pageNum
                      ? 'bg-dxc-bright-purple text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesV2;