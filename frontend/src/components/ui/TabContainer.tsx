import React, { useState } from 'react';

interface Tab {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabContainerProps {
  tabs: Tab[];
  defaultActiveTab?: string;
  onTabChange?: (tabKey: string) => void;
  className?: string;
}

const TabContainer: React.FC<TabContainerProps> = ({
  tabs,
  defaultActiveTab,
  onTabChange,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.key);

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    onTabChange?.(tabKey);
  };

  const activeTabContent = tabs.find(tab => tab.key === activeTab)?.content;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Navigation */}
      <div className="tab-container-v2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          
          return (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && handleTabChange(tab.key)}
              disabled={tab.disabled}
              className={`tab-button-v2 ${
                isActive ? 'tab-active-v2' : 'tab-inactive-v2'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTabContent}
      </div>
    </div>
  );
};

export default TabContainer;