import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToggleLeft, ToggleRight } from 'lucide-react';

const UISwitcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isV1 = location.pathname.startsWith('/v1');
  const isV2 = !isV1; // Default is now V2
  
  const toggleVersion = () => {
    if (isV2) {
      // Switch to V1 (legacy)
      if (location.pathname === '/' || location.pathname.includes('dashboard') || location.pathname === '/v2') {
        navigate('/v1/dashboard');
      } else if (location.pathname.includes('opportunities') && !location.pathname.includes('opportunity/')) {
        navigate('/v1/opportunities');
      } else if (location.pathname.includes('opportunity/')) {
        const id = location.pathname.split('/').pop();
        navigate(`/v1/opportunity/${id}`);
      } else if (location.pathname.includes('config')) {
        navigate('/v1/config');
      } else if (location.pathname.includes('reports')) {
        navigate('/v1/reports');
      } else if (location.pathname.includes('import')) {
        navigate('/v1/import');
      }
    } else {
      // Switch to V2 (current default)
      if (location.pathname.includes('dashboard') || location.pathname === '/v1') {
        navigate('/');
      } else if (location.pathname.includes('opportunities') && !location.pathname.includes('opportunity/')) {
        navigate('/opportunities');
      } else if (location.pathname.includes('opportunity/')) {
        const id = location.pathname.split('/').pop();
        navigate(`/opportunity/${id}`);
      } else if (location.pathname.includes('config')) {
        navigate('/config');
      } else if (location.pathname.includes('reports')) {
        navigate('/reports');
      } else if (location.pathname.includes('import')) {
        navigate('/import');
      }
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
                <span className="text-dxc-bright-purple">Current UI</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Legacy V1</span>
              </>
            )}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {isV2 ? 'Enhanced data density and condensed layout' : 'Original UI with standard layout'}
        </div>
      </div>
    </div>
  );
};

export default UISwitcher;