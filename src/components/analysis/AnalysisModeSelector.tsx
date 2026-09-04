import { Image as ImageIcon, GitCompare, Layers, Check } from 'lucide-react';
import type { AnalysisMode } from '../../types';
import { MODES } from '../../mock/mockCapabilities';
import { cn } from '../../utils/cn';

interface AnalysisModeSelectorProps {
  selectedMode: AnalysisMode | null;
  onSelectMode: (mode: AnalysisMode) => void;
  disabled?: boolean;
}

const MODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  single_image: ImageIcon,
  compare_images: GitCompare,
  optical_sar: Layers,
};

export function AnalysisModeSelector({
  selectedMode,
  onSelectMode,
  disabled = false,
}: AnalysisModeSelectorProps) {
  return (
    <div className="w-full">
      <div className="mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          Select Analysis Mode
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose the satellite sensor context and analytical modality
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {MODES.map((mode) => {
          const Icon = MODE_ICONS[mode.id] || ImageIcon;
          const isSelected = selectedMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(mode.id)}
              className={cn(
                'relative flex flex-col p-4 rounded-xl text-left transition-all duration-200 border cursor-pointer shadow-sm',
                isSelected
                  ? 'bg-blue-50/80 dark:bg-blue-600/10 border-blue-500 text-slate-900 dark:text-slate-100 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                  : 'bg-white dark:bg-[#0a0f1e]/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#0d1428] hover:border-slate-300 dark:hover:border-slate-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}

              <div
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg mb-3 transition-colors',
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>

              <h4 className="text-sm font-semibold mb-1 text-slate-900 dark:text-slate-100">
                {mode.name}
              </h4>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3 flex-1">
                {mode.description}
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1">
                {mode.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 font-mono"
                  >
                    {cap.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
