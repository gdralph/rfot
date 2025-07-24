import React, { useState } from 'react';
import { Search, Filter, Eye, ArrowUpDown, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { DXC_COLORS } from '../types/index.js';

// Mock data for opportunities
const mockOpportunities = [
  { 
    id: 1, 
    opportunityId: 'OPP-2024-001', 
    name: 'Digital Banking Transformation', 
    account: 'Global Financial Corp',
    stage: '04A', 
    tcv: 45.7, 
    closeDate: '2024-03-15', 
    category: 'Cat A', 
    owner: 'Sarah Johnson',
    probability: 85,
    serviceLines: ['CES', 'INS'],
    lastActivity: '2 hours ago',
    riskLevel: 'Low'
  },
  { 
    id: 2, 
    opportunityId: 'OPP-2024-002', 
    name: 'Cloud Migration Program', 
    account: 'Tech Solutions Ltd',
    stage: '03', 
    tcv: 38.2, 
    closeDate: '2024-04-22', 
    category: 'Cat B', 
    owner: 'Michael Chen',
    probability: 72,
    serviceLines: ['ITOC', 'MW'],
    lastActivity: '1 day ago',
    riskLevel: 'Medium'
  },
  { 
    id: 3, 
    opportunityId: 'OPP-2024-003', 
    name: 'Cybersecurity Enhancement', 
    account: 'Healthcare Systems Inc',
    stage: '04B', 
    tcv: 29.8, 
    closeDate: '2024-02-28', 
    category: 'Cat B', 
    owner: 'Emma Davis',
    probability: 91,
    serviceLines: ['SEC'],
    lastActivity: '3 hours ago',
    riskLevel: 'Low'
  },
  { 
    id: 4, 
    opportunityId: 'OPP-2024-004', 
    name: 'Infrastructure Modernization', 
    account: 'Manufacturing Co',
    stage: '02', 
    tcv: 26.3, 
    closeDate: '2024-05-10', 
    category: 'Cat C', 
    owner: 'David Wilson',
    probability: 65,
    serviceLines: ['BPS', 'ITOC'],
    lastActivity: '5 days ago',
    riskLevel: 'High'
  },
  { 
    id: 5, 
    opportunityId: 'OPP-2024-005', 
    name: 'ERP Implementation', 
    account: 'Retail Chain Group',
    stage: '01', 
    tcv: 18.5, 
    closeDate: '2024-06-30', 
    category: 'Sub $5M', 
    owner: 'Lisa Anderson',
    probability: 45,
    serviceLines: ['CES'],
    lastActivity: '1 week ago',
    riskLevel: 'Medium'
  },
  { 
    id: 6, 
    opportunityId: 'OPP-2024-006', 
    name: 'Data Center Consolidation', 
    account: 'Energy Corp',
    stage: '05A', 
    tcv: 52.1, 
    closeDate: '2024-01-15', 
    category: 'Cat A', 
    owner: 'Robert Kim',
    probability: 95,
    serviceLines: ['ITOC', 'MW'],
    lastActivity: '30 minutes ago',
    riskLevel: 'Low'
  }
];

const mockFilters = {
  stages: ['01', '02', '03', '04A', '04B', '05A', '05B', '06'],
  categories: ['Cat A', 'Cat B', 'Cat C', 'Sub $5M'],
  serviceLines: ['CES', 'INS', 'BPS', 'SEC', 'ITOC', 'MW'],
  owners: ['Sarah Johnson', 'Michael Chen', 'Emma Davis', 'David Wilson', 'Lisa Anderson', 'Robert Kim'],
  riskLevels: ['Low', 'Medium', 'High']
};

const OpportunitiesMockup: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value) + 'M';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'High': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Cat A': return 'text-green-600 bg-green-100';
      case 'Cat B': return 'text-blue-600 bg-blue-100';
      case 'Cat C': return 'text-orange-600 bg-orange-100';
      case 'Sub $5M': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const totalPages = Math.ceil(mockOpportunities.length / pageSize);

  return (
    <div className="space-y-4 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-dxc-bright-purple">Opportunities</h1>
          <p className="text-xs text-dxc-dark-gray">{mockOpportunities.length} opportunities • {formatCurrency(mockOpportunities.reduce((sum, opp) => sum + opp.tcv, 0))} total value</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-3 py-1.5 bg-dxc-purple text-white rounded hover:bg-dxc-dark-purple flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            New
          </button>
          <button className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 flex items-center gap-1.5">
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* Compact Search & Filters */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-3">
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search opportunities, accounts, or IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-dxc-purple focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 text-sm border rounded-lg flex items-center gap-1.5 transition-colors ${
                showFilters ? 'bg-dxc-purple text-white' : 'hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {Object.values(selectedFilters).some(arr => arr.length > 0) && (
                <span className="bg-dxc-bright-teal text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
                  {Object.values(selectedFilters).reduce((sum, arr) => sum + arr.length, 0)}
                </span>
              )}
            </button>
            <div className="flex bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2 py-2 text-xs rounded-l-lg transition-colors ${
                  viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2 py-2 text-xs rounded-r-lg transition-colors ${
                  viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                Cards
              </button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Hot Opportunities</button>
            <button className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">At Risk</button>
            <button className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Closing This Month</button>
            <button className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">Action Required</button>
            <button className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">My Opportunities</button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="border-t bg-gray-50 p-3">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                <select className="w-full text-xs border rounded px-2 py-1">
                  <option>All Stages</option>
                  {mockFilters.stages.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select className="w-full text-xs border rounded px-2 py-1">
                  <option>All Categories</option>
                  {mockFilters.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service Line</label>
                <select className="w-full text-xs border rounded px-2 py-1">
                  <option>All Service Lines</option>
                  {mockFilters.serviceLines.map(sl => (
                    <option key={sl} value={sl}>{sl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
                <select className="w-full text-xs border rounded px-2 py-1">
                  <option>All Owners</option>
                  {mockFilters.owners.map(owner => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Risk Level</label>
                <select className="w-full text-xs border rounded px-2 py-1">
                  <option>All Risk Levels</option>
                  {mockFilters.riskLevels.map(risk => (
                    <option key={risk} value={risk}>{risk}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary & Controls */}
      <div className="flex items-center justify-between text-xs text-gray-600 bg-white rounded-lg border p-2 shadow-sm">
        <div className="flex items-center gap-4">
          <span>Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, mockOpportunities.length)} of {mockOpportunities.length}</span>
          <select 
            value={pageSize} 
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2">{currentPage} of {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    <button className="flex items-center gap-1 hover:text-dxc-purple">
                      Opportunity <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    <button className="flex items-center gap-1 hover:text-dxc-purple">
                      TCV <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Stage</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    <button className="flex items-center gap-1 hover:text-dxc-purple">
                      Close Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Probability</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Owner</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Risk</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Service Lines</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockOpportunities.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((opp) => (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div>
                        <div className="font-medium text-gray-900 truncate max-w-48">{opp.name}</div>
                        <div className="text-gray-500">{opp.opportunityId}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-900">{opp.account}</td>
                    <td className="px-3 py-2 font-medium text-dxc-purple">{formatCurrency(opp.tcv)}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-1 bg-dxc-purple text-white rounded text-xs">{opp.stage}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{new Date(opp.closeDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-dxc-green h-1.5 rounded-full" 
                            style={{ width: `${opp.probability}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium w-8">{opp.probability}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(opp.category)}`}>
                        {opp.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{opp.owner}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(opp.riskLevel)}`}>
                        {opp.riskLevel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {opp.serviceLines.map(sl => (
                          <span key={sl} className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                            {sl}
                          </span>
                        ))}
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
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockOpportunities.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((opp) => (
            <div key={opp.id} className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 truncate">{opp.name}</h3>
                  <p className="text-xs text-gray-500">{opp.opportunityId}</p>
                  <p className="text-xs text-gray-600 mt-1">{opp.account}</p>
                </div>
                <button className="text-dxc-purple hover:text-dxc-dark-purple flex-shrink-0 ml-2">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">TCV:</span>
                  <span className="text-sm font-medium text-dxc-purple">{formatCurrency(opp.tcv)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Stage:</span>
                  <span className="px-2 py-1 bg-dxc-purple text-white rounded text-xs">{opp.stage}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Probability:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-dxc-green h-1.5 rounded-full" 
                        style={{ width: `${opp.probability}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">{opp.probability}%</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Close Date:</span>
                  <span className="text-xs">{new Date(opp.closeDate).toLocaleDateString()}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Risk:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(opp.riskLevel)}`}>
                    {opp.riskLevel}
                  </span>
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Owner:</span>
                    <span className="text-xs font-medium">{opp.owner}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {opp.serviceLines.map(sl => (
                      <span key={sl} className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {sl}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OpportunitiesMockup;