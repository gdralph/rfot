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

    const imgData = canvas.toDataURL('image/png', 1.0);
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
    const usableHeight = pageHeight - (2 * margin);

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
      const oppDetailsWidth = 75;
      
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
    
    sampleFTEs.forEach((fte, index) => {
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

export const exportToHTML = (reportData: any, reportType: string, viewMode?: string) => {
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

    default:
      return `Report Generated: ${generatedAt}`;
  }
};