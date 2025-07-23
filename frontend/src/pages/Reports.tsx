import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  Download, 
  Filter, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  List,
  Calendar,
  Table
} from 'lucide-react';
import { api } from '../services/api.js';
import { exportToPDF, exportToExcel, convertReportDataToExcel, exportTimelineChartToPDF, exportToHTML, exportConfigurationToPDF } from '../utils/exportUtils.js';

interface ReportInfo {
  id: string;
  name: string;
  description: string;
  export_formats: string[];
  filters: string[];
}

interface ReportFilters {
  [key: string]: any;
}

const Reports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [reportFilters, setReportFilters] = useState<ReportFilters>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [timelineViewMode, setTimelineViewMode] = useState<'list' | 'timeline' | 'table'>('list');

  // Add print styles for better PDF export
  useEffect(() => {
    const printStyles = document.createElement('style');
    printStyles.innerHTML = `
      @media print {
        @page {
          size: A4 landscape;
          margin: 0.4in;
        }
        
        .print\\:text-xs { font-size: 10px !important; }
        .print\\:leading-tight { line-height: 1.1 !important; }
        .print\\:space-y-2 > * + * { margin-top: 8px !important; }
        .print\\:mb-2 { margin-bottom: 8px !important; }
        .print\\:mt-0 { margin-top: 0 !important; }
        .print\\:p-2 { padding: 8px !important; }
        .print\\:pr-2 { padding-right: 8px !important; }
        .print\\:pl-32 { padding-left: 128px !important; }
        .print\\:w-32 { width: 128px !important; }
        .print\\:h-4 { height: 16px !important; }
        .print\\:h-2 { height: 8px !important; }
        .print\\:w-2 { width: 8px !important; }
        .print\\:-left-10 { left: -40px !important; }
        .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
        .print\\:shadow-none { box-shadow: none !important; }
        .print\\:opacity-80 { opacity: 0.8 !important; }
        .print\\:bg-gray-100 { background-color: #f3f4f6 !important; }
        .print\\:bg-gray-200 { background-color: #e5e7eb !important; }
        .print\\:bg-blue-200 { background-color: #bfdbfe !important; }
        .print\\:bg-red-200 { background-color: #fecaca !important; }
        .print\\:bg-orange-200 { background-color: #fed7aa !important; }
        .print\\:bg-yellow-200 { background-color: #fef3c7 !important; }
        .print\\:text-blue-900 { color: #1e3a8a !important; }
        .print\\:text-red-900 { color: #7f1d1d !important; }
        .print\\:text-orange-900 { color: #7c2d12 !important; }
        .print\\:text-yellow-900 { color: #78350f !important; }
        .print\\:text-gray-700 { color: #374151 !important; }
        .print\\:border-gray-400 { border-color: #9ca3af !important; }
        .print\\:break-inside-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }
        
        /* Table-specific print styles */
        table { page-break-inside: auto !important; }
        tr { page-break-inside: avoid !important; page-break-after: auto !important; }
        thead { display: table-header-group !important; }
        tfoot { display: table-footer-group !important; }
      }
    `;
    document.head.appendChild(printStyles);

    return () => {
      document.head.removeChild(printStyles);
    };
  }, []);

  // Fetch available reports
  const { data: availableReports, isLoading: loadingReports } = useQuery({
    queryKey: ['available-reports'],
    queryFn: () => api.getAvailableReports(),
  });

  const reportIcons = {
    'configuration-summary': FileText,
    'resource-utilization': Users,
    'opportunity-pipeline': TrendingUp,
    'service-line-performance': BarChart3,
    'stage-duration-analysis': Clock,
    'resource-gap-analysis': AlertTriangle,
    'service-line-activity-timeline': Clock,
  };

  const generateReport = async () => {
    if (!selectedReport) return;

    setIsGenerating(true);
    try {
      const response = await api.generateReport(selectedReport, reportFilters);
      setReportData(response);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportReport = async (format: string) => {
    if (!reportData || !selectedReport) return;

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const reportName = selectedReport.replace(/-/g, '_');

      if (format === 'excel') {
        const excelData = convertReportDataToExcel(reportData, selectedReport);
        if (excelData.length > 0) {
          exportToExcel(
            excelData,
            `${reportName}_report_${timestamp}.xlsx`,
            'Report Data'
          );
        } else {
          console.warn('No data available for Excel export');
        }
      } else if (format === 'pdf') {
        // Use custom timeline PDF generation for chart view
        if (selectedReport === 'service-line-activity-timeline' && timelineViewMode === 'timeline') {
          await exportTimelineChartToPDF(
            reportData,
            `${reportName}_timeline_${timestamp}.pdf`
          );
        } else if (selectedReport === 'configuration-summary') {
          // Use custom configuration PDF export
          await exportConfigurationToPDF(
            reportData,
            `${reportName}_report_${timestamp}.pdf`
          );
        } else {
          // Use regular HTML-to-PDF for other views
          const orientation = selectedReport === 'service-line-activity-timeline' && timelineViewMode === 'timeline' 
            ? 'landscape' 
            : 'portrait';
          
          await exportToPDF(
            'report-content',
            {
              filename: `${reportName}_report_${timestamp}.pdf`,
              title: `${reportData.report_name || selectedReport} - ${timestamp}`,
              orientation: orientation
            }
          );
        }
      } else if (format === 'html') {
        // Export as static HTML file
        const htmlContent = exportToHTML(
          reportData,
          selectedReport,
          timelineViewMode
        );
        
        // Create and download the HTML file
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportName}_report_${timestamp}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      // You might want to show a toast notification here
    }
  };


  const renderFilters = (report: ReportInfo) => {
    if (!report.filters.length) return null;

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-dxc-dark-gray flex items-center">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {report.filters.map(filter => renderFilterInput(filter))}
        </div>
      </div>
    );
  };

  const renderFilterInput = (filter: string) => {
    const updateFilter = (value: any) => {
      setReportFilters(prev => ({ ...prev, [filter]: value }));
    };

    switch (filter) {
      case 'start_date':
      case 'end_date':
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1 capitalize">
              {filter.replace('_', ' ')}
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(e.target.value)}
            />
          </div>
        );

      case 'service_line':
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1">
              Service Line
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(e.target.value)}
            >
              <option value="">All Service Lines</option>
              <option value="MW">MW</option>
              <option value="ITOC">ITOC</option>
              <option value="CES">CES</option>
              <option value="INS">INS</option>
              <option value="BPS">BPS</option>
              <option value="SEC">SEC</option>
            </select>
          </div>
        );

      case 'stage':
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1">
              Sales Stage
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              <option value="01">01: Understand Customer</option>
              <option value="02">02: Validate Opportunity</option>
              <option value="03">03: Qualify Opportunity</option>
              <option value="04A">04A: Develop Solution</option>
              <option value="04B">04B: Propose Solution</option>
              <option value="05A">05A: Negotiate</option>
              <option value="05B">05B: Award & Close</option>
              <option value="06">06: Deploy & Extend</option>
            </select>
          </div>
        );

      case 'sales_stage':
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1">
              Current Sales Stage
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              <option value="01">01: Understand Customer</option>
              <option value="02">02: Validate Opportunity</option>
              <option value="03">03: Qualify Opportunity</option>
              <option value="04A">04A: Develop Solution</option>
              <option value="04B">04B: Propose Solution</option>
              <option value="05A">05A: Negotiate</option>
              <option value="05B">05B: Award & Close</option>
              <option value="06">06: Deploy & Extend</option>
            </select>
          </div>
        );

      case 'category':
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1">
              Category
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Sub $5M">Sub $5M</option>
              <option value="Cat C">Cat C</option>
              <option value="Cat B">Cat B</option>
              <option value="Cat A">Cat A</option>
            </select>
          </div>
        );

      case 'period_months':
      case 'forecast_months':
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1">
              {filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(parseInt(e.target.value))}
              defaultValue="6"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="18">18 months</option>
              <option value="24">24 months</option>
            </select>
          </div>
        );

      default:
        return (
          <div key={filter}>
            <label className="block text-sm font-medium text-dxc-dark-gray mb-1 capitalize">
              {filter.replace('_', ' ')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dxc-bright-purple focus:border-transparent"
              onChange={(e) => updateFilter(e.target.value)}
            />
          </div>
        );
    }
  };

  const renderReportData = (data: any) => {
    if (!data) return null;

    // Different rendering based on report type
    if (data.opportunity_categories && data.service_line_categories) {
      return renderConfigurationReport(data);
    } else if (data.utilization_data) {
      return renderUtilizationReport(data);
    } else if (data.pipeline_data) {
      return renderPipelineReport(data);
    } else if (data.service_line_performance) {
      return renderServiceLineReport(data);
    } else if (data.stage_analysis) {
      return renderStageAnalysisReport(data);
    } else if (data.monthly_requirements) {
      return renderGapAnalysisReport(data);
    } else if (data.timeline_data) {
      return renderTimelineReport(data);
    }

    return (
      <div className="mt-6">
        <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatCurrencyMillions = (valueInMillions: number) => {
    return `${formatCurrency(valueInMillions)}M`;
  };

  const renderStageTimelineChart = (serviceLine: string, stages: any[]) => {
    if (!stages || stages.length === 0) return null;

    // Calculate date range
    const startDates = stages.map(s => new Date(s.stage_start_date)).filter(d => !isNaN(d.getTime()));
    const endDates = stages.map(s => new Date(s.stage_end_date)).filter(d => !isNaN(d.getTime()));
    
    if (startDates.length === 0 || endDates.length === 0) return null;

    const minDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    
    // Calculate total duration
    const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    const totalWeeks = Math.ceil(totalDays / 7);
    
    // Determine if we should show months or weeks
    const showMonths = totalWeeks > 16;
    
    // Create time markers
    const timeMarkers = [];
    if (showMonths) {
      let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      while (currentMonth <= maxDate) {
        timeMarkers.push(new Date(currentMonth));
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
    } else {
      let currentWeek = new Date(minDate);
      currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay()); // Start of week
      while (currentWeek <= maxDate) {
        timeMarkers.push(new Date(currentWeek));
        currentWeek.setDate(currentWeek.getDate() + 7);
      }
    }

    const getPositionFromDate = (date: Date) => {
      const totalDuration = maxDate.getTime() - minDate.getTime();
      const datePosition = date.getTime() - minDate.getTime();
      return Math.max(0, Math.min(100, (datePosition / totalDuration) * 100));
    };

    const getWidthFromDuration = (startDate: Date, endDate: Date) => {
      const totalDuration = maxDate.getTime() - minDate.getTime();
      const stageDuration = endDate.getTime() - startDate.getTime();
      return Math.max(2, Math.min(100, (stageDuration / totalDuration) * 100));
    };

    const stageColors = {
      '01': '#3B82F6', '02': '#10B981', '03': '#F59E0B', '04A': '#EF4444', 
      '04B': '#8B5CF6', '05A': '#06B6D4', '05B': '#84CC16', '06': '#F97316'
    };

    return (
      <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3">
        <h6 className="font-medium text-gray-700 mb-3">
          {serviceLine} Timeline ({showMonths ? 'Monthly' : 'Weekly'} View)
        </h6>
        
        {/* Time markers header */}
        <div className="relative mb-2 h-8 border-b border-gray-200">
          <div className="absolute inset-0 flex">
            {timeMarkers.map((marker, index) => {
              const position = getPositionFromDate(marker);
              return (
                <div
                  key={index}
                  className="absolute text-xs text-gray-600 transform -translate-x-1/2"
                  style={{ left: `${position}%`, top: '0px' }}
                >
                  <div className="border-l border-gray-300 h-4"></div>
                  <div className="mt-1 whitespace-nowrap">
                    {showMonths 
                      ? marker.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                      : `W${Math.ceil((marker.getTime() - minDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}`
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline bars */}
        <div className="relative h-8 bg-gray-50 rounded border">
          {stages.map((stage, index) => {
            const startDate = new Date(stage.stage_start_date);
            const endDate = new Date(stage.stage_end_date);
            const left = getPositionFromDate(startDate);
            const width = getWidthFromDuration(startDate, endDate);
            const color = stageColors[stage.stage_code as keyof typeof stageColors] || '#6B7280';
            
            return (
              <div
                key={index}
                className="absolute top-1 rounded shadow-sm flex items-center justify-center text-white text-xs font-medium"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  height: '24px',
                  backgroundColor: color,
                  minWidth: '20px'
                }}
                title={`${stage.stage_code}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} (${stage.duration_weeks}w, ${stage.fte_required} FTE)`}
              >
                <span className="truncate px-1">
                  {width > 8 ? stage.stage_code : stage.stage_code.substring(0, 2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {stages.map((stage, index) => {
            const color = stageColors[stage.stage_code as keyof typeof stageColors] || '#6B7280';
            return (
              <div key={index} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: color }}
                ></div>
                <span>{stage.stage_code}: {stage.duration_weeks}w, {stage.fte_required} FTE</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderConfigurationReport = (data: any) => (
    <div className="mt-6 space-y-6">
      {/* Configuration Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Opportunity Categories</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            {data.configuration_statistics.opportunity_categories_count}
          </p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Service Line Categories</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            {data.configuration_statistics.service_line_categories_count}
          </p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Stage Efforts Configured</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            {data.configuration_statistics.stage_efforts_configured}
          </p>
        </div>
      </div>

      {/* Opportunity Categories */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Opportunity Categories (Timeline Durations)</h3>
          <p className="text-sm text-gray-600 mb-4">Categories determine stage durations based on total TCV</p>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>TCV Range</th>
                  <th>Stage 01</th>
                  <th>Stage 02</th>
                  <th>Stage 03</th>
                  <th>Stage 04A</th>
                  <th>Stage 04B</th>
                  <th>Stage 05A</th>
                  <th>Stage 05B</th>
                  <th>Stage 06</th>
                  <th>Total Weeks</th>
                </tr>
              </thead>
              <tbody>
                {data.opportunity_categories.map((category: any) => (
                  <tr key={category.id}>
                    <td className="font-medium">{category.name}</td>
                    <td>{category.tcv_range_display}</td>
                    <td>{category.stage_durations['01']}w</td>
                    <td>{category.stage_durations['02']}w</td>
                    <td>{category.stage_durations['03']}w</td>
                    <td>{category.stage_durations['04A']}w</td>
                    <td>{category.stage_durations['04B']}w</td>
                    <td>{category.stage_durations['05A']}w</td>
                    <td>{category.stage_durations['05B']}w</td>
                    <td>{category.stage_durations['06']}w</td>
                    <td className="font-medium text-dxc-bright-purple">{category.total_timeline_weeks}w</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Service Line Categories */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Service Line Categories (FTE Requirements)</h3>
          <p className="text-sm text-gray-600 mb-4">Categories determine FTE requirements based on service line TCV</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(data.service_line_categories.reduce((acc: any, cat: any) => {
              if (!acc[cat.service_line]) acc[cat.service_line] = [];
              acc[cat.service_line].push(cat);
              return acc;
            }, {})).map(([serviceLine, categories]: [string, any]) => (
              <div key={serviceLine} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-dxc-bright-purple mb-3">{serviceLine} Categories</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-2">Category</th>
                        <th className="text-left py-2">TCV Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category: any) => (
                        <tr key={category.id} className="border-b border-gray-200">
                          <td className="py-2 font-medium">{category.name}</td>
                          <td className="py-2">{category.tcv_range_display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stage Efforts Matrix */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">FTE Requirements by Stage</h3>
          <p className="text-sm text-gray-600 mb-4">FTE requirements for each service line category and sales stage</p>
          <div className="space-y-6">
            {Object.entries(data.stage_efforts).map(([serviceLine, categories]: [string, any]) => (
              <div key={serviceLine} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-dxc-bright-purple mb-3">{serviceLine} FTE Requirements</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-2">Category</th>
                        <th className="text-center py-2">01</th>
                        <th className="text-center py-2">02</th>
                        <th className="text-center py-2">03</th>
                        <th className="text-center py-2">04A</th>
                        <th className="text-center py-2">04B</th>
                        <th className="text-center py-2">05A</th>
                        <th className="text-center py-2">05B</th>
                        <th className="text-center py-2">06</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(categories).map((category: any) => (
                        <tr key={category.category_id} className="border-b border-gray-200">
                          <td className="py-2 font-medium">{category.category_name}</td>
                          <td className="text-center py-2">{category.stages['01']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['02']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['03']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['04A']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['04B']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['05A']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['05B']?.fte_required || 0}</td>
                          <td className="text-center py-2">{category.stages['06']?.fte_required || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calculation Examples */}
      {data.calculation_examples && data.calculation_examples.length > 0 && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Real Calculation Examples</h3>
            <p className="text-sm text-gray-600 mb-4">Examples using actual opportunity data to demonstrate how configurations are applied</p>
            <div className="space-y-4">
              {data.calculation_examples.map((example: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  {/* Header with opportunity info and calculation method */}
                  <div className="mb-4 pb-3 border-b border-gray-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-dxc-dark-gray text-lg">{example.opportunity_name}</h4>
                        <p className="text-sm text-gray-600">{example.opportunity_id}</p>
                        <p className="text-sm font-medium text-gray-700">{example.account_name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-dxc-bright-purple">{formatCurrencyMillions(example.tcv_millions)} TCV</div>
                        <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          example.calculation_method === 'lead_offering_fallback' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {example.calculation_method === 'lead_offering_fallback' ? 'Lead Offering Method' : 'Service Line TCV Method'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Calculation Explanation */}
                  <div className="mb-4">
                    <h5 className="font-medium text-dxc-dark-gray mb-2">Calculation Flow</h5>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <ol className="space-y-1 text-sm text-blue-800">
                        {example.calculation_explanation.map((step: string, stepIndex: number) => (
                          <li key={stepIndex} className="flex items-start">
                            <span className="font-bold text-blue-600 mr-2">{stepIndex + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {/* Input Data */}
                    <div>
                      <h5 className="font-medium text-dxc-dark-gray mb-2">Input Data</h5>
                      <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                        <div><strong>Current Stage:</strong> {example.current_stage}</div>
                        <div><strong>Decision Date:</strong> {new Date(example.decision_date).toLocaleDateString()}</div>
                        <div><strong>Timeline Category:</strong> {example.timeline_category}</div>
                        {example.lead_offering_l1 && (
                          <div><strong>Lead Offering:</strong> {example.lead_offering_l1}</div>
                        )}
                        <div className="pt-2 border-t border-gray-200">
                          <strong>Service Line TCV Breakdown:</strong>
                          <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                            {Object.entries(example.service_line_tcv_breakdown).map(([sl, tcv]: [string, any]) => (
                              <div key={sl} className={tcv > 0 ? 'font-medium text-dxc-bright-purple' : 'text-gray-500'}>
                                {sl.toUpperCase()}: {formatCurrencyMillions(tcv)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Configuration Applied */}
                    <div>
                      <h5 className="font-medium text-dxc-dark-gray mb-2">Configuration Applied</h5>
                      <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                        <div><strong>Remaining Stages:</strong> {example.remaining_stages.join(', ')}</div>
                        {Object.entries(example.service_line_categories).map(([sl, config]: [string, any]) => (
                          <div key={sl} className="pt-2 border-t border-gray-200">
                            <div className="font-medium text-dxc-bright-purple">{sl} Service Line</div>
                            <div>Resource Category: {config.resource_category}</div>
                            <div>Service Line TCV: {formatCurrencyMillions(config.service_line_tcv)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Stage Breakdown */}
                  <div className="mb-4">
                    <h5 className="font-medium text-dxc-dark-gray mb-2">Detailed Stage Calculations</h5>
                    {Object.entries(example.detailed_stage_breakdown).map(([sl, stages]: [string, any]) => (
                      <div key={sl} className="mb-3">
                        <h6 className="font-medium text-dxc-bright-purple mb-2">{sl} Timeline</h6>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs border border-gray-300">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border border-gray-300 px-2 py-1 text-left">Stage</th>
                                <th className="border border-gray-300 px-2 py-1 text-left">Start Date</th>
                                <th className="border border-gray-300 px-2 py-1 text-left">End Date</th>
                                <th className="border border-gray-300 px-2 py-1 text-right">Duration (weeks)</th>
                                <th className="border border-gray-300 px-2 py-1 text-right">FTE</th>
                                <th className="border border-gray-300 px-2 py-1 text-right">Effort (weeks)</th>
                                <th className="border border-gray-300 px-2 py-1 text-left">Resource Category</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stages.map((stage: any, stageIndex: number) => (
                                <tr key={stageIndex} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-2 py-1 font-medium">{stage.stage_code}</td>
                                  <td className="border border-gray-300 px-2 py-1">
                                    {stage.stage_start_date ? new Date(stage.stage_start_date).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1">
                                    {stage.stage_end_date ? new Date(stage.stage_end_date).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1 text-right">{stage.duration_weeks}</td>
                                  <td className="border border-gray-300 px-2 py-1 text-right">{stage.fte_required}</td>
                                  <td className="border border-gray-300 px-2 py-1 text-right font-medium text-dxc-bright-purple">{stage.total_effort_weeks}</td>
                                  <td className="border border-gray-300 px-2 py-1">{stage.resource_category_used}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Add timeline chart */}
                        {renderStageTimelineChart(sl, stages)}
                      </div>
                    ))}
                  </div>

                  {/* Results Summary */}
                  <div className="pt-3 border-t border-gray-300">
                    <h5 className="font-medium text-dxc-dark-gray mb-2">Final Results</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-dxc-bright-purple text-white rounded p-3 text-center">
                        <div className="text-2xl font-bold">{example.total_effort_weeks.toFixed(1)}</div>
                        <div className="text-sm">Total Effort Weeks</div>
                      </div>
                      <div className="bg-blue-600 text-white rounded p-3 text-center">
                        <div className="text-2xl font-bold">{example.total_fte_hours.toFixed(0)}</div>
                        <div className="text-sm">Total Hours</div>
                      </div>
                      <div className="bg-green-600 text-white rounded p-3 text-center">
                        <div className="text-2xl font-bold">{Object.keys(example.service_line_efforts).length}</div>
                        <div className="text-sm">Service Lines</div>
                      </div>
                    </div>
                    
                    {Object.keys(example.service_line_efforts).length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm font-medium text-gray-700 mb-1">Effort by Service Line:</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(example.service_line_efforts).map(([sl, effort]: [string, any]) => (
                            <span key={sl} className="inline-block bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
                              {sl}: {effort.toFixed(1)} weeks
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Notes */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Configuration Notes</h3>
          <div className="bg-blue-50 rounded-lg p-4">
            <ul className="space-y-2 text-sm text-blue-800">
              {data.notes.map((note: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUtilizationReport = (data: any) => (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total Service Lines</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            {Object.keys(data.service_line_totals).length}
          </p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total FTE Required</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            {Object.values(data.service_line_totals).reduce((sum: number, sl: any) => sum + sl.fte, 0).toFixed(1)}
          </p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total Effort Weeks</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            {Object.values(data.service_line_totals).reduce((sum: number, sl: any) => sum + sl.effort, 0).toFixed(1)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Service Line Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Service Line</th>
                  <th>Opportunities</th>
                  <th>Total FTE</th>
                  <th>Total Effort</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.service_line_totals).map(([serviceLine, totals]: [string, any]) => (
                  <tr key={serviceLine}>
                    <td className="font-medium">{serviceLine}</td>
                    <td>{totals.count}</td>
                    <td>{totals.fte.toFixed(1)}</td>
                    <td>{totals.effort.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPipelineReport = (data: any) => (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total Opportunities</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.total_opportunities}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total TCV</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">
            ${data.summary.total_tcv.toFixed(1)}M
          </p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Stages Represented</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.stages_represented}</p>
        </div>
      </div>

      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Stage Progression</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.stage_progression.map((stage: any) => (
              <div key={stage.stage} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-dxc-bright-purple">{stage.count}</div>
                <div className="text-sm text-dxc-dark-gray">Stage {stage.stage}</div>
                <div className="text-xs text-gray-600">${stage.total_tcv.toFixed(1)}M</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderServiceLineReport = (data: any) => (
    <div className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(data.service_line_performance).map(([serviceLine, perf]: [string, any]) => (
          <div key={serviceLine} className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">{serviceLine}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-dxc-dark-gray">Opportunities:</span>
                  <span className="font-semibold">{perf.opportunity_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dxc-dark-gray">Total TCV:</span>
                  <span className="font-semibold">${perf.total_tcv.toFixed(1)}M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dxc-dark-gray">Win Rate:</span>
                  <span className="font-semibold">{perf.win_rate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dxc-dark-gray">Avg Deal Size:</span>
                  <span className="font-semibold">${perf.avg_deal_size.toFixed(1)}M</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStageAnalysisReport = (data: any) => (
    <div className="mt-6">
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Stage Duration Analysis</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Count</th>
                  <th>Avg Duration</th>
                  <th>Min Duration</th>
                  <th>Max Duration</th>
                  <th>Median Duration</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.stage_analysis).map(([stage, analysis]: [string, any]) => (
                  <tr key={stage}>
                    <td className="font-medium">Stage {stage}</td>
                    <td>{analysis.opportunity_count}</td>
                    <td>{analysis.avg_duration.toFixed(1)} weeks</td>
                    <td>{analysis.min_duration.toFixed(1)} weeks</td>
                    <td>{analysis.max_duration.toFixed(1)} weeks</td>
                    <td>{analysis.median_duration.toFixed(1)} weeks</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGapAnalysisReport = (data: any) => (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Critical Gaps</h4>
          <p className="text-2xl font-bold text-red-600">{data.summary.critical_gaps}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Service Lines Affected</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.service_lines_affected}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Months Forecasted</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.months_forecasted}</p>
        </div>
      </div>

      {data.gaps_identified.length > 0 && (
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Critical Resource Gaps</h3>
            <div className="space-y-3">
              {data.gaps_identified.slice(0, 5).map((gap: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <span className="font-medium text-red-800">{gap.service_line}</span>
                    <span className="text-red-600 ml-2">({gap.month})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-red-800 font-semibold">{gap.gap.toFixed(1)} FTE gap</div>
                    <div className="text-red-600 text-sm">{gap.gap_percentage.toFixed(1)}% shortfall</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTimelineTable = (data: any) => {
    // Create a simplified table view for better PDF export
    const timelineRows: any[] = [];
    
    data.timeline_data.slice(0, 15).forEach((opportunity: any) => {
      Object.entries(opportunity.service_lines).forEach(([serviceLine, slData]: [string, any]) => {
        slData.stages.forEach((stage: any) => {
          timelineRows.push({
            opportunityId: opportunity.opportunity_id,
            opportunityName: opportunity.opportunity_name,
            accountName: opportunity.account_name,
            category: opportunity.category,
            tcvMillions: opportunity.tcv_millions,
            securityClearance: opportunity.security_clearance,
            currentSalesStage: opportunity.current_sales_stage,
            serviceLine: serviceLine,
            stageName: stage.stage_name,
            stageStartDate: new Date(stage.stage_start_date),
            stageEndDate: new Date(stage.stage_end_date),
            durationWeeks: stage.duration_weeks,
            fteRequired: stage.fte_required,
            totalEffortWeeks: stage.total_effort_weeks,
            resourceStatus: stage.resource_status,
            isCurrentFuture: stage.is_current_future
          });
        });
      });
    });

    // Sort by opportunity and then by start date
    timelineRows.sort((a, b) => {
      if (a.opportunityName !== b.opportunityName) {
        return a.opportunityName.localeCompare(b.opportunityName);
      }
      return a.stageStartDate.getTime() - b.stageStartDate.getTime();
    });

    const serviceLineColors = {
      'MW': '#5F249F', 'ITOC': '#2DD4BF', 'CES': '#3B82F6',
      'INS': '#10B981', 'BPS': '#F59E0B', 'SEC': '#F97316'
    };

    return (
      <div className="space-y-4">
        {/* Simple Timeline Table for PDF */}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Opportunity
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Account
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Details
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Service Line
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Stage
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Start Date
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  End Date
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Duration
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  FTE
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {timelineRows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900">{row.opportunityName}</div>
                    <div className="text-xs text-gray-600">{row.opportunityId}</div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                    {row.accountName}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    <div className="space-y-1">
                      <div className="text-xs">
                        <span className="inline-block bg-gray-100 px-2 py-1 rounded text-xs">
                          {row.category}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          ${row.tcvMillions.toFixed(1)}M
                        </span>
                      </div>
                      {row.securityClearance && (
                        <div className="text-xs">
                          <span className={`inline-block px-2 py-1 rounded text-xs ${
                            row.securityClearance === 'DV' ? 'bg-red-100 text-red-800' :
                            row.securityClearance === 'SC' ? 'bg-orange-100 text-orange-800' :
                            row.securityClearance === 'BPSS' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {row.securityClearance}
                          </span>
                        </div>
                      )}
                      {row.currentSalesStage && (
                        <div className="text-xs">
                          <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            Stage: {row.currentSalesStage}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    <span 
                      className="inline-block w-3 h-3 rounded mr-2"
                      style={{ backgroundColor: serviceLineColors[row.serviceLine as keyof typeof serviceLineColors] || '#6B7280' }}
                    ></span>
                    {row.serviceLine}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900">
                    {row.stageName}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600">
                    {row.stageStartDate.toLocaleDateString()}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600">
                    {row.stageEndDate.toLocaleDateString()}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                    {row.durationWeeks.toFixed(1)} weeks
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900">
                    {row.fteRequired.toFixed(1)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      row.isCurrentFuture ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {row.isCurrentFuture ? 'Current/Future' : 'Past'}
                    </span>
                    <div className="text-xs text-gray-600 mt-1">{row.resourceStatus}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm font-medium text-gray-700">Total Activities</div>
            <div className="text-2xl font-bold text-dxc-bright-purple">{timelineRows.length}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm font-medium text-gray-700">Service Lines</div>
            <div className="text-2xl font-bold text-dxc-bright-purple">
              {new Set(timelineRows.map(r => r.serviceLine)).size}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm font-medium text-gray-700">Total FTE Required</div>
            <div className="text-2xl font-bold text-dxc-bright-purple">
              {timelineRows.reduce((sum, r) => sum + r.fteRequired, 0).toFixed(1)}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm font-medium text-gray-700">Total Effort (Weeks)</div>
            <div className="text-2xl font-bold text-dxc-bright-purple">
              {timelineRows.reduce((sum, r) => sum + r.totalEffortWeeks, 0).toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineChart = (data: any) => {
    // Calculate date range for timeline
    const getAllDates = () => {
      const dates: Date[] = [];
      data.timeline_data.forEach((opportunity: any) => {
        Object.values(opportunity.service_lines).forEach((slData: any) => {
          slData.stages.forEach((stage: any) => {
            dates.push(new Date(stage.stage_start_date));
            dates.push(new Date(stage.stage_end_date));
          });
        });
      });
      return dates;
    };

    const allDates = getAllDates();
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Create month grid - limit to prevent overflow
    const months: Date[] = [];
    let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (currentMonth <= maxDate && months.length < 12) { // Limit to 12 months max for PDF
      months.push(new Date(currentMonth));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    const getPositionFromDate = (date: Date) => {
      const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceMin = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      return (daysSinceMin / totalDays) * 100;
    };

    const getWidthFromDuration = (startDate: Date, endDate: Date) => {
      const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const stageDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max((stageDays / totalDays) * 100, 1); // Minimum 1% width
    };

    const serviceLineColors = {
      'MW': '#5F249F',     // DXC Purple
      'ITOC': '#2DD4BF',   // Teal
      'CES': '#3B82F6',    // Blue
      'INS': '#10B981',    // Green
      'BPS': '#F59E0B',    // Orange
      'SEC': '#F97316'     // Red-Orange
    };

    return (
      <div className="timeline-chart-container" style={{ minWidth: '1000px', overflowX: 'auto' }}>
        {/* Timeline Header - Fixed width for consistent rendering */}
        <div className="timeline-header" style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e5e7eb', 
          paddingBottom: '12px', 
          marginBottom: '16px',
          minWidth: '1000px' 
        }}>
          <div style={{ 
            width: '300px', 
            flexShrink: 0, 
            paddingRight: '16px',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span className="font-semibold text-gray-800">Opportunity Details</span>
          </div>
          <div style={{ 
            flex: 1, 
            display: 'flex',
            minWidth: '700px'
          }}>
            {months.slice(0, Math.min(months.length, 12)).map((month, index) => (
              <div 
                key={index}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#4b5563',
                  borderLeft: index > 0 ? '1px solid #e5e7eb' : 'none',
                  padding: '8px 4px',
                  minWidth: `${700 / Math.min(months.length, 12)}px`
                }}
              >
                {month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Rows with consistent styling */}
        <div className="timeline-rows" style={{ minWidth: '1000px' }}>
          {data.timeline_data.slice(0, 12).map((opportunity: any, oppIndex: number) => (
            <div 
              key={opportunity.opportunity_id} 
              className="timeline-row"
              style={{
                display: 'flex',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
                backgroundColor: '#ffffff',
                minWidth: '1000px',
                pageBreakInside: 'avoid'
              }}
            >
              {/* Opportunity Details Column - Fixed Width */}
              <div style={{
                width: '300px',
                flexShrink: 0,
                paddingRight: '16px',
                borderRight: '1px solid #e5e7eb'
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#1f2937',
                  marginBottom: '4px',
                  wordBreak: 'break-word',
                  lineHeight: '1.3'
                }}>
                  {opportunity.opportunity_name}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                  {opportunity.opportunity_id}
                </div>
                <div style={{ fontSize: '12px', color: '#374151', marginBottom: '8px', wordBreak: 'break-word' }}>
                  {opportunity.account_name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {opportunity.category}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    ${opportunity.tcv_millions.toFixed(1)}M
                  </span>
                  {opportunity.security_clearance && (
                    <span style={{
                      fontSize: '11px',
                      backgroundColor: opportunity.security_clearance === 'DV' ? '#fee2e2' :
                                     opportunity.security_clearance === 'SC' ? '#fed7aa' :
                                     opportunity.security_clearance === 'BPSS' ? '#fef3c7' : '#f3f4f6',
                      color: opportunity.security_clearance === 'DV' ? '#991b1b' :
                             opportunity.security_clearance === 'SC' ? '#9a3412' :
                             opportunity.security_clearance === 'BPSS' ? '#92400e' : '#374151',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {opportunity.security_clearance}
                    </span>
                  )}
                  {opportunity.current_sales_stage && (
                    <span style={{
                      fontSize: '11px',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      Stage: {opportunity.current_sales_stage}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Timeline Column - Flexible Width */}
              <div style={{ flex: 1, position: 'relative', minWidth: '700px', marginLeft: '16px' }}>
                {/* Service Line Timeline Tracks */}
                {Object.entries(opportunity.service_lines).map(([serviceLine, slData]: [string, any], slIndex) => (
                  <div key={serviceLine} style={{ position: 'relative', marginBottom: '8px' }}>
                    {/* Service Line Label */}
                    <div style={{
                      position: 'absolute',
                      left: '-60px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: '#6b7280',
                      width: '50px',
                      textAlign: 'right'
                    }}>
                      {serviceLine}
                    </div>
                    
                    {/* Stage Bars Track */}
                    <div style={{
                      position: 'relative',
                      height: '24px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb'
                    }}>
                      {slData.stages.map((stage: any, stageIndex: number) => {
                        const startDate = new Date(stage.stage_start_date);
                        const endDate = new Date(stage.stage_end_date);
                        const left = Math.min(getPositionFromDate(startDate), 95);
                        const width = Math.max(Math.min(getWidthFromDuration(startDate, endDate), 100 - left), 2);
                        
                        return (
                          <div
                            key={stageIndex}
                            style={{
                              position: 'absolute',
                              left: `${left}%`,
                              width: `${width}%`,
                              height: '100%',
                              backgroundColor: serviceLineColors[serviceLine as keyof typeof serviceLineColors] || '#6b7280',
                              borderRadius: '3px',
                              opacity: stage.is_current_future ? 1 : 0.6,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '20px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                            title={`${stage.stage_name}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n${stage.fte_required.toFixed(1)} FTE, ${stage.duration_weeks.toFixed(1)} weeks`}
                          >
                            <span style={{
                              color: 'white',
                              fontSize: '10px',
                              fontWeight: '500',
                              textAlign: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: '0 4px'
                            }}>
                              {width > 8 ? stage.stage_name : stage.stage_name.substring(0, 2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Summary */}
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  marginTop: '8px',
                  textAlign: 'right'
                }}>
                  Total: {opportunity.total_effort_weeks.toFixed(1)} weeks, {opportunity.total_fte_required.toFixed(1)} FTE
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend - Print Friendly */}
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg print:p-2 print:bg-gray-100 print:break-inside-avoid" 
             style={{ pageBreakInside: 'avoid' }}>
          <div className="text-sm font-medium text-gray-700 print:text-xs">Service Lines:</div>
          {Object.entries(serviceLineColors).map(([serviceLine, color]) => (
            <div key={serviceLine} className="flex items-center print:text-xs">
              <div 
                className="w-3 h-3 rounded mr-1 print:w-2 print:h-2"
                style={{ backgroundColor: color }}
              ></div>
              <span className="text-sm text-gray-600 print:text-xs">{serviceLine}</span>
            </div>
          ))}
          <div className="text-xs text-gray-500 print:text-xs">
            • Solid: Current/Future • Faded: Past activities
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineReport = (data: any) => (
    <div className="mt-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total Opportunities</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.total_opportunities}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Service Line Activities</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.total_service_line_activities}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total Effort (Weeks)</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.total_effort_weeks.toFixed(1)}</p>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-medium text-dxc-dark-gray mb-2">Total FTE Required</h4>
          <p className="text-2xl font-bold text-dxc-bright-purple">{data.summary.total_fte_required.toFixed(1)}</p>
        </div>
      </div>

      {/* Service Line Breakdown */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Service Line Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.service_line_breakdown).map(([serviceLine, breakdown]: [string, any]) => (
              <div key={serviceLine} className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-dxc-bright-purple mb-2">{serviceLine}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Opportunities:</span>
                    <span className="font-medium">{breakdown.opportunity_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Effort Weeks:</span>
                    <span className="font-medium">{breakdown.total_effort_weeks.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total FTE:</span>
                    <span className="font-medium">{breakdown.total_fte.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stages:</span>
                    <span className="font-medium">{breakdown.stage_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Timeline Data */}
      <div className="card">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-dxc-dark-gray">Opportunity Timelines</h3>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTimelineViewMode('list')}
                className={`flex items-center px-2 py-1 rounded text-sm font-medium transition-colors ${
                  timelineViewMode === 'list' 
                    ? 'bg-white text-dxc-bright-purple shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4 mr-1" />
                List
              </button>
              <button
                onClick={() => setTimelineViewMode('timeline')}
                className={`flex items-center px-2 py-1 rounded text-sm font-medium transition-colors ${
                  timelineViewMode === 'timeline' 
                    ? 'bg-white text-dxc-bright-purple shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4 mr-1" />
                Chart
              </button>
              <button
                onClick={() => setTimelineViewMode('table')}
                className={`flex items-center px-2 py-1 rounded text-sm font-medium transition-colors ${
                  timelineViewMode === 'table' 
                    ? 'bg-white text-dxc-bright-purple shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Table className="w-4 h-4 mr-1" />
                Table
              </button>
            </div>
          </div>
          
          {timelineViewMode === 'list' ? (
            <div className="space-y-4">
              {data.timeline_data.slice(0, 10).map((opportunity: any, index: number) => (
              <div key={opportunity.opportunity_id} className="border border-gray-200 rounded-lg p-4">
                {/* Opportunity Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-dxc-dark-gray">{opportunity.opportunity_name}</h4>
                    <p className="text-sm text-gray-600 mb-1">{opportunity.opportunity_id}</p>
                    <p className="text-sm text-dxc-dark-gray font-medium">{opportunity.account_name}</p>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <div className="text-dxc-bright-purple font-medium">${opportunity.tcv_millions.toFixed(1)}M TCV</div>
                    <div className="text-gray-600">{opportunity.category}</div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        opportunity.current_sales_stage ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        Stage: {opportunity.current_sales_stage || 'N/A'}
                      </span>
                      {opportunity.security_clearance && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          opportunity.security_clearance === 'DV' ? 'bg-red-100 text-red-800' :
                          opportunity.security_clearance === 'SC' ? 'bg-orange-100 text-orange-800' :
                          opportunity.security_clearance === 'BPSS' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {opportunity.security_clearance} Clearance
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Activity Period */}
                <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
                  <span className="font-medium">Activity Period:</span> {' '}
                  {new Date(opportunity.activity_period.start).toLocaleDateString()} - {' '}
                  {new Date(opportunity.activity_period.end).toLocaleDateString()}
                </div>

                {/* Service Lines */}
                <div className="space-y-3">
                  {Object.entries(opportunity.service_lines).map(([serviceLine, slData]: [string, any]) => (
                    <div key={serviceLine} className="pl-4 border-l-4 border-dxc-bright-purple">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-medium text-dxc-bright-purple">{serviceLine}</h5>
                        <div className="text-sm text-gray-600">
                          {slData.total_effort.toFixed(1)} effort weeks | {slData.total_fte.toFixed(1)} FTE
                        </div>
                      </div>
                      
                      {/* Stages */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {slData.stages.map((stage: any, stageIndex: number) => (
                          <div key={stageIndex} className="p-2 bg-gray-50 rounded text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Stage {stage.stage_name}</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                stage.is_current_future ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {stage.is_current_future ? 'Current/Future' : 'Past'}
                              </span>
                            </div>
                            <div className="mt-1 space-y-1">
                              <div>{new Date(stage.stage_start_date).toLocaleDateString()} - {new Date(stage.stage_end_date).toLocaleDateString()}</div>
                              <div>{stage.duration_weeks.toFixed(1)} weeks | {stage.fte_required.toFixed(1)} FTE</div>
                              <div className="text-gray-600">{stage.resource_status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              ))}
            </div>
          ) : timelineViewMode === 'timeline' ? (
            renderTimelineChart(data)
          ) : (
            renderTimelineTable(data)
          )}
          
          {data.timeline_data.length > 10 && (
            <div className="mt-4 text-center text-sm text-gray-600">
              Showing top 10 opportunities by effort. Total: {data.timeline_data.length} opportunities.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loadingReports) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-dxc-bright-purple animate-spin" />
      </div>
    );
  }

  const reports = availableReports?.available_reports || [];
  const selectedReportInfo = reports.find((r: ReportInfo) => r.id === selectedReport);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-dxc-slide font-bold text-dxc-dark-gray">Reports</h1>
          <p className="text-dxc-body text-gray-600 mt-2">
            Generate and export business intelligence reports for resource forecasting and opportunity tracking
          </p>
        </div>
      </div>

      {/* Report Selection */}
      <div className="card">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-dxc-dark-gray mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Select Report
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report: ReportInfo) => {
              const Icon = reportIcons[report.id as keyof typeof reportIcons] || FileText;
              const isSelected = selectedReport === report.id;
              
              return (
                <div
                  key={report.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-dxc-bright-purple bg-purple-50'
                      : 'border-gray-200 hover:border-dxc-bright-purple hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedReport(report.id)}
                >
                  <div className="flex items-start space-x-3">
                    <Icon className={`w-6 h-6 flex-shrink-0 ${isSelected ? 'text-dxc-bright-purple' : 'text-gray-600'}`} />
                    <div>
                      <h3 className={`font-medium ${isSelected ? 'text-dxc-bright-purple' : 'text-dxc-dark-gray'}`}>
                        {report.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {report.export_formats.map(format => (
                          <span
                            key={format}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {format.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      {selectedReportInfo && (
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-dxc-dark-gray mb-4">Configure Report</h2>
            
            {renderFilters(selectedReportInfo)}
            
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="flex items-center space-x-4">
                <button
                  onClick={generateReport}
                  disabled={isGenerating}
                  className="btn-primary flex items-center"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 mr-2" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
              
              {reportData && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-dxc-dark-gray mr-2">Export:</span>
                  {selectedReportInfo.export_formats.map((format: string) => (
                    <button
                      key={format}
                      onClick={() => exportReport(format)}
                      className="btn-secondary flex items-center"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Data */}
      {reportData && (
        <div id="report-content">
          {renderReportData(reportData)}
        </div>
      )}
    </div>
  );
};

export default Reports;