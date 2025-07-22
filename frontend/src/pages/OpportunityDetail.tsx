import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpportunity, useOpportunityLineItems, useUpdateOpportunity } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import { useResourceTimeline, useCalculateResourceTimeline, useDeleteResourceTimeline } from '../hooks/useResourceTimeline';
import LoadingSpinner from '../components/LoadingSpinner';
import type { OpportunityFormData, ChartDataPoint, Opportunity, OpportunityCategory, OpportunityEffortPrediction, StageTimelineData } from '../types/index';
import { DXC_COLORS, SERVICE_LINES } from '../types/index';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, BarChart3, Layers, Calendar, Users, FileText, DollarSign } from 'lucide-react';

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

  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
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
    quarterlyRevenue: false
  });

  // Resource Timeline chart controls
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('bar');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'stage'>('week');

  // Tab state for Resource Analysis section
  const [activeResourceTab, setActiveResourceTab] = useState<'timeline' | 'profile' | 'line-items' | 'revenue'>('timeline');

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

  const handleEditCustomFields = () => {
    setIsEditingCustomFields(true);
  };

  const handleCancelCustomFields = () => {
    setIsEditingCustomFields(false);
    // Reset custom fields form data to original values
    if (opportunity && categories) {
      const mappedOpp = mapOpportunityForDisplay(opportunity, categories);
      setFormData(prev => ({
        ...prev,
        assigned_resource: mappedOpp.assigned_resource || '',
        status: mappedOpp.status || '',
        security_clearance: opportunity.security_clearance || '',
        custom_priority: opportunity.custom_priority || '',
        internal_stage_assessment: opportunity.internal_stage_assessment || '',
        custom_tracking_field_1: opportunity.custom_tracking_field_1 || '',
        custom_tracking_field_2: opportunity.custom_tracking_field_2 || '',
        custom_tracking_field_3: opportunity.custom_tracking_field_3 || '',
      }));
    }
  };

  const handleSaveCustomFields = async () => {
    try {
      await updateMutation.mutateAsync({
        id: opportunityId,
        data: {
          assigned_resource: formData.assigned_resource,
          status: formData.status,
          security_clearance: formData.security_clearance,
          custom_priority: formData.custom_priority,
          internal_stage_assessment: formData.internal_stage_assessment,
          custom_tracking_field_1: formData.custom_tracking_field_1,
          custom_tracking_field_2: formData.custom_tracking_field_2,
          custom_tracking_field_3: formData.custom_tracking_field_3,
        },
      });
      setIsEditingCustomFields(false);
    } catch (error) {
      console.error('Failed to update custom fields:', error);
    }
  };

  const handleEditNotes = () => {
    setIsEditingNotes(true);
  };

  const handleCancelNotes = () => {
    setIsEditingNotes(false);
    // Reset notes form data to original values
    if (opportunity) {
      setFormData(prev => ({
        ...prev,
        internal_notes: opportunity.internal_notes || '',
      }));
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateMutation.mutateAsync({
        id: opportunityId,
        data: {
          internal_notes: formData.internal_notes,
        },
      });
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to update notes:', error);
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-dxc-subtitle font-semibold">Custom Fields</h2>
            <div className="flex gap-2">
              {!isEditingCustomFields ? (
                <button onClick={handleEditCustomFields} className="btn-primary text-sm px-3 py-1">
                  Edit
                </button>
              ) : (
                <>
                  <button onClick={handleCancelCustomFields} className="btn-secondary text-sm px-3 py-1">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCustomFields}
                    disabled={updateMutation.isPending}
                    className="btn-primary text-sm px-3 py-1 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {isEditingCustomFields ? (
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-dxc-subtitle font-semibold">Internal Notes</h2>
          <div className="flex gap-2">
            {!isEditingNotes ? (
              <button onClick={handleEditNotes} className="btn-primary text-sm px-3 py-1">
                Edit
              </button>
            ) : (
              <>
                <button onClick={handleCancelNotes} className="btn-secondary text-sm px-3 py-1">
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending}
                  className="btn-primary text-sm px-3 py-1 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
        <div>
          {isEditingNotes ? (
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


      {/* Resource Analysis Section - Tabbed Interface */}
      {(hasValidTimeline(resourceTimeline) || opportunity) && (
        <div className="card mb-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-dxc-subtitle font-semibold mb-4 sm:mb-0">Resource Analysis</h2>
            
            {/* Timeline Controls - only show for timeline tab */}
            {activeResourceTab === 'timeline' && hasValidTimeline(resourceTimeline) && (
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
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="tabs flex mb-6">
            {[
              { key: 'timeline', label: 'Resource Timeline', icon: Calendar, condition: hasValidTimeline(resourceTimeline) },
              { key: 'profile', label: 'Resource Profile', icon: Users, condition: hasValidTimeline(resourceTimeline) },
              { key: 'line-items', label: 'Line Item Details', icon: FileText, condition: true },
              { key: 'revenue', label: 'Service Line Revenue Breakdown', icon: DollarSign, condition: true }
            ].filter(tab => tab.condition).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveResourceTab(key as any)}
                className={`tab ${activeResourceTab === key ? 'tab-active' : ''} flex items-center gap-2`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          {activeResourceTab === 'timeline' && hasValidTimeline(resourceTimeline) && (() => {
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
                    {renderChart() || <div>No chart data available</div>}
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

          {/* Resource Profile Tab */}
          {activeResourceTab === 'profile' && hasValidTimeline(resourceTimeline) && (() => {
            const tableData = getTimelineTableData(resourceTimeline!);
            
            // Debug: log the actual data structure
            console.log('Resource Timeline Data:', resourceTimeline);
            console.log('Table Data:', tableData);
            
            if (!tableData.length) {
              return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Users className="w-12 h-12 mb-3" />
                  <p className="text-center">No resource profile data available</p>
                </div>
              );
            }

            // Group data by service line for better organization
            const serviceLineData = tableData.reduce((acc, item) => {
              const serviceLine = (item as any).service_line;
              if (!acc[serviceLine]) {
                acc[serviceLine] = [];
              }
              acc[serviceLine].push(item);
              return acc;
            }, {} as Record<string, typeof tableData>);

            const serviceLineColors: Record<string, string> = {
              'CES': DXC_COLORS[0],
              'INS': DXC_COLORS[1], 
              'BPS': DXC_COLORS[2],
              'SEC': DXC_COLORS[6],
              'ITOC': DXC_COLORS[4],
              'MW': DXC_COLORS[5],
            };

            return (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Total Stages</h4>
                    <p className="text-2xl font-bold text-dxc-purple">{tableData.length}</p>
                  </div>
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Service Lines</h4>
                    <p className="text-2xl font-bold text-dxc-purple">{Object.keys(serviceLineData).length}</p>
                  </div>
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Total Effort</h4>
                    <p className="text-2xl font-bold text-dxc-purple">
                      {tableData.reduce((sum, item) => sum + (item.total_effort_weeks || 0), 0).toFixed(1)} weeks
                    </p>
                  </div>
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Peak FTE</h4>
                    <p className="text-2xl font-bold text-dxc-purple">
                      {tableData.length > 0 ? Math.max(...tableData.map(item => item.fte_required || 0)).toFixed(1) : '0.0'}
                    </p>
                  </div>
                </div>

                {/* Resource Profile Table */}
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Service Line
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stage
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Start Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            End Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duration
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            FTE Required
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Effort
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(serviceLineData).map(([serviceLine, stages]) =>
                          stages.map((item, stageIndex) => (
                            <tr key={`${serviceLine}-${stageIndex}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                      style={{ 
                                        backgroundColor: `${serviceLineColors[serviceLine]}20`, 
                                        color: serviceLineColors[serviceLine] 
                                      }}>
                                  {serviceLine}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.stage_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(item.stage_start_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(item.stage_end_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {(item.duration_weeks || 0).toFixed(1)} weeks
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dxc-purple">
                                {(item.fte_required || 0).toFixed(1)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {(item.total_effort_weeks || 0).toFixed(1)} weeks
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Service Line Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(serviceLineData).map(([serviceLine, stages]) => (
                    <div key={serviceLine} className="bg-white border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full" 
                             style={{ backgroundColor: serviceLineColors[serviceLine] }}>
                        </div>
                        <h4 className="font-medium text-dxc-dark-gray">{serviceLine} Service Line</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Stages:</span>
                          <span className="font-medium">{stages.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Effort:</span>
                          <span className="font-medium">
                            {stages.reduce((sum, stage) => sum + (stage.total_effort_weeks || 0), 0).toFixed(1)} weeks
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Peak FTE:</span>
                          <span className="font-medium">
                            {stages.length > 0 ? Math.max(...stages.map(stage => stage.fte_required || 0)).toFixed(1) : '0.0'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium">
                            {stages.reduce((sum, stage) => sum + (stage.duration_weeks || 0), 0).toFixed(1)} weeks
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Line Item Details Tab */}
          {activeResourceTab === 'line-items' && (() => {
            if (!lineItems || lineItems.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FileText className="w-12 h-12 mb-3" />
                  <p className="text-center">No line items available</p>
                </div>
              );
            }

            // Calculate total TCV for percentage calculations
            const totalTCV = lineItems.reduce((sum, item) => sum + (item.offering_tcv || 0), 0);

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-dxc-dark-gray">Line Item Details ({lineItems.length} items)</h4>
                  <div className="text-sm text-gray-600">
                    Total TCV: {formatCurrency(totalTCV)}
                  </div>
                </div>
                
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Lead Offering
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Internal Service
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Simplified Offering
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Offering TCV
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            % of Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {lineItems.map((item, index) => {
                          const tcv = item.offering_tcv || 0;
                          const percentage = totalTCV > 0 ? (tcv / totalTCV * 100) : 0;
                          
                          return (
                            <tr key={item.id || index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.lead_offering_l2 || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.internal_service || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.simplified_offering || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.product_name || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dxc-purple">
                                {formatCurrency(tcv)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {percentage.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-dxc-dark-gray mb-2">Summary</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Line Items:</span>
                      <span className="font-medium ml-2">{lineItems.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total TCV:</span>
                      <span className="font-medium ml-2 text-dxc-purple">
                        {formatCurrency(totalTCV)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg TCV per Item:</span>
                      <span className="font-medium ml-2">
                        {lineItems.length > 0 ? formatCurrency(totalTCV / lineItems.length) : '$0M'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Service Line Revenue Breakdown Tab */}
          {activeResourceTab === 'revenue' && (() => {
            const serviceLineColors: Record<string, string> = {
              'CES': DXC_COLORS[0],
              'INS': DXC_COLORS[1], 
              'BPS': DXC_COLORS[2],
              'SEC': DXC_COLORS[6],
              'ITOC': DXC_COLORS[4],
              'MW': DXC_COLORS[5],
            };

            const revenueData = SERVICE_LINES.map(serviceLine => {
              const serviceLineKey = `${serviceLine.toLowerCase()}_millions` as keyof typeof opportunity;
              const revenue = (opportunity[serviceLineKey] as number) || 0;
              
              return {
                serviceLine,
                revenue,
                fill: serviceLineColors[serviceLine]
              };
            }).filter(item => item.revenue > 0);

            if (!revenueData.length) {
              return (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <DollarSign className="w-12 h-12 mb-3" />
                  <p className="text-center">No revenue data available</p>
                </div>
              );
            }

            const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Chart */}
                  <div className="chart-container">
                    <div className="chart-header">
                      <h4 className="chart-title">Service Line Revenue Distribution</h4>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D6" />
                        <XAxis dataKey="serviceLine" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} label={{ value: 'Revenue ($M)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          formatter={(value: number) => [`$${value.toFixed(1)}M`, 'Revenue']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #D9D9D6',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue Summary */}
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-dxc-dark-gray mb-3">Total Revenue: ${totalRevenue.toFixed(1)}M</h4>
                      <div className="space-y-3">
                        {revenueData
                          .sort((a, b) => b.revenue - a.revenue)
                          .map(item => {
                            const percentage = totalRevenue > 0 ? (item.revenue / totalRevenue * 100) : 0;
                            return (
                              <div key={item.serviceLine} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                                  <span className="font-medium text-sm">{item.serviceLine}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">${item.revenue.toFixed(1)}M</div>
                                  <div className="text-xs text-dxc-gray">{percentage.toFixed(1)}%</div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Show message if no content available */}
          {!hasValidTimeline(resourceTimeline) && activeResourceTab === 'timeline' && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Calendar className="w-12 h-12 mb-3" />
              <p className="text-center">No resource timeline available</p>
              <p className="text-sm text-gray-400 mt-1">
                Resource timelines are only available for MW and ITOC service lines
              </p>
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