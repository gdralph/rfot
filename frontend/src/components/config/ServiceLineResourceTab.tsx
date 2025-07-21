import React, { useState, useEffect } from 'react';
import { Settings, Plus, Save, Loader2, Users } from 'lucide-react';
import {
  useServiceLineStageEfforts,
  useUpdateServiceLineStageEffort,
  useBulkCreateServiceLineStageEfforts
} from '../../hooks/useConfig';
import type { OpportunityCategory, ServiceLineStageEffort } from '../../types/index';
import { SALES_STAGES } from '../../types/index';

interface ServiceLineResourceTabProps {
  categories: OpportunityCategory[];
}

const ServiceLineResourceTab: React.FC<ServiceLineResourceTabProps> = ({ categories }) => {
  const [activeServiceLine, setActiveServiceLine] = useState<'MW' | 'ITOC'>('MW');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<ServiceLineStageEffort>>>(new Map());
  
  const { data: stageEfforts = [], isLoading, error, refetch } = useServiceLineStageEfforts(activeServiceLine);
  const updateEffortMutation = useUpdateServiceLineStageEffort();
  const bulkCreateMutation = useBulkCreateServiceLineStageEfforts();

  // Create a matrix of all possible combinations
  const createEffortMatrix = () => {
    const matrix = new Map<string, ServiceLineStageEffort>();
    
    // Initialize with existing data
    stageEfforts.forEach(effort => {
      const key = `${effort.category_id}-${effort.stage_name}`;
      matrix.set(key, {
        ...effort,
        effort_weeks: effort.fte_required * effort.duration_weeks
      });
    });
    
    // Fill in missing combinations with defaults
    categories.forEach(category => {
      SALES_STAGES.forEach(stage => {
        const key = `${category.id}-${stage.code}`;
        if (!matrix.has(key)) {
          matrix.set(key, {
            service_line: activeServiceLine,
            category_id: category.id!,
            stage_name: stage.code,
            duration_weeks: 0,
            fte_required: 0,
            effort_weeks: 0
          });
        }
      });
    });
    
    return matrix;
  };

  const effortMatrix = createEffortMatrix();

  const handleCellEdit = (categoryId: number, stageCode: string, field: 'duration_weeks' | 'fte_required', value: string) => {
    const key = `${categoryId}-${stageCode}`;
    const currentEffort = effortMatrix.get(key);
    if (!currentEffort) return;

    const numValue = parseFloat(value) || 0;
    const changes = pendingChanges.get(key) || {};
    const updatedChanges = {
      ...changes,
      [field]: numValue
    };

    // Calculate effort_weeks based on updated values
    const duration = field === 'duration_weeks' ? numValue : (changes.duration_weeks ?? currentEffort.duration_weeks);
    const fte = field === 'fte_required' ? numValue : (changes.fte_required ?? currentEffort.fte_required);
    updatedChanges.effort_weeks = duration * fte;

    setPendingChanges(new Map(pendingChanges.set(key, updatedChanges)));
  };

  const handleSaveChanges = async () => {
    const updates: Array<{ existing: ServiceLineStageEffort; changes: Partial<ServiceLineStageEffort> }> = [];
    const creates: Array<Omit<ServiceLineStageEffort, 'id' | 'effort_weeks'>> = [];

    for (const [key, changes] of pendingChanges.entries()) {
      const existing = effortMatrix.get(key);
      if (!existing) continue;

      if (existing.id) {
        // Update existing
        updates.push({ existing, changes });
      } else if (changes.duration_weeks || changes.fte_required) {
        // Create new (only if values are non-zero)
        creates.push({
          service_line: activeServiceLine,
          category_id: existing.category_id,
          stage_name: existing.stage_name,
          duration_weeks: changes.duration_weeks || 0,
          fte_required: changes.fte_required || 0
        });
      }
    }

    try {
      // Process updates
      for (const { existing, changes } of updates) {
        if (existing.id) {
          await updateEffortMutation.mutateAsync({
            id: existing.id,
            data: {
              service_line: existing.service_line,
              category_id: existing.category_id,
              stage_name: existing.stage_name,
              duration_weeks: changes.duration_weeks ?? existing.duration_weeks,
              fte_required: changes.fte_required ?? existing.fte_required
            }
          });
        }
      }

      // Process creates
      if (creates.length > 0) {
        await bulkCreateMutation.mutateAsync(creates);
      }

      setPendingChanges(new Map());
      refetch();
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  const getCellValue = (categoryId: number, stageCode: string, field: 'duration_weeks' | 'fte_required' | 'effort_weeks') => {
    const key = `${categoryId}-${stageCode}`;
    const changes = pendingChanges.get(key);
    const existing = effortMatrix.get(key);
    
    if (changes && field in changes) {
      return changes[field];
    }
    
    return existing?.[field] || 0;
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || `Category #${categoryId}`;
  };

  const getStageLabel = (stageCode: string) => {
    const stage = SALES_STAGES.find(s => s.code === stageCode);
    return stage?.label || stageCode;
  };

  const hasPendingChanges = pendingChanges.size > 0;
  const isSaving = updateEffortMutation.isPending || bulkCreateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-dxc-bright-purple" />
        <span className="ml-2 text-dxc-medium-gray">Loading resource configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-dxc-subtitle font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Service Line Resource Configuration
          </h3>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Configure duration and FTE requirements for MW and ITOC service lines by category and stage
          </p>
        </div>
        {hasPendingChanges && (
          <button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Service Line Selector */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {(['MW', 'ITOC'] as const).map((serviceLine) => (
          <button
            key={serviceLine}
            onClick={() => {
              setActiveServiceLine(serviceLine);
              setPendingChanges(new Map()); // Clear pending changes when switching
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeServiceLine === serviceLine
                ? 'bg-dxc-bright-purple text-white shadow-sm'
                : 'text-dxc-medium-gray hover:text-dxc-dark-gray hover:bg-gray-200'
            }`}
          >
            {serviceLine} {serviceLine === 'MW' ? '(Modern Workplace)' : '(Infrastructure & Cloud)'}
          </button>
        ))}
      </div>

      {/* Configuration Matrix */}
      <div className="bg-white border border-dxc-light-gray rounded-dxc overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-dxc-light-gray">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-dxc-dark-gray min-w-[140px]">
                  Category
                </th>
                {SALES_STAGES.map((stage) => (
                  <th key={stage.code} className="px-2 py-3 text-center text-xs font-semibold text-dxc-dark-gray min-w-[110px]">
                    <div className="text-xs text-dxc-medium-gray">{stage.label.replace('Stage SS-0', '').replace('Stage SS-', '')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-dxc-dark-gray">
                    <div className="text-sm font-semibold">{category.name}</div>
                    <div className="text-xs text-dxc-medium-gray">
                      ${(category.min_tcv / 1000000).toFixed(category.min_tcv % 1000000 === 0 ? 0 : 2)}M{category.max_tcv ? ` - $${(category.max_tcv / 1000000).toFixed(category.max_tcv % 1000000 === 0 ? 0 : 2)}M` : '+'}
                    </div>
                  </td>
                  {SALES_STAGES.map((stage) => {
                    const key = `${category.id}-${stage.code}`;
                    const duration = getCellValue(category.id!, stage.code, 'duration_weeks');
                    const fte = getCellValue(category.id!, stage.code, 'fte_required');
                    const effort = getCellValue(category.id!, stage.code, 'effort_weeks');
                    const hasChanges = pendingChanges.has(key);

                    return (
                      <td key={stage.code} className={`px-2 py-2 text-center ${hasChanges ? 'bg-yellow-50' : ''}`}>
                        <div className="space-y-1">
                          {/* Duration input */}
                          <div>
                            <label className="text-xs text-dxc-medium-gray block mb-1">Weeks</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={duration}
                              onChange={(e) => handleCellEdit(category.id!, stage.code, 'duration_weeks', e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded px-1 py-1 text-center focus:border-dxc-bright-purple focus:outline-none"
                              placeholder="0"
                            />
                          </div>
                          {/* FTE input */}
                          <div>
                            <label className="text-xs text-dxc-medium-gray block mb-1">FTE</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={fte}
                              onChange={(e) => handleCellEdit(category.id!, stage.code, 'fte_required', e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded px-1 py-1 text-center focus:border-dxc-bright-purple focus:outline-none"
                              placeholder="0"
                            />
                          </div>
                          {/* Calculated effort */}
                          <div className="text-xs font-medium text-dxc-blue mt-1 whitespace-nowrap">
                            {effort?.toFixed(1) || '0.0'} FTE-wks
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-dxc p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Resource Configuration Guide
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Duration:</strong> Calendar weeks from stage start to finish</li>
          <li>• <strong>FTE:</strong> Full-time equivalent people working on this stage</li>
          <li>• <strong>Total Effort:</strong> Automatically calculated as Duration × FTE</li>
          <li>• Enter 0 for stages that don't require resources from this service line</li>
          <li>• Changes are highlighted in yellow and must be saved</li>
        </ul>
      </div>

      {/* Pending Changes Notice */}
      {hasPendingChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-dxc p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-amber-900">Unsaved Changes</h4>
              <p className="text-sm text-amber-800">You have {pendingChanges.size} unsaved changes. Don't forget to save!</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingChanges(new Map())}
                className="btn-secondary text-sm"
              >
                Discard Changes
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="btn-primary text-sm flex items-center gap-1"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceLineResourceTab;