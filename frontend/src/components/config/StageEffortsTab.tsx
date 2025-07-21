import React, { useState } from 'react';
import { Plus, Edit2, Clock } from 'lucide-react';
import { useCreateStageEffort } from '../../hooks/useConfig';
import type { OpportunityCategory, StageEffortEstimate } from '../../types/index';
import { SALES_STAGES } from '../../types/index';

interface StageEffortsTabProps {
  stageEfforts: StageEffortEstimate[];
  categories: OpportunityCategory[];
}

const StageEffortsTab: React.FC<StageEffortsTabProps> = ({ stageEfforts, categories }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '',
    stage_name: '',
    default_effort_weeks: '',
    default_duration_weeks: ''
  });

  const createStageEffortMutation = useCreateStageEffort();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const stageEffortData: Omit<StageEffortEstimate, 'id'> = {
        category_id: parseInt(formData.category_id),
        stage_name: formData.stage_name,
        default_effort_weeks: parseFloat(formData.default_effort_weeks),
        default_duration_weeks: parseInt(formData.default_duration_weeks)
      };

      await createStageEffortMutation.mutateAsync(stageEffortData);
      
      // Reset form
      setFormData({ category_id: '', stage_name: '', default_effort_weeks: '', default_duration_weeks: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create stage effort estimate:', error);
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || `Category #${categoryId}`;
  };

  const getStageLabel = (stageCode: string) => {
    const stage = SALES_STAGES.find(s => s.code === stageCode);
    return stage?.label || stageCode;
  };

  const sortedStageEfforts = [...stageEfforts].sort((a, b) => {
    // Sort by category first, then by stage
    if (a.category_id !== b.category_id) {
      return a.category_id - b.category_id;
    }
    const stageOrderA = SALES_STAGES.findIndex(s => s.code === a.stage_name);
    const stageOrderB = SALES_STAGES.findIndex(s => s.code === b.stage_name);
    return stageOrderA - stageOrderB;
  });

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-dxc-subtitle font-semibold">Stage Effort Estimates</h3>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Configure default effort and duration estimates for each stage and category combination
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Estimate
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-dxc p-4 border border-dxc-light-gray">
          <h4 className="font-semibold mb-4">Add New Stage Effort Estimate</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Category
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Stage
                </label>
                <select
                  value={formData.stage_name}
                  onChange={(e) => setFormData({ ...formData, stage_name: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Select Stage</option>
                  {SALES_STAGES.map((stage) => (
                    <option key={stage.code} value={stage.code}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Effort (Weeks)
                </label>
                <input
                  type="number"
                  value={formData.default_effort_weeks}
                  onChange={(e) => setFormData({ ...formData, default_effort_weeks: e.target.value })}
                  placeholder="2.5"
                  min="0"
                  step="0.1"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Duration (Weeks)
                </label>
                <input
                  type="number"
                  value={formData.default_duration_weeks}
                  onChange={(e) => setFormData({ ...formData, default_duration_weeks: e.target.value })}
                  placeholder="4"
                  min="1"
                  className="input w-full"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createStageEffortMutation.isPending}
                className="btn-primary"
              >
                {createStageEffortMutation.isPending ? 'Creating...' : 'Create Estimate'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stage Efforts List */}
      <div className="space-y-4">
        {sortedStageEfforts.length === 0 ? (
          <div className="text-center py-8 text-dxc-medium-gray">
            <Clock className="w-12 h-12 mx-auto mb-4 text-dxc-light-gray" />
            <p className="text-lg mb-2">No stage effort estimates configured</p>
            <p className="text-sm">Add effort estimates to help with resource planning</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Stage</th>
                  <th>Effort (Weeks)</th>
                  <th>Duration (Weeks)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStageEfforts.map((estimate) => (
                  <tr key={estimate.id}>
                    <td>
                      <span className="font-semibold text-dxc-dark-gray">
                        {getCategoryName(estimate.category_id)}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-dxc-bright-purple text-white">
                        {getStageLabel(estimate.stage_name)}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-dxc-blue">
                        {estimate.default_effort_weeks}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-dxc-green">
                        {estimate.default_duration_weeks}
                      </span>
                    </td>
                    <td>
                      <button className="text-dxc-medium-gray hover:text-dxc-bright-purple p-1">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-green-50 border border-green-200 rounded-dxc p-4">
        <h4 className="font-semibold text-green-900 mb-2">Understanding Effort vs Duration</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• <strong>Effort:</strong> Total person-weeks of work required (can be fractional)</li>
          <li>• <strong>Duration:</strong> Calendar time from start to finish (in whole weeks)</li>
          <li>• Multiple resources can work in parallel to reduce duration</li>
          <li>• Example: 4 weeks effort might take 2 weeks duration with 2 people working</li>
        </ul>
      </div>
    </div>
  );
};

export default StageEffortsTab;