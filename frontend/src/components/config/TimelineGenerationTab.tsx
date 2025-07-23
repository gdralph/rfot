import React, { useState } from 'react';
import { Clock, Play, RefreshCw, CheckCircle, AlertCircle, Info, BarChart3, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';

interface TimelineGenerationStats {
  total_opportunities: number;
  eligible_for_generation: number;
  existing_timelines: number;
  predicted_timelines: number;
  generated: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface TimelineGenerationResult {
  success: boolean;
  message: string;
  stats: TimelineGenerationStats;
  processed_opportunities: Array<{
    id: string;
    name: string;
    action: 'generated' | 'updated' | 'skipped' | 'error';
    reason?: string;
  }>;
}

const TimelineGenerationTab: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [lastResult, setLastResult] = useState<TimelineGenerationResult | null>(null);

  // Get current timeline statistics
  const { data: currentStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['timeline-generation-stats'],
    queryFn: async (): Promise<TimelineGenerationStats> => {
      const result = await api.getTimelineGenerationStats();
      return result as TimelineGenerationStats;
    },
    staleTime: 30000, // 30 seconds
  });

  // Bulk timeline generation mutation
  const generateTimelinesMutation = useMutation({
    mutationFn: async (regenerateAll: boolean = false): Promise<TimelineGenerationResult> => {
      const result = await api.generateBulkTimelines({ regenerateAll });
      return result as TimelineGenerationResult;
    },
    onSuccess: (result: TimelineGenerationResult) => {
      setLastResult(result);
      refetchStats(); // Refresh stats after generation
    },
    onError: (error) => {
      console.error('Timeline generation failed:', error);
      setLastResult({
        success: false,
        message: 'Timeline generation failed. Please try again.',
        stats: currentStats || {
          total_opportunities: 0,
          eligible_for_generation: 0,
          existing_timelines: 0,
          predicted_timelines: 0,
          generated: 0,
          updated: 0,
          skipped: 0,
          errors: 0
        },
        processed_opportunities: []
      });
    }
  });

  // Clear predicted timelines mutation
  const clearPredictedTimelinesMutation = useMutation({
    mutationFn: async () => {
      const result = await api.clearPredictedTimelines();
      return result;
    },
    onSuccess: (result: any) => {
      setLastResult({
        success: true,
        message: result.message,
        stats: {
          total_opportunities: currentStats?.total_opportunities || 0,
          eligible_for_generation: currentStats?.eligible_for_generation || 0,
          existing_timelines: currentStats?.existing_timelines || 0,
          predicted_timelines: 0, // Will be 0 after clearing
          generated: 0,
          updated: 0,
          skipped: 0,
          errors: 0
        },
        processed_opportunities: []
      });
      refetchStats(); // Refresh stats after clearing
    },
    onError: (error) => {
      console.error('Clear predicted timelines failed:', error);
      setLastResult({
        success: false,
        message: 'Failed to clear predicted timelines. Please try again.',
        stats: currentStats || {
          total_opportunities: 0,
          eligible_for_generation: 0,
          existing_timelines: 0,
          predicted_timelines: 0,
          generated: 0,
          updated: 0,
          skipped: 0,
          errors: 0
        },
        processed_opportunities: []
      });
    }
  });

  const handleGenerateTimelines = (regenerateAll: boolean = false) => {
    generateTimelinesMutation.mutate(regenerateAll);
  };

  const handleClearPredictedTimelines = () => {
    if (window.confirm('Are you sure you want to clear all predicted timeline records? This action cannot be undone.')) {
      clearPredictedTimelinesMutation.mutate();
    }
  };

  if (statsLoading) {
    return <LoadingSpinner text="Loading timeline statistics..." />;
  }

  const isGenerating = generateTimelinesMutation.isPending;
  const isClearing = clearPredictedTimelinesMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="bg-gradient-to-r from-dxc-bright-purple to-purple-600 text-white rounded-dxc p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6" />
          <h2 className="text-xl font-semibold">Timeline Generation</h2>
        </div>
        <p className="text-purple-100">
          Generate resource timelines for opportunities that meet the timeline generation criteria.
          Only opportunities in 'Predicted' status will be regenerated.
        </p>
      </div>

      {/* Current Statistics */}
      {currentStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-dxc-light-gray rounded-dxc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dxc-medium-gray">Total Opportunities</p>
                <p className="text-2xl font-bold text-dxc-dark-gray">
                  {currentStats.total_opportunities}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-dxc-bright-purple" />
            </div>
          </div>

          <div className="bg-white border border-dxc-light-gray rounded-dxc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dxc-medium-gray">Eligible for Generation</p>
                <p className="text-2xl font-bold text-dxc-bright-teal">
                  {currentStats.eligible_for_generation}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-dxc-bright-teal" />
            </div>
          </div>

          <div className="bg-white border border-dxc-light-gray rounded-dxc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dxc-medium-gray">Existing Timelines</p>
                <p className="text-2xl font-bold text-dxc-blue">
                  {currentStats.existing_timelines}
                </p>
              </div>
              <Clock className="w-8 h-8 text-dxc-blue" />
            </div>
          </div>

          <div className="bg-white border border-dxc-light-gray rounded-dxc p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dxc-medium-gray">Predicted Status</p>
                <p className="text-2xl font-bold text-orange-600">
                  {currentStats.predicted_timelines}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Generation Controls */}
      <div className="bg-white border border-dxc-light-gray rounded-dxc p-6">
        <h3 className="text-lg font-semibold text-dxc-dark-gray mb-4">Generation Controls</h3>
        
        <div className="space-y-4">
          {/* Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-dxc p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Timeline Generation Rules:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Only opportunities with complete line items and category assignment</li>
                  <li>Regeneration only occurs for timelines in 'Predicted' status</li>
                  <li>Manual and validated timelines are preserved</li>
                  <li>Service line stage effort configurations must be available</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleGenerateTimelines(false)}
              disabled={isGenerating || isClearing}
              className="btn-primary flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Generate New Timelines
            </button>

            <button
              onClick={() => handleGenerateTimelines(true)}
              disabled={isGenerating || isClearing}
              className="btn-secondary flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Regenerate All Eligible
            </button>

            <button
              onClick={handleClearPredictedTimelines}
              disabled={isGenerating || isClearing || !currentStats?.predicted_timelines}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-dxc font-medium flex items-center gap-2 transition-colors"
            >
              {isClearing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clear All Predicted
            </button>
          </div>

          {isGenerating && (
            <div className="bg-purple-50 border border-purple-200 rounded-dxc p-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-dxc-bright-purple animate-spin" />
                <span className="text-dxc-bright-purple font-medium">
                  Generating timelines... This may take a few moments.
                </span>
              </div>
            </div>
          )}

          {isClearing && (
            <div className="bg-red-50 border border-red-200 rounded-dxc p-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-red-600 animate-spin" />
                <span className="text-red-600 font-medium">
                  Clearing predicted timelines... This may take a few moments.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      {lastResult && (
        <div className="bg-white border border-dxc-light-gray rounded-dxc p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dxc-dark-gray">Generation Results</h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-dxc-bright-purple hover:text-dxc-purple text-sm"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Status Alert */}
          <div className={`border rounded-dxc p-4 mb-4 ${
            lastResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              {lastResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  lastResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {lastResult.success ? 'Generation Completed' : 'Generation Failed'}
                </p>
                <p className={`text-sm ${
                  lastResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {lastResult.message}
                </p>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {lastResult.stats.generated}
              </p>
              <p className="text-sm text-dxc-medium-gray">Generated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {lastResult.stats.updated}
              </p>
              <p className="text-sm text-dxc-medium-gray">Updated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">
                {lastResult.stats.skipped}
              </p>
              <p className="text-sm text-dxc-medium-gray">Skipped</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {lastResult.stats.errors}
              </p>
              <p className="text-sm text-dxc-medium-gray">Errors</p>
            </div>
          </div>

          {/* Detailed Results */}
          {showDetails && lastResult.processed_opportunities.length > 0 && (
            <div className="border-t border-dxc-light-gray pt-4">
              <h4 className="font-semibold text-dxc-dark-gray mb-3">Processed Opportunities</h4>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-sm font-medium text-dxc-dark-gray">Opportunity</th>
                      <th className="text-left p-2 text-sm font-medium text-dxc-dark-gray">Action</th>
                      <th className="text-left p-2 text-sm font-medium text-dxc-dark-gray">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastResult.processed_opportunities.map((opportunity) => (
                      <tr key={opportunity.id} className="border-t border-gray-200">
                        <td className="p-2 text-sm">{opportunity.name}</td>
                        <td className="p-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            opportunity.action === 'generated' ? 'bg-green-100 text-green-800' :
                            opportunity.action === 'updated' ? 'bg-blue-100 text-blue-800' :
                            opportunity.action === 'skipped' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {opportunity.action}
                          </span>
                        </td>
                        <td className="p-2 text-sm text-dxc-medium-gray">
                          {opportunity.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineGenerationTab;