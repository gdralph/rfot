import React, { useState } from 'react';
import { Plus, Edit2, DollarSign } from 'lucide-react';
import { useCreateCategory } from '../../hooks/useConfig';
import type { OpportunityCategory } from '../../types/index';

interface CategoriesTabProps {
  categories: OpportunityCategory[];
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({ categories }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    min_tcv: '',
    max_tcv: ''
  });

  const createCategoryMutation = useCreateCategory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const categoryData: Omit<OpportunityCategory, 'id'> = {
        name: formData.name,
        min_tcv: parseFloat(formData.min_tcv),
        max_tcv: formData.max_tcv ? parseFloat(formData.max_tcv) : undefined
      };

      await createCategoryMutation.mutateAsync(categoryData);
      
      // Reset form
      setFormData({ name: '', min_tcv: '', max_tcv: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create category:', error);
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
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-dxc-dark-gray">
                      {category.name}
                    </h4>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-dxc-bright-purple text-white">
                      #{category.id}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-dxc-medium-gray">
                    <span className="font-medium">Range:</span> {formatCurrency(category.min_tcv)}
                    {category.max_tcv ? ` - ${formatCurrency(category.max_tcv)}` : ' and above'}
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
      <div className="bg-blue-50 border border-blue-200 rounded-dxc p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Categories Work</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Categories are automatically assigned based on opportunity TCV (Total Contract Value)</li>
          <li>• Categories should not overlap - ensure min/max ranges don't conflict</li>
          <li>• Categories are used for effort estimation and resource allocation</li>
          <li>• Higher value categories (Cat A) typically require more specialized resources</li>
        </ul>
      </div>
    </div>
  );
};

export default CategoriesTab;