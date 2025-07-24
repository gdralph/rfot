// import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import OpportunityDetail from './pages/OpportunityDetail';
import Import from './pages/Import';
import Config from './pages/Config';
import Reports from './pages/Reports';
import ErrorBoundary from './components/ErrorBoundary';


// V2 Enhanced Components
import DashboardV2 from './pages/DashboardV2';
import OpportunitiesV2 from './pages/OpportunitiesV2';
import OpportunityDetailV2 from './pages/OpportunityDetailV2';
import ConfigV2 from './pages/ConfigV2';
import ReportsV2 from './pages/ReportsV2';
import ImportV2 from './pages/ImportV2';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Layout>
            <ErrorBoundary>
              <Routes>
                {/* Main Routes - Now V2 Enhanced UI (Default) */}
                <Route path="/" element={<DashboardV2 />} />
                <Route path="/opportunities" element={<OpportunitiesV2 />} />
                <Route path="/opportunity/:id" element={<OpportunityDetailV2 />} />
                <Route path="/reports" element={<ReportsV2 />} />
                <Route path="/import" element={<ImportV2 />} />
                <Route path="/config" element={<ConfigV2 />} />
                
                {/* V2 Routes - Backward Compatibility */}
                <Route path="/v2" element={<DashboardV2 />} />
                <Route path="/v2/dashboard" element={<DashboardV2 />} />
                <Route path="/v2/opportunities" element={<OpportunitiesV2 />} />
                <Route path="/v2/opportunity/:id" element={<OpportunityDetailV2 />} />
                <Route path="/v2/config" element={<ConfigV2 />} />
                <Route path="/v2/reports" element={<ReportsV2 />} />
                <Route path="/v2/import" element={<ImportV2 />} />
                
                {/* Legacy V1 Routes - Original UI */}
                <Route path="/v1" element={<Dashboard />} />
                <Route path="/v1/dashboard" element={<Dashboard />} />
                <Route path="/v1/opportunities" element={<Opportunities />} />
                <Route path="/v1/opportunity/:id" element={<OpportunityDetail />} />
                <Route path="/v1/reports" element={<Reports />} />
                <Route path="/v1/import" element={<Import />} />
                <Route path="/v1/config" element={<Config />} />
                
                <Route path="*" element={<div className="p-6 text-center"><h2 className="text-dxc-slide mb-4">Page Not Found</h2><p>The requested page could not be found.</p></div>} />
              </Routes>
            </ErrorBoundary>
          </Layout>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
