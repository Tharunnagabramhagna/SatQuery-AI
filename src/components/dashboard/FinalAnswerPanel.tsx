import { Download, Eye, Map, ShieldCheck } from 'lucide-react';

interface FinalAnswerPanelProps {
  answerSummary: string;
  confidence: number;
  evidencePoints: string[];
  onViewEvidence: () => void;
  onViewOnMap: () => void;
  onDownloadReport: () => void;
}

export function FinalAnswerPanel({
  answerSummary,
  confidence,
  evidencePoints,
  onViewEvidence,
  onViewOnMap,
  onDownloadReport,
}: FinalAnswerPanelProps) {
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

        {/* Subtitle & Narrative */}
        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
            Analysis Result
          </div>
          <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
            {answerSummary}
          </p>
        </div>

        {/* Confidence Meter */}
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
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">Calibrated</span>
          </div>
        </div>

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

        {/* Action Button Row */}
        <div className="grid grid-cols-2 gap-2 mb-2">
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
