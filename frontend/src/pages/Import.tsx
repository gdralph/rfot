import React, { useState } from 'react';
import { FileSpreadsheet, Database, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import ExcelUploader from '../components/ExcelUploader';
import ImportProgressModal from '../components/ImportProgressModal';
import { useImportExcel, useImportLineItems, useImportStatus } from '../hooks/useImport';
import type { ImportTask } from '../types/index';

const Import: React.FC = () => {
  const [opportunitiesFile, setOpportunitiesFile] = useState<File | null>(null);
  const [lineItemsFile, setLineItemsFile] = useState<File | null>(null);
  const [activeTask, setActiveTask] = useState<ImportTask | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [resetFiles, setResetFiles] = useState(false);

  const importOpportunitiesMutation = useImportExcel();
  const importLineItemsMutation = useImportLineItems();
  
  // Poll for import status when we have an active task
  const { data: taskStatus } = useImportStatus(
    activeTask?.task_id || '',
    !!activeTask && showProgressModal
  );

  // Update active task with latest status
  React.useEffect(() => {
    if (taskStatus && activeTask) {
      setActiveTask(taskStatus);
      
      // Don't auto-close when completed - let user close manually
      // This allows them to review detailed statistics and errors
      if (taskStatus.status === 'completed') {
        // Reset file selections after successful import
        setOpportunitiesFile(null);
        setLineItemsFile(null);
        setResetFiles(true);
        setTimeout(() => setResetFiles(false), 100);
      }
      // Only auto-close for failed imports after a longer delay
      if (taskStatus.status === 'failed') {
        setTimeout(() => {
          setShowProgressModal(false);
          setActiveTask(null);
        }, 5000); // 5 seconds for failed imports
      }
    }
  }, [taskStatus, activeTask]);

  const handleOpportunitiesUpload = async () => {
    if (!opportunitiesFile) return;

    try {
      const response = await importOpportunitiesMutation.mutateAsync(opportunitiesFile);
      setActiveTask({
        task_id: response.task_id,
        status: 'pending',
        progress: 0,
        message: response.message,
      });
      setShowProgressModal(true);
    } catch (error) {
      console.error('Failed to start opportunities import:', error);
      alert(`Failed to start opportunities import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLineItemsUpload = async () => {
    if (!lineItemsFile) return;

    try {
      const response = await importLineItemsMutation.mutateAsync(lineItemsFile);
      setActiveTask({
        task_id: response.task_id,
        status: 'pending',
        progress: 0,
        message: response.message,
      });
      setShowProgressModal(true);
    } catch (error) {
      console.error('Failed to start line items import:', error);
      alert(`Failed to start line items import: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCloseModal = () => {
    setShowProgressModal(false);
    setActiveTask(null);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-dxc-section mb-2">Import Data</h1>
        <p className="text-dxc-dark-gray">
          Upload Excel files to import opportunities and line item data into the system
        </p>
      </div>

      {/* Import Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Import Guidelines</h3>
            <ul className="text-blue-800 space-y-2">
              <li className="flex items-start">
                <span className="font-medium mr-2">1.</span>
                <span>Import opportunities first, then line items to ensure proper relationships</span>
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">2.</span>
                <span>Files should be in Excel format (.xlsx or .xls)</span>
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">3.</span>
                <span>Existing opportunities will be updated; new ones will be created</span>
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">4.</span>
                <span>Large files may take several minutes to process</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Import Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Opportunities Import */}
        <ExcelUploader
          title="Import Opportunities"
          description="Upload an Excel file containing opportunity data with columns for Opportunity ID, Name, Stage, Amount, Close Date, etc."
          onFileSelect={setOpportunitiesFile}
          onUpload={handleOpportunitiesUpload}
          isUploading={importOpportunitiesMutation.isPending}
          disabled={showProgressModal}
          resetTrigger={resetFiles}
        />

        {/* Line Items Import */}
        <ExcelUploader
          title="Import Line Items"
          description="Upload an Excel file containing opportunity line items with service line revenue breakdown (CES, INS, BPS, SEC, ITOC, MW)."
          onFileSelect={setLineItemsFile}
          onUpload={handleLineItemsUpload}
          isUploading={importLineItemsMutation.isPending}
          disabled={showProgressModal}
          resetTrigger={resetFiles}
        />
      </div>

      {/* Error Display */}
      {(importOpportunitiesMutation.error || importLineItemsMutation.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-medium text-red-800">Import Error</h3>
          </div>
          <p className="text-red-700">
            {importOpportunitiesMutation.error?.message || 
             importLineItemsMutation.error?.message || 
             'An error occurred during import'}
          </p>
        </div>
      )}

      {/* Recent Import History */}
      <div className="card">
        <h3 className="text-dxc-subtitle font-semibold mb-4">Import Tips</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <FileSpreadsheet className="w-5 h-5 text-dxc-purple flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900">Opportunity File Format</h4>
              <p className="text-sm text-gray-600 mt-1">
                Required columns: Opportunity Id, Opportunity Name, Sales Stage, Offering TCV (M), Decision Date<br/>
                Optional columns: Opportunity Owner, Forecast Category Consolidated
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <Database className="w-5 h-5 text-dxc-teal flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900">Line Items File Format</h4>
              <p className="text-sm text-gray-600 mt-1">
                Required columns: Opportunity Id, TCV $M<br/>
                Service Line columns: CES (M), INS (M), BPS (M), SEC (M), ITOC (M), MW (M)<br/>
                Optional columns: Contract Length, In Forecast
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-medium text-gray-900">Data Validation</h4>
              <p className="text-sm text-gray-600 mt-1">
                The system will automatically validate data types, check for required fields,
                and categorize opportunities based on TCV values.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <ImportProgressModal
        isOpen={showProgressModal}
        onClose={handleCloseModal}
        task={activeTask}
        title={activeTask?.message?.includes('line items') ? 'Line Items Import' : 'Opportunities Import'}
      />
    </div>
  );
};

export default Import;