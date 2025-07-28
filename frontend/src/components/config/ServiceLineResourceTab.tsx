import React, { useState, useMemo } from 'react';
import { Save, Loader2, Users, Plus, X, AlertCircle, Edit2, Trash2, Check, DollarSign } from 'lucide-react';
import {
  useServiceLineCategories,
  useCreateServiceLineCategory,
  useUpdateServiceLineCategory,
  useDeleteServiceLineCategory,
  useServiceLineStageEfforts,
  useUpdateServiceLineStageEffort,
  useBulkCreateServiceLineStageEfforts,
  useServiceLineOfferingThresholds,
  useCreateServiceLineOfferingThreshold,
  useUpdateServiceLineOfferingThreshold,
  useServiceLineOfferingMappings,
  useCreateServiceLineOfferingMapping,
  useUpdateServiceLineOfferingMapping,
  useDeleteServiceLineOfferingMapping,
  useServiceLineOfferingOptions
} from '../../hooks/useConfig';
import type { ServiceLineCategory, ServiceLineStageEffort, ServiceLineOfferingMapping } from '../../types/index';
import { SALES_STAGES } from '../../types/index';

const ServiceLineResourceTab: React.FC = () => {
  const [activeServiceLine, setActiveServiceLine] = useState<'MW' | 'ITOC'>('MW');
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<ServiceLineStageEffort>>>(new Map());
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<ServiceLineCategory>>({
    service_line: activeServiceLine,
    name: '',
    min_tcv: 0,
    max_tcv: null
  });
  const [editCategory, setEditCategory] = useState<Partial<ServiceLineCategory>>({
    service_line: activeServiceLine,
    name: '',
    min_tcv: 0,
    max_tcv: null
  });
  
  // Fetch service line categories for active service line
  const { data: categories = [], isLoading: categoriesLoading } = useServiceLineCategories(activeServiceLine);
  const createCategoryMutation = useCreateServiceLineCategory();
  const updateCategoryMutation = useUpdateServiceLineCategory();
  const deleteCategoryMutation = useDeleteServiceLineCategory();
  
  // Fetch stage efforts for all categories of the active service line
  const { data: allStageEfforts = [], isLoading: effortsLoading } = useServiceLineStageEfforts(activeServiceLine);
  const updateEffortMutation = useUpdateServiceLineStageEffort();
  const bulkCreateMutation = useBulkCreateServiceLineStageEfforts();

  // Fetch offering thresholds for active service line
  const { data: allThresholds = [], isLoading: thresholdsLoading } = useServiceLineOfferingThresholds(activeServiceLine);
  const createThresholdMutation = useCreateServiceLineOfferingThreshold();
  const updateThresholdMutation = useUpdateServiceLineOfferingThreshold();
  // const deleteThresholdMutation = useDeleteServiceLineOfferingThreshold();

  // Fetch offering mappings for active service line (consolidated)
  const { data: allOfferingMappings = [], isLoading: mappingsLoading, error: mappingsError } = useServiceLineOfferingMappings(activeServiceLine);
  const { data: offeringOptions } = useServiceLineOfferingOptions(activeServiceLine);
  
  // Debug logging
  React.useEffect(() => {
    // console.log('Offering mappings:', allOfferingMappings);
    // console.log('Offering options:', offeringOptions);
    // console.log('Mappings loading:', mappingsLoading);
    // console.log('Mappings error:', mappingsError);
  }, [allOfferingMappings, offeringOptions, mappingsLoading, mappingsError]);
  const createMappingMutation = useCreateServiceLineOfferingMapping();
  const updateMappingMutation = useUpdateServiceLineOfferingMapping();
  const deleteMappingMutation = useDeleteServiceLineOfferingMapping();
  
  // State for offering mappings (consolidated)
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
  const [newMapping, setNewMapping] = useState<Partial<ServiceLineOfferingMapping>>({
    service_line: activeServiceLine,
    internal_service: '',
    simplified_offering: ''
  });
  const [editMapping, setEditMapping] = useState<Partial<ServiceLineOfferingMapping>>({
    service_line: activeServiceLine,
    internal_service: '',
    simplified_offering: ''
  });

  // Update form data when switching service lines
  React.useEffect(() => {
    setNewCategory(prev => ({ ...prev, service_line: activeServiceLine }));
    setEditCategory(prev => ({ ...prev, service_line: activeServiceLine }));
    setNewMapping({ service_line: activeServiceLine, internal_service: '', simplified_offering: '' });
    setEditMapping({ service_line: activeServiceLine, internal_service: '', simplified_offering: '' });
    setIsAddingCategory(false);
    setEditingCategoryId(null);
    setIsAddingMapping(false);
    setEditingMappingId(null);
    setPendingChanges(new Map());
  }, [activeServiceLine]);

  // Create effort matrix for all categories and stages
  const effortMatrix = useMemo(() => {
    const matrix = new Map<string, ServiceLineStageEffort>();
    
    // Initialize with existing data
    allStageEfforts.forEach(effort => {
      const key = `${effort.service_line_category_id}-${effort.stage_name}`;
      matrix.set(key, effort);
    });
    
    // Fill in missing combinations with defaults
    categories.forEach(category => {
      SALES_STAGES.forEach(stage => {
        const key = `${category.id}-${stage.code}`;
        if (!matrix.has(key)) {
          matrix.set(key, {
            service_line: activeServiceLine,
            service_line_category_id: category.id!,
            stage_name: stage.code,
            fte_required: 0
          });
        }
      });
    });
    
    return matrix;
  }, [allStageEfforts, categories, activeServiceLine]);

  // Category management handlers
  const handleAddCategory = async () => {
    if (!newCategory.name || newCategory.min_tcv === undefined) return;
    
    try {
      await createCategoryMutation.mutateAsync({
        service_line: activeServiceLine,
        name: newCategory.name,
        min_tcv: newCategory.min_tcv,
        max_tcv: newCategory.max_tcv
      });
      setIsAddingCategory(false);
      setNewCategory({
        service_line: activeServiceLine,
        name: '',
        min_tcv: 0,
        max_tcv: null
      });
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleEditCategory = (category: ServiceLineCategory) => {
    setEditingCategoryId(category.id!);
    setEditCategory({
      service_line: category.service_line,
      name: category.name,
      min_tcv: category.min_tcv,
      max_tcv: category.max_tcv
    });
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId || !editCategory.name || editCategory.min_tcv === undefined) return;
    
    try {
      await updateCategoryMutation.mutateAsync({
        id: editingCategoryId,
        data: {
          service_line: activeServiceLine,
          name: editCategory.name,
          min_tcv: editCategory.min_tcv,
          max_tcv: editCategory.max_tcv
        }
      });
      setEditingCategoryId(null);
      setEditCategory({
        service_line: activeServiceLine,
        name: '',
        min_tcv: 0,
        max_tcv: null
      });
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category? All associated stage efforts will be deleted.')) {
      return;
    }
    
    try {
      await deleteCategoryMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // FTE editing handlers
  const handleCellEdit = (categoryId: number, stageCode: string, value: string) => {
    const key = `${categoryId}-${stageCode}`;
    const currentEffort = effortMatrix.get(key);
    if (!currentEffort) return;

    const numValue = parseFloat(value) || 0;
    const changes = pendingChanges.get(key) || {};
    const updatedChanges = {
      ...changes,
      fte_required: numValue
    };

    setPendingChanges(new Map(pendingChanges.set(key, updatedChanges)));
  };

  const handleSaveChanges = async () => {
    const updates: Array<{ existing: ServiceLineStageEffort; changes: Partial<ServiceLineStageEffort> }> = [];
    const creates: Array<Omit<ServiceLineStageEffort, 'id'>> = [];

    for (const [key, changes] of pendingChanges.entries()) {
      const existing = effortMatrix.get(key);
      if (!existing) continue;

      if (existing.id) {
        // Update existing
        updates.push({ existing, changes });
      } else if (changes.fte_required) {
        // Create new (only if values are non-zero)
        creates.push({
          service_line: existing.service_line,
          service_line_category_id: existing.service_line_category_id,
          stage_name: existing.stage_name,
          fte_required: changes.fte_required || 0
        });
      }
    }

    try {
      // Execute updates
      await Promise.all(
        updates.map(({ existing, changes }) =>
          updateEffortMutation.mutateAsync({
            id: existing.id!,
            data: {
              service_line: existing.service_line,
              service_line_category_id: existing.service_line_category_id,
              stage_name: existing.stage_name,
              fte_required: changes.fte_required ?? existing.fte_required
            }
          })
        )
      );

      // Execute bulk create
      if (creates.length > 0) {
        await bulkCreateMutation.mutateAsync(creates);
      }

      setPendingChanges(new Map());
    } catch (error) {
      console.error('Failed to save changes:', error);
    }
  };

  const getCellValue = (categoryId: number, stageCode: string) => {
    const key = `${categoryId}-${stageCode}`;
    const changes = pendingChanges.get(key);
    const effort = effortMatrix.get(key);
    
    if (!effort) return 0;
    
    return changes?.fte_required ?? effort.fte_required ?? 0;
  };

  // Threshold handling
  const getThresholdCount = (): number => {
    // Get threshold count from first available threshold (should be same across all stages)
    const firstThreshold = allThresholds.find(t => t.service_line === activeServiceLine);
    return firstThreshold?.threshold_count || 4;
  };

  const handleThresholdCountChange = async (newThresholdCount: number) => {
    if (isNaN(newThresholdCount) || newThresholdCount < 1) return;

    // Update threshold count for all stages
    const updates = SALES_STAGES.map(async (stage) => {
      const existingThreshold = allThresholds.find(t => 
        t.service_line === activeServiceLine && 
        t.stage_name === stage.code
      );

      const thresholdData = {
        service_line: activeServiceLine,
        stage_name: stage.code,
        threshold_count: newThresholdCount,
        increment_multiplier: existingThreshold?.increment_multiplier || 0.2
      };

      try {
        if (existingThreshold) {
          await updateThresholdMutation.mutateAsync({
            id: existingThreshold.id!,
            data: thresholdData
          });
        } else {
          await createThresholdMutation.mutateAsync(thresholdData);
        }
      } catch (error) {
        console.error('Failed to update threshold count for stage:', stage.code, error);
      }
    });

    await Promise.all(updates);
  };

  const handleThresholdChange = async (stageCode: string, _field: 'increment_multiplier', value: number) => {
    if (isNaN(value) || value < 0) return;

    const existingThreshold = allThresholds.find(t => 
      t.service_line === activeServiceLine && 
      t.stage_name === stageCode
    );

    const thresholdData = {
      service_line: activeServiceLine,
      stage_name: stageCode,
      threshold_count: existingThreshold?.threshold_count || getThresholdCount(),
      increment_multiplier: value
    };

    try {
      if (existingThreshold) {
        await updateThresholdMutation.mutateAsync({
          id: existingThreshold.id!,
          data: thresholdData
        });
      } else {
        await createThresholdMutation.mutateAsync(thresholdData);
      }
    } catch (error) {
      console.error('Failed to update threshold:', error);
    }
  };

  // Offering Mapping handlers (consolidated)
  const handleAddMapping = async () => {
    if (!newMapping.internal_service?.trim() || !newMapping.simplified_offering?.trim()) return;

    try {
      await createMappingMutation.mutateAsync({
        service_line: activeServiceLine,
        internal_service: newMapping.internal_service.trim(),
        simplified_offering: newMapping.simplified_offering.trim()
      });
      setNewMapping({ service_line: activeServiceLine, internal_service: '', simplified_offering: '' });
      setIsAddingMapping(false);
    } catch (error) {
      console.error('Failed to create offering mapping:', error);
    }
  };

  const handleUpdateMapping = async () => {
    if (!editMapping.internal_service?.trim() || !editMapping.simplified_offering?.trim() || !editingMappingId) return;

    try {
      await updateMappingMutation.mutateAsync({
        id: editingMappingId,
        data: {
          service_line: activeServiceLine,
          internal_service: editMapping.internal_service.trim(),
          simplified_offering: editMapping.simplified_offering.trim()
        }
      });
      setEditingMappingId(null);
      setEditMapping({ service_line: activeServiceLine, internal_service: '', simplified_offering: '' });
    } catch (error) {
      console.error('Failed to update offering mapping:', error);
    }
  };

  const handleDeleteMapping = async (id: number) => {
    if (!confirm('Are you sure you want to delete this offering mapping?')) return;

    try {
      await deleteMappingMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete offering mapping:', error);
    }
  };

  const startEditMapping = (mapping: ServiceLineOfferingMapping) => {
    setEditingMappingId(mapping.id!);
    setEditMapping({
      service_line: mapping.service_line,
      internal_service: mapping.internal_service,
      simplified_offering: mapping.simplified_offering
    });
  };

  const cancelEditMapping = () => {
    setEditingMappingId(null);
    setEditMapping({ service_line: activeServiceLine, internal_service: '', simplified_offering: '' });
  };

  if (categoriesLoading || effortsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-dxc-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <Users className="h-8 w-8 text-dxc-purple" />
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Service Line Resource Planning</h2>
            <p className="text-gray-600 mt-1">Configure service-line-specific TCV thresholds and FTE requirements per stage</p>
            <p className="text-sm text-gray-500 mt-1">Stage durations are managed in Opportunity Categories</p>
          </div>
        </div>
      </div>

      {/* Service Line Tabs - Compact V2 Style */}
      <div className="bg-white rounded-lg border p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-dxc-bright-purple" />
            <span className="text-sm font-medium text-gray-700">Service Line Configuration</span>
          </div>
          <div className="flex bg-gray-100 rounded p-1">
            <button
              onClick={() => setActiveServiceLine('MW')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeServiceLine === 'MW'
                  ? 'bg-dxc-bright-purple text-white shadow-sm'
                  : 'text-gray-600 hover:text-dxc-bright-purple hover:bg-gray-50'
              }`}
            >
              MW
            </button>
            <button
              onClick={() => setActiveServiceLine('ITOC')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeServiceLine === 'ITOC'
                  ? 'bg-dxc-bright-purple text-white shadow-sm'
                  : 'text-gray-600 hover:text-dxc-bright-purple hover:bg-gray-50'
              }`}
            >
              ITOC
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Configure TCV categories and FTE requirements for {activeServiceLine === 'MW' ? 'Modern Workplace' : 'Infrastructure & Cloud'} service line
        </div>
      </div>

      {/* SECTION 1: Service Line Categories Management */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="h-6 w-6 text-dxc-purple" />
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{activeServiceLine} Service Line TCV Categories</h3>
            <p className="text-gray-600 text-sm">Create and manage TCV thresholds for {activeServiceLine} service line</p>
          </div>
        </div>

        {/* Add New Category Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsAddingCategory(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        </div>

        {/* Categories List */}
        <div className="space-y-3">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-dxc-medium-gray">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-dxc-light-gray" />
              <p className="text-lg mb-2">No categories configured for {activeServiceLine}</p>
              <p className="text-sm">Add your first service line category to get started</p>
            </div>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="bg-gray-50 border border-dxc-light-gray rounded-dxc p-4 hover:shadow-sm transition-shadow"
              >
                {editingCategoryId === category.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="font-semibold text-dxc-dark-gray">Editing Category</h4>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-dxc-bright-purple text-white">
                        #{category.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                          Category Name
                        </label>
                        <input
                          type="text"
                          value={editCategory.name}
                          onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                          className="input w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                          Minimum TCV ($M)
                        </label>
                        <input
                          type="number"
                          value={editCategory.min_tcv}
                          onChange={(e) => setEditCategory({ ...editCategory, min_tcv: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          className="input w-full"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                          Maximum TCV ($M)
                        </label>
                        <input
                          type="number"
                          value={editCategory.max_tcv === null || editCategory.max_tcv === undefined ? '' : editCategory.max_tcv}
                          onChange={(e) => setEditCategory({ 
                            ...editCategory, 
                            max_tcv: e.target.value === '' ? null : parseFloat(e.target.value) || null 
                          })}
                          min="0"
                          step="0.01"
                          className="input w-full"
                          placeholder="Leave empty for no limit"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateCategory}
                        disabled={updateCategoryMutation.isPending}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {updateCategoryMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingCategoryId(null)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-dxc-dark-gray">{category.name}</h4>
                        <span className="text-sm text-dxc-medium-gray">
                          {formatCurrency(category.min_tcv * 1000000)}
                          {category.max_tcv ? ` - ${formatCurrency(category.max_tcv * 1000000)}` : ' and above'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEditCategory(category)}
                        className="text-dxc-medium-gray hover:text-dxc-bright-purple p-2"
                        title="Edit category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(category.id!)}
                        className="text-dxc-medium-gray hover:text-red-600 p-2"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add Category Form */}
          {isAddingCategory && (
            <div className="bg-blue-50 rounded-dxc p-4 border border-blue-200">
              <h4 className="font-semibold mb-4">Add New {activeServiceLine} Category</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="e.g., Small, Medium, Large"
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                    Minimum TCV ($M)
                  </label>
                  <input
                    type="number"
                    value={newCategory.min_tcv}
                    onChange={(e) => setNewCategory({ ...newCategory, min_tcv: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                    Maximum TCV ($M) <span className="text-dxc-medium-gray">(optional)</span>
                  </label>
                  <input
                    type="number"
                    value={newCategory.max_tcv === null || newCategory.max_tcv === undefined ? '' : newCategory.max_tcv}
                    onChange={(e) => setNewCategory({ 
                      ...newCategory, 
                      max_tcv: e.target.value === '' ? null : parseFloat(e.target.value) || null 
                    })}
                    placeholder="Leave empty for no limit"
                    min="0"
                    step="0.01"
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddCategory}
                  disabled={createCategoryMutation.isPending}
                  className="btn-primary"
                >
                  {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
                </button>
                <button
                  onClick={() => setIsAddingCategory(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: FTE Requirements Matrix */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-dxc-purple" />
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{activeServiceLine} FTE Requirements</h3>
            <p className="text-gray-600 text-sm">Configure FTE requirements by stage for each {activeServiceLine} category</p>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">No categories defined</p>
            <p className="text-gray-500">Create service line categories first to configure FTE requirements</p>
          </div>
        ) : (
          <div>
            {/* Save Changes Button */}
            {pendingChanges.size > 0 && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleSaveChanges}
                  className="btn-primary flex items-center gap-2"
                  disabled={updateEffortMutation.isPending || bulkCreateMutation.isPending}
                >
                  {(updateEffortMutation.isPending || bulkCreateMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes ({pendingChanges.size})
                </button>
              </div>
            )}

            {/* FTE Matrix Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    {SALES_STAGES.map((stage) => (
                      <th key={stage.code} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">{stage.code}</span>
                          <span className="text-xs mt-1 font-normal">{stage.label.replace(`Stage ${stage.code} `, '')}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{category.name}</span>
                          <span className="text-xs text-gray-500">
                            ${category.min_tcv}M{category.max_tcv ? ` - $${category.max_tcv}M` : '+'}
                          </span>
                        </div>
                      </td>
                      {SALES_STAGES.map((stage) => {
                        const key = `${category.id}-${stage.code}`;
                        const hasChanges = pendingChanges.has(key);
                        return (
                          <td key={stage.code} className={`px-3 py-3 text-center ${hasChanges ? 'bg-yellow-50' : ''}`}>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={getCellValue(category.id!, stage.code)}
                              onChange={(e) => handleCellEdit(category.id!, stage.code, e.target.value)}
                              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-dxc-purple text-sm"
                              placeholder="0"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Offering Thresholds Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <AlertCircle className="h-6 w-6 text-dxc-purple" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Offering Thresholds</h3>
            <p className="text-gray-600 text-sm">Configure service-line-wide offering thresholds with stage-specific multipliers</p>
          </div>
        </div>

        {thresholdsLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-dxc-purple" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Threshold Count Configuration */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-4 mb-3">
                <h4 className="font-medium text-gray-900">Threshold Count</h4>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Offerings threshold:</label>
                  <input
                    type="number"
                    min="1"
                    value={getThresholdCount()}
                    onChange={(e) => handleThresholdCountChange(parseInt(e.target.value))}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-dxc-purple"
                    placeholder="4"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Opportunities with ≤{getThresholdCount()} offerings use base FTE. Above this threshold, incremental multipliers apply per stage.
              </p>
            </div>

            {/* Stage Multipliers Table */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Stage Multipliers</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-white border border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-r border-gray-200">
                        Sales Stage
                      </th>
                      {SALES_STAGES.map((stage) => (
                        <th key={stage.code} className="px-3 py-2 text-center text-xs font-medium text-gray-700 border-r border-gray-200 min-w-[100px]">
                          <div>{stage.label}</div>
                          <div className="text-xs text-gray-500 font-normal">{stage.code}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white border border-gray-200">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 border-r border-gray-200">
                        Increment Multiplier
                      </td>
                      {SALES_STAGES.map((stage) => {
                        const threshold = allThresholds.find(t => t.stage_name === stage.code);
                        return (
                          <td key={stage.code} className="px-3 py-2 text-center border-r border-gray-200">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={threshold?.increment_multiplier || 0.2}
                              onChange={(e) => handleThresholdChange(stage.code, 'increment_multiplier', parseFloat(e.target.value))}
                              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-dxc-purple text-sm"
                              placeholder="0.2"
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-gray-50 border border-gray-200">
                      <td className="px-3 py-2 text-xs text-gray-600 border-r border-gray-200">
                        Example: {getThresholdCount() + 1} offerings
                      </td>
                      {SALES_STAGES.map((stage) => {
                        const threshold = allThresholds.find(t => t.stage_name === stage.code);
                        const multiplier = 1 + (threshold?.increment_multiplier || 0.2);
                        return (
                          <td key={stage.code} className="px-3 py-2 text-center text-xs text-gray-500 border-r border-gray-200">
                            {multiplier.toFixed(1)}x
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Internal Service Mappings Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Internal Service Mappings</h3>
            <p className="text-gray-600 text-sm">Configure which internal service and simplified offering combinations are counted for offering threshold calculations</p>
          </div>
          <button
            onClick={() => setIsAddingMapping(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Mapping
          </button>
        </div>

        {mappingsLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Loading mappings...</span>
          </div>
        ) : mappingsError ? (
          <div className="flex justify-center items-center h-32">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <span className="ml-2 text-red-600">Error loading mappings</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add New Mapping Form */}
            {isAddingMapping && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Add Internal Service Mapping</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Internal Service
                    </label>
                    <select
                      value={newMapping.internal_service || ''}
                      onChange={(e) => {
                        setNewMapping(prev => ({ 
                          ...prev, 
                          internal_service: e.target.value,
                          simplified_offering: '' // Reset simplified offering when internal service changes
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dxc-purple"
                    >
                      <option value="">Select Internal Service...</option>
                      {offeringOptions?.options && Object.keys(offeringOptions.options).map(internalService => (
                        <option key={internalService} value={internalService}>
                          {internalService}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Simplified Offering
                    </label>
                    <select
                      value={newMapping.simplified_offering || ''}
                      onChange={(e) => setNewMapping(prev => ({ ...prev, simplified_offering: e.target.value }))}
                      disabled={!newMapping.internal_service}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dxc-purple disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Simplified Offering...</option>
                      {newMapping.internal_service && offeringOptions?.options?.[newMapping.internal_service]?.map(offering => (
                        <option key={offering} value={offering}>
                          {offering}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddMapping}
                    disabled={!newMapping.internal_service?.trim() || !newMapping.simplified_offering?.trim()}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Add Mapping
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingMapping(false);
                      setNewMapping({ service_line: activeServiceLine, internal_service: '', simplified_offering: '' });
                    }}
                    className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Current Mappings */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Current {activeServiceLine} Mappings ({allOfferingMappings.length})
              </h4>
              
              {allOfferingMappings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No internal service mappings configured for {activeServiceLine}</p>
                  <p className="text-sm">Add mappings to enable offering threshold calculations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allOfferingMappings.map((mapping) => (
                    <div key={mapping.id} className="border border-gray-200 rounded-lg p-4">
                      {editingMappingId === mapping.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Internal Service
                              </label>
                              <select
                                value={editMapping.internal_service || ''}
                                onChange={(e) => {
                                  setEditMapping(prev => ({ 
                                    ...prev, 
                                    internal_service: e.target.value,
                                    simplified_offering: '' // Reset simplified offering when internal service changes
                                  }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dxc-purple"
                              >
                                <option value="">Select Internal Service...</option>
                                {offeringOptions?.options && Object.keys(offeringOptions.options).map(internalService => (
                                  <option key={internalService} value={internalService}>
                                    {internalService}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Simplified Offering
                              </label>
                              <select
                                value={editMapping.simplified_offering || ''}
                                onChange={(e) => setEditMapping(prev => ({ ...prev, simplified_offering: e.target.value }))}
                                disabled={!editMapping.internal_service}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-dxc-purple disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                <option value="">Select Simplified Offering...</option>
                                {editMapping.internal_service && offeringOptions?.options?.[editMapping.internal_service]?.map(offering => (
                                  <option key={offering} value={offering}>
                                    {offering}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleUpdateMapping}
                              disabled={!editMapping.internal_service?.trim() || !editMapping.simplified_offering?.trim()}
                              className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Check className="h-4 w-4" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditMapping}
                              className="px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 flex items-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">Internal Service:</p>
                                <p className="text-sm text-dxc-purple font-medium">{mapping.internal_service}</p>
                              </div>
                              <div className="text-gray-400">→</div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">Simplified Offering:</p>
                                <p className="text-sm text-dxc-purple font-medium">{mapping.simplified_offering}</p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{mapping.service_line}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditMapping(mapping)}
                              className="p-2 text-gray-400 hover:text-dxc-purple transition-colors"
                              title="Edit mapping"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMapping(mapping.id!)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete mapping"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {allOfferingMappings.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Only opportunity line items with these internal service and simplified offering combinations will be counted 
                    for offering threshold calculations in {activeServiceLine}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceLineResourceTab;