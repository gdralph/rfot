// import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import OpportunityDetail from './pages/OpportunityDetail';
import Import from './pages/Import';
import Config from './pages/Config';
import Forecast from './pages/Forecast';
import Reports from './pages/Reports';
import ErrorBoundary from './components/ErrorBoundary';

// Mockup imports
import DashboardMockup from './pages/DashboardMockup';
import OpportunitiesMockup from './pages/OpportunitiesMockup';
import OpportunityDetailMockup from './pages/OpportunityDetailMockup';

// V2 Enhanced Components
import DashboardV2 from './pages/DashboardV2';
import OpportunitiesV2 from './pages/OpportunitiesV2';

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
                {/* Enhanced V2 Routes - New UI */}
                <Route path="/v2" element={<DashboardV2 />} />
                <Route path="/v2/dashboard" element={<DashboardV2 />} />
                <Route path="/v2/opportunities" element={<OpportunitiesV2 />} />
                
                {/* Original Routes - Current UI */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/opportunities" element={<Opportunities />} />
                <Route path="/opportunity/:id" element={<OpportunityDetail />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/import" element={<Import />} />
                <Route path="/config" element={<Config />} />
                
                {/* Mockup Routes - For Reference */}
                <Route path="/mockup/dashboard" element={<DashboardMockup />} />
                <Route path="/mockup/opportunities" element={<OpportunitiesMockup />} />
                <Route path="/mockup/opportunity-detail" element={<OpportunityDetailMockup />} />
                
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
