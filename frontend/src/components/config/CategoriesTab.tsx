import React, { useState } from 'react';
import { Plus, Edit2, DollarSign, Trash2, Check, X, Clock } from 'lucide-react';
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../hooks/useConfig';
import type { OpportunityCategory } from '../../types/index';
import { SALES_STAGES } from '../../types/index';

interface CategoriesTabProps {
  categories: OpportunityCategory[];
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({ categories }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    min_tcv: '',
    max_tcv: '',
    stage_01_duration_weeks: '0',
    stage_02_duration_weeks: '0',
    stage_03_duration_weeks: '0',
    stage_04a_duration_weeks: '0',
    stage_04b_duration_weeks: '0',
    stage_05a_duration_weeks: '0',
    stage_05b_duration_weeks: '0',
    stage_06_duration_weeks: '0'
  });
  const [editData, setEditData] = useState({
    name: '',
    min_tcv: '',
    max_tcv: '',
    stage_01_duration_weeks: '0',
    stage_02_duration_weeks: '0',
    stage_03_duration_weeks: '0',
    stage_04a_duration_weeks: '0',
    stage_04b_duration_weeks: '0',
    stage_05a_duration_weeks: '0',
    stage_05b_duration_weeks: '0',
    stage_06_duration_weeks: '0'
  });

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const categoryData: Omit<OpportunityCategory, 'id'> = {
        name: formData.name,
        min_tcv: parseFloat(formData.min_tcv),
        max_tcv: formData.max_tcv ? parseFloat(formData.max_tcv) : undefined,
        stage_01_duration_weeks: parseFloat(formData.stage_01_duration_weeks) || 0,
        stage_02_duration_weeks: parseFloat(formData.stage_02_duration_weeks) || 0,
        stage_03_duration_weeks: parseFloat(formData.stage_03_duration_weeks) || 0,
        stage_04a_duration_weeks: parseFloat(formData.stage_04a_duration_weeks) || 0,
        stage_04b_duration_weeks: parseFloat(formData.stage_04b_duration_weeks) || 0,
        stage_05a_duration_weeks: parseFloat(formData.stage_05a_duration_weeks) || 0,
        stage_05b_duration_weeks: parseFloat(formData.stage_05b_duration_weeks) || 0,
        stage_06_duration_weeks: parseFloat(formData.stage_06_duration_weeks) || 0
      };

      await createCategoryMutation.mutateAsync(categoryData);
      
      // Reset form
      setFormData({
        name: '', min_tcv: '', max_tcv: '',
        stage_01_duration_weeks: '0', stage_02_duration_weeks: '0', stage_03_duration_weeks: '0',
        stage_04a_duration_weeks: '0', stage_04b_duration_weeks: '0', stage_05a_duration_weeks: '0',
        stage_05b_duration_weeks: '0', stage_06_duration_weeks: '0'
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleEdit = (category: OpportunityCategory) => {
    if (!category.id) return;
    setEditingId(category.id);
    setEditData({
      name: category.name,
      min_tcv: category.min_tcv.toString(),
      max_tcv: category.max_tcv?.toString() || '',
      stage_01_duration_weeks: (category.stage_01_duration_weeks || 0).toString(),
      stage_02_duration_weeks: (category.stage_02_duration_weeks || 0).toString(),
      stage_03_duration_weeks: (category.stage_03_duration_weeks || 0).toString(),
      stage_04a_duration_weeks: (category.stage_04a_duration_weeks || 0).toString(),
      stage_04b_duration_weeks: (category.stage_04b_duration_weeks || 0).toString(),
      stage_05a_duration_weeks: (category.stage_05a_duration_weeks || 0).toString(),
      stage_05b_duration_weeks: (category.stage_05b_duration_weeks || 0).toString(),
      stage_06_duration_weeks: (category.stage_06_duration_weeks || 0).toString()
    });
  };

  const handleUpdateSubmit = async (categoryId: number) => {
    try {
      const categoryData: Omit<OpportunityCategory, 'id'> = {
        name: editData.name,
        min_tcv: parseFloat(editData.min_tcv),
        max_tcv: editData.max_tcv ? parseFloat(editData.max_tcv) : undefined,
        stage_01_duration_weeks: parseFloat(editData.stage_01_duration_weeks) || 0,
        stage_02_duration_weeks: parseFloat(editData.stage_02_duration_weeks) || 0,
        stage_03_duration_weeks: parseFloat(editData.stage_03_duration_weeks) || 0,
        stage_04a_duration_weeks: parseFloat(editData.stage_04a_duration_weeks) || 0,
        stage_04b_duration_weeks: parseFloat(editData.stage_04b_duration_weeks) || 0,
        stage_05a_duration_weeks: parseFloat(editData.stage_05a_duration_weeks) || 0,
        stage_05b_duration_weeks: parseFloat(editData.stage_05b_duration_weeks) || 0,
        stage_06_duration_weeks: parseFloat(editData.stage_06_duration_weeks) || 0
      };

      await updateCategoryMutation.mutateAsync({ id: categoryId, data: categoryData });
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDelete = async (categoryId: number) => {
    try {
      await deleteCategoryMutation.mutateAsync(categoryId);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({
      name: '', min_tcv: '', max_tcv: '',
      stage_01_duration_weeks: '0', stage_02_duration_weeks: '0', stage_03_duration_weeks: '0',
      stage_04a_duration_weeks: '0', stage_04b_duration_weeks: '0', stage_05a_duration_weeks: '0',
      stage_05b_duration_weeks: '0', stage_06_duration_weeks: '0'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const sortedCategories = [...categories].sort((a, b) => a.min_tcv - b.min_tcv);

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-dxc-subtitle font-semibold">Opportunity Categories</h3>
          <p className="text-sm text-dxc-medium-gray mt-1">
            Categories are used to automatically classify opportunities based on Total Contract Value (TCV)
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-dxc p-4 border border-dxc-light-gray">
          <h4 className="font-semibold mb-4">Add New Category</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* TCV Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cat A, Cat B, Sub $5M"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Minimum TCV
                </label>
                <input
                  type="number"
                  value={formData.min_tcv}
                  onChange={(e) => setFormData({ ...formData, min_tcv: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                  Maximum TCV <span className="text-dxc-medium-gray">(optional)</span>
                </label>
                <input
                  type="number"
                  value={formData.max_tcv}
                  onChange={(e) => setFormData({ ...formData, max_tcv: e.target.value })}
                  placeholder="Leave empty for no limit"
                  min="0"
                  step="0.01"
                  className="input w-full"
                />
              </div>
            </div>
            
            {/* Stage Duration Configuration */}
            <div className="border-t border-dxc-light-gray pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-dxc-bright-purple" />
                <h5 className="font-semibold text-dxc-dark-gray">Stage Durations (Weeks)</h5>
                <span className="text-sm text-dxc-medium-gray">Timeline for opportunities in this category</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SALES_STAGES.map((stage) => {
                  // Map stage codes to field names
                  const fieldMapping: Record<string, keyof typeof formData> = {
                    '01': 'stage_01_duration_weeks',
                    '02': 'stage_02_duration_weeks',
                    '03': 'stage_03_duration_weeks',
                    '04A': 'stage_04a_duration_weeks',
                    '04B': 'stage_04b_duration_weeks',
                    '05A': 'stage_05a_duration_weeks',
                    '05B': 'stage_05b_duration_weeks',
                    '06': 'stage_06_duration_weeks'
                  };
                  
                  const fieldName = fieldMapping[stage.code];
                  
                  return (
                    <div key={stage.code}>
                      <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                        {stage.code}
                      </label>
                      <input
                        type="number"
                        value={formData[fieldName]}
                        onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
                        placeholder="0"
                        min="0"
                        step="0.5"
                        className="input w-full"
                      />
                      <span className="text-xs text-dxc-medium-gray mt-1 block truncate">
                        {stage.label.replace('Stage ' + stage.code + ' ', '')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createCategoryMutation.isPending}
                className="btn-primary"
              >
                {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
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

      {/* Categories List */}
      <div className="space-y-3">
        {sortedCategories.length === 0 ? (
          <div className="text-center py-8 text-dxc-medium-gray">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-dxc-light-gray" />
            <p className="text-lg mb-2">No categories configured</p>
            <p className="text-sm">Add your first opportunity category to get started</p>
          </div>
        ) : (
          sortedCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white border border-dxc-light-gray rounded-dxc p-4 hover:shadow-sm transition-shadow"
            >
              {editingId === category.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <h4 className="font-semibold text-dxc-dark-gray">
                      Editing Category
                    </h4>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-dxc-bright-purple text-white">
                      #{category.id}
                    </span>
                  </div>
                  {/* TCV Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                        Category Name
                      </label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="input w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                        Minimum TCV
                      </label>
                      <input
                        type="number"
                        value={editData.min_tcv}
                        onChange={(e) => setEditData({ ...editData, min_tcv: e.target.value })}
                        min="0"
                        step="0.01"
                        className="input w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                        Maximum TCV
                      </label>
                      <input
                        type="number"
                        value={editData.max_tcv}
                        onChange={(e) => setEditData({ ...editData, max_tcv: e.target.value })}
                        min="0"
                        step="0.01"
                        className="input w-full"
                        placeholder="Leave empty for no limit"
                      />
                    </div>
                  </div>
                  
                  {/* Stage Duration Configuration */}
                  <div className="border-t border-dxc-light-gray pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-dxc-bright-purple" />
                      <h5 className="font-semibold text-dxc-dark-gray">Stage Durations (Weeks)</h5>
                      <span className="text-sm text-dxc-medium-gray">Timeline for opportunities in this category</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {SALES_STAGES.map((stage) => {
                        // Map stage codes to field names
                        const fieldMapping: Record<string, keyof typeof editData> = {
                          '01': 'stage_01_duration_weeks',
                          '02': 'stage_02_duration_weeks',
                          '03': 'stage_03_duration_weeks',
                          '04A': 'stage_04a_duration_weeks',
                          '04B': 'stage_04b_duration_weeks',
                          '05A': 'stage_05a_duration_weeks',
                          '05B': 'stage_05b_duration_weeks',
                          '06': 'stage_06_duration_weeks'
                        };
                        
                        const fieldName = fieldMapping[stage.code];
                        
                        return (
                          <div key={stage.code}>
                            <label className="block text-sm font-medium text-dxc-dark-gray mb-2">
                              {stage.code}
                            </label>
                            <input
                              type="number"
                              value={editData[fieldName]}
                              onChange={(e) => setEditData({ ...editData, [fieldName]: e.target.value })}
                              placeholder="0"
                              min="0"
                              step="0.5"
                              className="input w-full"
                            />
                            <span className="text-xs text-dxc-medium-gray mt-1 block truncate">
                              {stage.label.replace('Stage ' + stage.code + ' ', '')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => category.id && handleUpdateSubmit(category.id)}
                      disabled={updateCategoryMutation.isPending}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {updateCategoryMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-dxc-dark-gray">
                        {category.name}
                      </h4>
                      <span className="text-sm text-dxc-medium-gray">
                        {formatCurrency(category.min_tcv)}
                        {category.max_tcv ? ` - ${formatCurrency(category.max_tcv)}` : ' and above'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(category)}
                      className="text-dxc-medium-gray hover:text-dxc-bright-purple p-2"
                      title="Edit category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => category.id && setShowDeleteConfirm(category.id)}
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
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-dxc p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">
              Delete Category
            </h3>
            <p className="text-dxc-medium-gray mb-6">
              Are you sure you want to delete this category? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleteCategoryMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleteCategoryMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-dxc p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Categories Work</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Categories are automatically assigned based on opportunity TCV (Total Contract Value)</li>
          <li>• Categories should not overlap - ensure min/max ranges don't conflict</li>
          <li>• Categories determine stage durations for opportunity timelines</li>
          <li>• Stage durations apply to all service lines within an opportunity</li>
          <li>• FTE requirements are managed separately in Service Line Resource Planning</li>
        </ul>
      </div>
    </div>
  );
};

export default CategoriesTab;