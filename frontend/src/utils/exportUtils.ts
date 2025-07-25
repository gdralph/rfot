import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export interface ExportOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

export const exportToPDF = async (elementId: string, options: ExportOptions = {}) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    // Enhanced canvas settings for better quality and layout preservation
    const canvasOptions = {
      scale: 3, // Higher scale for better quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth || element.offsetWidth,
      height: element.scrollHeight || element.offsetHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      // Force consistent rendering
      onclone: (clonedDoc: Document) => {
        // Apply print styles to the cloned document
        const style = clonedDoc.createElement('style');
        style.textContent = `
          * { 
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .overflow-hidden { overflow: visible !important; }
          .overflow-x-auto { overflow: visible !important; }
          .min-w-full { width: 100% !important; }
          .truncate { 
            white-space: normal !important;
            text-overflow: initial !important;
            overflow: visible !important;
          }
          .flex-1 { flex: none !important; width: auto !important; }
          .relative { position: static !important; }
          .absolute { position: static !important; }
          
          /* Fix timeline positioning issues */
          [style*="left:"] { position: static !important; }
          [style*="width:"] { min-width: 20px !important; }
          
          /* Configuration report specific fixes */
          .grid { display: block !important; }
          .grid > * { margin-bottom: 10px !important; }
          .overflow-x-auto { overflow: visible !important; }
          .space-y-4 > * + * { margin-top: 16px !important; }
          .space-y-6 > * + * { margin-top: 24px !important; }
          .bg-gray-50, .bg-blue-50, .bg-white { 
            background-color: #f9fafb !important; 
            border: 1px solid #e5e7eb !important;
          }
          
          /* Timeline chart fixes */
          .relative { position: relative !important; }
          .absolute { position: absolute !important; }
          .transform { transform: none !important; }
          
          /* Ensure timeline elements are visible */
          [style*="position: absolute"] {
            position: static !important;
            display: inline-block !important;
            margin-right: 5px !important;
          }
        `;
        clonedDoc.head.appendChild(style);
        
        // Ensure all text is visible
        const elements = clonedDoc.querySelectorAll('*');
        elements.forEach((el: any) => {
          if (el.style) {
            el.style.overflow = 'visible';
            el.style.textOverflow = 'initial';
            el.style.whiteSpace = 'normal';
          }
        });
      }
    };

    // Create canvas from HTML element
    const canvas = await html2canvas(element, canvasOptions);

    // const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Calculate dimensions with better aspect ratio preservation
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const availableWidth = pdfWidth - (2 * margin);
    const availableHeight = pdfHeight - (2 * margin);

    // Calculate scaling to fit content properly
    const canvasAspectRatio = canvas.width / canvas.height;
    const availableAspectRatio = availableWidth / availableHeight;

    let imgWidth, imgHeight;
    
    if (canvasAspectRatio > availableAspectRatio) {
      // Content is wider, scale by width
      imgWidth = availableWidth;
      imgHeight = availableWidth / canvasAspectRatio;
    } else {
      // Content is taller, scale by height
      imgHeight = availableHeight;
      imgWidth = availableHeight * canvasAspectRatio;
    }

    let heightLeft = imgHeight;
    let position = margin;

    // Add title if provided
    if (options.title) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(options.title, margin, margin + 10);
      position = margin + 20;
      heightLeft = imgHeight;
    }

    // Add images to PDF with proper paging
    let pageNum = 1;
    const maxHeightPerPage = availableHeight - (options.title ? 20 : 0);

    while (heightLeft > 0) {
      if (pageNum > 1) {
        pdf.addPage();
        position = margin;
      }

      const heightToUse = Math.min(heightLeft, maxHeightPerPage);
      const sourceY = imgHeight - heightLeft;
      const sourceHeight = heightToUse;

      // Create a cropped version for this page
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.width;
      tempCanvas.height = (sourceHeight / imgHeight) * canvas.height;
      
      if (tempCtx) {
        tempCtx.drawImage(
          canvas,
          0, (sourceY / imgHeight) * canvas.height,
          canvas.width, (sourceHeight / imgHeight) * canvas.height,
          0, 0,
          canvas.width, tempCanvas.height
        );
        
        const pageImgData = tempCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(pageImgData, 'PNG', margin, position, imgWidth, heightToUse);
      }

      heightLeft -= heightToUse;
      pageNum++;
    }

    // Add footer with generation date
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`,
        margin,
        pdfHeight - 5
      );
    }

    // Download the PDF
    const filename = options.filename || `report-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export PDF');
  }
};

export const exportToExcel = (data: any[], filename?: string, sheetName?: string) => {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const columnWidths: any[] = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      let maxWidth = 10;
      
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.v) {
          const cellValue = cell.v.toString();
          maxWidth = Math.max(maxWidth, cellValue.length + 2);
        }
      }
      
      columnWidths.push({ width: Math.min(maxWidth, 50) });
    }
    
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report Data');

    // Generate and download file
    const exportFilename = filename || `report-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, exportFilename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export Excel file');
  }
};

export const convertReportDataToExcel = (reportData: any, reportType: string) => {
  switch (reportType) {
    case 'resource-utilization':
      return reportData.utilization_data?.map((item: any) => ({
        'Service Line': item.service_line,
        'Stage': item.stage_name,
        'Category': item.category,
        'Opportunity Count': item.opportunity_count,
        'Total FTE': item.total_fte,
        'Total Effort Weeks': item.total_effort_weeks,
        'Avg Duration Weeks': item.avg_duration_weeks,
      })) || [];

    case 'opportunity-pipeline':
      return reportData.pipeline_data?.map((item: any) => ({
        'Opportunity ID': item.opportunity_id,
        'Opportunity Name': item.opportunity_name,
        'Account Name': item.account_name,
        'Sales Stage': item.sales_stage,
        'TCV (Millions)': item.tcv_millions,
        'Decision Date': item.decision_date,
        'Opportunity Owner': item.opportunity_owner,
        'Primary Service Line': item.primary_service_line,
        'Days to Decision': item.days_to_decision,
      })) || [];

    case 'service-line-performance':
      const serviceLineData: any[] = [];
      Object.entries(reportData.service_line_performance || {}).forEach(([serviceLine, perf]: [string, any]) => {
        serviceLineData.push({
          'Service Line': serviceLine,
          'Opportunity Count': perf.opportunity_count,
          'Total TCV': perf.total_tcv,
          'Won Count': perf.won_count,
          'Won TCV': perf.won_tcv,
          'Average Deal Size': perf.avg_deal_size,
          'Win Rate (%)': perf.win_rate,
        });
      });
      return serviceLineData;

    case 'stage-duration-analysis':
      const stageData: any[] = [];
      Object.entries(reportData.stage_analysis || {}).forEach(([stage, analysis]: [string, any]) => {
        stageData.push({
          'Stage': stage,
          'Opportunity Count': analysis.opportunity_count,
          'Average Duration (Weeks)': analysis.avg_duration,
          'Minimum Duration (Weeks)': analysis.min_duration,
          'Maximum Duration (Weeks)': analysis.max_duration,
          'Median Duration (Weeks)': analysis.median_duration,
        });
      });
      return stageData;

    case 'resource-gap-analysis':
      return reportData.gaps_identified?.map((gap: any) => ({
        'Month': gap.month,
        'Service Line': gap.service_line,
        'Required FTE': gap.required_fte,
        'Available Capacity': gap.available_capacity,
        'Gap (FTE)': gap.gap,
        'Gap Percentage': gap.gap_percentage,
      })) || [];

    case 'service-line-activity-timeline':
      const timelineData: any[] = [];
      reportData.timeline_data?.forEach((opportunity: any) => {
        Object.entries(opportunity.service_lines).forEach(([serviceLine, slData]: [string, any]) => {
          slData.stages.forEach((stage: any) => {
            timelineData.push({
              'Opportunity ID': opportunity.opportunity_id,
              'Opportunity Name': opportunity.opportunity_name,
              'Account Name': opportunity.account_name,
              'Current Sales Stage': opportunity.current_sales_stage,
              'Security Clearance': opportunity.security_clearance,
              'TCV (Millions)': opportunity.tcv_millions,
              'Category': opportunity.category,
              'Decision Date': opportunity.decision_date,
              'Service Line': serviceLine,
              'Stage': stage.stage_name,
              'Stage Start Date': stage.stage_start_date,
              'Stage End Date': stage.stage_end_date,
              'Duration (Weeks)': stage.duration_weeks,
              'FTE Required': stage.fte_required,
              'Total Effort (Weeks)': stage.total_effort_weeks,
              'Resource Status': stage.resource_status,
              'Current/Future Activity': stage.is_current_future ? 'Yes' : 'No',
            });
          });
        });
      });
      return timelineData;

    case 'configuration-summary':
      const configData: any[] = [];
      
      // Add opportunity categories
      reportData.opportunity_categories?.forEach((category: any) => {
        configData.push({
          'Configuration Type': 'Opportunity Category',
          'Name': category.name,
          'Min TCV': category.min_tcv,
          'Max TCV': category.max_tcv || 'Unlimited',
          'Stage 01 Duration': category.stage_durations?.['01'] || 0,
          'Stage 02 Duration': category.stage_durations?.['02'] || 0,
          'Stage 03 Duration': category.stage_durations?.['03'] || 0,
          'Stage 04A Duration': category.stage_durations?.['04A'] || 0,
          'Stage 04B Duration': category.stage_durations?.['04B'] || 0,
          'Stage 05A Duration': category.stage_durations?.['05A'] || 0,
          'Stage 05B Duration': category.stage_durations?.['05B'] || 0,
          'Stage 06 Duration': category.stage_durations?.['06'] || 0,
          'Service Line': '',
          'Service Line Category': '',
          'FTE Required': '',
          'Total Effort Weeks': ''
        });
      });

      // Add service line categories
      reportData.service_line_categories?.forEach((slCategory: any) => {
        configData.push({
          'Configuration Type': 'Service Line Category',
          'Name': slCategory.name,
          'Min TCV': slCategory.min_tcv,
          'Max TCV': slCategory.max_tcv || 'Unlimited',
          'Stage 01 Duration': '',
          'Stage 02 Duration': '',
          'Stage 03 Duration': '',
          'Stage 04A Duration': '',
          'Stage 04B Duration': '',
          'Stage 05A Duration': '',
          'Stage 05B Duration': '',
          'Stage 06 Duration': '',
          'Service Line': slCategory.service_line,
          'Service Line Category': slCategory.name,
          'FTE Required': '',
          'Total Effort Weeks': ''
        });
      });

      // Add service line stage efforts (from the actual backend structure)
      Object.entries(reportData.stage_efforts || {}).forEach(([serviceLine, categories]: [string, any]) => {
        Object.entries(categories).forEach(([/*categoryKey*/, categoryData]: [string, any]) => {
          Object.entries(categoryData.stages || {}).forEach(([stage, stageData]: [string, any]) => {
            configData.push({
              'Configuration Type': 'Service Line Stage Effort',
              'Name': `${serviceLine} - Stage ${stage} - ${categoryData.category_name}`,
              'Min TCV': '',
              'Max TCV': '',
              'Stage 01 Duration': '',
              'Stage 02 Duration': '',
              'Stage 03 Duration': '',
              'Stage 04A Duration': '',
              'Stage 04B Duration': '',
              'Stage 05A Duration': '',
              'Stage 05B Duration': '',
              'Stage 06 Duration': '',
              'Service Line': serviceLine,
              'Service Line Category': categoryData.category_name,
              'FTE Required': stageData.fte_required,
              'Total Effort Weeks': ''
            });
          });
        });
      });

      // Add calculation examples  
      reportData.calculation_examples?.forEach((example: any, index: number) => {
        configData.push({
          'Configuration Type': 'Calculation Example',
          'Name': `Example ${index + 1}: ${example.opportunity_name}`,
          'Min TCV': '',
          'Max TCV': '',
          'Stage 01 Duration': '',
          'Stage 02 Duration': '',
          'Stage 03 Duration': '',
          'Stage 04A Duration': '',
          'Stage 04B Duration': '',
          'Stage 05A Duration': '',
          'Stage 05B Duration': '',
          'Stage 06 Duration': '',
          'Service Line': Object.keys(example.service_line_efforts || {}).join(', ') || '',
          'Service Line Category': example.timeline_category || '',
          'FTE Required': example.total_fte_hours ? (example.total_fte_hours / 40).toFixed(1) : '',
          'Total Effort Weeks': example.total_effort_weeks || ''
        });
      });

      return configData;

    default:
      return [];
  }
};

export const exportTimelineChartToPDF = (reportData: any, filename?: string) => {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - (2 * margin);
    // const usableHeight = pageHeight - (2 * margin);

    // Service line colors
    const serviceLineColors: {[key: string]: [number, number, number]} = {
      'MW': [95, 36, 159],     // DXC Purple
      'ITOC': [45, 212, 191],  // Teal
      'CES': [59, 130, 246],   // Blue
      'INS': [16, 185, 129],   // Green
      'BPS': [245, 158, 11],   // Orange
      'SEC': [249, 115, 22]    // Red-Orange
    };

    let yPosition = margin;
    
    // Title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Service Line Activity Timeline Report', margin, yPosition);
    yPosition += 15;

    // Date info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 10;

    // Calculate date range for timeline
    const getAllDates = () => {
      const dates: Date[] = [];
      reportData.timeline_data.forEach((opportunity: any) => {
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

    // Create month headers
    const months: Date[] = [];
    let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (currentMonth <= maxDate && months.length < 12) {
      months.push(new Date(currentMonth));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    const timelineStartX = margin + 85; // More space for opportunity names
    const timelineWidth = usableWidth - 85;
    const rowHeight = 35; // More height per opportunity

    // Header row
    yPosition += 5;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Opportunity column header
    pdf.text('Opportunity', margin, yPosition);
    
    // Month headers
    months.forEach((month, index) => {
      const monthX = timelineStartX + (index * timelineWidth / months.length);
      const monthText = month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      pdf.text(monthText, monthX + 5, yPosition);
    });
    
    // Draw header line
    yPosition += 3;
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Helper functions
    const getPositionFromDate = (date: Date) => {
      const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceMin = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      return (daysSinceMin / totalDays) * timelineWidth;
    };

    const getWidthFromDuration = (startDate: Date, endDate: Date) => {
      const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const stageDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max((stageDays / totalDays) * timelineWidth, 2);
    };

    // Calculate FTE range for height scaling
    let maxFTE = 0;
    let minFTE = Infinity;
    reportData.timeline_data.forEach((opportunity: any) => {
      Object.values(opportunity.service_lines).forEach((slData: any) => {
        slData.stages.forEach((stage: any) => {
          maxFTE = Math.max(maxFTE, stage.fte_required);
          minFTE = Math.min(minFTE, stage.fte_required);
        });
      });
    });

    // Function to calculate bar height based on FTE
    const getBarHeight = (fteRequired: number) => {
      if (maxFTE === minFTE) return 5; // Default height if all FTE are the same
      const minHeight = 2;
      const maxHeight = 8;
      const ratio = (fteRequired - minFTE) / (maxFTE - minFTE);
      return minHeight + (ratio * (maxHeight - minHeight));
    };

    // Draw opportunities - export all opportunities
    reportData.timeline_data.forEach((opportunity: any, oppIndex: number) => {
      // Check if we need a new page
      if (yPosition + rowHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin + 20; // Leave space for title
        
        // Repeat header on new page
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Opportunity', margin, yPosition);
        months.forEach((month, index) => {
          const monthX = timelineStartX + (index * timelineWidth / months.length);
          const monthText = month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          pdf.text(monthText, monthX + 5, yPosition);
        });
        yPosition += 3;
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 8;
      }

      // Create opportunity details section (left side)
      // const oppDetailsWidth = 75;
      
      // Opportunity name
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      const oppName = opportunity.opportunity_name.length > 30 
        ? `${opportunity.opportunity_name.substring(0, 27)}...` 
        : opportunity.opportunity_name;
      pdf.text(oppName, margin, yPosition + 6);
      
      // Account name
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      const accountName = opportunity.account_name?.length > 30 
        ? `${opportunity.account_name.substring(0, 27)}...` 
        : opportunity.account_name || '';
      pdf.text(accountName, margin, yPosition + 11);
      
      // Category and TCV
      pdf.text(`${opportunity.category} | $${opportunity.tcv_millions.toFixed(1)}M`, margin, yPosition + 16);
      
      // Security clearance and sales stage (if available)
      let detailsY = yPosition + 21;
      if (opportunity.security_clearance) {
        pdf.setFontSize(6);
        pdf.setTextColor(120, 50, 50);
        pdf.text(`Clearance: ${opportunity.security_clearance}`, margin, detailsY);
        detailsY += 4;
      }
      
      if (opportunity.current_sales_stage) {
        pdf.setFontSize(6);
        pdf.setTextColor(50, 100, 150);
        pdf.text(`Sales Stage: ${opportunity.current_sales_stage}`, margin, detailsY);
      }
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);

      // Draw vertical separator line
      pdf.setDrawColor(200, 200, 200);
      pdf.line(timelineStartX - 5, yPosition + 2, timelineStartX - 5, yPosition + rowHeight - 2);
      pdf.setDrawColor(0, 0, 0);

      // Draw service line tracks (right side)
      let serviceLineY = yPosition + 6;
      Object.entries(opportunity.service_lines).forEach(([serviceLine, slData]: [string, any]) => {
        // Service line label
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.text(serviceLine, timelineStartX - 20, serviceLineY + 4);

        // Track background with border (taller to accommodate variable heights)
        const trackHeight = 10;
        pdf.setFillColor(248, 248, 248);
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(timelineStartX, serviceLineY, timelineWidth, trackHeight, 'FD');

        // Draw stages with variable heights based on FTE
        slData.stages.forEach((stage: any) => {
          const startDate = new Date(stage.stage_start_date);
          const endDate = new Date(stage.stage_end_date);
          const stageX = timelineStartX + getPositionFromDate(startDate);
          const stageWidth = getWidthFromDuration(startDate, endDate);
          const barHeight = getBarHeight(stage.fte_required);
          const barY = serviceLineY + (trackHeight - barHeight) / 2; // Center vertically in track

          // Stage bar with proper opacity for past/future
          const color = serviceLineColors[serviceLine] || [107, 114, 128];
          if (stage.is_current_future) {
            pdf.setFillColor(color[0], color[1], color[2]);
          } else {
            // Lighter version for past activities
            pdf.setFillColor(
              Math.min(255, color[0] + 60),
              Math.min(255, color[1] + 60),
              Math.min(255, color[2] + 60)
            );
          }
          
          pdf.rect(stageX, barY, stageWidth, barHeight, 'F');

          // Stage label and FTE info (if there's space)
          if (stageWidth > 12) {
            pdf.setFontSize(5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(255, 255, 255);
            
            // Show stage name and FTE
            const stageText = stageWidth > 25 ? stage.stage_name : stage.stage_name.substring(0, 4);
            const fteText = `${stage.fte_required.toFixed(1)} FTE`;
            
            // Center the stage name in the bar
            const stageTextWidth = pdf.getTextWidth(stageText);
            const stageTextX = stageX + (stageWidth - stageTextWidth) / 2;
            
            if (barHeight > 5 && stageWidth > 20) {
              // Show both stage name and FTE if there's enough space
              pdf.text(stageText, stageTextX, barY + barHeight / 2 - 0.5);
              
              pdf.setFontSize(4);
              const fteTextWidth = pdf.getTextWidth(fteText);
              const fteTextX = stageX + (stageWidth - fteTextWidth) / 2;
              pdf.text(fteText, fteTextX, barY + barHeight / 2 + 1.5);
            } else if (stageWidth > 15) {
              // Show just stage name if space is limited
              pdf.text(stageText, stageTextX, barY + barHeight / 2 + 1);
            }
            
            pdf.setTextColor(0, 0, 0);
          }
          
          // Add FTE tooltip above the bar for very small bars
          if (stageWidth <= 12 && stageWidth > 6) {
            pdf.setFontSize(4);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`${stage.fte_required.toFixed(1)}`, stageX + 1, serviceLineY - 1);
            pdf.setTextColor(0, 0, 0);
          }
        });

        serviceLineY += 9;
      });

      yPosition += rowHeight;
      
      // Add separator line between opportunities (except for the last one)
      if (oppIndex < Math.min(reportData.timeline_data.length, 15) - 1) {
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        pdf.setDrawColor(0, 0, 0);
      }
    });

    // Add legend at bottom
    yPosition += 10;
    
    // Service line colors legend
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Service Lines:', margin, yPosition);
    
    let legendX = margin + 30;
    Object.entries(serviceLineColors).forEach(([serviceLine, color]) => {
      // Color box
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(legendX, yPosition - 3, 4, 4, 'F');
      
      // Label
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(serviceLine, legendX + 6, yPosition);
      
      legendX += 25;
    });

    // FTE height scale explanation
    yPosition += 8;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Bar Height represents FTE Requirements:', margin, yPosition);
    
    yPosition += 5;
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Taller bars = Higher FTE (Range: ${minFTE.toFixed(1)} - ${maxFTE.toFixed(1)} FTE)`, margin, yPosition);
    pdf.text('Lighter colors = Past activities, Darker colors = Current/Future activities', margin, yPosition + 4);
    
    // Visual FTE scale example
    const scaleStartX = pageWidth - margin - 100;
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FTE Scale:', scaleStartX, yPosition);
    
    // Show sample bars with different heights
    const sampleFTEs = [minFTE, (minFTE + maxFTE) / 2, maxFTE];
    let sampleX = scaleStartX + 25;
    
    sampleFTEs.forEach((fte, /*index*/) => {
      const sampleHeight = getBarHeight(fte);
      pdf.setFillColor(150, 150, 150);
      pdf.rect(sampleX, yPosition - 2 - sampleHeight, 8, sampleHeight, 'F');
      
      pdf.setFontSize(5);
      pdf.text(`${fte.toFixed(1)}`, sampleX + 1, yPosition + 2);
      
      sampleX += 15;
    });

    // Save the PDF
    const exportFilename = filename || `timeline_report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(exportFilename);
  } catch (error) {
    console.error('Error exporting timeline to PDF:', error);
    throw new Error('Failed to export timeline PDF');
  }
};

export const exportToHTML = (reportData: any, reportType: string, /*viewMode?: string*/) => {
  try {
    const timestamp = new Date().toLocaleString();
    const reportTitle = reportData.report_name || `${reportType.replace(/-/g, ' ')} Report`;
    
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #5F249F, #7C3AED);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #5F249F;
        }
        
        .card h3 {
            color: #5F249F;
            font-size: 2em;
            margin-bottom: 5px;
        }
        
        .card p {
            color: #666;
            font-size: 0.9em;
        }
        
        .timeline-container {
            overflow-x: auto;
            margin-bottom: 40px;
        }
        
        .timeline {
            min-width: 1000px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: white;
        }
        
        .timeline-header {
            display: flex;
            background: #f8f9fa;
            border-bottom: 2px solid #e0e0e0;
            font-weight: bold;
            padding: 15px 0;
        }
        
        .timeline-row {
            display: flex;
            border-bottom: 1px solid #f0f0f0;
            min-height: 80px;
            align-items: center;
        }
        
        .timeline-row:hover {
            background-color: #f8f9fa;
        }
        
        .timeline-row:last-child {
            border-bottom: none;
        }
        
        .opportunity-details {
            width: 300px;
            padding: 15px;
            border-right: 1px solid #e0e0e0;
            flex-shrink: 0;
        }
        
        .opportunity-name {
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 5px;
        }
        
        .opportunity-meta {
            font-size: 0.85em;
            color: #666;
            margin-bottom: 3px;
        }
        
        .badges {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 8px;
        }
        
        .badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 500;
        }
        
        .badge-category { background: #f3f4f6; color: #374151; }
        .badge-tcv { background: #dbeafe; color: #1e40af; }
        .badge-clearance-dv { background: #fee2e2; color: #991b1b; }
        .badge-clearance-sc { background: #fed7aa; color: #9a3412; }
        .badge-clearance-bpss { background: #fef3c7; color: #92400e; }
        .badge-stage { background: #dbeafe; color: #1e40af; }
        
        .timeline-chart {
            flex: 1;
            padding: 15px;
            position: relative;
        }
        
        .service-line-track {
            margin-bottom: 10px;
            position: relative;
        }
        
        .service-line-label {
            font-size: 0.8em;
            font-weight: bold;
            color: #666;
            margin-bottom: 3px;
        }
        
        .track-container {
            height: 24px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
        }
        
        .stage-bar {
            position: absolute;
            height: 100%;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.65em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .stage-bar:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .stage-bar.past {
            opacity: 0.6;
        }
        
        .legend {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .legend h3 {
            margin-bottom: 15px;
            color: #1f2937;
        }
        
        .legend-items {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #666;
            font-size: 0.9em;
        }
        
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .timeline-container { overflow: visible; }
            .timeline { min-width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${reportTitle}</h1>
            <p>Generated on ${timestamp}</p>
        </div>
        
        <div class="content">
`;

    // Add report-specific content
    if (reportType === 'service-line-activity-timeline') {
      htmlContent += generateTimelineHTML(reportData);
    } else {
      htmlContent += generateGenericReportHTML(reportData, reportType);
    }

    htmlContent += `
        </div>
        
        <div class="footer">
            <p>Generated by Resource Forecasting & Opportunity Tracker</p>
            <p>© ${new Date().getFullYear()} DXC Technology</p>
        </div>
    </div>

    <script>
        // Add interactivity
        document.addEventListener('DOMContentLoaded', function() {
            // Add tooltips to stage bars
            const stageBars = document.querySelectorAll('.stage-bar');
            stageBars.forEach(bar => {
                bar.addEventListener('mouseenter', function(e) {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'tooltip';
                    tooltip.innerHTML = this.getAttribute('data-tooltip');
                    tooltip.style.cssText = \`
                        position: absolute;
                        background: #333;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 4px;
                        font-size: 0.8em;
                        z-index: 1000;
                        pointer-events: none;
                        white-space: nowrap;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    \`;
                    document.body.appendChild(tooltip);
                    
                    const rect = this.getBoundingClientRect();
                    tooltip.style.left = rect.left + 'px';
                    tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
                });
                
                bar.addEventListener('mouseleave', function() {
                    const tooltip = document.querySelector('.tooltip');
                    if (tooltip) {
                        tooltip.remove();
                    }
                });
            });
        });
    </script>
</body>
</html>`;

    return htmlContent;
    
  } catch (error) {
    console.error('Error exporting to HTML:', error);
    throw new Error('Failed to export HTML file');
  }
};

const generateTimelineHTML = (reportData: any): string => {
  const serviceLineColors = {
    'MW': '#5F249F', 'ITOC': '#2DD4BF', 'CES': '#3B82F6',
    'INS': '#10B981', 'BPS': '#F59E0B', 'SEC': '#F97316'
  };

  let html = `
    <div class="summary-cards">
        <div class="card">
            <h3>${reportData.summary?.total_opportunities || 0}</h3>
            <p>Total Opportunities</p>
        </div>
        <div class="card">
            <h3>${reportData.summary?.total_service_line_activities || 0}</h3>
            <p>Service Line Activities</p>
        </div>
        <div class="card">
            <h3>${reportData.summary?.total_effort_weeks?.toFixed(1) || 0}</h3>
            <p>Total Effort (Weeks)</p>
        </div>
        <div class="card">
            <h3>${reportData.summary?.total_fte_required?.toFixed(1) || 0}</h3>
            <p>Total FTE Required</p>
        </div>
    </div>

    <div class="timeline-container">
        <div class="timeline">`;

  // Calculate date range for timeline positioning
  const getAllDates = () => {
    const dates: Date[] = [];
    reportData.timeline_data?.forEach((opportunity: any) => {
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
  if (allDates.length > 0) {
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    const getPositionFromDate = (date: Date) => {
      const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceMin = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      return (daysSinceMin / totalDays) * 100;
    };

    const getWidthFromDuration = (startDate: Date, endDate: Date) => {
      const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
      const stageDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max((stageDays / totalDays) * 100, 1);
    };

    // Timeline header with months
    const months: Date[] = [];
    let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (currentMonth <= maxDate && months.length < 12) {
      months.push(new Date(currentMonth));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    html += `
            <div class="timeline-header">
                <div class="opportunity-details">Opportunity Details</div>
                <div style="flex: 1; display: flex;">`;

    months.forEach(month => {
      html += `<div style="flex: 1; text-align: center; padding: 0 8px;">
                    ${month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </div>`;
    });

    html += `</div></div>`;

    // Timeline rows - export all opportunities
    reportData.timeline_data?.forEach((opportunity: any) => {
      html += `
            <div class="timeline-row">
                <div class="opportunity-details">
                    <div class="opportunity-name">${opportunity.opportunity_name}</div>
                    <div class="opportunity-meta">${opportunity.opportunity_id}</div>
                    <div class="opportunity-meta">${opportunity.account_name}</div>
                    <div class="badges">
                        <span class="badge badge-category">${opportunity.category}</span>
                        <span class="badge badge-tcv">$${opportunity.tcv_millions.toFixed(1)}M</span>`;

      if (opportunity.security_clearance) {
        const clearanceClass = `badge-clearance-${opportunity.security_clearance.toLowerCase()}`;
        html += `<span class="badge ${clearanceClass}">${opportunity.security_clearance}</span>`;
      }

      if (opportunity.current_sales_stage) {
        html += `<span class="badge badge-stage">Stage: ${opportunity.current_sales_stage}</span>`;
      }

      html += `</div></div><div class="timeline-chart">`;

      Object.entries(opportunity.service_lines).forEach(([serviceLine, slData]: [string, any]) => {
        html += `
                    <div class="service-line-track">
                        <div class="service-line-label">${serviceLine}</div>
                        <div class="track-container">`;

        slData.stages.forEach((stage: any) => {
          const startDate = new Date(stage.stage_start_date);
          const endDate = new Date(stage.stage_end_date);
          const left = getPositionFromDate(startDate);
          const width = getWidthFromDuration(startDate, endDate);
          const color = serviceLineColors[serviceLine as keyof typeof serviceLineColors] || '#6B7280';
          const pastClass = stage.is_current_future ? '' : ' past';

          html += `
                            <div class="stage-bar${pastClass}" 
                                 style="left: ${left}%; width: ${width}%; background-color: ${color};"
                                 data-tooltip="${stage.stage_name}<br/>${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}<br/>${stage.fte_required.toFixed(1)} FTE, ${stage.duration_weeks.toFixed(1)} weeks">
                                ${width > 15 ? stage.stage_name : stage.stage_name.substring(0, 3)}
                            </div>`;
        });

        html += `</div></div>`;
      });

      html += `</div></div>`;
    });
  }

  html += `</div></div>`;

  // Legend
  html += `
    <div class="legend">
        <h3>Legend</h3>
        <div class="legend-items">`;

  Object.entries(serviceLineColors).forEach(([serviceLine, color]) => {
    html += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${color};"></div>
                <span>${serviceLine}</span>
            </div>`;
  });

  html += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: #ccc; opacity: 0.6;"></div>
                <span>Past Activities</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: #5F249F;"></div>
                <span>Current/Future Activities</span>
            </div>
        </div>
    </div>`;

  return html;
};

const generateGenericReportHTML = (reportData: any, reportType: string): string => {
  if (reportType === 'configuration-summary') {
    return generateConfigurationHTML(reportData);
  }
  
  return `
    <div class="summary-cards">
        <div class="card">
            <h3>Report Data</h3>
            <p>${reportType.replace(/-/g, ' ')}</p>
        </div>
    </div>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <pre style="white-space: pre-wrap; font-family: monospace; font-size: 0.9em; color: #333;">
${JSON.stringify(reportData, null, 2)}
        </pre>
    </div>`;
};

const generateConfigurationHTML = (reportData: any): string => {
  const formatCurrencyMillions = (valueInMillions: number) => {
    return `$${valueInMillions.toFixed(1)}M`;
  };

  let html = `
    <!-- Configuration Statistics -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <h4 style="margin: 0 0 8px 0; color: #4B5563; font-size: 0.875rem;">Opportunity Categories</h4>
            <p style="margin: 0; color: #5F249F; font-size: 2rem; font-weight: bold;">
                ${reportData.configuration_statistics?.opportunity_categories_count || 0}
            </p>
        </div>
        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <h4 style="margin: 0 0 8px 0; color: #4B5563; font-size: 0.875rem;">Service Line Categories</h4>
            <p style="margin: 0; color: #5F249F; font-size: 2rem; font-weight: bold;">
                ${reportData.configuration_statistics?.service_line_categories_count || 0}
            </p>
        </div>
        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <h4 style="margin: 0 0 8px 0; color: #4B5563; font-size: 0.875rem;">Stage Efforts Configured</h4>
            <p style="margin: 0; color: #5F249F; font-size: 2rem; font-weight: bold;">
                ${reportData.configuration_statistics?.stage_efforts_configured || 0}
            </p>
        </div>
        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <h4 style="margin: 0 0 8px 0; color: #4B5563; font-size: 0.875rem;">Offering Thresholds</h4>
            <p style="margin: 0; color: #5F249F; font-size: 2rem; font-weight: bold;">
                ${reportData.configuration_statistics?.offering_thresholds_configured || 0}
            </p>
            <p style="margin: 4px 0 0 0; color: #6B7280; font-size: 0.75rem;">
                ${reportData.configuration_statistics?.service_lines_with_thresholds || 0} service lines
            </p>
        </div>
        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <h4 style="margin: 0 0 8px 0; color: #4B5563; font-size: 0.875rem;">Internal Service Mappings</h4>
            <p style="margin: 0; color: #5F249F; font-size: 2rem; font-weight: bold;">
                ${reportData.configuration_statistics?.internal_service_mappings_count || 0}
            </p>
            <p style="margin: 4px 0 0 0; color: #6B7280; font-size: 0.75rem;">
                ${reportData.configuration_statistics?.service_lines_with_mappings || 0} service lines
            </p>
        </div>
    </div>

    <!-- Opportunity Categories -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">Opportunity Categories (Timeline Durations)</h3>
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 0.875rem;">Categories determine stage durations based on total TCV</p>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                    <thead>
                        <tr style="background: #F9FAFB;">
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Category</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">TCV Range</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 01</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 02</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 03</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 04A</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 04B</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 05A</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 05B</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Stage 06</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB;">Total Weeks</th>
                        </tr>
                    </thead>
                    <tbody>`;
    
    reportData.opportunity_categories?.forEach((category: any) => {
      html += `
                        <tr style="border-bottom: 1px solid #F3F4F6;">
                            <td style="padding: 12px; font-weight: 500; color: #111827;">${category.name || ''}</td>
                            <td style="padding: 12px; color: #374151;">${category.tcv_range_display || 'N/A'}</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['01'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['02'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['03'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['04A'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['04B'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['05A'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['05B'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; color: #374151;">${category.stage_durations?.['06'] || 0}w</td>
                            <td style="padding: 12px; text-align: center; font-weight: 600; color: #5F249F;">${category.total_timeline_weeks || 0}w</td>
                        </tr>`;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Service Line Categories -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">Service Line Categories (FTE Requirements)</h3>
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 0.875rem;">Categories determine FTE requirements based on service line TCV</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">`;

    // Group by service line
    const groupedCategories = reportData.service_line_categories?.reduce((acc: any, cat: any) => {
      if (!acc[cat.service_line]) acc[cat.service_line] = [];
      acc[cat.service_line].push(cat);
      return acc;
    }, {}) || {};

    Object.entries(groupedCategories).forEach(([serviceLine, categories]: [string, any]) => {
      html += `
                <div style="background: #F9FAFB; border-radius: 8px; padding: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #5F249F; font-size: 1rem; font-weight: 600;">${serviceLine} Categories</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; font-size: 0.875rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #D1D5DB;">
                                    <th style="padding: 8px 0; text-align: left; font-weight: 600; color: #374151;">Category</th>
                                    <th style="padding: 8px 0; text-align: left; font-weight: 600; color: #374151;">TCV Range</th>
                                </tr>
                            </thead>
                            <tbody>`;
      
      categories.forEach((category: any) => {
        html += `
                                <tr style="border-bottom: 1px solid #E5E7EB;">
                                    <td style="padding: 8px 0; font-weight: 500; color: #111827;">${category.name || ''}</td>
                                    <td style="padding: 8px 0; color: #374151;">${category.tcv_range_display || 'N/A'}</td>
                                </tr>`;
      });
      
      html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
    });
    
    html += `
            </div>
        </div>
    </div>

    <!-- FTE Requirements by Stage -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">FTE Requirements by Stage</h3>
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 0.875rem;">FTE requirements for each service line category and sales stage</p>
            <div style="display: flex; flex-direction: column; gap: 24px;">`;

    Object.entries(reportData.stage_efforts || {}).forEach(([serviceLine, categories]: [string, any]) => {
      html += `
                <div style="background: #F9FAFB; border-radius: 8px; padding: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #5F249F; font-size: 1rem; font-weight: 600;">${serviceLine} FTE Requirements</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; font-size: 0.875rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #D1D5DB;">
                                    <th style="padding: 8px; text-align: left; font-weight: 600; color: #374151;">Category</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">01</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">02</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">03</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">04A</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">04B</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">05A</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">05B</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">06</th>
                                </tr>
                            </thead>
                            <tbody>`;
      
      Object.values(categories).forEach((category: any) => {
        html += `
                                <tr style="border-bottom: 1px solid #E5E7EB;">
                                    <td style="padding: 8px; font-weight: 500; color: #111827;">${category.category_name || ''}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['01']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['02']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['03']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['04A']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['04B']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['05A']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['05B']?.fte_required || 0}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${category.stages?.['06']?.fte_required || 0}</td>
                                </tr>`;
      });
      
      html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
    });
    
    html += `
            </div>
        </div>
    </div>`;

  // Offering Thresholds section
  if (reportData.offering_thresholds && Object.keys(reportData.offering_thresholds).length > 0) {
    html += `
    <!-- Offering Thresholds -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">Offering-Based Multipliers</h3>
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 0.875rem;">Dynamic FTE scaling based on unique offering counts per service line and stage</p>
            <div style="display: flex; flex-direction: column; gap: 24px;">`;

    Object.entries(reportData.offering_thresholds).forEach(([serviceLine, stages]: [string, any]) => {
      html += `
                <div style="background: #F9FAFB; border-radius: 8px; padding: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #5F249F; font-size: 1rem; font-weight: 600;">${serviceLine} Offering Thresholds</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; font-size: 0.875rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #D1D5DB;">
                                    <th style="padding: 8px; text-align: left; font-weight: 600; color: #374151;">Sales Stage</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">Threshold Count</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; color: #374151;">Increment Multiplier</th>
                                    <th style="padding: 8px; text-align: left; font-weight: 600; color: #374151;">Example Calculation</th>
                                </tr>
                            </thead>
                            <tbody>`;
      
      Object.entries(stages).forEach(([stage, thresholdData]: [string, any]) => {
        const exampleMultiplier = (1.0 + 3 * thresholdData.increment_multiplier).toFixed(2);
        html += `
                                <tr style="border-bottom: 1px solid #E5E7EB;">
                                    <td style="padding: 8px; font-weight: 500; color: #111827;">Stage ${stage}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${thresholdData.threshold_count}</td>
                                    <td style="padding: 8px; text-align: center; color: #374151;">${thresholdData.increment_multiplier}</td>
                                    <td style="padding: 8px; color: #6B7280; font-size: 0.75rem;">
                                        If ${thresholdData.threshold_count + 3} offerings: Base FTE × (1.0 + 3 × ${thresholdData.increment_multiplier}) = Base FTE × ${exampleMultiplier}
                                    </td>
                                </tr>`;
      });
      
      html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
    });
    
    html += `
            </div>
        </div>
    </div>`;
  }

  // Internal Service Mappings section
  if (reportData.internal_service_mappings && Object.keys(reportData.internal_service_mappings).length > 0) {
    html += `
    <!-- Internal Service Mappings -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">Internal Service Mappings</h3>
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 0.875rem;">Which opportunity line item internal services count for offering threshold calculations</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">`;

    Object.entries(reportData.internal_service_mappings).forEach(([serviceLine, mappings]: [string, any]) => {
      html += `
                <div style="background: #F9FAFB; border-radius: 8px; padding: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #5F249F; font-size: 1rem; font-weight: 600;">${serviceLine} Internal Services</h4>
                    <p style="margin: 0 0 12px 0; color: #6B7280; font-size: 0.75rem;">
                        Only opportunity line items with these internal service values are counted for offering thresholds:
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 8px;">`;
      
      mappings.forEach((mapping: string, _index: number) => {
        html += `
                        <div style="display: flex; align-items: center;">
                            <div style="width: 8px; height: 8px; background: #5F249F; border-radius: 50%; margin-right: 12px;"></div>
                            <span style="font-size: 0.875rem; font-family: monospace; background: white; padding: 4px 8px; border-radius: 4px; border: 1px solid #E5E7EB;">
                                ${mapping}
                            </span>
                        </div>`;
      });
      
      html += `
                    </div>
                    <div style="margin-top: 12px; padding: 8px; background: #DBEAFE; border-radius: 4px; border-left: 4px solid #3B82F6;">
                        <p style="margin: 0; color: #1E40AF; font-size: 0.75rem;">
                            <strong>Total mappings:</strong> ${mappings.length} internal service values
                        </p>
                    </div>
                </div>`;
    });
    
    html += `
            </div>
        </div>
    </div>`;
  }

  // Real Calculation Examples
  if (reportData.calculation_examples?.length > 0) {
    html += `
    <!-- Real Calculation Examples -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">Real Calculation Examples</h3>
            <p style="margin: 0 0 16px 0; color: #6B7280; font-size: 0.875rem;">Examples using actual opportunity data to demonstrate how configurations are applied</p>
            <div style="display: flex; flex-direction: column; gap: 16px;">`;
    
    reportData.calculation_examples.forEach((example: any, _index: number) => {
      html += `
                <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #F9FAFB;">
                    <!-- Header with opportunity info and calculation method -->
                    <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #D1D5DB;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                            <div>
                                <h4 style="margin: 0 0 4px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">${example.opportunity_name || 'Unknown'}</h4>
                                <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 0.875rem;">${example.opportunity_id || ''}</p>
                                <p style="margin: 0; color: #374151; font-size: 0.875rem; font-weight: 500;">${example.account_name || 'Unknown Account'}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.125rem; font-weight: bold; color: #5F249F; margin-bottom: 4px;">${formatCurrencyMillions(example.tcv_millions || 0)} TCV</div>
                                <div style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; ${
                                  example.calculation_method === 'lead_offering_fallback' 
                                    ? 'background: #FEF3C7; color: #92400E;' 
                                    : 'background: #D1FAE5; color: #065F46;'
                                }">
                                    ${example.calculation_method === 'lead_offering_fallback' ? 'Lead Offering Method' : 'Service Line TCV Method'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Calculation Explanation -->
                    <div style="margin-bottom: 16px;">
                        <h5 style="margin: 0 0 8px 0; color: #4B5563; font-weight: 500;">Calculation Flow</h5>
                        <div style="background: #EBF8FF; border-radius: 8px; padding: 12px;">
                            <ol style="margin: 0; padding-left: 16px; color: #1E40AF; font-size: 0.875rem; line-height: 1.5;">`;

      example.calculation_explanation?.forEach((step: string, stepIndex: number) => {
        html += `
                                <li style="margin-bottom: 4px;">
                                    <span style="font-weight: bold; color: #1D4ED8;">${stepIndex + 1}.</span> ${step}
                                </li>`;
      });

      html += `
                            </ol>
                        </div>
                    </div>

                    <!-- Input Data and Configuration Applied -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 16px;">
                        <!-- Input Data -->
                        <div>
                            <h5 style="margin: 0 0 8px 0; color: #4B5563; font-weight: 500;">Input Data</h5>
                            <div style="background: white; border-radius: 8px; padding: 12px; font-size: 0.875rem;">
                                <div style="margin-bottom: 8px;"><strong>Current Stage:</strong> ${example.current_stage || 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Decision Date:</strong> ${example.decision_date ? new Date(example.decision_date).toLocaleDateString() : 'N/A'}</div>
                                <div style="margin-bottom: 8px;"><strong>Timeline Category:</strong> ${example.timeline_category || 'N/A'}</div>
                                ${example.lead_offering_l1 ? `<div style="margin-bottom: 8px;"><strong>Lead Offering:</strong> ${example.lead_offering_l1}</div>` : ''}
                                <div style="padding-top: 8px; border-top: 1px solid #E5E7EB;">
                                    <strong>Service Line TCV Breakdown:</strong>
                                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; margin-top: 4px; font-size: 0.75rem;">`;

      Object.entries(example.service_line_tcv_breakdown || {}).forEach(([sl, tcv]: [string, any]) => {
        html += `
                                        <div style="${tcv > 0 ? 'font-weight: 500; color: #5F249F;' : 'color: #6B7280;'}">
                                            ${sl.toUpperCase()}: ${formatCurrencyMillions(tcv || 0)}
                                        </div>`;
      });

      html += `
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Configuration Applied -->
                        <div>
                            <h5 style="margin: 0 0 8px 0; color: #4B5563; font-weight: 500;">Configuration Applied</h5>
                            <div style="background: white; border-radius: 8px; padding: 12px; font-size: 0.875rem;">
                                <div style="margin-bottom: 8px;"><strong>Remaining Stages:</strong> ${example.remaining_stages?.join(', ') || 'N/A'}</div>`;

      Object.entries(example.service_line_categories || {}).forEach(([sl, config]: [string, any]) => {
        html += `
                                <div style="padding-top: 8px; border-top: 1px solid #E5E7EB; margin-top: 8px;">
                                    <div style="font-weight: 500; color: #5F249F; margin-bottom: 4px;">${sl} Service Line</div>
                                    <div>Resource Category: ${config.resource_category || 'N/A'}</div>
                                    <div>Service Line TCV: ${formatCurrencyMillions(config.service_line_tcv || 0)}</div>
                                </div>`;
      });

      html += `
                            </div>
                        </div>
                    </div>`;

      // Detailed Stage Breakdown
      if (example.detailed_stage_breakdown && Object.keys(example.detailed_stage_breakdown).length > 0) {
        html += `
                    <!-- Detailed Stage Calculations -->
                    <div style="margin-bottom: 16px;">
                        <h5 style="margin: 0 0 8px 0; color: #4B5563; font-weight: 500;">Detailed Stage Calculations</h5>`;

        Object.entries(example.detailed_stage_breakdown).forEach(([sl, stages]: [string, any]) => {
          html += `
                        <div style="margin-bottom: 12px;">
                            <h6 style="margin: 0 0 8px 0; color: #5F249F; font-weight: 500;">${sl} Timeline</h6>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; font-size: 0.75rem; border: 1px solid #D1D5DB; border-radius: 4px; overflow: hidden;">
                                    <thead style="background: #F3F4F6;">
                                        <tr>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: left; font-weight: 600;">Stage</th>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: left; font-weight: 600;">Start Date</th>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: left; font-weight: 600;">End Date</th>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: right; font-weight: 600;">Duration (weeks)</th>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: right; font-weight: 600;">FTE</th>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: right; font-weight: 600;">Effort (weeks)</th>
                                            <th style="border: 1px solid #D1D5DB; padding: 8px; text-align: left; font-weight: 600;">Resource Category</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;

          stages?.forEach((stage: any) => {
            html += `
                                        <tr style="background: white;">
                                            <td style="border: 1px solid #D1D5DB; padding: 8px; font-weight: 500;">${stage.stage_code || 'N/A'}</td>
                                            <td style="border: 1px solid #D1D5DB; padding: 8px;">${stage.stage_start_date ? new Date(stage.stage_start_date).toLocaleDateString() : 'N/A'}</td>
                                            <td style="border: 1px solid #D1D5DB; padding: 8px;">${stage.stage_end_date ? new Date(stage.stage_end_date).toLocaleDateString() : 'N/A'}</td>
                                            <td style="border: 1px solid #D1D5DB; padding: 8px; text-align: right;">${stage.duration_weeks || 0}</td>
                                            <td style="border: 1px solid #D1D5DB; padding: 8px; text-align: right;">${stage.fte_required || 0}</td>
                                            <td style="border: 1px solid #D1D5DB; padding: 8px; text-align: right; font-weight: 500; color: #5F249F;">${stage.total_effort_weeks || 0}</td>
                                            <td style="border: 1px solid #D1D5DB; padding: 8px;">${stage.resource_category_used || 'N/A'}</td>
                                        </tr>`;
          });

          html += `
                                    </tbody>
                                </table>
                            </div>

                            <!-- Timeline Chart -->
                            ${generateTimelineChart(sl, stages)}
                        </div>`;
        });

        html += `
                    </div>`;
      }

      // Results Summary
      html += `
                    <!-- Final Results -->
                    <div style="padding-top: 12px; border-top: 1px solid #D1D5DB;">
                        <h5 style="margin: 0 0 8px 0; color: #4B5563; font-weight: 500;">Final Results</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                            <div style="background: #5F249F; color: white; border-radius: 6px; padding: 12px; text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 4px;">${(example.total_effort_weeks || 0).toFixed(1)}</div>
                                <div style="font-size: 0.875rem;">Total Effort Weeks</div>
                            </div>
                            <div style="background: #2563EB; color: white; border-radius: 6px; padding: 12px; text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 4px;">${(example.total_fte_hours || 0).toFixed(0)}</div>
                                <div style="font-size: 0.875rem;">Total Hours</div>
                            </div>
                            <div style="background: #059669; color: white; border-radius: 6px; padding: 12px; text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 4px;">${Object.keys(example.service_line_efforts || {}).length}</div>
                                <div style="font-size: 0.875rem;">Service Lines</div>
                            </div>
                        </div>`;

      if (example.service_line_efforts && Object.keys(example.service_line_efforts).length > 0) {
        html += `
                        <div style="margin-top: 12px;">
                            <div style="font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 4px;">Effort by Service Line:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">`;

        Object.entries(example.service_line_efforts).forEach(([sl, effort]: [string, any]) => {
          html += `
                                <span style="display: inline-block; background: #E5E7EB; color: #374151; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">
                                    ${sl}: ${(effort || 0).toFixed(1)} weeks
                                </span>`;
        });

        html += `
                            </div>
                        </div>`;
      }

      html += `
                    </div>
                </div>`;
    });
    
    html += `
            </div>
        </div>
    </div>`;
  }

  // Configuration Notes
  if (reportData.notes?.length > 0) {
    html += `
    <!-- Configuration Notes -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden;">
        <div style="padding: 24px;">
            <h3 style="margin: 0 0 16px 0; color: #4B5563; font-size: 1.125rem; font-weight: 600;">Configuration Notes</h3>
            <div style="background: #EBF8FF; border-radius: 8px; padding: 16px;">
                <ul style="margin: 0; padding-left: 16px; color: #1E40AF; font-size: 0.875rem; line-height: 1.6;">`;

    reportData.notes.forEach((note: string) => {
      html += `
                    <li style="margin-bottom: 8px;">${note}</li>`;
    });

    html += `
                </ul>
            </div>
            
            <!-- Enhanced Features Section -->
            <div style="margin-top: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #14532D; font-size: 1rem; font-weight: 600;">Advanced Calculation Features</h4>
                <div style="background: #F0FDF4; border-radius: 8px; padding: 16px;">
                    <ul style="margin: 0; padding-left: 16px; color: #15803D; font-size: 0.875rem; line-height: 1.6;">
                        <li style="margin-bottom: 8px;"><strong>Offering-Based Multipliers:</strong> FTE scales dynamically based on unique offering counts</li>
                        <li style="margin-bottom: 8px;"><strong>Internal Service Filtering:</strong> Only mapped internal services count for threshold calculations</li>
                        <li style="margin-bottom: 8px;"><strong>Dual Category System:</strong> Timeline categories (total TCV) vs Resource categories (service line TCV)</li>
                        <li style="margin-bottom: 8px;"><strong>Backward Timeline Calculation:</strong> Works backwards from decision date through remaining stages</li>
                    </ul>
                </div>
            </div>
            
            <!-- Calculation Formula -->
            <div style="margin-top: 24px; background: #F9FAFB; border-radius: 8px; padding: 16px; border-left: 4px solid #5F249F;">
                <h4 style="margin: 0 0 12px 0; color: #5F249F; font-size: 1rem; font-weight: 600;">Core Calculation Formula</h4>
                <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.875rem;">
                    <div style="font-family: monospace; background: white; padding: 12px; border-radius: 4px; border: 1px solid #E5E7EB;">
                        <div style="color: #374151;">
                            <strong>Final FTE</strong> = Base FTE × Offering Multiplier
                        </div>
                        <div style="color: #6B7280; margin-top: 4px;">
                            Where: <strong>Offering Multiplier</strong> = 1.0 + (excess_offerings × increment_multiplier)
                        </div>
                    </div>
                    <div style="font-family: monospace; background: white; padding: 12px; border-radius: 4px; border: 1px solid #E5E7EB;">
                        <div style="color: #374151;">
                            <strong>Total Effort</strong> = Final FTE × Stage Duration (weeks)
                        </div>
                        <div style="color: #6B7280; margin-top: 4px;">
                            <strong>Total Hours</strong> = Total Effort × 40 hours/week
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
  }

  return html;
};

// Helper function to generate timeline chart HTML
const generateTimelineChart = (serviceLine: string, stages: any[]): string => {
  if (!stages || stages.length === 0) return '';

  // Calculate date range
  const startDates = stages.map(s => new Date(s.stage_start_date)).filter(d => !isNaN(d.getTime()));
  const endDates = stages.map(s => new Date(s.stage_end_date)).filter(d => !isNaN(d.getTime()));
  
  if (startDates.length === 0 || endDates.length === 0) return '';

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

  const stageColors: {[key: string]: string} = {
    '01': '#3B82F6', '02': '#10B981', '03': '#F59E0B', '04A': '#EF4444', 
    '04B': '#8B5CF6', '05A': '#06B6D4', '05B': '#84CC16', '06': '#F97316'
  };

  let html = `
            <!-- Timeline Chart -->
            <div style="margin-top: 12px; background: white; border-radius: 8px; border: 1px solid #E5E7EB; padding: 12px;">
                <h6 style="margin: 0 0 12px 0; color: #374151; font-weight: 500;">${serviceLine} Timeline (${showMonths ? 'Monthly' : 'Weekly'} View)</h6>
                
                <!-- Time markers header -->
                <div style="position: relative; margin-bottom: 8px; height: 32px; border-bottom: 1px solid #E5E7EB;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 100%;">`;

  timeMarkers.forEach((marker, /*index*/) => {
    const position = getPositionFromDate(marker);
    html += `
                        <div style="position: absolute; left: ${position}%; top: 0; transform: translateX(-50%); font-size: 0.75rem; color: #6B7280;">
                            <div style="border-left: 1px solid #D1D5DB; height: 16px;"></div>
                            <div style="margin-top: 4px; white-space: nowrap;">
                                ${showMonths 
                                  ? marker.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                                  : `W${Math.ceil((marker.getTime() - minDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}`
                                }
                            </div>
                        </div>`;
  });

  html += `
                    </div>
                </div>

                <!-- Timeline bars -->
                <div style="position: relative; height: 32px; background: #F9FAFB; border-radius: 4px; border: 1px solid #E5E7EB;">`;

  stages.forEach((stage, /*index*/) => {
    const startDate = new Date(stage.stage_start_date);
    const endDate = new Date(stage.stage_end_date);
    const left = getPositionFromDate(startDate);
    const width = getWidthFromDuration(startDate, endDate);
    const color = stageColors[stage.stage_code] || '#6B7280';
    
    html += `
                    <div style="position: absolute; top: 4px; left: ${left}%; width: ${width}%; height: 24px; background: ${color}; border-radius: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 500; min-width: 20px;" title="${stage.stage_code}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()} (${stage.duration_weeks}w, ${stage.fte_required} FTE)">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px;">
                            ${width > 8 ? stage.stage_code : stage.stage_code.substring(0, 2)}
                        </span>
                    </div>`;
  });

  html += `
                </div>

                <!-- Legend -->
                <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.75rem;">`;

  stages.forEach((stage, /*index*/) => {
    const color = stageColors[stage.stage_code] || '#6B7280';
    html += `
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <div style="width: 12px; height: 12px; background: ${color}; border-radius: 2px;"></div>
                        <span>${stage.stage_code}: ${stage.duration_weeks}w, ${stage.fte_required} FTE</span>
                    </div>`;
  });

  html += `
                </div>
            </div>`;

  return html;
};

// Helper function to render timeline charts in PDF
const renderPDFTimelineChart = (
  pdf: any,
  stages: any[],
  marginX: number,
  startY: number,
  chartWidth: number,
  serviceLine: string
): number => {
  if (!stages || stages.length === 0) return startY;

  // Stage colors matching the web app
  const stageColors: {[key: string]: [number, number, number]} = {
    '01': [59, 130, 246],   // Blue
    '02': [16, 185, 129],   // Green
    '03': [245, 158, 11],   // Orange
    '04A': [239, 68, 68],   // Red
    '04B': [139, 92, 246],  // Purple
    '05A': [6, 182, 212],   // Cyan
    '05B': [132, 204, 22],  // Lime
    '06': [249, 115, 22]    // Orange-Red
  };

  // Calculate date range
  const startDates = stages.map(s => new Date(s.stage_start_date)).filter(d => !isNaN(d.getTime()));
  const endDates = stages.map(s => new Date(s.stage_end_date)).filter(d => !isNaN(d.getTime()));
  
  if (startDates.length === 0 || endDates.length === 0) return startY;

  const minDate = new Date(Math.min(...startDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...endDates.map(d => d.getTime())));
  
  // Calculate total duration
  const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
  const totalWeeks = Math.ceil(totalDays / 7);
  
  // Determine if we should show months or weeks
  const showMonths = totalWeeks > 16;
  
  // Chart dimensions - increased for better visibility
  const chartHeight = Math.max(30, stages.length * 8 + 15); // Dynamic height based on stage count
  const timelineBarHeight = 6;
  const stageTrackHeight = 8; // Height per stage track
  
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

  // Helper functions
  const getPositionFromDate = (date: Date) => {
    const totalDuration = maxDate.getTime() - minDate.getTime();
    const datePosition = date.getTime() - minDate.getTime();
    return Math.max(0, Math.min(1, datePosition / totalDuration));
  };

  const getWidthFromDuration = (startDate: Date, endDate: Date) => {
    const totalDuration = maxDate.getTime() - minDate.getTime();
    const stageDuration = endDate.getTime() - startDate.getTime();
    return Math.max(0.02, Math.min(1, stageDuration / totalDuration));
  };

  // Draw chart background with better styling
  pdf.setFillColor(249, 250, 251);
  pdf.setDrawColor(209, 213, 219);
  pdf.setLineWidth(0.5);
  pdf.rect(marginX, startY, chartWidth, chartHeight, 'FD');
  
  // Add chart title background
  pdf.setFillColor(243, 244, 246);
  pdf.rect(marginX, startY, chartWidth, 12, 'F');
  
  // Add chart title
  pdf.setFontSize(6);  
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(75, 85, 99);
  pdf.text(`${serviceLine} Timeline`, marginX + 2, startY + 7);

  // Draw time markers below title
  const markerY = startY + 14;
  pdf.setFontSize(5);
  pdf.setTextColor(107, 114, 128);
  
  timeMarkers.forEach((marker) => {
    const position = getPositionFromDate(marker);
    const xPos = marginX + (position * chartWidth);
    
    // Draw marker line from marker area to bottom of chart
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(xPos, markerY + 6, xPos, startY + chartHeight - 8);
    
    // Draw marker text
    const markerText = showMonths 
      ? marker.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      : `W${Math.ceil((marker.getTime() - minDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}`;
    
    const textWidth = pdf.getTextWidth(markerText);
    pdf.text(markerText, Math.max(marginX + 1, Math.min(marginX + chartWidth - textWidth - 1, xPos - textWidth/2)), markerY + 4);
  });

  // Draw timeline bars with proper spacing
  const barStartY = startY + 22; // Start below time markers and title
  stages.forEach((stage, index) => {
    const startDate = new Date(stage.stage_start_date);
    const endDate = new Date(stage.stage_end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
    
    const leftPosition = getPositionFromDate(startDate);
    const width = getWidthFromDuration(startDate, endDate);
    
    const barX = marginX + (leftPosition * chartWidth);
    const barWidth = Math.max(3, width * chartWidth); // Minimum 3mm width
    const barY = barStartY + (index * stageTrackHeight);
    
    // Get stage color
    const color = stageColors[stage.stage_code] || [107, 114, 128];
    
    // Draw stage bar with rounded corners effect
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.rect(barX, barY, barWidth, timelineBarHeight, 'F');
    
    // Add stage label - always show stage code
    pdf.setFontSize(5);
    pdf.setTextColor(255, 255, 255);
    const stageLabel = stage.stage_code || '';
    const labelWidth = pdf.getTextWidth(stageLabel);
    
    // Position label in center of bar, or to the right if bar is too narrow
    if (barWidth > labelWidth + 2) {
      pdf.text(stageLabel, barX + (barWidth/2) - (labelWidth/2), barY + 4);
    } else {
      pdf.setTextColor(0, 0, 0);
      pdf.text(stageLabel, barX + barWidth + 2, barY + 4);
    }
    
    // Add stage details to the left
    pdf.setFontSize(5);
    pdf.setTextColor(75, 85, 99);
    const stageInfo = `${stage.stage_code}: ${stage.fte_required || 0} FTE, ${stage.total_effort_weeks || 0}w`;
    const maxLabelWidth = 25; // Maximum width for stage info
    if (marginX > 25) {
      pdf.text(stageInfo.substring(0, 15) + '...', marginX - maxLabelWidth, barY + 4);
    }
  });

  // Add improved legend at the bottom
  const legendY = startY + chartHeight + 2;
  pdf.setFontSize(6);
  pdf.setTextColor(75, 85, 99);
  
  // Timeline title
  const titleText = `${serviceLine} Timeline (${showMonths ? 'Monthly' : 'Weekly'} View)`;
  pdf.text(titleText, marginX, legendY);
  
  // Add total duration info
  const durationText = `Duration: ${totalWeeks} weeks | Stages: ${stages.length}`;
  pdf.setFontSize(5);
  pdf.setTextColor(107, 114, 128);
  pdf.text(durationText, marginX, legendY + 4);
  
  // Add stage color legend if we have multiple stages
  if (stages.length > 1) {
    const legendStartY = legendY + 8;
    pdf.setFontSize(4);
    pdf.setTextColor(75, 85, 99);
    pdf.text('Stage Colors:', marginX, legendStartY);
    
    let legendX = marginX;
    const uniqueStages = [...new Set(stages.map(s => s.stage_code))];
    uniqueStages.slice(0, 4).forEach((stageCode, index) => { // Show max 4 stages in legend
      const color = stageColors[stageCode] || [107, 114, 128];
      const legendItemX = legendX + (index * 25);
      
      // Draw color square
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(legendItemX, legendStartY + 2, 3, 3, 'F');
      
      // Add stage label
      pdf.setTextColor(75, 85, 99);
      pdf.text(stageCode, legendItemX + 4, legendStartY + 4);
    });
    
    return legendStartY + 8;
  }

  return legendY + 8;
};

export const exportConfigurationToPDF = (reportData: any, filename?: string) => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - (2 * margin);
    let yPosition = margin;

    // Helper functions
    const formatCurrencyMillions = (valueInMillions: number) => {
      return `$${valueInMillions.toFixed(1)}M`;
    };

    const addNewPageIfNeeded = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    const addSectionTitle = (title: string) => {
      addNewPageIfNeeded(15);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(95, 36, 159); // DXC Purple
      pdf.text(title, margin, yPosition);
      yPosition += 8;
    };

    const addSubtitle = (subtitle: string) => {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(75, 85, 99);
      pdf.text(subtitle, margin, yPosition);
      yPosition += 6;
    };

    // Title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(95, 36, 159);
    pdf.text('Configuration Summary Report', margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 15;

    // Configuration Statistics Cards
    addSectionTitle('Configuration Overview');
    
    const stats = [
      { label: 'Opportunity Categories', value: reportData.configuration_statistics?.opportunity_categories_count || 0 },
      { label: 'Service Line Categories', value: reportData.configuration_statistics?.service_line_categories_count || 0 },
      { label: 'Stage Efforts Configured', value: reportData.configuration_statistics?.stage_efforts_configured || 0 },
      { label: 'Offering Thresholds', value: reportData.configuration_statistics?.offering_thresholds_configured || 0 },
      { label: 'Internal Service Mappings', value: reportData.configuration_statistics?.internal_service_mappings_count || 0 }
    ];

    const cardsPerRow = 3;
    const cardWidth = (usableWidth - ((cardsPerRow - 1) * 4)) / cardsPerRow;
    const cardHeight = 20;

    stats.forEach((stat, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const cardX = margin + (col * (cardWidth + 4));
      const cardY = yPosition + (row * (cardHeight + 4));
      
      // Card with border
      pdf.setFillColor(249, 250, 251);
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.5);
      pdf.rect(cardX, cardY, cardWidth, cardHeight, 'FD');
      
      // Label
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(75, 85, 99);
      const labelLines = pdf.splitTextToSize(stat.label, cardWidth - 4);
      pdf.text(labelLines, cardX + 2, cardY + 6);
      
      // Value
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(95, 36, 159);
      pdf.text(String(stat.value), cardX + 2, cardY + 15);
    });
    
    pdf.setTextColor(0, 0, 0);
    const totalRows = Math.ceil(stats.length / cardsPerRow);
    yPosition += (totalRows * (cardHeight + 4)) + 15;

    // Opportunity Categories Complete Table
    if (reportData.opportunity_categories?.length > 0) {
      addSectionTitle('Opportunity Categories (Timeline Durations)');
      addSubtitle('Categories determine stage durations based on total TCV');

      // Complete table with all stages
      const headers = ['Category', 'TCV Range', '01', '02', '03', '04A', '04B', '05A', '05B', '06', 'Total'];
      const colWidths = [25, 25, 12, 12, 12, 12, 12, 12, 12, 12, 15];
      const rowHeight = 6;

      // Header
      addNewPageIfNeeded(rowHeight);
      pdf.setFillColor(95, 36, 159);
      pdf.rect(margin, yPosition, usableWidth, rowHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);

      let xPos = margin;
      headers.forEach((header, index) => {
        if (index < 2) {
          pdf.text(header, xPos + 1, yPosition + 4);
        } else {
          const textWidth = pdf.getTextWidth(header);
          pdf.text(header, xPos + colWidths[index]/2 - textWidth/2, yPosition + 4);
        }
        xPos += colWidths[index];
      });
      yPosition += rowHeight;

      // Data rows
      reportData.opportunity_categories.forEach((category: any, rowIndex: number) => {
        addNewPageIfNeeded(rowHeight);

        if (rowIndex % 2 === 1) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, yPosition, usableWidth, rowHeight, 'F');
        }

        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);

        xPos = margin;
        const rowData = [
          category.name || '',
          category.tcv_range_display || 'N/A',
          `${category.stage_durations?.['01'] || 0}w`,
          `${category.stage_durations?.['02'] || 0}w`,
          `${category.stage_durations?.['03'] || 0}w`,
          `${category.stage_durations?.['04A'] || 0}w`,
          `${category.stage_durations?.['04B'] || 0}w`,
          `${category.stage_durations?.['05A'] || 0}w`,
          `${category.stage_durations?.['05B'] || 0}w`,
          `${category.stage_durations?.['06'] || 0}w`,
          `${category.total_timeline_weeks || 0}w`
        ];

        rowData.forEach((data, index) => {
          if (index < 2) {
            if (index === 0) pdf.setFont('helvetica', 'bold');
            pdf.text(data, xPos + 1, yPosition + 4);
          } else {
            if (index === rowData.length - 1) {
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(95, 36, 159);
            }
            const textWidth = pdf.getTextWidth(data);
            pdf.text(data, xPos + colWidths[index]/2 - textWidth/2, yPosition + 4);
          }
          xPos += colWidths[index];
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
        });

        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPosition + rowHeight, pageWidth - margin, yPosition + rowHeight);
        yPosition += rowHeight;
      });
      yPosition += 10;
    }

    // Service Line Categories Section
    if (reportData.service_line_categories?.length > 0) {
      addSectionTitle('Service Line Categories (FTE Requirements)');
      addSubtitle('Categories determine FTE requirements based on service line TCV');

      const groupedCategories = reportData.service_line_categories.reduce((acc: any, cat: any) => {
        if (!acc[cat.service_line]) acc[cat.service_line] = [];
        acc[cat.service_line].push(cat);
        return acc;
      }, {});

      Object.entries(groupedCategories).forEach(([serviceLine, categories]: [string, any]) => {
        addNewPageIfNeeded(30);

        // Service line header
        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, yPosition, usableWidth, 8, 'FD');
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(95, 36, 159);
        pdf.text(`${serviceLine} Categories`, margin + 3, yPosition + 5);
        yPosition += 10;

        // Categories table header
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Category', margin + 3, yPosition);
        pdf.text('TCV Range', margin + 80, yPosition);
        yPosition += 5;

        // Categories rows
        categories.forEach((category: any, index: number) => {
          if (index % 2 === 1) {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(margin + 3, yPosition - 1, usableWidth - 6, 5, 'F');
          }
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(category.name || 'Unknown', margin + 5, yPosition + 2);
          
          pdf.setFont('helvetica', 'normal');
          pdf.text(category.tcv_range_display || 'N/A', margin + 80, yPosition + 2);
          
          yPosition += 4;
        });
        yPosition += 8;
      });
    }

    // FTE Requirements by Stage Section (COMPLETE)
    if (reportData.stage_efforts && Object.keys(reportData.stage_efforts).length > 0) {
      addSectionTitle('FTE Requirements by Stage');
      addSubtitle('FTE requirements for each service line category and sales stage');

      Object.entries(reportData.stage_efforts).forEach(([serviceLine, categories]: [string, any]) => {
        addNewPageIfNeeded(60);

        // Service line header
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(95, 36, 159);
        pdf.text(`${serviceLine} FTE Requirements`, margin, yPosition);
        yPosition += 8;

        // FTE table
        const fteHeaders = ['Category', '01', '02', '03', '04A', '04B', '05A', '05B', '06'];
        const fteColWidths = [50, 16, 16, 16, 16, 16, 16, 16, 16];
        const fteRowHeight = 6;

        // Header
        pdf.setFillColor(95, 36, 159);
        pdf.rect(margin, yPosition, usableWidth, fteRowHeight, 'F');
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        
        let xPos = margin;
        fteHeaders.forEach((header, index) => {
          if (index === 0) {
            pdf.text(header, xPos + 2, yPosition + 4);
          } else {
            const textWidth = pdf.getTextWidth(header);
            pdf.text(header, xPos + fteColWidths[index]/2 - textWidth/2, yPosition + 4);
          }
          xPos += fteColWidths[index];
        });
        yPosition += fteRowHeight;

        // Data rows
        Object.values(categories).forEach((category: any, catIndex: number) => {
          if (catIndex % 2 === 1) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, yPosition, usableWidth, fteRowHeight, 'F');
          }

          pdf.setFontSize(7);
          pdf.setTextColor(0, 0, 0);
          
          xPos = margin;
          const fteRowData = [
            category.category_name || '',
            category.stages?.['01']?.fte_required || '0',
            category.stages?.['02']?.fte_required || '0',
            category.stages?.['03']?.fte_required || '0',
            category.stages?.['04A']?.fte_required || '0',
            category.stages?.['04B']?.fte_required || '0',
            category.stages?.['05A']?.fte_required || '0',
            category.stages?.['05B']?.fte_required || '0',
            category.stages?.['06']?.fte_required || '0'
          ];

          fteRowData.forEach((data, index) => {
            if (index === 0) {
              pdf.setFont('helvetica', 'bold');
              pdf.text(String(data), xPos + 2, yPosition + 4);
            } else {
              pdf.setFont('helvetica', 'normal');
              const textWidth = pdf.getTextWidth(String(data));
              pdf.text(String(data), xPos + fteColWidths[index]/2 - textWidth/2, yPosition + 4);
            }
            xPos += fteColWidths[index];
          });

          pdf.setDrawColor(229, 231, 235);
          pdf.line(margin, yPosition + fteRowHeight, pageWidth - margin, yPosition + fteRowHeight);
          yPosition += fteRowHeight;
        });
        yPosition += 10;
      });
    }

    // Real Calculation Examples Section (COMPLETE with all details)
    if (reportData.calculation_examples?.length > 0) {
      addSectionTitle('Real Calculation Examples');
      addSubtitle('Examples using actual opportunity data to demonstrate how configurations are applied');

      reportData.calculation_examples.forEach((example: any, /*index: number*/) => {
        addNewPageIfNeeded(150);

        // Example container
        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, yPosition, usableWidth, 80, 'FD');

        // Opportunity header
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        const oppName = example.opportunity_name?.length > 40 ? 
          example.opportunity_name.substring(0, 37) + '...' : 
          example.opportunity_name || 'Unknown Opportunity';
        pdf.text(oppName, margin + 3, yPosition + 8);
        
        // Header info row
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(example.opportunity_id || '', margin + 3, yPosition + 13);
        pdf.text(example.account_name || '', margin + 3, yPosition + 18);

        // TCV and method
        pdf.setFontSize(9);
        pdf.setTextColor(95, 36, 159);
        pdf.text(`TCV: ${formatCurrencyMillions(example.tcv_millions || 0)}`, pageWidth - margin - 40, yPosition + 8);
        
        const methodText = example.calculation_method === 'lead_offering_fallback' ? 
          'Lead Offering Method' : 'Service Line TCV Method';
        pdf.setFontSize(7);
        pdf.setTextColor(75, 85, 99);
        pdf.text(`Method: ${methodText}`, pageWidth - margin - 40, yPosition + 13);

        // Calculation Flow
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Calculation Flow', margin + 3, yPosition + 25);
        
        pdf.setFillColor(235, 248, 255);
        pdf.rect(margin + 3, yPosition + 27, usableWidth - 6, 15, 'F');
        
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 64, 175);
        
        let stepY = yPosition + 30;
        example.calculation_explanation?.slice(0, 3).forEach((step: string, stepIndex: number) => {
          const stepText = step.length > 75 ? step.substring(0, 72) + '...' : step;
          pdf.text(`${stepIndex + 1}. ${stepText}`, margin + 5, stepY);
          stepY += 4;
        });

        // Input Data and Configuration (side by side)
        const colWidth = (usableWidth - 10) / 2;
        let dataY = yPosition + 45;
        
        // Input Data
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin + 3, dataY, colWidth, 18, 'FD');
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Input Data', margin + 5, dataY + 4);
        
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Current Stage: ${example.current_stage || 'N/A'}`, margin + 5, dataY + 8);
        pdf.text(`Decision Date: ${example.decision_date ? new Date(example.decision_date).toLocaleDateString() : 'N/A'}`, margin + 5, dataY + 12);
        pdf.text(`Category: ${example.timeline_category || 'N/A'}`, margin + 5, dataY + 16);

        // Configuration Applied
        pdf.setFillColor(255, 255, 255);
        pdf.rect(margin + 7 + colWidth, dataY, colWidth, 18, 'FD');
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Configuration Applied', margin + 9 + colWidth, dataY + 4);
        
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Remaining Stages: ${example.remaining_stages?.join(', ') || 'N/A'}`, margin + 9 + colWidth, dataY + 8);

        // Service Line breakdown
        if (example.service_line_tcv_breakdown) {
          let serviceY = dataY + 12;
          Object.entries(example.service_line_tcv_breakdown).slice(0, 2).forEach(([sl, tcv]: [string, any]) => {
            const color = tcv > 0 ? [95, 36, 159] : [107, 114, 128];
            pdf.setTextColor(color[0], color[1], color[2]);
            pdf.text(`${sl}: ${formatCurrencyMillions(tcv || 0)}`, margin + 9 + colWidth, serviceY);
            serviceY += 3;
          });
        }

        // Detailed Stage Timeline Table
        if (example.detailed_stage_breakdown && Object.keys(example.detailed_stage_breakdown).length > 0) {
          let timelineY = yPosition + 85;
          
          Object.entries(example.detailed_stage_breakdown).forEach(([serviceLine, stages]: [string, any]) => {
            addNewPageIfNeeded(35);
            
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(95, 36, 159);
            pdf.text(`${serviceLine} Timeline Details`, margin, timelineY);
            timelineY += 6;

            // Timeline table headers
            const stageHeaders = ['Stage', 'Start Date', 'End Date', 'Weeks', 'FTE', 'Effort'];
            const stageColWidths = [18, 25, 25, 15, 15, 20];
            const stageRowHeight = 5;

            // Header
            pdf.setFillColor(243, 244, 246);
            pdf.rect(margin, timelineY, usableWidth, stageRowHeight, 'F');
            
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(75, 85, 99);
            
            let stageXPos = margin;
            stageHeaders.forEach((header, index) => {
              pdf.text(header, stageXPos + 1, timelineY + 3);
              stageXPos += stageColWidths[index];
            });
            timelineY += stageRowHeight;

            // Stage data rows
            stages?.slice(0, 6).forEach((stage: any, stageIndex: number) => {
              if (stageIndex % 2 === 1) {
                pdf.setFillColor(249, 250, 251);
                pdf.rect(margin, timelineY, usableWidth, stageRowHeight, 'F');
              }

              pdf.setFontSize(6);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(0, 0, 0);
              
              stageXPos = margin;
              const stageRowData = [
                stage.stage_code || 'N/A',
                stage.stage_start_date ? new Date(stage.stage_start_date).toLocaleDateString('en-GB') : 'N/A',
                stage.stage_end_date ? new Date(stage.stage_end_date).toLocaleDateString('en-GB') : 'N/A',
                (stage.duration_weeks || 0).toString(),
                (stage.fte_required || 0).toString(),
                (stage.total_effort_weeks || 0).toFixed(1)
              ];

              stageRowData.forEach((data, index) => {
                if (index === 0) pdf.setFont('helvetica', 'bold');
                else if (index === stageRowData.length - 1) {
                  pdf.setFont('helvetica', 'bold');
                  pdf.setTextColor(95, 36, 159);
                }
                pdf.text(data, stageXPos + 1, timelineY + 3);
                stageXPos += stageColWidths[index];
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(0, 0, 0);
              });

              pdf.setDrawColor(229, 231, 235);
              pdf.line(margin, timelineY + stageRowHeight, pageWidth - margin, timelineY + stageRowHeight);
              timelineY += stageRowHeight;
            });
            
            // Add Timeline Chart after the table
            timelineY += 8;
            addNewPageIfNeeded(Math.max(40, stages.length * 8 + 25)); // Dynamic space requirement
            
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(95, 36, 159);
            pdf.text(`${serviceLine} Timeline Chart`, margin, timelineY);
            timelineY += 6;
            
            // Render timeline chart
            timelineY = renderPDFTimelineChart(pdf, stages, margin, timelineY, usableWidth, serviceLine);
            timelineY += 10;
          });
          yPosition = timelineY;
        } else {
          yPosition += 85;
        }

        // Final Results Summary
        addNewPageIfNeeded(25);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Final Results', margin, yPosition);
        yPosition += 6;

        const resultBoxWidth = (usableWidth - 12) / 3;
        const results = [
          { label: 'Total Effort', value: `${(example.total_effort_weeks || 0).toFixed(1)}w`, color: [95, 36, 159] },
          { label: 'Total Hours', value: (example.total_fte_hours || 0).toFixed(0), color: [37, 99, 235] },
          { label: 'Service Lines', value: Object.keys(example.service_line_efforts || {}).length.toString(), color: [5, 150, 105] }
        ];

        results.forEach((result, rIndex) => {
          const boxX = margin + (rIndex * (resultBoxWidth + 6));
          
          pdf.setFillColor(result.color[0], result.color[1], result.color[2]);
          pdf.rect(boxX, yPosition, resultBoxWidth, 12, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          const valueWidth = pdf.getTextWidth(result.value);
          pdf.text(result.value, boxX + resultBoxWidth/2 - valueWidth/2, yPosition + 6);
          
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'normal');
          const labelWidth = pdf.getTextWidth(result.label);
          pdf.text(result.label, boxX + resultBoxWidth/2 - labelWidth/2, yPosition + 10);
        });

        yPosition += 20;
      });
    }

    // Offering Thresholds Section
    if (reportData.offering_thresholds && Object.keys(reportData.offering_thresholds).length > 0) {
      addSectionTitle('Offering-Based Multipliers');
      addSubtitle('Dynamic FTE scaling based on unique offering counts per service line and stage');

      Object.entries(reportData.offering_thresholds).forEach(([serviceLine, stages]: [string, any]) => {
        addNewPageIfNeeded(40);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(95, 36, 159);
        pdf.text(`${serviceLine} Offering Thresholds`, margin, yPosition);
        yPosition += 8;

        // Table headers
        const colWidths = [30, 30, 35, 75];
        const headers = ['Sales Stage', 'Threshold Count', 'Increment Multiplier', 'Example Calculation'];
        
        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, yPosition, usableWidth, 8, 'FD');
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        
        let xPos = margin;
        headers.forEach((header, index) => {
          pdf.text(header, xPos + 2, yPosition + 5);
          xPos += colWidths[index];
        });
        yPosition += 8;

        // Table rows
        Object.entries(stages).forEach(([stage, thresholdData]: [string, any]) => {
          addNewPageIfNeeded(8);
          
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(margin, yPosition, usableWidth, 6, 'FD');
          
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          
          xPos = margin;
          const rowData = [
            `Stage ${stage}`,
            String(thresholdData.threshold_count),
            String(thresholdData.increment_multiplier),
            `If ${thresholdData.threshold_count + 3} offerings: Base FTE × ${(1.0 + 3 * thresholdData.increment_multiplier).toFixed(2)}`
          ];
          
          rowData.forEach((data, index) => {
            const cellText = pdf.splitTextToSize(data, colWidths[index] - 4);
            pdf.text(cellText, xPos + 2, yPosition + 4);
            xPos += colWidths[index];
          });
          
          yPosition += 6;
        });
        
        yPosition += 10;
      });
    }

    // Internal Service Mappings Section
    if (reportData.internal_service_mappings && Object.keys(reportData.internal_service_mappings).length > 0) {
      addSectionTitle('Internal Service Mappings');
      addSubtitle('Which opportunity line item internal services count for offering threshold calculations');

      Object.entries(reportData.internal_service_mappings).forEach(([serviceLine, mappings]: [string, any]) => {
        addNewPageIfNeeded(25);
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(95, 36, 159);
        pdf.text(`${serviceLine} Internal Services`, margin, yPosition);
        yPosition += 6;

        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Only line items with these internal service values count for offering thresholds:', margin, yPosition);
        yPosition += 8;

        // List mappings
        mappings.forEach((mapping: string, _index: number) => {
          addNewPageIfNeeded(5);
          
          pdf.setFillColor(249, 250, 251);
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(margin, yPosition, usableWidth, 4, 'FD');
          
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`• ${mapping}`, margin + 2, yPosition + 3);
          
          yPosition += 4;
        });
        
        // Summary box
        pdf.setFillColor(219, 234, 254);
        pdf.setDrawColor(59, 130, 246);
        pdf.rect(margin, yPosition, usableWidth, 6, 'FD');
        
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        pdf.text(`Total mappings: ${mappings.length} internal service values`, margin + 2, yPosition + 4);
        
        yPosition += 12;
      });
    }

    // Configuration Notes Section
    if (reportData.notes?.length > 0) {
      addSectionTitle('Configuration Notes');
      
      pdf.setFillColor(235, 248, 255);
      pdf.setDrawColor(191, 219, 254);
      const notesHeight = Math.min(reportData.notes.length * 5 + 10, 50);
      pdf.rect(margin, yPosition, usableWidth, notesHeight, 'FD');
      
      yPosition += 5;
      reportData.notes.forEach((note: string) => {
        addNewPageIfNeeded(8);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 64, 175);
        
        const noteLines = pdf.splitTextToSize(`• ${note}`, usableWidth - 10);
        pdf.text(noteLines, margin + 5, yPosition);
        yPosition += noteLines.length * 4 + 2;
      });
      yPosition += 5;
    }

    // Add footer with page numbers
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Configuration Summary Report - Generated ${new Date().toLocaleDateString()} - Page ${i} of ${pageCount}`,
        margin,
        pageHeight - 5
      );
    }

    // Save PDF
    const safeFilename = filename || `configuration_summary_report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(safeFilename);

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
};

export const generateReportSummary = (reportData: any, reportType: string): string => {
  const generatedAt = new Date().toLocaleString();
  
  switch (reportType) {
    case 'resource-utilization':
      return `Resource Utilization Report
Generated: ${generatedAt}
Period: ${reportData.report_period?.start_date} to ${reportData.report_period?.end_date}
Service Lines: ${Object.keys(reportData.service_line_totals || {}).length}
Total Records: ${reportData.utilization_data?.length || 0}`;

    case 'opportunity-pipeline':
      return `Opportunity Pipeline Report
Generated: ${generatedAt}
Total Opportunities: ${reportData.summary?.total_opportunities || 0}
Total TCV: $${reportData.summary?.total_tcv || 0}M
Stages Represented: ${reportData.summary?.stages_represented || 0}`;

    case 'service-line-performance':
      return `Service Line Performance Report
Generated: ${generatedAt}
Period: ${reportData.report_period?.period_months || 0} months
Total Opportunities: ${reportData.summary?.total_opportunities || 0}
Total TCV: $${reportData.summary?.total_tcv || 0}M`;

    case 'stage-duration-analysis':
      return `Stage Duration Analysis Report
Generated: ${generatedAt}
Timelines Analyzed: ${reportData.summary?.total_timelines_analyzed || 0}
Stages Analyzed: ${reportData.summary?.stages_analyzed || 0}
Categories Analyzed: ${reportData.summary?.categories_analyzed || 0}`;

    case 'resource-gap-analysis':
      return `Resource Gap Analysis Report
Generated: ${generatedAt}
Forecast Period: ${reportData.forecast_period?.period_months || 0} months
Critical Gaps: ${reportData.summary?.critical_gaps || 0}
Service Lines Affected: ${reportData.summary?.service_lines_affected || 0}`;

    case 'service-line-activity-timeline':
      return `Service Line Activity Timeline Report
Generated: ${generatedAt}
Period: ${reportData.report_period?.start_date} to ${reportData.report_period?.end_date}
Total Opportunities: ${reportData.summary?.total_opportunities || 0}
Service Line Activities: ${reportData.summary?.total_service_line_activities || 0}
Total Effort Weeks: ${reportData.summary?.total_effort_weeks || 0}`;

    case 'configuration-summary':
      return `Configuration Summary Report
Generated: ${generatedAt}
Opportunity Categories: ${reportData.opportunity_categories?.length || 0}
Service Line Categories: ${reportData.service_line_categories?.length || 0}
Stage Effort Templates: ${reportData.service_line_stage_efforts?.length || 0}
Calculation Examples: ${reportData.calculation_examples?.length || 0}`;

    default:
      return `Report Generated: ${generatedAt}`;
  }
};