import React, { useState } from 'react';
import { Settings, DollarSign, Users, TrendingUp, Clock } from 'lucide-react';
import { useCategories } from '../hooks/useConfig';
import LoadingSpinner from '../components/LoadingSpinner';
import CategoriesTab from '../components/config/CategoriesTab';
import ServiceLineResourceTab from '../components/config/ServiceLineResourceTab';
import ServiceLineAllocationTab from '../components/config/ServiceLineAllocationTab';
import TimelineGenerationTab from '../components/config/TimelineGenerationTab';

type ConfigTab = 'categories' | 'service-line-resources' | 'service-allocation' | 'timeline-generation';

const Config: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('categories');

  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useCategories();

  const isLoading = categoriesLoading;
  const error = categoriesError;

  if (isLoading) {
    return <LoadingSpinner text="Loading configuration..." />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-dxc-slide mb-4">Configuration</h2>
        <div className="bg-red-50 border border-red-200 rounded-dxc p-4">
          <p className="text-red-700">Error loading configuration data. Please try again later.</p>
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
        return <ServiceLineResourceTab categories={categories || []} />;
      case 'service-allocation':
        return <ServiceLineAllocationTab />;
      case 'timeline-generation':
        return <TimelineGenerationTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-dxc-bright-purple" />
        <div>
          <h1 className="text-dxc-section mb-1">Configuration</h1>
          <p className="text-dxc-dark-gray">Manage system settings and business rules</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-dxc shadow-sm border border-dxc-light-gray">
        <nav className="flex border-b border-dxc-light-gray">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-colors ${
                  isActive
                    ? 'border-dxc-bright-purple text-dxc-bright-purple bg-purple-50'
                    : 'border-transparent text-dxc-dark-gray hover:text-dxc-bright-purple hover:bg-gray-50'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-semibold">{tab.label}</div>
                  <div className="text-xs text-dxc-medium-gray">
                    {tab.count} {tab.count === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Tab Description */}
        <div className="px-6 py-3 bg-gray-50 border-b border-dxc-light-gray">
          <p className="text-sm text-dxc-medium-gray">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Config;