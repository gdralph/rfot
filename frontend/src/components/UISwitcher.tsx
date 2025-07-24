import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToggleLeft, ToggleRight } from 'lucide-react';

const UISwitcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isV2 = location.pathname.startsWith('/v2') || location.pathname.startsWith('/mockup');
  
  const toggleVersion = () => {
    if (isV2) {
      // Switch to V1 (original)
      if (location.pathname.includes('dashboard') || location.pathname === '/v2') {
        navigate('/');
      } else if (location.pathname.includes('opportunities')) {
        navigate('/opportunities');
      }
      // Add more mappings as we build V2 pages
    } else {
      // Switch to V2 (enhanced)
      if (location.pathname === '/') {
        navigate('/v2/dashboard');
      } else if (location.pathname === '/opportunities') {
        navigate('/v2/opportunities');
      }
      // Add more mappings as we build V2 pages
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg border shadow-lg p-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">UI Version:</span>
          <button
            onClick={toggleVersion}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors hover:bg-gray-100"
          >
            {isV2 ? (
              <>
                <ToggleRight className="w-4 h-4 text-dxc-bright-purple" />
                <span className="text-dxc-bright-purple">Enhanced V2</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Original V1</span>
              </>
            )}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {isV2 ? 'Condensed UI with enhanced data density' : 'Original UI with standard layout'}
        </div>
      </div>
    </div>
  );
};

export default UISwitcher;