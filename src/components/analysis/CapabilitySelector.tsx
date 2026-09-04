import {
  MessageSquareText,
  FileText,
  ScanSearch,
  GitCompare,
  MessageSquareDiff,
  MapPin,
  Layers,
  Check
} from 'lucide-react';
import type { AnalysisCapability, AnalysisMode } from '../../types';
import { CAPABILITIES } from '../../mock/mockCapabilities';
import { cn } from '../../utils/cn';

interface CapabilitySelectorProps {
  mode: AnalysisMode | null;
  selectedCapability: AnalysisCapability | null;
  onSelectCapability: (capability: AnalysisCapability) => void;
  error?: string;
  disabled?: boolean;
}

const CAP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  vqa: MessageSquareText,
  captioning: FileText,
  grounding: ScanSearch,
  change_detection: GitCompare,
  change_vqa: MessageSquareDiff,
  change_localization: MapPin,
  multimodal_analysis: Layers,
};

export function CapabilitySelector({
  mode,
  selectedCapability,
  onSelectCapability,
  error,
  disabled = false,
}: CapabilitySelectorProps) {
  if (!mode) return null;

  const relevantCapabilities = CAPABILITIES.filter((c) => c.mode === mode);

  return (
    <div className="w-full">
      <div className="mb-2.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          Select Analytical Capability
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Determine the target reasoning task for the AI engine
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {relevantCapabilities.map((cap) => {
          const Icon = CAP_ICONS[cap.id] || MessageSquareText;
          const isSelected = selectedCapability === cap.id;

          return (
            <button
              key={cap.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectCapability(cap.id)}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer shadow-sm',
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-500 text-slate-900 dark:text-slate-100 ring-1 ring-blue-500/30'
                  : 'bg-white dark:bg-[#0a0f1e]/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0d1428] hover:border-slate-300 dark:hover:border-slate-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5',
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {cap.name}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {cap.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
