import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpportunity, useOpportunityLineItems, useUpdateOpportunity } from '../hooks/useOpportunities';
import { useCategories } from '../hooks/useConfig';
import { useResourceTimeline, useCalculateResourceTimeline, useUpdateResourceTimelineData } from '../hooks/useResourceTimeline';
import LoadingSpinner from '../components/LoadingSpinner';
import type { OpportunityFormData, Opportunity, OpportunityCategory, OpportunityEffortPrediction } from '../types/index';
import { DXC_COLORS, SERVICE_LINES, RESOURCE_STATUSES } from '../types/index';
import { getSecurityClearanceColorClass } from '../utils/securityClearance';
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, BarChart3, Layers, Calendar, Users, DollarSign, Edit, Save, X, Calculator, RefreshCw, Settings, TrendingUp, Eye } from 'lucide-react';

// Enhanced UI Components
import MetricCard from '../components/ui/MetricCard';
import CompactTable from '../components/ui/CompactTable';
import StatusIndicator from '../components/ui/StatusIndicator';

type ResourceStatus = 'Predicted' | 'Forecast' | 'Planned';

// Helper function to calculate opportunity category based on TCV using backend categories
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

const OpportunityDetailV2: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const opportunityId = id ? parseInt(id, 10) : 0;

  const { data: opportunity, isLoading: opportunityLoading, error: opportunityError } = useOpportunity(opportunityId);
  const { data: lineItems } = useOpportunityLineItems(opportunityId);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const updateMutation = useUpdateOpportunity();

  // Resource Timeline hooks
  const { data: resourceTimeline } = useResourceTimeline(opportunityId);
  const calculateTimelineMutation = useCalculateResourceTimeline();
  const updateTimelineDataMutation = useUpdateResourceTimelineData();

  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false);
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

  // Resource Timeline chart controls
  const [_chartType, _setChartType] = useState<'line' | 'bar' | 'area'>('bar');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'stage'>('week');
  
  // Debug logging for timePeriod changes
  useEffect(() => {
    console.log('🎯 OpportunityDetailV2: timePeriod state changed to:', timePeriod);
  }, [timePeriod]);

  // Tab state for Resource Analysis section
  const [activeResourceTab, setActiveResourceTab] = useState<'timeline' | 'profile' | 'line-items' | 'revenue'>('timeline');

  // Resource status modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState<Record<string, ResourceStatus>>({});
  const [timelineUpdates, setTimelineUpdates] = useState<Record<string, {
    stage_start_date: string;
    stage_end_date: string;
    duration_weeks: number;
    fte_required: number;
  }>>({});

  const isLoading = opportunityLoading || categoriesLoading;

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

  // Format currency helper
  const formatCurrency = (value: number | undefined) => {
    if (!value || isNaN(value)) return '$0.00M';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + 'M';
  };

  // Format date helper
  const formatDate = (dateString: string | undefined) => {
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

  // Handle input changes
  const handleInputChange = (field: keyof OpportunityFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Determine if this opportunity can have a resource timeline calculated
  const canCalculateTimeline = (opp: Opportunity): boolean => {
    if (!opp) return false;
    
    // Check if opportunity has TCV in MW or ITOC service lines
    if ((opp.mw_millions && opp.mw_millions > 0) || (opp.itoc_millions && opp.itoc_millions > 0)) {
      return true;
    }
    
    // Fallback: Check if lead offering is MW or ITOC
    if (opp.lead_offering_l1 === 'MW' || opp.lead_offering_l1 === 'ITOC') {
      return true;
    }
    
    return false;
  };

  // Check if timeline data exists and is valid
  const hasValidTimeline = (effortPrediction: OpportunityEffortPrediction | undefined | null): boolean => {
    return !!(effortPrediction?.service_line_timelines && 
              Object.keys(effortPrediction.service_line_timelines).length > 0);
  };

  // Get timeline table data
  const getTimelineTableData = (effortPrediction: OpportunityEffortPrediction) => {
    if (!effortPrediction?.service_line_timelines) return [];

    const tableData: any[] = [];
    
    Object.entries(effortPrediction.service_line_timelines).forEach(([serviceLine, stages]) => {
      stages.forEach((stage: any) => {
        tableData.push({
          service_line: serviceLine,
          stage_name: stage.stage_name,
          duration_weeks: stage.duration_weeks,
          fte_required: stage.fte_required,
          total_effort_weeks: stage.total_effort_weeks,
          stage_start_date: stage.stage_start_date,
          stage_end_date: stage.stage_end_date,
          resource_status: stage.resource_status || 'Predicted'
        });
      });
    });
    
    return tableData;
  };

  // Get quarterly revenue data
  const getQuarterlyRevenueData = () => {
    if (!opportunity) return [];

    const quarters = [
      { quarter: 'FY1 Q1', value: opportunity.first_year_q1_rev || 0 },
      { quarter: 'FY1 Q2', value: opportunity.first_year_q2_rev || 0 },
      { quarter: 'FY1 Q3', value: opportunity.first_year_q3_rev || 0 },
      { quarter: 'FY1 Q4', value: opportunity.first_year_q4_rev || 0 },
      { quarter: 'FY2 Q1', value: opportunity.second_year_q1_rev || 0 },
      { quarter: 'FY2 Q2', value: opportunity.second_year_q2_rev || 0 },
      { quarter: 'FY2 Q3', value: opportunity.second_year_q3_rev || 0 },
      { quarter: 'FY2 Q4', value: opportunity.second_year_q4_rev || 0 },
    ];

    return quarters.filter(q => q.value > 0);
  };

  // Handle custom fields editing
  const handleEditCustomFields = () => {
    setIsEditingCustomFields(true);
  };

  const handleCancelCustomFields = () => {
    setIsEditingCustomFields(false);
    // Reset form data to original values
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
          opportunity_owner: formData.assigned_resource,
          security_clearance: formData.security_clearance,
          custom_priority: formData.custom_priority,
          internal_stage_assessment: formData.internal_stage_assessment,
          custom_tracking_field_1: formData.custom_tracking_field_1,
          custom_tracking_field_2: formData.custom_tracking_field_2,
          custom_tracking_field_3: formData.custom_tracking_field_3,
          internal_notes: formData.internal_notes,
        },
      });
      setIsEditingCustomFields(false);
    } catch (error) {
      console.error('Failed to update custom fields:', error);
    }
  };

  // Handle calculate resource timeline
  const handleCalculateTimeline = async () => {
    if (!opportunity) return;
    
    try {
      await calculateTimelineMutation.mutateAsync(opportunityId);
    } catch (error) {
      console.error('Failed to calculate resource timeline:', error);
    }
  };

  // Check if resource profile has been edited (has non-Predicted statuses)
  const hasEditedResourceProfile = (): boolean => {
    if (!resourceTimeline?.service_line_timelines) return false;
    
    for (const serviceLineData of Object.values(resourceTimeline.service_line_timelines)) {
      if (Array.isArray(serviceLineData)) {
        for (const item of serviceLineData) {
          if (item.status && item.status !== 'Predicted') {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Handle Generate Resource Profile with warning for existing edited profiles
  const handleGenerateResourceProfile = async () => {
    if (hasEditedResourceProfile()) {
      const proceed = window.confirm(
        'This opportunity already has an edited Resource Profile. Generating a new profile will overwrite all current resource status changes. Do you want to proceed?'
      );
      if (!proceed) return;
    }
    
    if (!opportunity) return;
    
    try {
      await calculateTimelineMutation.mutateAsync(opportunityId);
    } catch (error) {
      console.error('Failed to generate resource profile:', error);
    }
  };

  // Status modal functions
  const handleOpenStatusModal = () => {
    // Initialize statusUpdates and timelineUpdates with current values
    if (resourceTimeline && opportunity) {
      const tableData = getTimelineTableData(resourceTimeline);
      const initialStatusUpdates: Record<string, ResourceStatus> = {};
      const initialTimelineUpdates: Record<string, {
        stage_start_date: string;
        stage_end_date: string;
        duration_weeks: number;
        fte_required: number;
      }> = {};
      
      // Use opportunity close date as the baseline for date calculations
      const closeDate = opportunity.decision_date ? new Date(opportunity.decision_date) : new Date();
      
      // Calculate dates working backwards from close date
      let currentEndDate = new Date(closeDate);
      
      // Sort stages by their original order (we'll work backwards from close date)
      const sortedTableData = [...tableData].reverse();
      
      sortedTableData.forEach((item: any) => {
        const key = `${item.service_line}|${item.stage_name}`;
        
        // Default all statuses to 'Forecast' for the modal (not persisted until saved)
        initialStatusUpdates[key] = 'Forecast';
        
        // Calculate start and end dates based on duration
        const durationWeeks = item.duration_weeks || 0;
        const durationDays = Math.round(durationWeeks * 7); // Convert weeks to days
        
        const stageEndDate = new Date(currentEndDate);
        const stageStartDate = new Date(currentEndDate);
        stageStartDate.setDate(stageStartDate.getDate() - durationDays);
        
        // Format dates for date input fields (YYYY-MM-DD format)
        const formatDateForInput = (date: Date) => {
          return date.toISOString().split('T')[0];
        };
        
        initialTimelineUpdates[key] = {
          stage_start_date: formatDateForInput(stageStartDate),
          stage_end_date: formatDateForInput(stageEndDate),
          duration_weeks: durationWeeks,
          fte_required: item.fte_required || 0,
        };
        
        // Move to the next stage (working backwards)
        currentEndDate = new Date(stageStartDate);
      });
      
      setStatusUpdates(initialStatusUpdates);
      setTimelineUpdates(initialTimelineUpdates);
    }
    setShowStatusModal(true);
  };

  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
    setStatusUpdates({});
    setTimelineUpdates({});
  };

  const handleStatusChange = (serviceLine: string, stageName: string, newStatus: ResourceStatus) => {
    const key = `${serviceLine}|${stageName}`;
    setStatusUpdates(prev => ({
      ...prev,
      [key]: newStatus
    }));
  };

  const handleTimelineFieldChange = (serviceLine: string, stageName: string, field: string, value: any) => {
    const key = `${serviceLine}|${stageName}`;
    
    if (field === 'duration_weeks' && opportunity) {
      // When duration changes, recalculate dates working backwards from close date
      const closeDate = opportunity.decision_date ? new Date(opportunity.decision_date) : new Date();
      const newDurationWeeks = parseFloat(value) || 0;
      const durationDays = Math.round(newDurationWeeks * 7);
      
      // Get all timeline data to maintain proper sequencing
      const tableData = getTimelineTableData(resourceTimeline!);
      
      // Update this specific item's duration first
      setTimelineUpdates(prev => {
        const updatedTimelines = { ...prev };
        
        // Update the duration for the changed item
        updatedTimelines[key] = {
          ...updatedTimelines[key],
          duration_weeks: newDurationWeeks
        };
        
        // Recalculate all dates working backwards from close date
        let currentEndDate = new Date(closeDate);
        const sortedTableData = [...tableData].reverse();
        
        sortedTableData.forEach((item: any) => {
          const itemKey = `${item.service_line}|${item.stage_name}`;
          const itemDuration = itemKey === key ? newDurationWeeks : (updatedTimelines[itemKey]?.duration_weeks || item.duration_weeks || 0);
          const itemDurationDays = Math.round(itemDuration * 7);
          
          const stageEndDate = new Date(currentEndDate);
          const stageStartDate = new Date(currentEndDate);
          stageStartDate.setDate(stageStartDate.getDate() - itemDurationDays);
          
          // Format dates for date input fields
          const formatDateForInput = (date: Date) => {
            return date.toISOString().split('T')[0];
          };
          
          updatedTimelines[itemKey] = {
            ...updatedTimelines[itemKey],
            stage_start_date: formatDateForInput(stageStartDate),
            stage_end_date: formatDateForInput(stageEndDate),
            duration_weeks: itemDuration
          };
          
          // Move to the next stage (working backwards)
          currentEndDate = new Date(stageStartDate);
        });
        
        return updatedTimelines;
      });
    } else {
      // For non-duration fields, update normally
      setTimelineUpdates(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value
        }
      }));
    }
  };

  const handleBulkStatusUpdate = (status: ResourceStatus) => {
    if (resourceTimeline) {
      const tableData = getTimelineTableData(resourceTimeline);
      const bulkUpdates: Record<string, ResourceStatus> = {};
      
      tableData.forEach((item: any) => {
        const key = `${item.service_line}|${item.stage_name}`;
        bulkUpdates[key] = status;
      });
      
      setStatusUpdates(bulkUpdates);
    }
  };

  const handleSaveBulkStatus = async () => {
    if (!resourceTimeline) return;
    
    try {
      const updates = Object.entries(statusUpdates).map(([key, status]) => {
        const [serviceLine, stageName] = key.split('|');
        const timelineData = timelineUpdates[key];
        
        return updateTimelineDataMutation.mutateAsync({
          opportunityId: opportunityId,
          serviceLine,
          stageName,
          data: {
            resource_status: status,
            ...(timelineData && {
              stage_start_date: timelineData.stage_start_date,
              stage_end_date: timelineData.stage_end_date,
              duration_weeks: timelineData.duration_weeks,
              fte_required: timelineData.fte_required,
            })
          },
        });
      });

      await Promise.all(updates);
      handleCloseStatusModal();
    } catch (error) {
      console.error('Failed to update resource timeline data:', error);
    }
  };


  if (isLoading) {
    return <LoadingSpinner text="Loading opportunity details..." />;
  }

  if (opportunityError || !opportunity) {
    return (
      <div className="p-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Opportunity</h2>
          <p className="text-red-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  const mappedOpportunity = mapOpportunityForDisplay(opportunity, categories);
  const quarterlyRevenueData = getQuarterlyRevenueData();

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/v2/opportunities')}
            className="flex items-center gap-2 text-dxc-bright-purple hover:text-dxc-dark-purple text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Opportunities
          </button>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator 
            status={mappedOpportunity.status === 'Active' ? 'success' : mappedOpportunity.status === 'Inactive' ? 'error' : 'warning'} 
            label="Live Data"
            size="sm" 
          />
        </div>
      </div>

      {/* Prominent Account and Opportunity Info */}
      <div className="bg-dxc-bright-purple/5 border-l-4 border-dxc-bright-purple p-4 rounded-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full">
            <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 mb-3">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Account</span>
                <h2 className={`text-lg font-bold ${getSecurityClearanceColorClass(opportunity.security_clearance) || 'text-dxc-bright-purple'}`}>
                  {opportunity.account_name || 'No Account'}
                </h2>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Opportunity ID</span>
                {opportunity.sfdc_url ? (
                  <a 
                    href={opportunity.sfdc_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-lg font-bold text-dxc-bright-purple hover:text-dxc-dark-purple hover:underline transition-colors cursor-pointer block"
                    title="Click to view in Salesforce"
                  >
                    {opportunity.opportunity_id}
                  </a>
                ) : (
                  <h2 className="text-lg font-bold text-dxc-bright-purple">{opportunity.opportunity_id}</h2>
                )}
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Assigned Resource</span>
                <h2 className="text-lg font-bold text-gray-900">{opportunity.opportunity_owner || 'Not assigned'}</h2>
              </div>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{opportunity.opportunity_name}</h1>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Opportunity Details Card */}
        <div className="bg-white rounded-lg border shadow-sm p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Opportunity Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">Stage</dt>
              <dd className="text-xs font-medium">{opportunity.sales_stage}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">Close Date</dt>
              <dd className="text-xs">{formatDate(opportunity.decision_date)}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">Category</dt>
              <dd className="text-xs">{getOpportunityCategory(opportunity.tcv_millions, categories)}</dd>
            </div>
            {opportunity.opportunity_type && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Type</dt>
                <dd className="text-xs">{opportunity.opportunity_type}</dd>
              </div>
            )}
            {opportunity.lead_offering_l1 && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Lead Offering</dt>
                <dd className="text-xs">{opportunity.lead_offering_l1}</dd>
              </div>
            )}
            {opportunity.contract_length && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Contract Length</dt>
                <dd className="text-xs">{opportunity.contract_length} years</dd>
              </div>
            )}
            {opportunity.sales_org_l1 && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Sales Org</dt>
                <dd className="text-xs">{opportunity.sales_org_l1}</dd>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="bg-white rounded-lg border shadow-sm p-3">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">Total Contract Value</dt>
              <dd className="text-xs font-medium text-dxc-bright-purple">
                {formatCurrency(opportunity.tcv_millions || 0)}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">In Forecast</dt>
              <dd className="text-xs">
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  opportunity.in_forecast === 'Y' ? 'bg-green-100 text-green-800' :
                  opportunity.in_forecast === 'N' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {opportunity.in_forecast === 'Y' ? 'Yes' : opportunity.in_forecast === 'N' ? 'No' : 'Unknown'}
                </span>
              </dd>
            </div>
            {opportunity.master_period && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Master Period</dt>
                <dd className="text-xs">{opportunity.master_period}</dd>
              </div>
            )}
            {opportunity.margin_percentage && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Margin %</dt>
                <dd className={`text-xs font-medium ${
                  opportunity.margin_percentage >= 20 ? 'text-green-600' :
                  opportunity.margin_percentage >= 10 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {opportunity.margin_percentage.toFixed(1)}%
                </dd>
              </div>
            )}
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">First Year Revenue</dt>
              <dd className="text-xs font-medium text-dxc-bright-purple">
                {formatCurrency(opportunity.first_year_fy_rev || 0)}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-xs font-bold text-gray-600">Second Year Revenue</dt>
              <dd className="text-xs font-medium">
                {formatCurrency(opportunity.second_year_fy_rev || 0)}
              </dd>
            </div>
            {opportunity.fy_rev_beyond_yr2 && (
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-gray-600">Revenue Beyond Year 2</dt>
                <dd className="text-xs font-medium">
                  {formatCurrency(opportunity.fy_rev_beyond_yr2)}
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* Custom Fields Card */}
        <div className="bg-white rounded-lg border shadow-sm p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Custom Fields
            </h3>
            <div className="flex gap-1.5">
              {!isEditingCustomFields ? (
                <button onClick={handleEditCustomFields} className="btn-primary text-xs px-2 py-0.5">
                  <Edit className="w-3 h-3" />
                </button>
              ) : (
                <>
                  <button onClick={handleCancelCustomFields} className="btn-secondary text-xs px-2 py-0.5">
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleSaveCustomFields}
                    disabled={updateMutation.isPending}
                    className="btn-primary text-xs px-2 py-0.5 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            {isEditingCustomFields ? (
              <>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Security Clearance</dt>
                  <select
                    value={formData.security_clearance || ''}
                    onChange={(e) => handleInputChange('security_clearance', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                  >
                    <option value="">No clearance required</option>
                    <option value="BPSS">BPSS</option>
                    <option value="SC">SC</option>
                    <option value="DV">DV</option>
                  </select>
                </div>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Custom Priority</dt>
                  <input
                    type="text"
                    value={formData.custom_priority || ''}
                    onChange={(e) => handleInputChange('custom_priority', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                    placeholder="e.g. High, Medium, Low"
                  />
                </div>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Internal Stage Assessment</dt>
                  <input
                    type="text"
                    value={formData.internal_stage_assessment || ''}
                    onChange={(e) => handleInputChange('internal_stage_assessment', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                    placeholder="Internal stage assessment"
                  />
                </div>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Custom Field 1</dt>
                  <input
                    type="text"
                    value={formData.custom_tracking_field_1 || ''}
                    onChange={(e) => handleInputChange('custom_tracking_field_1', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                    placeholder="Custom tracking field 1"
                  />
                </div>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Custom Field 2</dt>
                  <input
                    type="text"
                    value={formData.custom_tracking_field_2 || ''}
                    onChange={(e) => handleInputChange('custom_tracking_field_2', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                    placeholder="Custom tracking field 2"
                  />
                </div>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Custom Field 3</dt>
                  <input
                    type="text"
                    value={formData.custom_tracking_field_3 || ''}
                    onChange={(e) => handleInputChange('custom_tracking_field_3', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                    placeholder="Custom tracking field 3"
                  />
                </div>
                <div>
                  <dt className="text-xs font-bold text-gray-600 mb-0.5">Internal Notes</dt>
                  <textarea
                    value={formData.internal_notes || ''}
                    onChange={(e) => handleInputChange('internal_notes', e.target.value)}
                    className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded resize-none"
                    rows={3}
                    placeholder="Add internal notes..."
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <dt className="text-xs font-bold text-gray-600">Security Clearance</dt>
                  <dd className="text-xs">{opportunity.security_clearance || 'None required'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs font-bold text-gray-600">Custom Priority</dt>
                  <dd className="text-xs">{opportunity.custom_priority || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs font-bold text-gray-600">Stage Assessment</dt>
                  <dd className="text-xs">{opportunity.internal_stage_assessment || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs font-bold text-gray-600">Custom Field 1</dt>
                  <dd className="text-xs">{opportunity.custom_tracking_field_1 || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs font-bold text-gray-600">Custom Field 2</dt>
                  <dd className="text-xs">{opportunity.custom_tracking_field_2 || 'Not set'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs font-bold text-gray-600">Custom Field 3</dt>
                  <dd className="text-xs">{opportunity.custom_tracking_field_3 || 'Not set'}</dd>
                </div>
                <div className="border-t pt-2 mt-2">
                  <dt className="text-xs font-bold text-gray-600 mb-1">Internal Notes</dt>
                  <dd className="text-xs text-gray-700 whitespace-pre-wrap">
                    {opportunity.internal_notes || 'No internal notes added.'}
                  </dd>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Line Revenue Breakdown */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Service Line Revenue Breakdown
          </h3>
        </div>
        
        <div className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {SERVICE_LINES.map(serviceLine => {
              const fieldName = `${serviceLine.toLowerCase()}_millions` as keyof Opportunity;
              const value = opportunity[fieldName] as number || 0;
              const percentage = opportunity.tcv_millions ? (value / opportunity.tcv_millions * 100) : 0;
              
              return (
                <div key={serviceLine} className="text-center">
                  <div className="text-xs font-bold text-gray-600 mb-1">{serviceLine}</div>
                  <div className="text-sm font-medium text-dxc-bright-purple">{formatCurrency(value)}</div>
                  <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resource Analysis Section - Tabbed Interface */}
      {(hasValidTimeline(resourceTimeline) || opportunity) && (
        <div className="bg-white rounded-lg border shadow-sm">
          {/* Header with Calculate Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800 mb-2 sm:mb-0">Resource Analysis</h3>
            
            {/* Timeline Controls and Calculate Button */}
            <div className="flex flex-wrap gap-2">
              {activeResourceTab === 'timeline' && hasValidTimeline(resourceTimeline) && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {(['week', 'month', 'quarter', 'stage'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => {
                        console.log('🔄 OpportunityDetailV2: Time period clicked:', period);
                        setTimePeriod(period);
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        timePeriod === period
                          ? 'bg-white text-dxc-bright-purple shadow-sm'
                          : 'text-gray-600 hover:text-dxc-bright-purple'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Calculate Timeline Button */}
              {canCalculateTimeline(opportunity) && !hasValidTimeline(resourceTimeline) && (
                <button
                  onClick={handleCalculateTimeline}
                  disabled={calculateTimelineMutation.isPending}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  {calculateTimelineMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Calculator className="w-3 h-3" />
                  )}
                  Calculate Timeline
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'timeline', label: 'Timeline', icon: Calendar, condition: hasValidTimeline(resourceTimeline) },
              { key: 'profile', label: 'Resource Profile', icon: Users, condition: hasValidTimeline(resourceTimeline) },
              { key: 'line-items', label: 'Line Items', icon: BarChart3, condition: lineItems && lineItems.length > 0 },
              { key: 'revenue', label: 'Service Line Revenue', icon: DollarSign, condition: true },
              { key: 'quarterly-revenue', label: 'Quarterly Revenue', icon: TrendingUp, condition: quarterlyRevenueData.length > 0 }
            ].filter(tab => tab.condition).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveResourceTab(key as any)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeResourceTab === key
                    ? 'border-dxc-bright-purple text-dxc-bright-purple bg-dxc-bright-purple/5'
                    : 'border-transparent text-gray-600 hover:text-dxc-bright-purple hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-3">
            {/* Timeline Tab */}
            {activeResourceTab === 'timeline' && hasValidTimeline(resourceTimeline) && (() => {
              const tableData = getTimelineTableData(resourceTimeline!);
              
              if (!tableData.length) {
                return (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Calendar className="w-12 h-12 mb-3" />
                    <p className="text-center">No timeline data available</p>
                  </div>
                );
              }

              // Prepare chart data based on time period
              console.log('📊 OpportunityDetailV2: Preparing chart data for timePeriod:', timePeriod);
              console.log('📊 OpportunityDetailV2: Raw tableData:', tableData);
              
              let chartData = [];
              if (timePeriod === 'stage') {
                // Group by stage and service line (stacked view)
                const stageMap = new Map<string, Record<string, number>>();
                
                tableData.forEach(item => {
                  const stage = item.stage_name;
                  const serviceLine = item.service_line;
                  
                  if (!stageMap.has(stage)) {
                    stageMap.set(stage, {});
                  }
                  
                  const stageData = stageMap.get(stage)!;
                  stageData[serviceLine] = (stageData[serviceLine] || 0) + item.fte_required;
                });
                
                // Convert to chart data format
                chartData = Array.from(stageMap.entries()).map(([stage, serviceLineData]) => ({
                  stage,
                  ...serviceLineData
                }));
              } else {
                // Time-based view: create concurrent timeline (like original)
                const timelineMap = new Map<string, Record<string, any>>();
                const serviceLines = new Set<string>();
                
                // Collect all service lines
                tableData.forEach(item => {
                  serviceLines.add(item.service_line);
                });
                
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
                  const serviceLine = item.service_line;
                  const startDate = new Date(item.stage_start_date || Date.now());
                  const endDate = new Date(item.stage_end_date || Date.now());
                  
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
                      periodLabel = `Q${quarter} ${year.toString().slice(-2)}`;
                    } else if (timePeriod === 'month') {
                      // For monthly, group by month
                      const year = currentDate.getFullYear();
                      const month = currentDate.getMonth();
                      dateKey = `${year}-${month.toString().padStart(2, '0')}`;
                      periodLabel = currentDate.toLocaleDateString('en-US', formatOptions);
                    } else {
                      // For weekly, group by week
                      const weekStart = new Date(currentDate);
                      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
                      dateKey = weekStart.toISOString().split('T')[0];
                      periodLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    }
                    
                    if (!timelineMap.has(dateKey)) {
                      const entry: Record<string, any> = { date: dateKey, period: periodLabel };
                      // Initialize all service lines to 0
                      Array.from(serviceLines).forEach(sl => {
                        entry[sl] = 0;
                      });
                      timelineMap.set(dateKey, entry);
                    }
                    
                    const entry = timelineMap.get(dateKey)!;
                    entry[serviceLine] = (entry[serviceLine] || 0) + Number(item.fte_required);
                    
                    currentDate.setDate(currentDate.getDate() + intervalDays);
                  }
                });
                
                // Convert to array and sort by date
                chartData = Array.from(timelineMap.values())
                  .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                  .map(item => ({
                    ...item,
                    period: item.period
                  }));
              }
              
              console.log('📊 OpportunityDetailV2: Processed chartData:', chartData);

              return (
                <div className="space-y-4">
                  {/* Time Period Indicator */}
                  <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                    Viewing: <span className="font-medium capitalize">{timePeriod}</span> 
                    {timePeriod !== 'stage' ? ' timeline (concurrent FTE by service line)' : ' stages'} • 
                    {timePeriod !== 'stage' ? `${chartData.length} time periods` : `${chartData.length} stages`}
                  </div>
                  {/* Chart */}
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey={timePeriod === 'stage' ? 'stage' : 'period'} 
                          angle={0}
                          textAnchor="middle"
                          height={60}
                          tick={{ fontSize: 11 }}
                          interval={0}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(label) => `${label} (${timePeriod} view)`}
                          formatter={(value: number, name: string) => [
                            typeof value === 'number' ? value.toFixed(1) : value,
                            name
                          ]}
                        />
                        <Legend />
                        {timePeriod === 'stage' ? (
                          // Show stacked bars by service line
                          Array.from(new Set(tableData.map(item => item.service_line))).map((serviceLine, index) => (
                            <Bar
                              key={serviceLine}
                              dataKey={serviceLine}
                              stackId="serviceLine"
                              fill={DXC_COLORS[index % DXC_COLORS.length]}
                              name={serviceLine}
                            />
                          ))
                        ) : (
                          // Show separate bars for each service line (concurrent view)
                          Array.from(new Set(tableData.map(item => item.service_line))).map((serviceLine, index) => (
                            <Bar
                              key={serviceLine}
                              dataKey={serviceLine}
                              stackId="fte"
                              fill={DXC_COLORS[index % DXC_COLORS.length]}
                              name={serviceLine}
                            />
                          ))
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}

            {/* Resource Profile Tab */}
            {activeResourceTab === 'profile' && hasValidTimeline(resourceTimeline) && (() => {
              const tableData = getTimelineTableData(resourceTimeline!);
              
              if (!tableData.length) {
                return (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Users className="w-12 h-12 mb-3" />
                    <p className="text-center">No resource profile data available</p>
                  </div>
                );
              }

              // Calculate summary metrics
              const totalEffort = tableData.reduce((sum, item) => sum + item.total_effort_weeks, 0);
              const avgFTE = tableData.reduce((sum, item) => sum + item.fte_required, 0) / tableData.length;
              const peakFTE = Math.max(...tableData.map(item => item.fte_required));
              const serviceLines = [...new Set(tableData.map(item => item.service_line))];

              // Group data by service line for better organization
              const serviceLineData = tableData.reduce((acc, item) => {
                const serviceLine = item.service_line;
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
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                      title="Total Effort"
                      value={`${totalEffort.toFixed(1)} weeks`}
                      icon={Calendar}
                      iconColor="text-dxc-bright-teal"
                    />
                    <MetricCard
                      title="Average FTE"
                      value={avgFTE.toFixed(1)}
                      icon={Users}
                      iconColor="text-dxc-blue"
                    />
                    <MetricCard
                      title="Peak FTE"
                      value={peakFTE.toFixed(1)}
                      icon={TrendingUp}
                      iconColor="text-dxc-green"
                    />
                    <MetricCard
                      title="Service Lines"
                      value={serviceLines.length.toString()}
                      icon={Layers}
                      iconColor="text-dxc-orange"
                    />
                  </div>

                  {/* Detailed Resource Profile Table */}
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Service Line
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stage
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Start Date
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              End Date
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              FTE Required
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Effort
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(serviceLineData).map(([serviceLine, stages]) =>
                            (stages as any[]).map((item: any, stageIndex: number) => (
                              <tr key={`${serviceLine}-${stageIndex}`} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                        style={{ 
                                          backgroundColor: `${serviceLineColors[serviceLine]}20`, 
                                          color: serviceLineColors[serviceLine] 
                                        }}>
                                    {serviceLine}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {item.stage_name}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {item.stage_start_date ? new Date(item.stage_start_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : 'TBD'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {item.stage_end_date ? new Date(item.stage_end_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : 'TBD'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {(item.duration_weeks || 0).toFixed(1)} weeks
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-dxc-bright-purple">
                                  {(item.fte_required || 0).toFixed(1)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                                  {(item.total_effort_weeks || 0).toFixed(1)} weeks
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs">
                                  <span 
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      item.resource_status === 'Predicted' ? 'bg-blue-100 text-blue-800' :
                                      item.resource_status === 'Forecast' ? 'bg-yellow-100 text-yellow-800' :
                                      item.resource_status === 'Planned' ? 'bg-green-100 text-green-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {item.resource_status || 'Predicted'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Service Line Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(serviceLineData).map(([serviceLine, stages]) => (
                      <div key={serviceLine} className="bg-white border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" 
                               style={{ backgroundColor: serviceLineColors[serviceLine] }}>
                          </div>
                          <h4 className="text-sm font-medium text-gray-800">{serviceLine} Service Line</h4>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Stages:</span>
                            <span className="font-medium">{(stages as any[]).length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Effort:</span>
                            <span className="font-medium">
                              {(stages as any[]).reduce((sum: number, stage: any) => sum + (stage.total_effort_weeks || 0), 0).toFixed(1)} weeks
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Peak FTE:</span>
                            <span className="font-medium">
                              {(stages as any[]).length > 0 ? Math.max(...(stages as any[]).map((stage: any) => stage.fte_required || 0)).toFixed(1) : '0.0'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-medium">
                              {(stages as any[]).reduce((sum: number, stage: any) => sum + (stage.duration_weeks || 0), 0).toFixed(1)} weeks
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons - Bottom Right */}
                  <div className="flex justify-end gap-3">
                    {/* Generate Resource Profile Button */}
                    {canCalculateTimeline(opportunity) && (
                      <button
                        onClick={handleGenerateResourceProfile}
                        disabled={calculateTimelineMutation.isPending}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                      >
                        <TrendingUp className="w-3 h-3" />
                        {calculateTimelineMutation.isPending ? 'Generating...' : 'Generate Resource Profile'}
                      </button>
                    )}
                    
                    {/* Edit Resource Profile Button */}
                    <button
                      onClick={handleOpenStatusModal}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                    >
                      <Users className="w-3 h-3" />
                      Edit Resource Profile
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Line Items Tab */}
            {activeResourceTab === 'line-items' && (() => {
              if (!lineItems || lineItems.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <BarChart3 className="w-12 h-12 mb-3" />
                    <p className="text-center">No line items available</p>
                  </div>
                );
              }

              // Calculate total TCV for percentage calculations
              const totalTCV = lineItems.reduce((sum, item) => sum + (item.offering_tcv || 0), 0);

              return (
                <div className="space-y-4">
                  {/* Header with count and total */}
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium text-gray-800">
                      Line Item Details ({lineItems.length} items)
                    </h4>
                    <div className="text-sm font-medium text-dxc-bright-purple">
                      Total TCV: {formatCurrency(totalTCV)}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            Internal Service
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            Simplified Offering
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            Product Name
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            Offering TCV
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                            % of Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {lineItems.map((item, index) => {
                          const percentage = totalTCV > 0 ? ((item.offering_tcv || 0) / totalTCV * 100) : 0;
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-xs text-gray-900">
                                {item.internal_service || 'N/A'}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-900">
                                {item.simplified_offering || 'N/A'}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-900">
                                {item.product_name || 'N/A'}
                              </td>
                              <td className="px-3 py-2 text-xs text-right font-medium text-dxc-bright-purple">
                                {formatCurrency(item.offering_tcv || 0)}
                              </td>
                              <td className="px-3 py-2 text-xs text-right text-gray-600">
                                {percentage.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary section */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-xs font-medium text-gray-600">Total Line Items</div>
                        <div className="text-sm font-bold text-gray-900">{lineItems.length}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-gray-600">Total TCV</div>
                        <div className="text-sm font-bold text-dxc-bright-purple">{formatCurrency(totalTCV)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-gray-600">Average TCV per Item</div>
                        <div className="text-sm font-bold text-gray-900">
                          {formatCurrency(lineItems.length > 0 ? totalTCV / lineItems.length : 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Service Line Revenue Tab */}
            {activeResourceTab === 'revenue' && (
              <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={SERVICE_LINES.map(serviceLine => {
                          const fieldName = `${serviceLine.toLowerCase()}_millions` as keyof Opportunity;
                          const value = opportunity[fieldName] as number || 0;
                          return {
                            name: serviceLine,
                            value: value,
                            percentage: opportunity.tcv_millions ? (value / opportunity.tcv_millions * 100) : 0
                          };
                        }).filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                      >
                        {SERVICE_LINES.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={DXC_COLORS[index % DXC_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <CompactTable
                  data={SERVICE_LINES.map(serviceLine => {
                    const fieldName = `${serviceLine.toLowerCase()}_millions` as keyof Opportunity;
                    const value = opportunity[fieldName] as number || 0;
                    const percentage = opportunity.tcv_millions ? (value / opportunity.tcv_millions * 100) : 0;
                    
                    return {
                      service_line: serviceLine,
                      tcv: formatCurrency(value),
                      percentage: `${percentage.toFixed(1)}%`,
                      raw_value: value
                    };
                  }).filter(item => item.raw_value > 0)}
                  columns={[
                    { key: 'service_line', label: 'Service Line', sortable: true },
                    { key: 'tcv', label: 'TCV', sortable: true },
                    { key: 'percentage', label: '% of Total', sortable: true }
                  ]}
                  maxHeight="300px"
                />
              </div>
            )}

            {/* Quarterly Revenue Tab */}
            {activeResourceTab === 'revenue' && quarterlyRevenueData.length > 0 && (
              <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={quarterlyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="value" stroke={DXC_COLORS[0]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <CompactTable
                  data={quarterlyRevenueData}
                  columns={[
                    { key: 'quarter', label: 'Quarter', sortable: true },
                    { 
                      key: 'value', 
                      label: 'Revenue', 
                      sortable: true,
                      render: (value: number) => formatCurrency(value)
                    }
                  ]}
                  maxHeight="300px"
                />
              </div>
            )}
          </div>

          {/* Show message if no timeline available */}
          {!hasValidTimeline(resourceTimeline) && activeResourceTab === 'timeline' && (
            <div className="p-6 text-center">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <Calendar className="w-12 h-12 mb-3" />
                <p className="text-center mb-2">No resource timeline available</p>
                <p className="text-sm text-gray-400 mb-4">
                  Resource timelines are only available for MW and ITOC service lines
                </p>
                {opportunity && canCalculateTimeline(opportunity) && (
                  <button
                    onClick={handleCalculateTimeline}
                    disabled={calculateTimelineMutation.isPending}
                    className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                  >
                    {calculateTimelineMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4" />
                    )}
                    Calculate Resource Timeline
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Status Edit Modal */}
      {showStatusModal && resourceTimeline && (() => {
        const tableData = getTimelineTableData(resourceTimeline);
        const serviceLineData = tableData.reduce((acc, item) => {
          const serviceLine = (item as any).service_line;
          if (!acc[serviceLine]) {
            acc[serviceLine] = [];
          }
          acc[serviceLine].push(item);
          return acc;
        }, {} as Record<string, typeof tableData>);

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Edit Resource Timeline</h2>
                    <p className="text-xs text-gray-600 mt-1">Adjust duration and FTE requirements. Dates are calculated automatically from the opportunity close date. All items default to 'Forecast' status.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkStatusUpdate('Predicted')}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
                    >
                      Set All to Predicted
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('Forecast')}
                      className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full hover:bg-yellow-200 transition-colors"
                    >
                      Set All to Forecast
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('Planned')}
                      className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors"
                    >
                      Set All to Planned
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <div className="space-y-4">
                  {Object.entries(serviceLineData).map(([serviceLine, stages]) => (
                    <div key={serviceLine} className="border rounded-lg p-3">
                      <h3 className="text-sm font-medium text-dxc-bright-purple mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-dxc-bright-purple"></div>
                        {serviceLine} Service Line
                      </h3>
                      
                      {/* Column Headers */}
                      <div className="grid grid-cols-12 gap-2 items-center mb-2 px-2">
                        <div className="col-span-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Stage
                        </div>
                        <div className="col-span-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Start Date
                        </div>
                        <div className="col-span-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          End Date
                        </div>
                        <div className="col-span-1 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Duration
                        </div>
                        <div className="col-span-1 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          FTE
                        </div>
                        <div className="col-span-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Status
                        </div>
                        <div className="col-span-2 text-xs font-medium text-gray-600 uppercase tracking-wide text-right">
                          Total Effort
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {(stages as any[]).map((stage: any) => {
                          const key = `${serviceLine}|${stage.stage_name}`;
                          const currentStatus = statusUpdates[key] || 'Forecast';
                          const currentTimeline = timelineUpdates[key] || {
                            stage_start_date: '',
                            stage_end_date: '',
                            duration_weeks: stage.duration_weeks || 0,
                            fte_required: stage.fte_required || 0,
                          };
                          
                          return (
                            <div key={key} className="bg-gray-50 rounded-lg p-2 grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-2">
                                <div className="text-xs font-medium text-gray-700">
                                  Stage {stage.stage_name}
                                </div>
                              </div>
                              
                              <div className="col-span-2">
                                <input
                                  type="date"
                                  value={currentTimeline.stage_start_date}
                                  readOnly
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-1 py-1 text-xs text-gray-600 cursor-not-allowed"
                                  title="Start Date (Auto-calculated)"
                                />
                              </div>
                              
                              <div className="col-span-2">
                                <input
                                  type="date"
                                  value={currentTimeline.stage_end_date}
                                  readOnly
                                  className="w-full border border-gray-200 bg-gray-50 rounded px-1 py-1 text-xs text-gray-600 cursor-not-allowed"
                                  title="End Date (Auto-calculated)"
                                />
                              </div>
                              
                              <div className="col-span-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={currentTimeline.duration_weeks}
                                  onChange={(e) => handleTimelineFieldChange(serviceLine, stage.stage_name, 'duration_weeks', parseFloat(e.target.value) || 0)}
                                  className="w-full border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-dxc-bright-purple"
                                  placeholder="Weeks"
                                  title="Duration (weeks)"
                                />
                              </div>
                              
                              <div className="col-span-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={currentTimeline.fte_required}
                                  onChange={(e) => handleTimelineFieldChange(serviceLine, stage.stage_name, 'fte_required', parseFloat(e.target.value) || 0)}
                                  className="w-full border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-dxc-bright-purple"
                                  placeholder="FTE"
                                  title="FTE Required"
                                />
                              </div>
                              
                              <div className="col-span-2">
                                <select
                                  value={currentStatus}
                                  onChange={(e) => handleStatusChange(serviceLine, stage.stage_name, e.target.value as ResourceStatus)}
                                  className="w-full border border-gray-300 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-dxc-bright-purple"
                                >
                                  {RESOURCE_STATUSES.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="col-span-2 text-xs text-gray-500 text-right">
                                {(currentTimeline.duration_weeks * currentTimeline.fte_required).toFixed(1)} weeks total
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 italic">
                    💡 Changes are only saved to the database when you click "Save Changes"
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseStatusModal}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBulkStatus}
                      disabled={updateTimelineDataMutation.isPending}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      {updateTimelineDataMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default OpportunityDetailV2;