import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpportunity, useOpportunityLineItems, useUpdateOpportunity } from '../hooks/useOpportunities';
import LoadingSpinner from '../components/LoadingSpinner';
import type { OpportunityFormData, ServiceLine, ChartDataPoint } from '../types/index';
import { SERVICE_LINES, DXC_COLORS } from '../types/index';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';

const OpportunityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const opportunityId = id ? parseInt(id, 10) : 0;

  const { data: opportunity, isLoading: opportunityLoading, error: opportunityError } = useOpportunity(opportunityId);
  const { data: lineItems, isLoading: lineItemsLoading } = useOpportunityLineItems(opportunityId);
  const updateMutation = useUpdateOpportunity();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<OpportunityFormData>({
    assigned_resource: '',
    status: '',
    notes: '',
  });

  // Initialize form data when opportunity loads
  React.useEffect(() => {
    if (opportunity) {
      setFormData({
        assigned_resource: opportunity.assigned_resource || '',
        status: opportunity.status || '',
        notes: opportunity.notes || '',
      });
    }
  }, [opportunity]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values
    if (opportunity) {
      setFormData({
        assigned_resource: opportunity.assigned_resource || '',
        status: opportunity.status || '',
        notes: opportunity.notes || '',
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

  // Prepare service line chart data
  const getServiceLineChartData = (): ChartDataPoint[] => {
    if (!lineItems || lineItems.length === 0) return [];

    const totalRevenue = lineItems.reduce((sum, item) => {
      return sum + (item.ces_revenue || 0) + (item.ins_revenue || 0) + (item.bps_revenue || 0) + 
             (item.sec_revenue || 0) + (item.itoc_revenue || 0) + (item.mw_revenue || 0);
    }, 0);

    const serviceLineData: ChartDataPoint[] = [];
    let colorIndex = 0;

    SERVICE_LINES.forEach(serviceLine => {
      const revenue = lineItems.reduce((sum, item) => {
        switch (serviceLine) {
          case 'CES': return sum + (item.ces_revenue || 0);
          case 'INS': return sum + (item.ins_revenue || 0);
          case 'BPS': return sum + (item.bps_revenue || 0);
          case 'SEC': return sum + (item.sec_revenue || 0);
          case 'ITOC': return sum + (item.itoc_revenue || 0);
          case 'MW': return sum + (item.mw_revenue || 0);
          default: return sum;
        }
      }, 0);

      if (revenue > 0) {
        serviceLineData.push({
          name: serviceLine,
          value: revenue,
          color: DXC_COLORS[colorIndex % DXC_COLORS.length]
        });
        colorIndex++;
      }
    });

    return serviceLineData;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (opportunityLoading) {
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
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
        <h1 className="text-dxc-slide text-dxc-purple mb-2">{opportunity.name}</h1>
        <p className="text-dxc-body text-gray-600">ID: {opportunity.opportunity_id}</p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Opportunity Details */}
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Opportunity Details</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <p className="text-dxc-body font-medium">{opportunity.stage}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <p className="text-dxc-body font-medium text-dxc-purple">
                  {formatCurrency(opportunity.amount)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Close Date</label>
                <p className="text-dxc-body">{formatDate(opportunity.close_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <p className="text-dxc-body">{opportunity.category || 'Not categorized'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Resource Assignment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Resource
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.assigned_resource}
                  onChange={(e) => handleInputChange('assigned_resource', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
                  placeholder="Enter resource name"
                />
              ) : (
                <p className="text-dxc-body">{opportunity.assigned_resource || 'Not assigned'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              {isEditing ? (
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
              ) : (
                <p className="text-dxc-body">{opportunity.status || 'No status set'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="card mb-8">
        <h2 className="text-dxc-subtitle font-semibold mb-4">Notes</h2>
        {isEditing ? (
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
            placeholder="Add notes about this opportunity..."
          />
        ) : (
          <p className="text-dxc-body whitespace-pre-wrap">
            {opportunity.notes || 'No notes added'}
          </p>
        )}
      </div>

      {/* Service Line Breakdown */}
      {serviceLineChartData.length > 0 && (
        <div className="card">
          <h2 className="text-dxc-subtitle font-semibold mb-4">Service Line Revenue Breakdown</h2>
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
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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