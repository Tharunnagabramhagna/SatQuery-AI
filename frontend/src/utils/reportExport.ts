export interface ReportData {
  project: string;
  problemStatement: string;
  task: string;
  taskId: string;
  imageryMode: 'single' | 'compare' | 'fusion' | string;
  timestamp: string;
  imagery: {
    sensor: string;
    resolution: string;
    crs: string;
    coordinates: string;
    temporalRange?: {
      t0: string;
      t1: string;
    };
  };
  query: string;
  confidence: string;
  confidenceScore?: {
    overall: number;
    label?: string;
    breakdown: Array<{ id: string; label: string; value: number; isVerified?: boolean }>;
  };
  answer: string;
  evidence: string[];
  evidenceItems?: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    confidence: number;
    regionId?: string;
    band?: string;
    detectionMethod?: string;
  }>;
  detectedFeatures: number;
  statistics?: {
    areaChangedHectares: number;
    buildingCount: number;
    vegetationCoverPercent: number;
    builtUpPercent: number;
    landUseChanges: Array<{ category: string; percentage: number; color?: string }>;
    temporalRange?: {
      t0: string;
      t1: string;
    };
  };
  processingStages?: Array<{
    id: string;
    label: string;
    status: string;
    description?: string;
  }>;
  isVerified?: boolean;
}

/**
 * Trigger download of a client-side Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Safe filename generator
 */
function generateFilename(taskId: string, extension: 'json' | 'txt' | 'pdf'): string {
  const safeId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `SatQuery_Report_${safeId}_${timestamp}.${extension}`;
}

/**
 * 1. Export as JSON (Structured Data)
 */
export function exportToJson(data: ReportData): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, generateFilename(data.taskId, 'json'));
}

/**
 * 2. Export as TXT (Human-Readable Plain Text Report)
 */
export function exportToTxt(data: ReportData): void {
  const lines: string[] = [];
  const divider = '='.repeat(78);
  const subDivider = '-'.repeat(78);

  lines.push(divider);
  lines.push('SATQUERY AI — REMOTE-SENSING ANALYSIS REPORT');
  lines.push(divider);
  lines.push(`Report Status    : VERIFIED ANALYSIS REPORT`);
  lines.push(`Generated At     : ${new Date(data.timestamp).toUTCString()}`);
  lines.push(`Project          : ${data.project}`);
  lines.push(`Problem Statement: ${data.problemStatement}`);
  lines.push(`Task Mode        : ${data.task} (${data.imageryMode.toUpperCase()})`);
  lines.push('');

  lines.push(subDivider);
  lines.push('1. ANALYSIS SUMMARY');
  lines.push(subDivider);
  lines.push(`Query:`);
  lines.push(`  "${data.query}"`);
  lines.push('');
  lines.push(`Result Summary:`);
  lines.push(`  ${data.answer}`);
  lines.push('');
  lines.push(`Confidence:`);
  lines.push(`  ${data.confidence}`);
  if (data.confidenceScore?.breakdown) {
    lines.push('  Confidence Breakdown:');
    data.confidenceScore.breakdown.forEach((item) => {
      lines.push(`    • ${item.label.padEnd(24)}: ${item.value}%`);
    });
  }
  lines.push('');
  if (data.statistics?.temporalRange) {
    lines.push(`Timeline / Temporal Baseline:`);
    lines.push(`  ${data.statistics.temporalRange.t0} -> ${data.statistics.temporalRange.t1}`);
    lines.push('');
  }

  lines.push(subDivider);
  lines.push('2. KEY FINDINGS');
  lines.push(subDivider);
  if (data.evidence && data.evidence.length > 0) {
    data.evidence.forEach((point, idx) => {
      lines.push(`  [${idx + 1}] ${point}`);
    });
  } else {
    lines.push('  No specific findings recorded.');
  }
  lines.push('');

  if (data.statistics) {
    lines.push(subDivider);
    lines.push('3. STATISTICS & METRICS');
    lines.push(subDivider);
    lines.push(`  Area Changed     : ${data.statistics.areaChangedHectares} Hectares`);
    lines.push(`  Buildings Detected: ${data.statistics.buildingCount} Footprints`);
    lines.push(`  Vegetation Cover : ${data.statistics.vegetationCoverPercent}%`);
    lines.push(`  Built-Up Area    : ${data.statistics.builtUpPercent}%`);
    lines.push('');
    lines.push('  Land-Use Distribution:');
    data.statistics.landUseChanges.forEach((change) => {
      lines.push(`    • ${change.category.padEnd(16)}: ${change.percentage}%`);
    });
    lines.push('');
  }

  if (data.evidenceItems && data.evidenceItems.length > 0) {
    lines.push(subDivider);
    lines.push('4. DETAILED EVIDENCE ITEMS');
    lines.push(subDivider);
    data.evidenceItems.forEach((item, idx) => {
      lines.push(`  Item #${idx + 1}: ${item.title}`);
      lines.push(`    Type            : ${item.type.toUpperCase()}`);
      if (item.regionId) lines.push(`    Region ID       : ${item.regionId}`);
      lines.push(`    Confidence      : ${item.confidence}%`);
      if (item.band) lines.push(`    Sensor Band     : ${item.band}`);
      if (item.detectionMethod) lines.push(`    Method          : ${item.detectionMethod}`);
      lines.push(`    Description     : ${item.description}`);
      lines.push('');
    });
  }

  lines.push(subDivider);
  lines.push('5. SENSOR & IMAGERY METADATA');
  lines.push(subDivider);
  lines.push(`  Sensor System   : ${data.imagery.sensor}`);
  lines.push(`  Ground Res (GSD): ${data.imagery.resolution}`);
  lines.push(`  CRS Projection  : ${data.imagery.crs}`);
  lines.push(`  Coordinates     : ${data.imagery.coordinates}`);
  lines.push('');

  if (data.processingStages && data.processingStages.length > 0) {
    lines.push(subDivider);
    lines.push('6. PROCESSING STAGES TRACE');
    lines.push(subDivider);
    data.processingStages.forEach((stage, idx) => {
      lines.push(
        `  [${idx + 1}] ${stage.label.padEnd(28)} [${stage.status.toUpperCase()}] ${stage.description || ''}`
      );
    });
    lines.push('');
  }

  lines.push(divider);
  lines.push('REPORT NOTICE & COMPLIANCE');
  lines.push(divider);
  lines.push('Generated by SatQuery AI Space Intelligence Workspace.');
  lines.push('Multimodal Earth Observation and Geospatial Intelligence Engine.');
  lines.push(divider);

  const txtContent = lines.join('\r\n');
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, generateFilename(data.taskId, 'txt'));
}

/**
 * 3. Export as PDF (Publication-Grade Vector PDF Report)
 */
export async function exportToPdf(data: ReportData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2; // 178mm
  let currentY = 16;

  // Helper to add a page and reset position
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 18;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('SatQuery AI — Space Intelligence Workspace (SIH26167)', marginX, 10);
    doc.text('ANALYSIS REPORT', pageWidth - marginX, 10, { align: 'right' });
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(marginX, 12, pageWidth - marginX, 12);
  };

  // ─── Header Banner ───
  doc.setFillColor(10, 15, 30); // dark navy #0a0f1e
  doc.roundedRect(marginX, currentY, contentWidth, 24, 2, 2, 'F');

  // Title in Banner
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SatQuery AI — Remote Sensing Analysis Report', marginX + 6, currentY + 9);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Autonomous Vision-Language Satellite Intelligence Engine', marginX + 6, currentY + 15);

  // Badge on right
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(pageWidth - marginX - 38, currentY + 5, 32, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(56, 189, 248); // cyan-400
  doc.text('ANALYSIS REPORT', pageWidth - marginX - 22, currentY + 9.8, { align: 'center' });

  // Metadata line under banner
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated: ${new Date(data.timestamp).toLocaleString()}  |  Task: ${data.task}  |  Mode: ${data.imageryMode.toUpperCase()}`,
    marginX + 6,
    currentY + 20.5
  );

  currentY += 30;

  // ─── Section 1: Executive Synthesis & Query ───
  checkPageBreak(38);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, contentWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('1. ANALYSIS RESULT & USER QUERY', marginX + 5, currentY + 6);

  // Query block
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  const queryLines = doc.splitTextToSize(`Query: "${data.query}"`, contentWidth - 10);
  doc.text(queryLines, marginX + 5, currentY + 12);

  // Answer narrative
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const answerLines = doc.splitTextToSize(data.answer, contentWidth - 10);
  doc.text(answerLines, marginX + 5, currentY + 20);

  // Confidence row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Overall Confidence: `, marginX + 5, currentY + 29);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`${data.confidence}`, marginX + 34, currentY + 29);

  if (data.statistics?.temporalRange) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Temporal Baseline: ${data.statistics.temporalRange.t0} → ${data.statistics.temporalRange.t1}`,
      marginX + 75,
      currentY + 29
    );
  }

  currentY += 40;

  // ─── Section 2: Key Findings ───
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. KEY EVIDENCE FINDINGS', marginX, currentY);
  currentY += 5;

  data.evidence.forEach((point) => {
    checkPageBreak(8);
    doc.setFillColor(37, 99, 235); // blue-600 bullet
    doc.circle(marginX + 3, currentY - 1, 1.2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const pointLines = doc.splitTextToSize(point, contentWidth - 12);
    doc.text(pointLines, marginX + 7, currentY);
    currentY += pointLines.length * 4.5 + 1.5;
  });

  currentY += 4;

  // ─── Section 3: Statistics & Metrics Cards ───
  if (data.statistics) {
    checkPageBreak(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('3. QUANTITATIVE ANALYSIS METRICS', marginX, currentY);
    currentY += 5;

    // 4 metric cards (2x2 grid)
    const cardWidth = (contentWidth - 6) / 2;
    const cardHeight = 14;

    const cards = [
      {
        label: 'Area Changed',
        value: `${data.statistics.areaChangedHectares} ha`,
        sub: 'Hectares Changed',
      },
      {
        label: 'Building Count',
        value: `${data.statistics.buildingCount}`,
        sub: 'Structures Detected',
      },
      {
        label: 'Vegetation Cover',
        value: `${data.statistics.vegetationCoverPercent}%`,
        sub: 'Vegetation Index',
      },
      {
        label: 'Built-up Area',
        value: `${data.statistics.builtUpPercent}%`,
        sub: 'Built-up Ratio',
      },
    ];

    cards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = marginX + col * (cardWidth + 6);
      const cy = currentY + row * (cardHeight + 4);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cx, cy, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(c.value, cx + 4, cy + 6.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(c.sub, cx + 4, cy + 11);
    });

    currentY += 34;

    // Land-Use Distribution breakdown
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Land-Use Classification Distribution:', marginX, currentY);
    currentY += 4.5;

    data.statistics.landUseChanges.forEach((change) => {
      checkPageBreak(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(change.category, marginX + 4, currentY);

      // Percentage bar background
      const barX = marginX + 38;
      const barMaxWidth = 100;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(barX, currentY - 2.8, barMaxWidth, 3.2, 1, 1, 'F');

      // Filled portion
      doc.setFillColor(37, 99, 235);
      const fillW = Math.max(1, (change.percentage / 100) * barMaxWidth);
      doc.roundedRect(barX, currentY - 2.8, fillW, 3.2, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`${change.percentage}%`, barX + barMaxWidth + 4, currentY);

      currentY += 5;
    });

    currentY += 4;
  }

  // ─── Section 4: Detailed Evidence Items ───
  if (data.evidenceItems && data.evidenceItems.length > 0) {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('4. EVIDENCE REPERTOIRE & REGIONAL GROUNDING', marginX, currentY);
    currentY += 5;

    data.evidenceItems.forEach((item, idx) => {
      checkPageBreak(24);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, currentY, contentWidth, 20, 1.5, 1.5, 'FD');

      // Title & Type
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`[E-${idx + 1}] ${item.title}`, marginX + 4, currentY + 5);

      // Badges
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(37, 99, 235);
      const badgeText = `${item.type.toUpperCase()}  |  Confidence: ${item.confidence}%${
        item.regionId ? `  |  Region: ${item.regionId}` : ''
      }`;
      doc.text(badgeText, pageWidth - marginX - 4, currentY + 5, { align: 'right' });

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(item.description, contentWidth - 8);
      doc.text(descLines, marginX + 4, currentY + 10);

      // Method info
      if (item.band || item.detectionMethod) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        const methodStr = `Sensor Band: ${item.band || 'N/A'}  •  Method: ${
          item.detectionMethod || 'N/A'
        }`;
        doc.text(methodStr, marginX + 4, currentY + 17);
      }

      currentY += 23;
    });

    currentY += 3;
  }

  // ─── Section 5: Sensor & Ingestion Specifications ───
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('5. SENSOR PLATFORM & REGISTRATION SPECIFICATIONS', marginX, currentY);
  currentY += 5;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, contentWidth, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Sensor Ingestion : ${data.imagery.sensor}`, marginX + 4, currentY + 5.5);
  doc.text(`Spatial Resolution: ${data.imagery.resolution}`, marginX + 4, currentY + 11.5);
  doc.text(`CRS Projection  : ${data.imagery.crs}`, marginX + 90, currentY + 5.5);
  doc.text(`Geo-Coordinates : ${data.imagery.coordinates}`, marginX + 90, currentY + 11.5);

  currentY += 22;

  // ─── Bottom Notice ───
  checkPageBreak(15);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Notice: Spatial inferences and confidence indices generated by SatQuery AI Space Intelligence Platform.',
    marginX,
    currentY
  );

  // ─── Page Footers on all pages ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('SatQuery AI • Remote Sensing Intelligence Report', marginX, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  doc.save(generateFilename(data.taskId, 'pdf'));
}

/**
 * Universal export dispatcher
 */
export async function exportReport(report: ReportData, format: 'json' | 'txt' | 'pdf'): Promise<void> {
  switch (format) {
    case 'json':
      exportToJson(report);
      break;
    case 'txt':
      exportToTxt(report);
      break;
    case 'pdf':
      await exportToPdf(report);
      break;
  }
}
