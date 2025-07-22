import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpportunity, useOpportunityLineItems, useUpdateOpportunity } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import { useResourceTimeline, useCalculateResourceTimeline, useDeleteResourceTimeline } from '../hooks/useResourceTimeline';
import LoadingSpinner from '../components/LoadingSpinner';
import type { OpportunityFormData, ChartDataPoint, Opportunity, OpportunityCategory, OpportunityEffortPrediction, StageTimelineData } from '../types/index';
import { DXC_COLORS } from '../types/index';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line } from 'recharts';

// Helper function to calculate opportunity category based on TCV using database categories
const getOpportunityCategory = (tcvMillions: number | undefined, categories: OpportunityCategory[]): string => {
  if (!tcvMillions || tcvMillions < 0) return 'Uncategorized';
  if (!categories || categories.length === 0) return 'Uncategorized';
  
  // Sort categories by min_tcv in ascending order
  const sortedCategories = [...categories].sort((a, b) => a.min_tcv - b.min_tcv);
  
  // Find the category with the highest min_tcv that the tcvMillions meets or exceeds
  let bestMatch = null;
  for (const category of sortedCategories) {
    if (tcvMillions >= category.min_tcv) {
      if (category.max_tcv === null || (category.max_tcv !== undefined && tcvMillions <= category.max_tcv)) {
        bestMatch = category;
      }
    }
  }
  
  return bestMatch ? bestMatch.name : 'Uncategorized';
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
    status: opp.in_forecast === 'Y' ? 'Active' : opp.in_forecast === 'N' ? 'Inactive' : 'Unknown',
    notes: '' // This field doesn't exist in the current schema
  };
};

const OpportunityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const opportunityId = id ? parseInt(id, 10) : 0;

  const { data: opportunity, isLoading: opportunityLoading, error: opportunityError } = useOpportunity(opportunityId);
  const { data: lineItems, isLoading: lineItemsLoading } = useOpportunityLineItems(opportunityId);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const updateMutation = useUpdateOpportunity();

  // Resource Timeline hooks - always enabled, but with graceful error handling
  const { data: resourceTimeline, isLoading: timelineLoading, error: timelineError } = useResourceTimeline(opportunityId);
  const calculateTimelineMutation = useCalculateResourceTimeline();
  const deleteTimelineMutation = useDeleteResourceTimeline();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<OpportunityFormData>({
    assigned_resource: '',
    status: '',
    notes: '',
  });

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    quarterlyRevenue: false,
    lineItems: false,
    resourceTimeline: false,
    serviceLines: true // Keep service lines expanded by default
  });

  // Initialize form data when opportunity and categories load
  React.useEffect(() => {
    if (opportunity && categories) {
      const mappedOpp = mapOpportunityForDisplay(opportunity, categories);
      setFormData({
        assigned_resource: mappedOpp.assigned_resource || '',
        status: mappedOpp.status || '',
        notes: mappedOpp.notes || '',
      });
    }
  }, [opportunity, categories]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values
    if (opportunity && categories) {
      const mappedOpp = mapOpportunityForDisplay(opportunity, categories);
      setFormData({
        assigned_resource: mappedOpp.assigned_resource || '',
        status: mappedOpp.status || '',
        notes: mappedOpp.notes || '',
      });
    }
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: opportunityId,
        data: formData,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update opportunity:', error);
      // Error handling could be improved with toast notifications
    }
  };

  const handleInputChange = (field: keyof OpportunityFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Resource timeline calculation logic
  const handleCalculateTimeline = async () => {
    try {
      const result = await calculateTimelineMutation.mutateAsync(opportunityId);
      // Timeline calculation success - data will automatically refresh via React Query
      console.log('Resource timeline calculated successfully:', result.total_remaining_effort_weeks, 'weeks');
    } catch (error) {
      console.error('Failed to calculate resource timeline:', error);
    }
  };

  const handleDeleteTimeline = async () => {
    if (window.confirm('Are you sure you want to delete the existing resource timeline? This action cannot be undone.')) {
      try {
        await deleteTimelineMutation.mutateAsync(opportunityId);
        // Success feedback could be added here if needed
      } catch (error) {
        console.error('Failed to delete resource timeline:', error);
        // Error handling is shown in the UI via mutation state
      }
    }
  };

  // Determine if this opportunity can have a resource timeline calculated
  const canCalculateTimeline = (opp: Opportunity): boolean => {
    if (!opp) return false;
    
    // Check if opportunity has TCV in MW or ITOC service lines (primary logic)
    if ((opp.mw_millions && opp.mw_millions > 0) || (opp.itoc_millions && opp.itoc_millions > 0)) {
      return true;
    }
    
    // Fallback: Check if lead offering is MW or ITOC (these are the only service lines with resource templates)
    if (opp.lead_offering_l1 === 'MW' || opp.lead_offering_l1 === 'ITOC') {
      return true;
    }
    
    return false;
  };

  // Get the service lines that will be used for calculation
  const getCalculationServiceLines = (opp: Opportunity): string[] => {
    if (!opp) return [];
    
    const serviceLines: string[] = [];
    
    // Add service lines based on TCV
    if (opp.mw_millions && opp.mw_millions > 0) {
      serviceLines.push('MW');
    }
    if (opp.itoc_millions && opp.itoc_millions > 0) {
      serviceLines.push('ITOC');
    }
    
    // Fallback to lead offering if no TCV in MW/ITOC
    if (serviceLines.length === 0 && opp.lead_offering_l1) {
      if (opp.lead_offering_l1 === 'MW' || opp.lead_offering_l1 === 'ITOC') {
        serviceLines.push(opp.lead_offering_l1);
      }
    }
    
    return serviceLines;
  };

  // Helper function to flatten timeline data for table display
  const getTimelineTableData = (effortPrediction: OpportunityEffortPrediction | null): StageTimelineData[] => {
    if (!effortPrediction?.service_line_timelines) return [];
    
    const tableData: StageTimelineData[] = [];
    
    Object.entries(effortPrediction.service_line_timelines).forEach(([serviceLine, stages]) => {
      stages.forEach(stage => {
        tableData.push({
          ...stage,
          service_line: serviceLine // Add service line to stage data
        } as StageTimelineData & { service_line: string });
      });
    });
    
    return tableData;
  };

  // Helper function to calculate timeline summary metrics
  const getTimelineSummary = (effortPrediction: OpportunityEffortPrediction | null) => {
    if (!effortPrediction?.service_line_timelines) {
      return { totalEffort: 0, peakFTE: 0, serviceLineCount: 0 };
    }
    
    let totalEffort = 0;
    let peakFTE = 0;
    const serviceLines = new Set<string>();
    
    Object.entries(effortPrediction.service_line_timelines).forEach(([serviceLine, stages]) => {
      serviceLines.add(serviceLine);
      stages.forEach(stage => {
        totalEffort += stage.total_effort_weeks;
        peakFTE = Math.max(peakFTE, stage.fte_required);
      });
    });
    
    return {
      totalEffort,
      peakFTE,
      serviceLineCount: serviceLines.size
    };
  };

  // Check if timeline data exists and is valid
  const hasValidTimeline = (effortPrediction: OpportunityEffortPrediction | undefined | null): boolean => {
    return !!(effortPrediction?.service_line_timelines && 
              Object.keys(effortPrediction.service_line_timelines).length > 0);
  };


  // Prepare service line chart data using opportunity-level aggregated fields
  const getServiceLineChartData = (): ChartDataPoint[] => {
    if (!opportunity) return [];

    const serviceLineData: ChartDataPoint[] = [];
    let colorIndex = 0;

    const serviceLineRevenues = [
      { name: 'CES', value: opportunity.ces_millions || 0 },
      { name: 'INS', value: opportunity.ins_millions || 0 },
      { name: 'BPS', value: opportunity.bps_millions || 0 },
      { name: 'SEC', value: opportunity.sec_millions || 0 },
      { name: 'ITOC', value: opportunity.itoc_millions || 0 },
      { name: 'MW', value: opportunity.mw_millions || 0 }
    ];

    serviceLineRevenues.forEach(serviceLine => {
      if (serviceLine.value > 0) {
        serviceLineData.push({
          name: serviceLine.name,
          value: serviceLine.value,
          color: DXC_COLORS[colorIndex % DXC_COLORS.length]
        });
        colorIndex++;
      }
    });

    return serviceLineData;
  };

  // Prepare quarterly revenue chart data
  const getQuarterlyRevenueData = () => {
    if (!opportunity) return [];

    return [
      { quarter: 'Y1 Q1', revenue: opportunity.first_year_q1_rev || 0 },
      { quarter: 'Y1 Q2', revenue: opportunity.first_year_q2_rev || 0 },
      { quarter: 'Y1 Q3', revenue: opportunity.first_year_q3_rev || 0 },
      { quarter: 'Y1 Q4', revenue: opportunity.first_year_q4_rev || 0 },
      { quarter: 'Y2 Q1', revenue: opportunity.second_year_q1_rev || 0 },
      { quarter: 'Y2 Q2', revenue: opportunity.second_year_q2_rev || 0 },
      { quarter: 'Y2 Q3', revenue: opportunity.second_year_q3_rev || 0 },
      { quarter: 'Y2 Q4', revenue: opportunity.second_year_q4_rev || 0 }
    ].filter(item => item.revenue > 0);
  };

  const formatCurrency = (amount: number) => {
    if (!amount || isNaN(amount)) return '$0M';
    
    // Check if the value is likely in dollars (large number) or millions (small number)
    if (amount > 1000) {
      // Value appears to be in dollars, convert to millions
      const millions = amount / 1000000;
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(millions);
      return `$${formatted}M`;
    } else {
      // Value appears to already be in millions
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount);
      return `$${formatted}M`;
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'No Date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  if (opportunityLoading || categoriesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (opportunityError || !opportunity) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Opportunity</h2>
          <p className="text-red-600">
            {opportunityError instanceof Error ? opportunityError.message : 'Opportunity not found'}
          </p>
          <button
            onClick={() => navigate('/opportunities')}
            className="mt-4 btn-primary"
          >
            Back to Opportunities
          </button>
        </div>
      </div>
    );
  }

  const serviceLineChartData = getServiceLineChartData();
  const quarterlyRevenueData = getQuarterlyRevenueData();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/opportunities')}
            className="text-dxc-purple hover:text-dxc-purple/80 font-medium"
          >
            ← Back to Opportunities
          </button>
          <div className="flex gap-2">
            {!isEditing ? (
              <button onClick={handleEdit} className="btn-primary">
                Edit
              </button>
            ) : (
              <>
                <button onClick={handleCancel} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Prominent Account and Opportunity ID */}
        <div className="bg-dxc-purple/5 border-l-4 border-dxc-purple p-6 rounded-lg mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="w-full">
              <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4 mb-4">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Account</span>
                  <h2 className="text-xl font-bold text-dxc-purple">{opportunity.account_name || 'No Account'}</h2>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Opportunity ID</span>
                  {opportunity.sfdc_url ? (
                    <a 
                      href={opportunity.sfdc_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xl font-bold text-dxc-purple hover:text-dxc-purple/80 hover:underline transition-colors cursor-pointer block"
                      title="Click to view in Salesforce"
                    >
                      {opportunity.opportunity_id}
                    </a>
                  ) : (
                    <h2 className="text-xl font-bold text-dxc-purple">{opportunity.opportunity_id}</h2>
                  )}
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{opportunity.opportunity_name}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {/* Opportunity Details */}
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Opportunity Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Stage</dt>
              <dd className="text-dxc-body font-medium">{opportunity.sales_stage}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Total Contract Value</dt>
              <dd className="text-dxc-body font-medium text-dxc-purple">
                {formatCurrency(opportunity.tcv_millions || 0)}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Close Date</dt>
              <dd className="text-dxc-body">{formatDate(opportunity.decision_date)}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Category</dt>
              <dd className="text-dxc-body">{getOpportunityCategory(opportunity.tcv_millions, categories)}</dd>
            </div>
            {opportunity.opportunity_type && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Type</dt>
                <dd className="text-dxc-body">{opportunity.opportunity_type}</dd>
              </div>
            )}
            {opportunity.lead_offering_l1 && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Lead Offering</dt>
                <dd className="text-dxc-body">{opportunity.lead_offering_l1}</dd>
              </div>
            )}
            {opportunity.contract_length && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Contract Length</dt>
                <dd className="text-dxc-body">{opportunity.contract_length} years</dd>
              </div>
            )}
            {opportunity.sales_org_l1 && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Sales Org</dt>
                <dd className="text-dxc-body">{opportunity.sales_org_l1}</dd>
              </div>
            )}
            {opportunity.master_period && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Master Period</dt>
                <dd className="text-dxc-body">{opportunity.master_period}</dd>
              </div>
            )}
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">In Forecast</dt>
              <dd className="text-dxc-body">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  opportunity.in_forecast === 'Y' ? 'bg-green-100 text-green-800' :
                  opportunity.in_forecast === 'N' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {opportunity.in_forecast === 'Y' ? 'Yes' : opportunity.in_forecast === 'N' ? 'No' : 'Unknown'}
                </span>
              </dd>
            </div>
          </div>
        </div>

        {/* Financial Details */}
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Financial Summary</h2>
          <div className="space-y-2">
            {opportunity.margin_percentage && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Margin %</dt>
                <dd className={`text-dxc-body font-medium ${
                  opportunity.margin_percentage >= 20 ? 'text-green-600' :
                  opportunity.margin_percentage >= 10 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {opportunity.margin_percentage.toFixed(1)}%
                </dd>
              </div>
            )}
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">First Year Revenue</dt>
              <dd className="text-dxc-body font-medium text-dxc-purple">
                {formatCurrency(opportunity.first_year_fy_rev || 0)}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Second Year Revenue</dt>
              <dd className="text-dxc-body font-medium">
                {formatCurrency(opportunity.second_year_fy_rev || 0)}
              </dd>
            </div>
            {opportunity.fy_rev_beyond_yr2 && (
              <div className="flex justify-between items-center">
                <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Beyond Year 2</dt>
                <dd className="text-dxc-body font-medium">
                  {formatCurrency(opportunity.fy_rev_beyond_yr2)}
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* Editable Fields */}
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Resource Assignment</h2>
          <div className="space-y-3">
            {isEditing ? (
              <>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">
                    Assigned Resource
                  </dt>
                  <input
                    type="text"
                    value={formData.assigned_resource}
                    onChange={(e) => handleInputChange('assigned_resource', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                    placeholder="Enter resource name"
                  />
                </div>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Status</dt>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                  >
                    <option value="">Select status</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Assigned Resource</dt>
                  <dd className="text-dxc-body">{opportunity.opportunity_owner || 'Not assigned'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Status</dt>
                  <dd className="text-dxc-body">{opportunity.in_forecast === 'Y' ? 'Active' : opportunity.in_forecast === 'N' ? 'Inactive' : 'Unknown'}</dd>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="card mb-8">
        <h2 className="text-dxc-subtitle font-semibold mb-4">Notes</h2>
        <div>
          {isEditing ? (
            <>
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Additional Notes</dt>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                placeholder="Add notes about this opportunity..."
              />
            </>
          ) : (
            <div className="flex justify-between items-start">
              <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Additional Notes</dt>
              <dd className="text-dxc-body whitespace-pre-wrap text-right flex-1 ml-4">
                {'No notes available in current schema'}
              </dd>
            </div>
          )}
        </div>
      </div>

      {/* Quarterly Revenue Timeline */}
      {quarterlyRevenueData.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-dxc-subtitle font-semibold">Quarterly Revenue Timeline</h2>
            <button
              onClick={() => toggleSection('quarterlyRevenue')}
              className="text-dxc-purple hover:text-dxc-purple/80 font-medium"
            >
              {expandedSections.quarterlyRevenue ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>
          {expandedSections.quarterlyRevenue && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Line Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Revenue Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={quarterlyRevenueData}>
                      <XAxis dataKey="quarter" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#5F249F" 
                        strokeWidth={3}
                        dot={{ fill: '#5F249F', strokeWidth: 2, r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Quarterly Breakdown</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={quarterlyRevenueData}>
                      <XAxis dataKey="quarter" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#5F249F" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Summary Table */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Quarterly Summary</h3>
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Quarter</th>
                        <th>Revenue</th>
                        <th>Percentage of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlyRevenueData.map((item) => {
                        const totalQuarterlyRevenue = quarterlyRevenueData.reduce((sum, data) => sum + data.revenue, 0);
                        const percentage = ((item.revenue / totalQuarterlyRevenue) * 100).toFixed(1);
                        return (
                          <tr key={item.quarter}>
                            <td className="font-medium">{item.quarter}</td>
                            <td>{formatCurrency(item.revenue)}</td>
                            <td>{percentage}%</td>
                          </tr>
                        );
                      })}
                      {opportunity.fy_rev_beyond_yr2 && opportunity.fy_rev_beyond_yr2 > 0 && (
                        <tr className="border-t-2 font-medium">
                          <td>Beyond Year 2</td>
                          <td>{formatCurrency(opportunity.fy_rev_beyond_yr2)}</td>
                          <td>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Line Items Detail Table */}
      {lineItems && lineItems.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-dxc-subtitle font-semibold">Line Items Detail</h2>
            <button
              onClick={() => toggleSection('lineItems')}
              className="text-dxc-purple hover:text-dxc-purple/80 font-medium"
            >
              {expandedSections.lineItems ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>
          {expandedSections.lineItems && (
            <div>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Offering</th>
                      <th>Product</th>
                      <th>TCV</th>
                      <th>ABR</th>
                      <th>IYR</th>
                      <th>Margin %</th>
                      <th>FY1 Revenue</th>
                      <th>FY2 Revenue</th>
                      <th>Beyond Y2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="font-medium">
                          <div>
                            <div>{item.lead_offering_l2 || item.simplified_offering || 'N/A'}</div>
                            {item.internal_service && (
                              <div className="text-sm text-gray-500">{item.internal_service}</div>
                            )}
                          </div>
                        </td>
                        <td>{item.product_name || 'N/A'}</td>
                        <td className="font-medium text-dxc-purple">
                          {formatCurrency(item.offering_tcv || 0)}
                        </td>
                        <td>{formatCurrency(item.offering_abr || 0)}</td>
                        <td>{formatCurrency(item.offering_iyr || 0)}</td>
                        <td className={`font-medium ${
                          item.offering_margin_percentage && item.offering_margin_percentage >= 20 ? 'text-green-600' :
                          item.offering_margin_percentage && item.offering_margin_percentage >= 10 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {item.offering_margin_percentage ? `${item.offering_margin_percentage.toFixed(1)}%` : 'N/A'}
                        </td>
                        <td>{formatCurrency(item.first_year_fy_rev || 0)}</td>
                        <td>{formatCurrency(item.second_year_fy_rev || 0)}</td>
                        <td>{formatCurrency(item.fy_rev_beyond_yr2 || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          
              {/* Line Items Summary */}
              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Line Items:</span>
                    <span className="font-medium ml-2">{lineItems.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total TCV:</span>
                    <span className="font-medium ml-2 text-dxc-purple">
                      {formatCurrency(lineItems.reduce((sum, item) => sum + (item.offering_tcv || 0), 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total ABR:</span>
                    <span className="font-medium ml-2">
                      {formatCurrency(lineItems.reduce((sum, item) => sum + (item.offering_abr || 0), 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Margin:</span>
                    <span className="font-medium ml-2">
                      {lineItems.filter(item => item.offering_margin_percentage).length > 0 
                        ? `${(lineItems
                            .filter(item => item.offering_margin_percentage)
                            .reduce((sum, item) => sum + (item.offering_margin_percentage || 0), 0) / 
                            lineItems.filter(item => item.offering_margin_percentage).length
                          ).toFixed(1)}%`
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resource Timeline Section */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-dxc-subtitle font-semibold">Resource Timeline</h2>
          <div className="flex items-center gap-2">
            {hasValidTimeline(resourceTimeline) && (
              <button
                onClick={handleDeleteTimeline}
                disabled={deleteTimelineMutation.isPending}
                className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
              >
                {deleteTimelineMutation.isPending ? 'Deleting...' : 'Delete Timeline'}
              </button>
            )}
            <button
              onClick={() => toggleSection('resourceTimeline')}
              className="text-dxc-purple hover:text-dxc-purple/80 font-medium"
            >
              {expandedSections.resourceTimeline ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>
        </div>

        {expandedSections.resourceTimeline && (
          <div>
            {/* Timeline Status and Actions */}
            <div className="mb-6">
              {timelineLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                  <span className="ml-2 text-gray-600">Loading resource timeline...</span>
                </div>
              ) : timelineError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-red-800">Error Loading Timeline</h3>
                      <p className="text-sm text-red-600 mt-1">
                        {timelineError instanceof Error ? timelineError.message : 'Failed to load resource timeline data'}
                      </p>
                    </div>
                    {canCalculateTimeline(opportunity) && (
                      <button
                        onClick={handleCalculateTimeline}
                        disabled={calculateTimelineMutation.isPending}
                        className="btn-primary disabled:opacity-50"
                      >
                        {calculateTimelineMutation.isPending ? 'Generating...' : 'Generate Timeline'}
                      </button>
                    )}
                  </div>
                </div>
              ) : hasValidTimeline(resourceTimeline) ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-green-800">Resource Timeline Generated</h3>
                      <p className="text-sm text-green-600 mt-1">
                        Service lines: {resourceTimeline?.supported_service_lines?.join(', ') || 'N/A'}
                        {resourceTimeline?.total_remaining_effort_weeks && (
                          <> • Total effort: {resourceTimeline.total_remaining_effort_weeks.toFixed(1)} weeks</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={handleCalculateTimeline}
                      disabled={calculateTimelineMutation.isPending}
                      className="btn-secondary disabled:opacity-50"
                    >
                      {calculateTimelineMutation.isPending ? 'Recalculating...' : 'Recalculate'}
                    </button>
                  </div>
                </div>
              ) : canCalculateTimeline(opportunity) ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-blue-800">Ready for Resource Timeline Calculation</h3>
                      <p className="text-sm text-blue-600 mt-1">
                        Service lines available for calculation: {getCalculationServiceLines(opportunity).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={handleCalculateTimeline}
                      disabled={calculateTimelineMutation.isPending}
                      className="btn-primary disabled:opacity-50"
                    >
                      {calculateTimelineMutation.isPending ? 'Calculating...' : 'Generate Timeline'}
                    </button>
                  </div>
                </div>
              ) : resourceTimeline === null ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">No Resource Timeline Found</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        No timeline has been generated for this opportunity yet.
                      </p>
                    </div>
                    {canCalculateTimeline(opportunity) && (
                      <button
                        onClick={handleCalculateTimeline}
                        disabled={calculateTimelineMutation.isPending}
                        className="btn-primary disabled:opacity-50"
                      >
                        {calculateTimelineMutation.isPending ? 'Generating...' : 'Generate Timeline'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-800">Resource Timeline Not Available</h3>
                  <p className="text-sm text-yellow-600 mt-1">
                    This opportunity doesn't have TCV in MW or ITOC service lines, and the lead offering ({opportunity?.lead_offering_l1 || 'N/A'}) doesn't have resource planning templates available.
                  </p>
                </div>
              )}
            </div>

            {/* Timeline Visualization */}
            {hasValidTimeline(resourceTimeline) && (
              <div>
                {(() => {
                  const summary = getTimelineSummary(resourceTimeline!);
                  const tableData = getTimelineTableData(resourceTimeline!);
                  
                  return (
                    <>
                      {/* Timeline Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-700">Total Effort</h4>
                          <p className="text-2xl font-bold text-dxc-purple">
                            {summary.totalEffort.toFixed(1)} weeks
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-700">Peak FTE</h4>
                          <p className="text-2xl font-bold text-dxc-purple">
                            {summary.peakFTE.toFixed(1)}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-medium text-gray-700">Service Lines</h4>
                          <p className="text-2xl font-bold text-dxc-purple">
                            {summary.serviceLineCount}
                          </p>
                        </div>
                      </div>

                      {/* Timeline Table */}
                      {tableData.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="table w-full">
                            <thead>
                              <tr>
                                <th>Service Line</th>
                                <th>Stage</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Duration (weeks)</th>
                                <th>FTE Required</th>
                                <th>Total Effort (weeks)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.map((item, index) => (
                                <tr key={`${(item as any).service_line}-${item.stage_name}-${index}`}>
                                  <td className="font-medium">{(item as any).service_line}</td>
                                  <td>{item.stage_name}</td>
                                  <td>{new Date(item.stage_start_date).toLocaleDateString()}</td>
                                  <td>{new Date(item.stage_end_date).toLocaleDateString()}</td>
                                  <td>{item.duration_weeks}</td>
                                  <td>{item.fte_required}</td>
                                  <td className="font-medium text-dxc-purple">{item.total_effort_weeks.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          No timeline data available for display
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Error Display */}
            {(calculateTimelineMutation.error || deleteTimelineMutation.error || timelineError) && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800">Error</h4>
                <p className="text-red-600 mt-1">
                  {calculateTimelineMutation.error instanceof Error ? calculateTimelineMutation.error.message :
                   deleteTimelineMutation.error instanceof Error ? deleteTimelineMutation.error.message :
                   timelineError instanceof Error ? timelineError.message : 'An error occurred'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Service Line Breakdown */}
      {serviceLineChartData.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-dxc-subtitle font-semibold">Service Line Revenue Breakdown</h2>
            <button
              onClick={() => toggleSection('serviceLines')}
              className="text-dxc-purple hover:text-dxc-purple/80 font-medium"
            >
              {expandedSections.serviceLines ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>
          {expandedSections.serviceLines && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={serviceLineChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {serviceLineChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar Chart */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Revenue by Service Line</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={serviceLineChartData}>
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#5F249F" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Summary Table */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Service Line Details</h3>
                {lineItemsLoading ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th>Service Line</th>
                          <th>Revenue</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceLineChartData.map((item) => {
                          const totalRevenue = serviceLineChartData.reduce((sum, data) => sum + data.value, 0);
                          const percentage = ((item.value / totalRevenue) * 100).toFixed(1);
                          return (
                            <tr key={item.name}>
                              <td className="font-medium">{item.name}</td>
                              <td>{formatCurrency(item.value)}</td>
                              <td>{percentage}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error display for update mutation */}
      {updateMutation.error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">
            Failed to update opportunity: {updateMutation.error instanceof Error ? updateMutation.error.message : 'Unknown error'}
          </p>
        </div>
      )}
    </div>
  );
};

export default OpportunityDetail;