import React, { useState } from 'react';
import { FileSpreadsheet, Database, AlertCircle, CheckCircle, XCircle, Upload } from 'lucide-react';
import ExcelUploader from '../components/ExcelUploader';
import ImportProgressModal from '../components/ImportProgressModal';
import { useImportExcel, useImportLineItems, useImportStatus } from '../hooks/useImport';
import type { ImportTask } from '../types/index';

const ImportV2: React.FC = () => {
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
      
      if (taskStatus.status === 'completed') {
        setOpportunitiesFile(null);
        setLineItemsFile(null);
        setResetFiles(true);
        setTimeout(() => setResetFiles(false), 100);
      }
      if (taskStatus.status === 'failed') {
        setTimeout(() => {
          setShowProgressModal(false);
          setActiveTask(null);
        }, 5000);
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
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center gap-2">
        <Upload className="w-6 h-6 text-dxc-bright-purple" />
        <div>
          <h1 className="text-lg font-semibold text-dxc-dark-gray">Import Data</h1>
          <p className="text-xs text-dxc-medium-gray">Upload Excel files for opportunities and line items</p>
        </div>
      </div>

      {/* Compact Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Guidelines</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li><span className="font-medium">1.</span> Import opportunities first, then line items</li>
              <li><span className="font-medium">2.</span> Excel format (.xlsx/.xls) required</li>
              <li><span className="font-medium">3.</span> Existing records updated, new ones created</li>
              <li><span className="font-medium">4.</span> Large files may take several minutes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Compact Import Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Opportunities Import */}
        <ExcelUploader
          title="Import Opportunities"
          description="Opportunity data with ID, Name, Stage, Amount, Close Date, etc."
          onFileSelect={setOpportunitiesFile}
          onUpload={handleOpportunitiesUpload}
          isUploading={importOpportunitiesMutation.isPending}
          disabled={showProgressModal}
          resetTrigger={resetFiles}
        />

        {/* Line Items Import */}
        <ExcelUploader
          title="Import Line Items"
          description="Service line revenue breakdown (CES, INS, BPS, SEC, ITOC, MW)."
          onFileSelect={setLineItemsFile}
          onUpload={handleLineItemsUpload}
          isUploading={importLineItemsMutation.isPending}
          disabled={showProgressModal}
          resetTrigger={resetFiles}
        />
      </div>

      {/* Compact Error Display */}
      {(importOpportunitiesMutation.error || importLineItemsMutation.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-medium text-red-800">Import Error</h3>
          </div>
          <p className="text-xs text-red-700">
            {importOpportunitiesMutation.error?.message || 
             importLineItemsMutation.error?.message || 
             'An error occurred during import'}
          </p>
        </div>
      )}

      {/* Compact Format Reference */}
      <div className="bg-white rounded-lg shadow-sm border border-dxc-light-gray p-4">
        <h3 className="text-sm font-semibold text-dxc-dark-gray mb-3">Format Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-2">
            <FileSpreadsheet className="w-4 h-4 text-dxc-purple flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium text-gray-900">Opportunities</h4>
              <p className="text-xs text-gray-600 mt-1">
                Required: Opportunity Id, Name, Stage, TCV, Decision Date<br/>
                Optional: Owner, Forecast Category
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 text-dxc-teal flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium text-gray-900">Line Items</h4>
              <p className="text-xs text-gray-600 mt-1">
                Required: Opportunity Id, TCV $M<br/>
                Service Lines: CES, INS, BPS, SEC, ITOC, MW (M)<br/>
                Optional: Contract Length, In Forecast
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-medium text-gray-900">Validation</h4>
              <p className="text-xs text-gray-600 mt-1">
                Auto data type validation, required field checks, and TCV-based categorization
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

export default ImportV2;