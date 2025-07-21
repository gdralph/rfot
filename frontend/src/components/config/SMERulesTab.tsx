import React, { useState } from 'react';
import { Plus, Edit2, Users } from 'lucide-react';
import { useCreateSMERule } from '../../hooks/useConfig';
import type { SMEAllocationRule } from '../../types/index';
import { SERVICE_LINES } from '../../types/index';

interface SMERulesTabProps {
  smeRules: SMEAllocationRule[];
}

const SMERulesTab: React.FC<SMERulesTabProps> = ({ smeRules }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    team_name: '',
    service_line: '',
    effort_per_million: ''
  });

  const createSMERuleMutation = useCreateSMERule();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const smeRuleData: Omit<SMEAllocationRule, 'id'> = {
        team_name: formData.team_name,
        service_line: formData.service_line || undefined,
        effort_per_million: parseFloat(formData.effort_per_million)
      };

      await createSMERuleMutation.mutateAsync(smeRuleData);
      
      // Reset form
      setFormData({ team_name: '', service_line: '', effort_per_million: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create SME rule:', error);
    }
  };

  const sortedSMERules = [...smeRules].sort((a, b) => {
    // Sort by service line first (null values last), then by team name
    if (a.service_line && b.service_line) {
      if (a.service_line !== b.service_line) {
        return a.service_line.localeCompare(b.service_line);
      }
    } else if (a.service_line && !b.service_line) {
      return -1;
    } else if (!a.service_line && b.service_line) {
      return 1;
    }
    return a.team_name.localeCompare(b.team_name);
  });

  const getServiceLineBadgeColor = (serviceLine?: string) => {
    if (!serviceLine) return 'bg-gray-100 text-gray-800';
    
    const colors: Record<string, string> = {
      'CES': 'bg-purple-100 text-purple-800',
      'INS': 'bg-blue-100 text-blue-800',
      'BPS': 'bg-green-100 text-green-800',
      'SEC': 'bg-red-100 text-red-800',
      'ITOC': 'bg-yellow-100 text-yellow-800',
      'MW': 'bg-indigo-100 text-indigo-800'
    };
    
    return colors[serviceLine] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-dxc-subtitle font-semibold">SME Allocation Rules</h3>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Define how subject matter experts are allocated based on opportunity value and service lines
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-dxc p-4 border border-dxc-light-gray">
          <h4 className="font-semibold mb-4">Add New SME Allocation Rule</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={formData.team_name}
                  onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                  placeholder="e.g., Security SMEs, Cloud Architects"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Service Line <span className="text-dxc-medium-gray">(optional)</span>
                </label>
                <select
                  value={formData.service_line}
                  onChange={(e) => setFormData({ ...formData, service_line: e.target.value })}
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
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Effort per $1M
                </label>
                <input
                  type="number"
                  value={formData.effort_per_million}
                  onChange={(e) => setFormData({ ...formData, effort_per_million: e.target.value })}
                  placeholder="0.5"
                  min="0"
                  step="0.1"
                  className="input w-full"
                  required
                />
              </div>
            </div>
            <div className="text-sm text-dxc-medium-gray bg-blue-50 p-3 rounded-dxc">
              <strong>Example:</strong> If effort per $1M is 0.5, then a $10M opportunity would require 5 weeks of SME effort from this team.
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createSMERuleMutation.isPending}
                className="btn-primary"
              >
                {createSMERuleMutation.isPending ? 'Creating...' : 'Create Rule'}
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

      {/* SME Rules List */}
      <div className="space-y-3">
        {sortedSMERules.length === 0 ? (
          <div className="text-center py-8 text-dxc-medium-gray">
            <Users className="w-12 h-12 mx-auto mb-4 text-dxc-light-gray" />
            <p className="text-lg mb-2">No SME allocation rules configured</p>
            <p className="text-sm">Add rules to automatically calculate SME resource requirements</p>
          </div>
        ) : (
          sortedSMERules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white border border-dxc-light-gray rounded-dxc p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-dxc-dark-gray">
                      {rule.team_name}
                    </h4>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-dxc-bright-purple text-white">
                      #{rule.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-dxc-medium-gray">Service Line:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${getServiceLineBadgeColor(rule.service_line)}`}>
                        {rule.service_line || 'All'}
                      </span>
                    </div>
                    <div>
                      <span className="text-dxc-medium-gray">Effort per $1M:</span>
                      <span className="font-medium text-dxc-blue ml-2">
                        {rule.effort_per_million} weeks
                      </span>
                    </div>
                  </div>
                  
                  {/* Example calculation */}
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-dxc-medium-gray">
                    <strong>Example:</strong> A $5M opportunity would require {(rule.effort_per_million * 5).toFixed(1)} weeks of {rule.team_name} effort
                    {rule.service_line && ` (${rule.service_line} service line)`}
                  </div>
                </div>
                <button className="text-dxc-medium-gray hover:text-dxc-bright-purple p-2">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-amber-50 border border-amber-200 rounded-dxc p-4">
        <h4 className="font-semibold text-amber-900 mb-2">How SME Allocation Works</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• SME rules calculate required subject matter expert effort based on opportunity value</li>
          <li>• Service line specific rules take precedence over general rules</li>
          <li>• Rules are multiplicative: $10M opportunity × 0.5 weeks/$1M = 5 weeks effort</li>
          <li>• Use these estimates for resource planning and capacity management</li>
        </ul>
      </div>
    </div>
  );
};

export default SMERulesTab;