import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpportunity, useOpportunityLineItems, useUpdateOpportunity } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import { useResourceTimeline, useCalculateResourceTimeline, useDeleteResourceTimeline } from '../hooks/useResourceTimeline';
import LoadingSpinner from '../components/LoadingSpinner';
import type { OpportunityFormData, ChartDataPoint, Opportunity, OpportunityCategory, OpportunityEffortPrediction, StageTimelineData } from '../types/index';
import { DXC_COLORS, SERVICE_LINES } from '../types/index';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, BarChart3, Layers } from 'lucide-react';

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
    security_clearance: '',
    custom_priority: '',
    internal_stage_assessment: '',
    custom_tracking_field_1: '',
    custom_tracking_field_2: '',
    custom_tracking_field_3: '',
    internal_notes: '',
  });

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    quarterlyRevenue: false,
    lineItems: false,
    serviceLines: true // Keep service lines expanded by default
  });

  // Resource Timeline chart controls
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('bar');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'stage'>('week');

  // Initialize form data when opportunity and categories load
  React.useEffect(() => {
    if (opportunity && categories) {
      const mappedOpp = mapOpportunityForDisplay(opportunity, categories);
      setFormData({
        assigned_resource: mappedOpp.assigned_resource || '',
        status: mappedOpp.status || '',
        notes: mappedOpp.notes || '',
        security_clearance: opportunity.security_clearance || '',
        custom_priority: opportunity.custom_priority || '',
        internal_stage_assessment: opportunity.internal_stage_assessment || '',
        custom_tracking_field_1: opportunity.custom_tracking_field_1 || '',
        custom_tracking_field_2: opportunity.custom_tracking_field_2 || '',
        custom_tracking_field_3: opportunity.custom_tracking_field_3 || '',
        internal_notes: opportunity.internal_notes || '',
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
        security_clearance: opportunity.security_clearance || '',
        custom_priority: opportunity.custom_priority || '',
        internal_stage_assessment: opportunity.internal_stage_assessment || '',
        custom_tracking_field_1: opportunity.custom_tracking_field_1 || '',
        custom_tracking_field_2: opportunity.custom_tracking_field_2 || '',
        custom_tracking_field_3: opportunity.custom_tracking_field_3 || '',
        internal_notes: opportunity.internal_notes || '',
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

  // Prepare chart data for Resource Timeline (moved outside conditional rendering to fix hooks order)
  const resourceTimelineChartData = useMemo(() => {
    if (!hasValidTimeline(resourceTimeline)) return { chartArray: [], serviceLines: [] };
    
    const tableData = getTimelineTableData(resourceTimeline!);
    if (!tableData.length) return { chartArray: [], serviceLines: [] };
    
    const serviceLines = new Set<string>();
    tableData.forEach(item => {
      const serviceLine = (item as any).service_line;
      serviceLines.add(serviceLine);
    });
    
    if (timePeriod === 'stage') {
      // Stage-based view: show each stage as a separate point
      const chartArray = tableData.map(item => {
        const result: Record<string, any> = {
          stage: item.stage_name,
          period: item.stage_name
        };
        
        const serviceLine = (item as any).service_line;
        result[serviceLine] = item.fte_required;
        
        // Set other service lines to 0 for this stage
        Array.from(serviceLines).forEach(sl => {
          if (sl !== serviceLine && !result[sl]) {
            result[sl] = 0;
          }
        });
        
        return result;
      });
      
      return { chartArray, serviceLines: Array.from(serviceLines) };
    } else {
      // Time-based view: create intervals based on selected period
      const timelineMap = new Map<string, Record<string, number>>();
      
      // Determine interval and date formatting based on time period
      let intervalDays: number;
      let formatOptions: Intl.DateTimeFormatOptions;
      
      switch (timePeriod) {
        case 'week':
          intervalDays = 7;
          formatOptions = { month: 'short', day: 'numeric' };
          break;
        case 'month':
          intervalDays = 30;
          formatOptions = { month: 'short', year: '2-digit' };
          break;
        case 'quarter':
          intervalDays = 90;
          formatOptions = { year: 'numeric' };
          break;
        default:
          intervalDays = 7;
          formatOptions = { month: 'short', day: 'numeric' };
      }
      
      tableData.forEach(item => {
        const serviceLine = (item as any).service_line;
        const startDate = new Date(item.stage_start_date);
        const endDate = new Date(item.stage_end_date);
        
        // Create time interval points between start and end date
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          let dateKey: string;
          let periodLabel: string;
          
          if (timePeriod === 'quarter') {
            // For quarterly, group by quarter
            const year = currentDate.getFullYear();
            const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
            dateKey = `${year}-Q${quarter}`;
            periodLabel = `Q${quarter} ${year}`;
          } else if (timePeriod === 'month') {
            // For monthly, group by month
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            dateKey = `${year}-${month.toString().padStart(2, '0')}`;
            periodLabel = currentDate.toLocaleDateString('en-US', formatOptions);
          } else {
            // For weekly, use individual dates
            dateKey = currentDate.toISOString().split('T')[0];
            periodLabel = currentDate.toLocaleDateString('en-US', formatOptions);
          }
          
          if (!timelineMap.has(dateKey)) {
            timelineMap.set(dateKey, { date: dateKey, period: periodLabel });
          }
          
          const entry = timelineMap.get(dateKey)!;
          entry[serviceLine] = (entry[serviceLine] || 0) + item.fte_required;
          
          currentDate.setDate(currentDate.getDate() + intervalDays);
        }
      });
      
      // Convert to array and sort by date
      const chartArray = Array.from(timelineMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(item => ({
          ...item,
          period: item.period
        }));
      
      return { chartArray, serviceLines: Array.from(serviceLines) };
    }
  }, [resourceTimeline, timePeriod]);


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
              <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 mb-4">
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
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Assigned Resource</span>
                  <h2 className="text-xl font-bold text-gray-900">{opportunity.opportunity_owner || 'Not assigned'}</h2>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Status</span>
                  <span className={`text-xl font-bold px-3 py-1 rounded-full ${
                    opportunity.in_forecast === 'Y' ? 'bg-green-100 text-green-800' :
                    opportunity.in_forecast === 'N' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {opportunity.in_forecast === 'Y' ? 'Active' : opportunity.in_forecast === 'N' ? 'Inactive' : 'Unknown'}
                  </span>
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

        {/* User-Managed Fields */}
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Custom Fields</h2>
          <div className="space-y-3">
            {isEditing ? (
              <>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">
                    Security Clearance
                  </dt>
                  <select
                    value={formData.security_clearance || ''}
                    onChange={(e) => handleInputChange('security_clearance', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                  >
                    <option value="">No clearance required</option>
                    <option value="BPSS">BPSS</option>
                    <option value="SC">SC</option>
                    <option value="DV">DV</option>
                  </select>
                </div>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Custom Priority</dt>
                  <input
                    type="text"
                    value={formData.custom_priority || ''}
                    onChange={(e) => handleInputChange('custom_priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                    placeholder="e.g. High, Medium, Low"
                  />
                </div>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Internal Stage Assessment</dt>
                  <input
                    type="text"
                    value={formData.internal_stage_assessment || ''}
                    onChange={(e) => handleInputChange('internal_stage_assessment', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                    placeholder="Internal stage assessment"
                  />
                </div>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Custom Field 1</dt>
                  <input
                    type="text"
                    value={formData.custom_tracking_field_1 || ''}
                    onChange={(e) => handleInputChange('custom_tracking_field_1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                    placeholder="Custom tracking field 1"
                  />
                </div>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Custom Field 2</dt>
                  <input
                    type="text"
                    value={formData.custom_tracking_field_2 || ''}
                    onChange={(e) => handleInputChange('custom_tracking_field_2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                    placeholder="Custom tracking field 2"
                  />
                </div>
                <div>
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide mb-1">Custom Field 3</dt>
                  <input
                    type="text"
                    value={formData.custom_tracking_field_3 || ''}
                    onChange={(e) => handleInputChange('custom_tracking_field_3', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                    placeholder="Custom tracking field 3"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Security Clearance</dt>
                  <dd className="text-dxc-body">{opportunity.security_clearance || 'None required'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Custom Priority</dt>
                  <dd className="text-dxc-body">{opportunity.custom_priority || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Internal Stage Assessment</dt>
                  <dd className="text-dxc-body">{opportunity.internal_stage_assessment || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Custom Field 1</dt>
                  <dd className="text-dxc-body">{opportunity.custom_tracking_field_1 || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Custom Field 2</dt>
                  <dd className="text-dxc-body">{opportunity.custom_tracking_field_2 || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm font-bold text-dxc-purple uppercase tracking-wide">Custom Field 3</dt>
                  <dd className="text-dxc-body">{opportunity.custom_tracking_field_3 || 'Not set'}</dd>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="card mb-8">
        <h2 className="text-dxc-subtitle font-semibold mb-4">Internal Notes</h2>
        <div>
          {isEditing ? (
            <textarea
              value={formData.internal_notes || ''}
              onChange={(e) => handleInputChange('internal_notes', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
              placeholder="Add internal notes about this opportunity..."
            />
          ) : (
            <div className="text-dxc-body whitespace-pre-wrap">
              {opportunity.internal_notes || 'No notes added'}
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

      {/* Resource Timeline Chart */}
      {hasValidTimeline(resourceTimeline) && (
        <div className="card mb-8">
          {/* Header with Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-dxc-subtitle font-semibold mb-4 sm:mb-0">Resource Timeline</h2>
            
            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              {/* Time Period Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['week', 'month', 'quarter', 'stage'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      timePeriod === period
                        ? 'bg-white text-dxc-purple shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {period === 'week' ? 'Weekly' : 
                     period === 'month' ? 'Monthly' :
                     period === 'quarter' ? 'Quarterly' : 'By Stage'}
                  </button>
                ))}
              </div>

              {/* Chart Type Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setChartType('line')}
                  className={`p-2 rounded transition-colors ${
                    chartType === 'line'
                      ? 'bg-white text-dxc-purple shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="Line Chart"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`p-2 rounded transition-colors ${
                    chartType === 'bar'
                      ? 'bg-white text-dxc-purple shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="Bar Chart"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartType('area')}
                  className={`p-2 rounded transition-colors ${
                    chartType === 'area'
                      ? 'bg-white text-dxc-purple shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="Area Chart"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div>
            {(() => {
              const tableData = getTimelineTableData(resourceTimeline!);
              const serviceLineColors: Record<string, string> = {
                'CES': DXC_COLORS[0],
                'INS': DXC_COLORS[1], 
                'BPS': DXC_COLORS[2],
                'SEC': DXC_COLORS[6],
                'ITOC': DXC_COLORS[4],
                'MW': DXC_COLORS[5],
              };

              const renderChart = () => {
                const commonProps = {
                  data: resourceTimelineChartData.chartArray,
                  margin: { top: 10, right: 30, left: 0, bottom: 0 },
                };

                const commonAxisProps = {
                  xAxis: <XAxis dataKey="period" tick={{ fontSize: 12 }} />,
                  yAxis: <YAxis tick={{ fontSize: 12 }} label={{ value: 'FTE', angle: -90, position: 'insideLeft' }} />,
                  grid: <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />,
                  tooltip: (
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #D9D9D6',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => [`${value.toFixed(1)} FTE`, name]}
                    />
                  ),
                  legend: <Legend wrapperStyle={{ paddingTop: '20px' }} />,
                };

                switch (chartType) {
                  case 'line':
                    return (
                      <LineChart {...commonProps}>
                        {commonAxisProps.grid}
                        {commonAxisProps.xAxis}
                        {commonAxisProps.yAxis}
                        {commonAxisProps.tooltip}
                        {commonAxisProps.legend}
                        {resourceTimelineChartData.serviceLines.map(serviceLine => (
                          <Line
                            key={serviceLine}
                            type="monotone"
                            dataKey={serviceLine}
                            stroke={serviceLineColors[serviceLine] || DXC_COLORS[0]}
                            name={serviceLine}
                            strokeWidth={3}
                          />
                        ))}
                      </LineChart>
                    );

                  case 'bar':
                    return (
                      <BarChart {...commonProps}>
                        {commonAxisProps.grid}
                        {commonAxisProps.xAxis}
                        {commonAxisProps.yAxis}
                        {commonAxisProps.tooltip}
                        {commonAxisProps.legend}
                        {resourceTimelineChartData.serviceLines.map(serviceLine => (
                          <Bar
                            key={serviceLine}
                            dataKey={serviceLine}
                            stackId="fte"
                            fill={serviceLineColors[serviceLine] || DXC_COLORS[0]}
                            name={serviceLine}
                          />
                        ))}
                      </BarChart>
                    );

                  case 'area':
                    return (
                      <AreaChart {...commonProps}>
                        {commonAxisProps.grid}
                        {commonAxisProps.xAxis}
                        {commonAxisProps.yAxis}
                        {commonAxisProps.tooltip}
                        {commonAxisProps.legend}
                        {resourceTimelineChartData.serviceLines.map(serviceLine => (
                          <Area
                            key={serviceLine}
                            type="monotone"
                            dataKey={serviceLine}
                            stackId="1"
                            stroke={serviceLineColors[serviceLine] || DXC_COLORS[0]}
                            fill={serviceLineColors[serviceLine] || DXC_COLORS[0]}
                            fillOpacity={0.6}
                            name={serviceLine}
                          />
                        ))}
                      </AreaChart>
                    );

                  default:
                    return null;
                }
              };
              
              return (
                <div>
                  {/* Chart */}
                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={300}>
                      {renderChart()}
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-700">Total Effort</h4>
                      <p className="text-2xl font-bold text-dxc-purple">
                        {tableData.reduce((sum, item) => sum + item.total_effort_weeks, 0).toFixed(1)} weeks
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-700">Peak FTE</h4>
                      <p className="text-2xl font-bold text-dxc-purple">
                        {Math.max(...tableData.map(item => item.fte_required)).toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-700">Service Lines</h4>
                      <p className="text-2xl font-bold text-dxc-purple">
                        {resourceTimelineChartData.serviceLines.length}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

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