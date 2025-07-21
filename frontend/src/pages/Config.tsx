import React, { useState } from 'react';
import { Settings, DollarSign, Clock, Users, Plus, TrendingUp } from 'lucide-react';
import { useCategories, useStageEfforts, useSMERules } from '../hooks/useConfig';
import LoadingSpinner from '../components/LoadingSpinner';
import CategoriesTab from '../components/config/CategoriesTab';
import StageEffortsTab from '../components/config/StageEffortsTab';
import SMERulesTab from '../components/config/SMERulesTab';
import ServiceLineAllocationTab from '../components/config/ServiceLineAllocationTab';

type ConfigTab = 'categories' | 'stage-efforts' | 'sme-rules' | 'service-allocation';

const Config: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('categories');

  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useCategories();
  const { data: stageEfforts, isLoading: stageEffortsLoading, error: stageEffortsError } = useStageEfforts();
  const { data: smeRules, isLoading: smeRulesLoading, error: smeRulesError } = useSMERules();

  const isLoading = categoriesLoading || stageEffortsLoading || smeRulesLoading;
  const error = categoriesError || stageEffortsError || smeRulesError;

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
      id: 'stage-efforts' as const,
      label: 'Stage Effort Estimates',
      icon: Clock,
      description: 'Configure effort and duration estimates by stage and category',
      count: stageEfforts?.length || 0
    },
    {
      id: 'sme-rules' as const,
      label: 'SME Allocation Rules',
      icon: Users,
      description: 'Define subject matter expert allocation rules by service line',
      count: smeRules?.length || 0
    },
    {
      id: 'service-allocation' as const,
      label: 'Service Line Allocation',
      icon: TrendingUp,
      description: 'Analyze resource allocation and capacity planning across service lines',
      count: 6 // Number of service lines
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'categories':
        return <CategoriesTab categories={categories || []} />;
      case 'stage-efforts':
        return <StageEffortsTab stageEfforts={stageEfforts || []} categories={categories || []} />;
      case 'sme-rules':
        return <SMERulesTab smeRules={smeRules || []} />;
      case 'service-allocation':
        return <ServiceLineAllocationTab />;
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