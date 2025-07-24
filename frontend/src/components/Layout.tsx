import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Database, Settings, Upload, Home, FileText } from 'lucide-react';
import UISwitcher from './UISwitcher';

interface LayoutProps {
  children: React.ReactNode;
}

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/opportunities', label: 'Opportunities', icon: Database },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/import', label: 'Import', icon: Upload },
    { path: '/config', label: 'Config', icon: Settings },
  ];

  return (
    <nav className="bg-dxc-bright-purple text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 space-x-12">
          <div className="flex-shrink-0 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-white" />
            <h1 className="text-xl font-bold text-white">
              RFOT
            </h1>
          </div>
          
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-dxc-dark-purple text-white'
                      : 'text-white hover:bg-dxc-dark-purple hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-dxc-lg shadow-lg">
          <div className="p-6">
            {children}
          </div>
        </div>
      </main>
      
      {/* UI Version Switcher */}
      <UISwitcher />
      
      <footer className="bg-dxc-dark-gray text-white py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-sm">
              <span className="font-semibold">DXC Technology</span> - Resource Forecasting & Opportunity Tracker
            </div>
            <div className="text-sm text-dxc-light-gray">
              DXC Internal
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;