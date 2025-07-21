import React from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';
import type { ImportTask } from '../types/index';

export interface ImportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ImportTask | null;
  title: string;
}

const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  isOpen,
  onClose,
  task,
  title,
}) => {
  if (!isOpen || !task) return null;

  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'processing':
        return <Loader className="w-6 h-6 text-dxc-purple animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <AlertCircle className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'pending':
        return 'text-yellow-600';
      case 'processing':
        return 'text-dxc-purple';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (task.status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const canClose = task.status === 'completed' || task.status === 'failed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-dxc-subtitle font-semibold">{title}</h2>
          {(canClose || task.status === 'completed') && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center space-x-3 mb-6">
          {getStatusIcon()}
          <div>
            <p className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </p>
            <p className="text-sm text-gray-600">{task.message}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {(task.status === 'processing' || task.status === 'pending') && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Progress</span>
              <span className="text-sm font-medium text-gray-900">
                {task.progress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-dxc-purple h-2 rounded-full transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Processing Statistics */}
        {(task.total_rows || task.processed_rows) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Import Statistics</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {task.total_rows && (
                <div>
                  <span className="font-medium">Total Rows:</span>
                  <span className="ml-2">{task.total_rows.toLocaleString()}</span>
                </div>
              )}
              {task.processed_rows !== undefined && (
                <div>
                  <span className="font-medium">Processed:</span>
                  <span className="ml-2">{task.processed_rows.toLocaleString()}</span>
                </div>
              )}
              {task.successful_rows !== undefined && (
                <div>
                  <span className="font-medium text-green-600">Successful:</span>
                  <span className="ml-2 text-green-600">{task.successful_rows.toLocaleString()}</span>
                </div>
              )}
              {task.failed_rows !== undefined && task.failed_rows > 0 && (
                <div>
                  <span className="font-medium text-red-600">Failed:</span>
                  <span className="ml-2 text-red-600">{task.failed_rows.toLocaleString()}</span>
                </div>
              )}
              {task.warnings_count !== undefined && task.warnings_count > 0 && (
                <div>
                  <span className="font-medium text-amber-600">Warnings:</span>
                  <span className="ml-2 text-amber-600">{task.warnings_count.toLocaleString()}</span>
                </div>
              )}
              {task.status === 'completed' && task.successful_rows !== undefined && task.total_rows && (
                <div>
                  <span className="font-medium text-green-600">Success Rate:</span>
                  <span className="ml-2 text-green-600">
                    {((task.successful_rows / task.total_rows) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {task.status === 'completed' && task.start_time && task.end_time && (
                <div className="col-span-2">
                  <span className="font-medium">Duration:</span>
                  <span className="ml-2">
                    {(() => {
                      const duration = new Date(task.end_time).getTime() - new Date(task.start_time).getTime();
                      const seconds = Math.round(duration / 1000);
                      return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Errors and Warnings */}
        {task.errors && task.errors.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-red-600">
                {task.errors.length > 1 ? `${task.errors.length} Issues Found:` : '1 Issue Found:'}
              </p>
              {task.errors.length > 5 && (
                <p className="text-xs text-gray-500">Showing first 50 issues</p>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
              {task.errors.slice(0, 50).map((error, index) => {
                const isWarning = error.toLowerCase().includes('warning');
                return (
                  <div 
                    key={index} 
                    className={`text-sm mb-2 pb-2 border-b border-red-200 last:border-b-0 last:mb-0 last:pb-0 ${
                      isWarning ? 'text-amber-700' : 'text-red-700'
                    }`}
                  >
                    <div className="flex items-start">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                        isWarning ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isWarning ? 'WARN' : 'ERROR'}
                      </span>
                      <span className="flex-1">{error}</span>
                    </div>
                  </div>
                );
              })}
              {task.errors.length > 50 && (
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-red-200">
                  ... and {task.errors.length - 50} more issues
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          {task.status === 'completed' && (
            <div className="flex space-x-3">
              <button 
                onClick={() => {
                  if (task.errors && task.errors.length > 0) {
                    const errorText = task.errors.join('\n');
                    navigator.clipboard.writeText(errorText).then(() => {
                      alert('Errors copied to clipboard');
                    }).catch(() => {
                      console.log('Could not copy errors');
                    });
                  }
                }} 
                className="btn-secondary"
                disabled={!task.errors || task.errors.length === 0}
              >
                Copy Errors
              </button>
              <button onClick={onClose} className="btn-primary">
                Done
              </button>
            </div>
          )}
          {task.status === 'failed' && (
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          )}
          {(task.status === 'processing' || task.status === 'pending') && (
            <div className="text-sm text-gray-500 py-2">
              Import in progress...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportProgressModal;