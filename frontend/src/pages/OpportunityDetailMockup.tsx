import React, { useState } from 'react';
import { ArrowLeft, Edit, Save, X, Calendar, DollarSign, Users, BarChart3, FileText, Target, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { DXC_COLORS } from '../types/index.js';

// Mock data for opportunity details
const mockOpportunity = {
  id: 1,
  opportunityId: 'OPP-2024-001',
  name: 'Digital Banking Transformation Initiative',
  account: 'Global Financial Corp',
  stage: '04A',
  tcv: 45.7,
  closeDate: '2024-03-15',
  probability: 85,
  category: 'Cat A',
  owner: 'Sarah Johnson',
  description: 'Comprehensive digital transformation of legacy banking systems including core banking platform modernization, customer portal development, and API integration.',
  status: 'Active',
  createdDate: '2023-09-15',
  lastModified: '2024-01-20',
  serviceLines: {
    CES: 18.5,
    INS: 12.3,
    BPS: 8.2,
    SEC: 4.1,
    ITOC: 2.6,
    MW: 0
  },
  quarterlyRevenue: [
    { quarter: 'Q1 2024', revenue: 12.5 },
    { quarter: 'Q2 2024', revenue: 15.2 },
    { quarter: 'Q3 2024', revenue: 10.8 },
    { quarter: 'Q4 2024', revenue: 7.2 }
  ],
  timeline: [
    { stage: '01', startDate: '2023-09-15', endDate: '2023-10-15', status: 'Completed', fte: 2.5 },
    { stage: '02', startDate: '2023-10-16', endDate: '2023-11-30', status: 'Completed', fte: 4.2 },
    { stage: '03', startDate: '2023-12-01', endDate: '2024-01-15', status: 'Completed', fte: 6.8 },
    { stage: '04A', startDate: '2024-01-16', endDate: '2024-02-28', status: 'In Progress', fte: 8.5 },
    { stage: '04B', startDate: '2024-03-01', endDate: '2024-03-15', status: 'Planned', fte: 12.3 },
    { stage: '05A', startDate: '2024-03-16', endDate: '2024-03-25', status: 'Planned', fte: 6.2 }
  ],
  riskFactors: [
    { type: 'Budget', level: 'Medium', description: 'Client budget approval delayed by 2 weeks' },
    { type: 'Technical', level: 'Low', description: 'Legacy system integration complexity' },
    { type: 'Timeline', level: 'High', description: 'Regulatory compliance requirements may extend timeline' }
  ],
  recentActivity: [
    { date: '2024-01-20', user: 'Sarah Johnson', action: 'Updated probability to 85%', type: 'update' },
    { date: '2024-01-19', user: 'Michael Chen', action: 'Added technical assessment document', type: 'document' },
    { date: '2024-01-18', user: 'Sarah Johnson', action: 'Client meeting scheduled for 2024-01-25', type: 'meeting' },
    { date: '2024-01-17', user: 'Emma Davis', action: 'Security clearance requirements confirmed', type: 'update' }
  ]
};

const OpportunityDetailMockup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'financials' | 'team' | 'activity'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(mockOpportunity);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value) + 'M';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'High': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'In Progress': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'Planned': return <Calendar className="w-4 h-4 text-gray-400" />;
      default: return <Calendar className="w-4 h-4 text-gray-400" />;
    }
  };

  const serviceLineData = Object.entries(mockOpportunity.serviceLines)
    .filter(([_, value]) => value > 0)
    .map(([name, value], index) => ({
      name,
      value,
      fill: DXC_COLORS[index % DXC_COLORS.length]
    }));

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4">
          <div className="flex items-start justify-between mb-4">
            <button className="flex items-center gap-2 text-sm text-dxc-purple hover:text-dxc-dark-purple">
              <ArrowLeft className="w-4 h-4" />
              Back to Opportunities
            </button>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-dxc-purple text-white rounded hover:bg-dxc-dark-purple"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2">
              <div className="mb-3">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{mockOpportunity.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{mockOpportunity.opportunityId}</span>
                  <span>•</span>
                  <span>{mockOpportunity.account}</span>
                  <span>•</span>
                  <span>Created {new Date(mockOpportunity.createdDate).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Key Metrics Row */}
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">TCV</div>
                  <div className="text-lg font-bold text-dxc-purple">{formatCurrency(mockOpportunity.tcv)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Stage</div>
                  <div className="px-2 py-1 bg-dxc-purple text-white rounded text-sm font-medium">{mockOpportunity.stage}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Probability</div>
                  <div className="text-lg font-bold text-dxc-green">{mockOpportunity.probability}%</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Category</div>
                  <div className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">{mockOpportunity.category}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Close Date</div>
                  <div className="text-sm font-medium">{new Date(mockOpportunity.closeDate).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* Status & Owner */}
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-600 mb-2">Opportunity Owner</div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-dxc-purple text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {mockOpportunity.owner.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{mockOpportunity.owner}</div>
                    <div className="text-xs text-gray-600">Senior Account Manager</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-600 mb-2">Status</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">{mockOpportunity.status}</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">Last updated: {new Date(mockOpportunity.lastModified).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Tabs */}
        <div className="border-t bg-gray-50">
          <div className="flex">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'timeline', label: 'Timeline', icon: Calendar },
              { key: 'financials', label: 'Financials', icon: DollarSign },
              { key: 'team', label: 'Team & Resources', icon: Users },
              { key: 'activity', label: 'Activity', icon: FileText }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors ${
                  activeTab === key 
                    ? 'bg-white text-dxc-purple border-b-2 border-dxc-purple' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Description */}
            <div className="lg:col-span-2 bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3">Description</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{mockOpportunity.description}</p>
            </div>

            {/* Risk Factors */}
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Risk Factors
              </h3>
              <div className="space-y-3">
                {mockOpportunity.riskFactors.map((risk, index) => (
                  <div key={index} className="border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-800">{risk.type}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskColor(risk.level)}`}>
                        {risk.level}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{risk.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Line Breakdown */}
            <div className="lg:col-span-3 bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3">Service Line Distribution</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={serviceLineData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ fontSize: '10px' }}
                      >
                        {serviceLineData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ fontSize: '12px', padding: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {serviceLineData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-dxc-purple">{formatCurrency(item.value)}</div>
                        <div className="text-xs text-gray-500">
                          {((item.value / mockOpportunity.tcv) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-4">Project Timeline & Resource Allocation</h3>
              <div className="space-y-4">
                {mockOpportunity.timeline.map((stage, index) => (
                  <div key={stage.stage} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(stage.status)}
                      <span className="font-medium text-sm w-12">{stage.stage}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Start: </span>
                        <span className="font-medium">{new Date(stage.startDate).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">End: </span>
                        <span className="font-medium">{new Date(stage.endDate).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">FTE: </span>
                        <span className="font-medium">{stage.fte}</span>
                      </div>
                      <div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          stage.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          stage.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {stage.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold mb-3">Resource Forecast</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={mockOpportunity.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: 'FTE', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value} FTE`, 'Resources Required']}
                    contentStyle={{ fontSize: '12px', padding: '8px' }}
                  />
                  <Bar dataKey="fte" fill={DXC_COLORS[0]} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Financials Tab */}
        {activeTab === 'financials' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border p-4 shadow-sm">
                <h3 className="text-sm font-semibold mb-3">Quarterly Revenue Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={mockOpportunity.quarterlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      contentStyle={{ fontSize: '12px', padding: '8px' }}
                    />
                    <Bar dataKey="revenue" fill={DXC_COLORS[1]} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg border p-4 shadow-sm">
                <h3 className="text-sm font-semibold mb-3">Financial Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total Contract Value</span>
                    <span className="text-lg font-bold text-dxc-purple">{formatCurrency(mockOpportunity.tcv)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Expected Value</span>
                    <span className="text-sm font-medium">{formatCurrency(mockOpportunity.tcv * mockOpportunity.probability / 100)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Probability</span>
                    <span className="text-sm font-medium text-dxc-green">{mockOpportunity.probability}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Contract Length</span>
                    <span className="text-sm font-medium">3 years</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">Annual Value</span>
                    <span className="text-sm font-medium">{formatCurrency(mockOpportunity.tcv / 3)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Team & Resource Allocation</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-3">Core Team</h4>
                <div className="space-y-3">
                  {[
                    { name: 'Sarah Johnson', role: 'Account Manager', allocation: '100%', status: 'Active' },
                    { name: 'Michael Chen', role: 'Technical Lead', allocation: '75%', status: 'Active' },
                    { name: 'Emma Davis', role: 'Solution Architect', allocation: '50%', status: 'Active' },
                    { name: 'David Wilson', role: 'Delivery Manager', allocation: '25%', status: 'Planned' }
                  ].map((member, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-dxc-purple text-white rounded-full flex items-center justify-center text-xs font-medium">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-gray-600">{member.role}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{member.allocation}</div>
                        <div className={`text-xs px-2 py-0.5 rounded ${
                          member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {member.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">Resource Utilization</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={mockOpportunity.timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value} FTE`, 'Resource Requirement']}
                      contentStyle={{ fontSize: '12px', padding: '8px' }}
                    />
                    <Line type="monotone" dataKey="fte" stroke={DXC_COLORS[2]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {mockOpportunity.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    activity.type === 'update' ? 'bg-blue-100 text-blue-700' :
                    activity.type === 'document' ? 'bg-green-100 text-green-700' :
                    activity.type === 'meeting' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {activity.type === 'update' ? <Edit className="w-4 h-4" /> :
                     activity.type === 'document' ? <FileText className="w-4 h-4" /> :
                     activity.type === 'meeting' ? <Calendar className="w-4 h-4" /> :
                     <Target className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{activity.action}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      by {activity.user} • {new Date(activity.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpportunityDetailMockup;