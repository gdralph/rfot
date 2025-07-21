import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X } from 'lucide-react';

export interface ExcelUploaderProps {
  onFileSelect: (file: File) => void;
  onUpload: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  acceptedTypes?: string;
  maxSize?: number; // in MB
  resetTrigger?: boolean; // Add this to trigger file reset
}

const ExcelUploader: React.FC<ExcelUploaderProps> = ({
  onFileSelect,
  onUpload,
  isUploading = false,
  disabled = false,
  title,
  description,
  acceptedTypes = '.xlsx,.xls',
  maxSize = 50,
  resetTrigger = false
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Reset selected file when resetTrigger changes
  useEffect(() => {
    if (resetTrigger) {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [resetTrigger]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="card">
      <h3 className="text-dxc-subtitle font-semibold mb-2">{title}</h3>
      <p className="text-dxc-body text-gray-600 mb-4">{description}</p>

      {/* File Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragOver ? 'border-dxc-purple bg-purple-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-dxc-purple hover:bg-gray-50 cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!disabled ? handleBrowseClick : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <FileText className="w-8 h-8 text-dxc-purple" />
              <div className="text-left">
                <p className="font-medium text-dxc-dark-gray">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              {!disabled && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  className="text-red-500 hover:text-red-700"
                  title="Remove file"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpload();
              }}
              disabled={disabled || isUploading}
              className="btn-primary disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-lg font-medium text-gray-600">
                Drop your Excel file here
              </p>
              <p className="text-sm text-gray-500">
                or <span className="text-dxc-purple font-medium">browse</span> to select a file
              </p>
            </div>
            
            <div className="text-xs text-gray-500">
              <p>Supported formats: .xlsx, .xls</p>
              <p>Maximum file size: {maxSize}MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelUploader;