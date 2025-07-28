import React from 'react';

interface SummaryStatsData {
  total_opportunities_processed: number;
  total_effort_weeks: number;
  forecast_period: {
    timeline_opportunities: number;
    missing_timelines: number;
  };
}

interface SummaryStatsGridProps {
  data: SummaryStatsData;
}

const SummaryStatsGrid: React.FC<SummaryStatsGridProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-dxc-gray mb-1">Total Opportunities</p>
        <p className="text-xl font-semibold text-dxc-bright-purple">
          {data.total_opportunities_processed}
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-dxc-gray mb-1">Total Effort</p>
        <p className="text-xl font-semibold text-dxc-bright-purple">
          {data.total_effort_weeks.toFixed(1)} weeks
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-dxc-gray mb-1">Timelines Available</p>
        <p className="text-xl font-semibold text-dxc-bright-purple">
          {data.forecast_period.timeline_opportunities}
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-dxc-gray mb-1">Missing Timelines</p>
        <p className="text-xl font-semibold text-orange-600">
          {data.forecast_period.missing_timelines}
        </p>
      </div>
    </div>
  );
};

export default SummaryStatsGrid;