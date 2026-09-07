import { Check, UploadCloud, Layers, MessageSquare, Play, BarChart3 } from 'lucide-react';
import type { AnalysisStep } from '../../types';
import { cn } from '../../utils/cn';

interface AnalysisStepperProps {
  currentStep: AnalysisStep;
  onStepClick?: (step: AnalysisStep) => void;
}

const STEPS = [
  { step: 1 as AnalysisStep, label: 'Select Mode', icon: Layers },
  { step: 2 as AnalysisStep, label: 'Upload Imagery', icon: UploadCloud },
  { step: 3 as AnalysisStep, label: 'Ask Question', icon: MessageSquare },
  { step: 4 as AnalysisStep, label: 'Analyze', icon: Play },
  { step: 5 as AnalysisStep, label: 'Review Result', icon: BarChart3 },
];

export function AnalysisStepper({ currentStep, onStepClick }: AnalysisStepperProps) {
  return (
    <div className="w-full bg-white dark:bg-[#0a0f1e]/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 mb-6 shadow-sm transition-colors duration-150">
      <div className="flex items-center justify-between">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const isCompleted = currentStep > s.step;
          const isCurrent = currentStep === s.step;
          const isClickable = s.step <= currentStep && s.step < 5;

          return (
            <div key={s.step} className="flex items-center flex-1 last:flex-initial">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(s.step)}
                className={cn(
                  'flex items-center gap-2 group transition-all text-left',
                  isClickable ? 'cursor-pointer' : 'cursor-default opacity-60'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold transition-all shrink-0',
                    isCompleted
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : isCurrent
                      ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/40 ring-2 ring-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </div>

                <div className="hidden md:flex flex-col">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                    Step 0{s.step}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isCurrent ? 'text-slate-900 dark:text-slate-100 font-semibold' : isCompleted ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              </button>

              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 sm:mx-4 transition-colors',
                    currentStep > s.step ? 'bg-blue-600/60' : 'bg-slate-200 dark:bg-slate-800'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
