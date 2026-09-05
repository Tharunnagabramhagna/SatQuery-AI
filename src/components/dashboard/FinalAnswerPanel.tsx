import { useState } from 'react';
import { Download, Eye, Map, ShieldCheck, Calendar, BarChart3, FileText, List } from 'lucide-react';
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
  onDownloadReport: () => void;
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

        {/* Full-width Download Report Button */}
        <button
          onClick={onDownloadReport}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[13px] font-semibold text-slate-800 dark:text-slate-200 transition-colors shadow-sm mb-3"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Report</span>
        </button>

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
