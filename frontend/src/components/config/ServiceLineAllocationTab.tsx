import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign } from 'lucide-react';
import { useServiceLineForecast } from '../../hooks/useForecasts';
import { SERVICE_LINES, DXC_COLORS } from '../../types/index';
import LoadingSpinner from '../LoadingSpinner';

const ServiceLineAllocationTab: React.FC = () => {
  const { data: serviceLineForecast, isLoading: forecastLoading } = useServiceLineForecast();

  if (forecastLoading) {
    return <LoadingSpinner text="Loading service line data..." />;
  }

  // Calculate allocation data
  const allocationData = SERVICE_LINES.map((serviceLine, index) => {
    const revenue = serviceLineForecast?.service_line_totals[serviceLine] || 0;
    const percentage = serviceLineForecast?.service_line_percentages[serviceLine] || 0;
    
    return {
      serviceLine,
      revenue,
      percentage,
      fill: DXC_COLORS[index % DXC_COLORS.length]
    };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalRevenue = serviceLineForecast?.total_revenue || 0;

  return (
    <div className="space-y-6">
      <div className="card bg-white p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="h-5 w-5 text-dxc-purple" />
          <h3 className="text-dxc-heading text-dxc-dark-gray">Service Line Revenue Distribution</h3>
        </div>
        
        <div className="mb-6 p-4 bg-dxc-light-gray rounded">
          <h4 className="text-dxc-subtitle text-dxc-dark-gray mb-2">Total Revenue</h4>
          <p className="text-2xl font-bold text-dxc-purple">{formatCurrency(totalRevenue)}</p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={allocationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="serviceLine" stroke="#6b7280" />
              <YAxis stroke="#6b7280" tickFormatter={formatCurrency} />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="revenue" fill="#5F249F" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6">
          <h4 className="font-semibold mb-4">Service Line Revenue Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full table">
              <thead>
                <tr>
                  <th>Service Line</th>
                  <th>Revenue</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {allocationData.map((item) => (
                  <tr key={item.serviceLine}>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: item.fill }}
                        ></div>
                        <span className="font-medium">{item.serviceLine}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(item.revenue)}</td>
                    <td>{item.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceLineAllocationTab;