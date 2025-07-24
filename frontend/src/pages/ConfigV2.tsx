import React, { useState } from 'react';
import { Settings, DollarSign, Users, TrendingUp, Clock } from 'lucide-react';
import { useCategories } from '../hooks/useConfig';
import LoadingSpinner from '../components/LoadingSpinner';
import CategoriesTab from '../components/config/CategoriesTab';
import ServiceLineResourceTab from '../components/config/ServiceLineResourceTab';
import ServiceLineAllocationTab from '../components/config/ServiceLineAllocationTab';
import TimelineGenerationTab from '../components/config/TimelineGenerationTab';

// Enhanced UI Components
import StatusIndicator from '../components/ui/StatusIndicator';

type ConfigTab = 'categories' | 'service-line-resources' | 'service-allocation' | 'timeline-generation';

const ConfigV2: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('categories');

  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useCategories();

  const isLoading = categoriesLoading;
  const error = categoriesError;

  if (isLoading) {
    return <LoadingSpinner text="Loading configuration..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Configuration Error</h2>
          <p className="text-red-600">Error loading configuration data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'categories' as const,
      label: 'Opportunity Categories',
      icon: DollarSign,
      description: 'Manage TCV-based opportunity categorization rules',
      count: categories?.length || 0
    },
    {
      id: 'service-line-resources' as const,
      label: 'SLA Resource Planning',
      icon: Users,
      description: 'Configure duration and FTE requirements for Modern Workplace and ITOC service lines',
      count: 2 // MW and ITOC
    },
    {
      id: 'service-allocation' as const,
      label: 'Service Line Allocation',
      icon: TrendingUp,
      description: 'Analyze resource allocation and capacity planning across service lines',
      count: 6 // Number of service lines
    },
    {
      id: 'timeline-generation' as const,
      label: 'Timeline Generation',
      icon: Clock,
      description: 'Generate and regenerate resource timelines for opportunities',
      count: 0 // Will be populated by the component
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'categories':
        return <CategoriesTab categories={categories || []} />;
      case 'service-line-resources':
        return <ServiceLineResourceTab />;
      case 'service-allocation':
        return <ServiceLineAllocationTab />;
      case 'timeline-generation':
        return <TimelineGenerationTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-dxc-bright-purple" />
          <div>
            <h1 className="text-lg font-bold text-dxc-bright-purple">Configuration</h1>
            <p className="text-xs text-dxc-dark-gray">System settings and business rules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status="success" label="Live" size="sm" />
        </div>
      </div>

      {/* Main Configuration Panel */}
      <div className="bg-white rounded-lg border shadow-sm">
        {/* Tab Navigation */}
        <nav className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-dxc-bright-purple text-dxc-bright-purple bg-purple-50'
                    : 'border-transparent text-gray-600 hover:text-dxc-bright-purple hover:bg-gray-50'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="text-xs text-gray-500">
                    {tab.count} {tab.count === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Tab Description */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-xs text-gray-600">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ConfigV2;