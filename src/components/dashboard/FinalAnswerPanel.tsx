import { useState, useRef, useEffect } from 'react';
import { Download, Eye, Map, ShieldCheck, Calendar, BarChart3, FileText, List, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { AnalysisStatistics, ProcessingStage, ConfidenceScore } from '../../types/visualization';
import { ConfidenceDisplay } from './ConfidenceDisplay';

type TabId = 'summary' | 'details' | 'statistics';

interface FinalAnswerPanelProps {
  answerSummary: string;
  confidence: number;
  evidencePoints: string[];
  onViewEvidence: () => void;
  onViewOnMap: () => void;
  onDownloadReport: (format?: 'json' | 'txt' | 'pdf') => void | Promise<void>;
  /** Phase 2 props */
  confidenceScore?: ConfidenceScore;
  statistics?: AnalysisStatistics;
  processingStages?: ProcessingStage[];
}

export function FinalAnswerPanel({
  answerSummary,
  confidence,
  evidencePoints,
  onViewEvidence,
  onViewOnMap,
  onDownloadReport,
  confidenceScore,
  statistics,
  processingStages,
}: FinalAnswerPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleSelectFormat = async (format: 'json' | 'txt' | 'pdf') => {
    setIsDropdownOpen(false);
    setExportError(null);

    if (format === 'pdf') {
      setIsGeneratingPdf(true);
      try {
        await Promise.resolve(onDownloadReport(format));
      } catch (err) {
        console.error('PDF generation failed:', err);
        setExportError('Failed to generate PDF. Please try again.');
      } finally {
        setIsGeneratingPdf(false);
      }
    } else {
      try {
        await Promise.resolve(onDownloadReport(format));
      } catch (err) {
        console.error(`${format.toUpperCase()} export failed:`, err);
        setExportError(`Failed to export ${format.toUpperCase()}.`);
      }
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof List }[] = [
    { id: 'summary', label: 'Summary', icon: List },
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  ];

  return (
    <div className="rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            Final Answer Panel
          </h2>
          <span className="text-[10px] font-semibold text-blue-600 dark:text-cyan-400 font-mono">
            VLM-AGENT
          </span>
        </div>

        {/* Phase 2: Tab Navigation */}
        <div className="flex items-center gap-0.5 mb-3 p-0.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors flex-1 justify-center',
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Summary Tab (Original behavior preserved) ─── */}
        {activeTab === 'summary' && (
          <>
            {/* Subtitle & Narrative */}
            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                Analysis Result
              </div>
              <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                {answerSummary}
              </p>
            </div>

            {/* Confidence — Phase 2 enhanced or fallback */}
            {confidenceScore ? (
              <ConfidenceDisplay score={confidenceScore} compact />
            ) : (
              <div className="mb-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Confidence:</span>
                    <span className="font-mono">{confidence}%</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium whitespace-nowrap shrink-0">High</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <div className="text-right mt-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">Demo</span>
                </div>
              </div>
            )}

            {/* Evidence-Backed Bullet points */}
            <div className="mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-400 mb-1.5">
                Evidence-Backed
              </div>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                {evidencePoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-500 dark:text-cyan-400 font-bold mt-0.5 shrink-0">•</span>
                    <span className="text-[12px] leading-snug">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Temporal Range */}
            {statistics && (
              <div className="mb-3 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40 text-[10px]">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {statistics.temporalRange.t0} → {statistics.temporalRange.t1}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-mono">(Demo)</span>
              </div>
            )}
          </>
        )}

        {/* ─── Details Tab ─── */}
        {activeTab === 'details' && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
              Processing Stages
              <span className="ml-1.5 text-[8px] font-mono text-slate-400/80 dark:text-slate-500 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800/60">DEMO</span>
            </div>
            {processingStages ? (
              <div className="space-y-1.5">
                {processingStages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50"
                  >
                    <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <span className="text-[8px] font-bold">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug truncate">
                        {stage.label}
                      </div>
                      {stage.description && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                          {stage.description}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'ml-auto text-[9px] font-mono font-medium shrink-0',
                        stage.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400'
                          : stage.status === 'skipped' ? 'text-slate-400'
                          : 'text-amber-500'
                      )}
                    >
                      {stage.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic px-2">
                No processing stage data available.
              </div>
            )}
          </div>
        )}

        {/* ─── Statistics Tab ─── */}
        {activeTab === 'statistics' && statistics && (
          <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
              Demo Analysis Metrics
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                <div className="text-[18px] font-bold text-slate-900 dark:text-slate-100 font-mono leading-none">
                  {statistics.areaChangedHectares}
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Hectares Changed <span className="text-slate-400">(Demo)</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                <div className="text-[18px] font-bold text-slate-900 dark:text-slate-100 font-mono leading-none">
                  {statistics.buildingCount}
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Buildings Detected <span className="text-slate-400">(Demo)</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                <div className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400 font-mono leading-none">
                  {statistics.vegetationCoverPercent}%
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Vegetation Cover <span className="text-slate-400">(Demo)</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40">
                <div className="text-[18px] font-bold text-amber-500 dark:text-amber-400 font-mono leading-none">
                  {statistics.builtUpPercent}%
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  Built-up Area <span className="text-slate-400">(Demo)</span>
                </div>
              </div>
            </div>

            {/* Land Use Change Bar Chart */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-400 mb-1.5">
                Land Use Distribution (Demo)
              </div>
              <div className="space-y-1.5">
                {statistics.landUseChanges.map((change) => (
                  <div key={change.category} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium w-16 shrink-0 truncate">
                      {change.category}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${change.percentage}%`,
                          backgroundColor: change.color,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 w-8 text-right shrink-0">
                      {change.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Temporal Range */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/40 text-[10px]">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-600 dark:text-slate-400">
                {statistics.temporalRange.t0} → {statistics.temporalRange.t1}
              </span>
              <span className="text-slate-400 dark:text-slate-500 font-mono">(Demo)</span>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && !statistics && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic px-2">
            No statistics data available.
          </div>
        )}

        {/* Action Button Row */}
        <div className="grid grid-cols-2 gap-2 mb-2 mt-3">
          <button
            onClick={onViewEvidence}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-[13px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Evidence</span>
          </button>

          <button
            onClick={onViewOnMap}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-[13px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Map className="w-3.5 h-3.5" />
            <span>View on Map</span>
          </button>
        </div>

        {/* Full-width Download Report Dropdown */}
        <div className="relative mb-3" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            aria-label="Download Report Format Selection"
            disabled={isGeneratingPdf}
            className={cn(
              'w-full flex items-center justify-between py-1.5 px-3 rounded-lg border text-[13px] font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-cyan-500/30',
              isDropdownOpen
                ? 'border-blue-500/60 dark:border-cyan-500/60 bg-slate-200 dark:bg-slate-700 text-blue-700 dark:text-cyan-300'
                : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200',
              isGeneratingPdf && 'opacity-75 cursor-wait'
            )}
          >
            <span className="flex items-center gap-2">
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-cyan-400" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Report'}</span>
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-200',
                isDropdownOpen && 'rotate-180 text-blue-600 dark:text-cyan-400'
              )}
            />
          </button>

          {/* Format Selection Popover (positioned upwards so it never overlaps map legend) */}
          {isDropdownOpen && (
            <div
              role="menu"
              aria-label="Report format options"
              className="absolute bottom-full left-0 right-0 mb-1.5 p-1.5 rounded-xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl z-30 animate-in fade-in zoom-in-[0.98] duration-100 space-y-1"
            >
              <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Select Format
                </span>
                <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400">
                  DEMO
                </span>
              </div>

              {/* JSON Option */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelectFormat('json')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left transition-colors group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-blue-500/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                    {'{ }'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-cyan-400 truncate">
                      JSON
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Structured analysis data
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase shrink-0 ml-2">
                  .json
                </span>
              </button>

              {/* TXT Option */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelectFormat('txt')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left transition-colors group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                      TXT
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Readable text report
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase shrink-0 ml-2">
                  .txt
                </span>
              </button>

              {/* PDF Option */}
              <button
                type="button"
                role="menuitem"
                disabled={isGeneratingPdf}
                onClick={() => handleSelectFormat('pdf')}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left transition-colors group focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                    PDF
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 truncate">
                      PDF
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Formatted publication report
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase shrink-0 ml-2">
                  .pdf
                </span>
              </button>
            </div>
          )}

          {/* User-friendly error alert if export failed */}
          {exportError && (
            <div
              role="alert"
              className="mt-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] flex items-center justify-between"
            >
              <span>{exportError}</span>
              <button
                type="button"
                onClick={() => setExportError(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-2"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Map Legend */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-yellow-400 shadow-sm shrink-0" />
              <span>Detected Buildings</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-600 border border-amber-400 shrink-0" />
              <span>Changed Region</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Query Target</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm border-2 border-dashed border-slate-400 dark:border-slate-500 shrink-0" />
              <span>Analysis Area</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
