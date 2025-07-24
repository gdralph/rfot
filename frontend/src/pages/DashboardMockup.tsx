import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Calendar, BarChart3, Eye, Filter, DollarSign, Target, Briefcase } from 'lucide-react';
import { DXC_COLORS } from '../types/index.js';

// Mock data for the dashboard
const mockSummaryData = {
  total_opportunities: 847,
  total_value: 2847.5,
  average_value: 3.36,
  win_rate: 78.5,
  pipeline_health: 'Healthy',
  forecast_accuracy: 89.2
};

const mockStageData = [
  { name: '01', value: 245.7, count: 23, fill: DXC_COLORS[0] },
  { name: '02', value: 423.2, count: 35, fill: DXC_COLORS[1] },
  { name: '03', value: 567.8, count: 42, fill: DXC_COLORS[2] },
  { name: '04A', value: 789.3, count: 58, fill: DXC_COLORS[3] },
  { name: '04B', value: 456.2, count: 31, fill: DXC_COLORS[4] },
  { name: '05A', value: 234.1, count: 18, fill: DXC_COLORS[5] },
  { name: '05B', value: 131.2, count: 12, fill: DXC_COLORS[6] }
];

const mockServiceLineData = [
  { name: 'CES', value: 567.8, count: 125, fill: DXC_COLORS[0] },
  { name: 'INS', value: 423.5, count: 98, fill: DXC_COLORS[1] },
  { name: 'BPS', value: 345.2, count: 76, fill: DXC_COLORS[2] },
  { name: 'SEC', value: 289.4, count: 54, fill: DXC_COLORS[3] },
  { name: 'ITOC', value: 656.3, count: 142, fill: DXC_COLORS[4] },
  { name: 'MW', value: 565.3, count: 118, fill: DXC_COLORS[5] }
];

const mockTrendData = [
  { month: 'Jan', revenue: 245, opportunities: 28, forecast: 267 },
  { month: 'Feb', revenue: 289, opportunities: 32, forecast: 301 },
  { month: 'Mar', revenue: 334, opportunities: 38, forecast: 342 },
  { month: 'Apr', revenue: 398, opportunities: 42, forecast: 389 },
  { month: 'May', revenue: 456, opportunities: 47, forecast: 445 },
  { month: 'Jun', revenue: 523, opportunities: 51, forecast: 512 }
];

const mockTopOpportunities = [
  { id: 1, name: 'Digital Transformation Initiative', account: 'Global Bank Corp', tcv: 45.7, stage: '04A', probability: 85 },
  { id: 2, name: 'Cloud Migration Program', account: 'Tech Solutions Ltd', tcv: 38.2, stage: '03', probability: 72 },
  { id: 3, name: 'Security Enhancement Project', account: 'Healthcare Systems', tcv: 29.8, stage: '04B', probability: 91 },
  { id: 4, name: 'Infrastructure Modernization', account: 'Manufacturing Co', tcv: 26.3, stage: '02', probability: 65 }
];

const DashboardMockup: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'trends' | 'pipeline'>('overview');
  const [showFilters, setShowFilters] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value) + 'M';
  };

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-dxc-bright-purple">Portfolio Dashboard</h1>
          <p className="text-xs text-dxc-dark-gray">Real-time opportunity tracking & forecasting</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Live</span>
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Updated 1m ago</span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1.5 text-gray-600 hover:text-dxc-purple rounded border hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Filters */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg border p-3">
          <div className="grid grid-cols-6 gap-2">
            <select className="text-xs border rounded px-2 py-1">
              <option>All Stages</option>
              <option>01-03</option>
              <option>04A-05B</option>
            </select>
            <select className="text-xs border rounded px-2 py-1">
              <option>All Categories</option>
              <option>Cat A</option>
              <option>Cat B</option>
            </select>
            <select className="text-xs border rounded px-2 py-1">
              <option>All Service Lines</option>
              <option>CES</option>
              <option>INS</option>
            </select>
            <select className="text-xs border rounded px-2 py-1">
              <option>All Regions</option>
              <option>EMEA</option>
              <option>Americas</option>
            </select>
            <input type="date" className="text-xs border rounded px-2 py-1" />
            <button className="text-xs bg-dxc-purple text-white rounded px-2 py-1 hover:bg-dxc-dark-purple">Apply</button>
          </div>
        </div>
      )}

      {/* Compact Navigation */}
      <div className="flex bg-white rounded-lg border shadow-sm">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'trends', label: 'Trends', icon: TrendingUp },
          { key: 'pipeline', label: 'Pipeline', icon: Target }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium transition-colors ${
              activeView === key 
                ? 'bg-dxc-purple text-white' 
                : 'text-gray-600 hover:text-dxc-purple hover:bg-gray-50'
            } ${key === 'overview' ? 'rounded-l-lg' : key === 'pipeline' ? 'rounded-r-lg' : ''}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview Content */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          {/* Compact Metrics Grid */}
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4 text-dxc-purple" />
                <span className="text-xs font-medium text-gray-600">Opportunities</span>
              </div>
              <p className="text-lg font-bold text-dxc-purple">{mockSummaryData.total_opportunities.toLocaleString()}</p>
              <p className="text-xs text-green-600">+12% vs last month</p>
            </div>
            
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-dxc-bright-teal" />
                <span className="text-xs font-medium text-gray-600">Total Value</span>
              </div>
              <p className="text-lg font-bold text-dxc-bright-teal">{formatCurrency(mockSummaryData.total_value)}</p>
              <p className="text-xs text-green-600">+8% vs last month</p>
            </div>
            
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-dxc-blue" />
                <span className="text-xs font-medium text-gray-600">Avg Value</span>
              </div>
              <p className="text-lg font-bold text-dxc-blue">{formatCurrency(mockSummaryData.average_value)}</p>
              <p className="text-xs text-red-600">-3% vs last month</p>
            </div>
            
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-dxc-green" />
                <span className="text-xs font-medium text-gray-600">Win Rate</span>
              </div>
              <p className="text-lg font-bold text-dxc-green">{mockSummaryData.win_rate}%</p>
              <p className="text-xs text-green-600">+2.1% vs last month</p>
            </div>
            
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4 text-dxc-orange" />
                <span className="text-xs font-medium text-gray-600">Pipeline Health</span>
              </div>
              <p className="text-lg font-bold text-dxc-orange">{mockSummaryData.pipeline_health}</p>
              <p className="text-xs text-gray-500">Stable trend</p>
            </div>
            
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-dxc-gold" />
                <span className="text-xs font-medium text-gray-600">Forecast Accuracy</span>
              </div>
              <p className="text-lg font-bold text-dxc-gold">{mockSummaryData.forecast_accuracy}%</p>
              <p className="text-xs text-green-600">+1.3% vs last month</p>
            </div>
          </div>

          {/* Compact Charts Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Stage Distribution */}
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <h3 className="text-sm font-semibold mb-2 text-gray-800">Stage Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mockStageData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    formatter={(value: number, _, props) => [
                      <div key="tooltip" className="text-xs">
                        <div>Revenue: {formatCurrency(value)}</div>
                        <div>Count: {props.payload?.count || 0}</div>
                      </div>,
                      ''
                    ]}
                    contentStyle={{ fontSize: '12px', padding: '8px' }}
                  />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Service Line Distribution */}
            <div className="bg-white rounded-lg border p-3 shadow-sm">
              <h3 className="text-sm font-semibold mb-2 text-gray-800">Service Line Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={mockServiceLineData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                    style={{ fontSize: '10px' }}
                  >
                    {mockServiceLineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _, props) => [
                      <div key="tooltip" className="text-xs">
                        <div>Revenue: {formatCurrency(value)}</div>
                        <div>Count: {props.payload?.count || 0}</div>
                      </div>,
                      props.payload?.name
                    ]}
                    contentStyle={{ fontSize: '12px', padding: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Compact Top Opportunities Table */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Top Opportunities</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Opportunity</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">TCV</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Stage</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Probability</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockTopOpportunities.map((opp) => (
                    <tr key={opp.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{opp.name}</td>
                      <td className="px-3 py-2 text-gray-600">{opp.account}</td>
                      <td className="px-3 py-2 font-medium text-dxc-purple">{formatCurrency(opp.tcv)}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 bg-dxc-purple text-white rounded text-xs">{opp.stage}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-dxc-green h-1.5 rounded-full" 
                              style={{ width: `${opp.probability}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{opp.probability}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button className="text-dxc-purple hover:text-dxc-dark-purple">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Trends Content */}
      {activeView === 'trends' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-3 text-gray-800">Revenue & Opportunity Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: '12px', padding: '8px' }} />
                <Line type="monotone" dataKey="revenue" stroke={DXC_COLORS[0]} strokeWidth={2} name="Revenue ($M)" />
                <Line type="monotone" dataKey="opportunities" stroke={DXC_COLORS[1]} strokeWidth={2} name="Opportunities" />
                <Line type="monotone" dataKey="forecast" stroke={DXC_COLORS[2]} strokeWidth={2} strokeDasharray="5 5" name="Forecast ($M)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pipeline Content */}
      {activeView === 'pipeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">Pipeline Velocity</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Avg. Stage Duration</span>
                  <span className="font-medium">23 days</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Deal Velocity</span>
                  <span className="font-medium text-green-600">+15%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Conversion Rate</span>
                  <span className="font-medium">34.2%</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">Risk Analysis</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>At Risk ($M)</span>
                  <span className="font-medium text-red-600">$234.5M</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Stalled Deals</span>
                  <span className="font-medium text-orange-600">18</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Overdue Actions</span>
                  <span className="font-medium text-red-600">7</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardMockup;