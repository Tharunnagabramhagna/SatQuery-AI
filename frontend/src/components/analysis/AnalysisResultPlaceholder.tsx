import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Activity,
  Layers,
  MapPin,
  RefreshCw,
  Info
} from 'lucide-react';
import type { AnalysisResponse } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface AnalysisResultPlaceholderProps {
  response: AnalysisResponse;
  onReset: () => void;
}

export function AnalysisResultPlaceholder({
  response,
  onReset,
}: AnalysisResultPlaceholderProps) {
  return (
    <div className="w-full space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-md">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Analysis Complete
              </h3>
              {response.isDemo && (
                <Badge variant="demo" className="text-[9px]">DEMO RESULT</Badge>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Task: <span className="font-mono text-blue-600 dark:text-cyan-400 font-semibold">{response.task.replace('_', ' ').toUpperCase()}</span>
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={onReset}
        >
          New Analysis
        </Button>
      </div>

      {/* Answer Box */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/90 shadow-sm dark:shadow-md transition-colors">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Geospatial Assessment</h4>
          </div>
          {response.confidence > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Confidence:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {(response.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {response.answer}
        </p>

        {response.warnings.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {response.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Execution Trace & Evidence Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Execution Trace */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800/60">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
              Observable Execution Trace
            </h5>
          </div>

          <div className="space-y-2.5 text-xs">
            {response.executionTrace.map((step) => (
              <div
                key={step.step}
                className="flex items-start justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/60"
              >
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                    {step.step}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {step.action}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {step.detail}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-500">
                  {step.duration}ms
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Supporting Evidence / Spatial Preview */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f1e]/60 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-800/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                  Visual Evidence & Verification
                </h5>
              </div>
              <Badge variant="info" className="text-[9px]">PHASE 2 PREVIEW</Badge>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center min-h-[140px]">
              <Layers className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-xs font-medium text-slate-800 dark:text-slate-300">
                Interactive MapLibre Geospatial Viewer
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-500 max-w-xs mt-1">
                Full-resolution raster tiling, segmentation overlays, bounding boxes, and bi-temporal split-screen compare will render in Phase 2.
              </p>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Spatial Projection: <span className="font-mono text-slate-700 dark:text-slate-400">EPSG:4326</span></span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <MapPin className="w-3 h-3" /> Geo-Referenced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
