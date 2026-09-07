import { useState, useEffect } from 'react';
import { ArrowRight, Check, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { QueryAgentLogo } from '../common/QueryAgentLogo';
import { MOCK_EXECUTION_STAGES } from '../../mock/mockGrounding';

const STAGE_LABEL_KEYS: Record<string, string> = {
  'Request Received': 'executionStages.requestReceived',
  'Input Validated': 'executionStages.inputValidated',
  'Query Understood': 'executionStages.queryUnderstood',
  'Task Identified': 'executionStages.taskIdentified',
  'Workflow Selected': 'executionStages.workflowSelected',
  'Specialist Capability Selected': 'executionStages.specialistCapabilitySelected',
  'Imagery Processed': 'executionStages.imageryProcessed',
  'Result Validated': 'executionStages.resultValidated',
  'Evidence Extracted': 'executionStages.evidenceExtracted',
  'Confidence Estimated': 'executionStages.confidenceEstimated',
  'Response Generated': 'executionStages.responseGenerated',
};

interface QueryAndExecutionPanelProps {
  currentQuery: string;
  onQueryChange: (query: string) => void;
  suggestions: string[];
  onSelectSuggestion: (s: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  activeModeName: string;
  showQueryInput?: boolean;
}

export function QueryAndExecutionPanel({
  currentQuery,
  onQueryChange,
  suggestions,
  onSelectSuggestion,
  onAnalyze,
  isAnalyzing,
  activeModeName,
  showQueryInput = true,
}: QueryAndExecutionPanelProps) {
  const { t } = useTranslation();
  const [isExecutionExpanded, setIsExecutionExpanded] = useState(true);
  const [currentStep, setCurrentStep] = useState(11);

  // Synchronize stage progression with analysis lifecycle (with timer cleanup)
  useEffect(() => {
    if (!isAnalyzing) {
      setCurrentStep(11);
      return;
    }

    // Step 1 immediately on analysis start
    setCurrentStep(1);

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 11) {
          return prev + 1;
        }
        return prev;
      });
    }, 95);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
      {/* Left Card: Query Agent (Conditional) */}
      {showQueryInput && (
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100 mb-2 leading-snug">
              <QueryAgentLogo className="w-5 h-5 rounded shrink-0" />
              <span>{t('sidebar.queryAgent')}</span>
            </div>

            <div className="relative">
              <textarea
                value={currentQuery}
                onChange={(e) => onQueryChange(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-[12.5px] leading-relaxed text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#070b15] border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium resize-none transition-colors"
                placeholder={t('queryAgent.placeholder')}
              />
            </div>
          </div>

          {/* Suggestions & Action Row */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 py-0.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">
                {t('execution.suggestions')}
              </span>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectSuggestion(s)}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700/60 transition-colors shrink-0 whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all duration-150 shrink-0',
                'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
                isAnalyzing && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('execution.processing')}</span>
                </>
              ) : (
                <>
                  <span>{t('execution.analyze')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Right Card / Full Width: AI Execution Panel */}
      <div
        className={cn(
          'rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm flex flex-col justify-between transition-all duration-150',
          showQueryInput ? 'lg:col-span-5' : 'lg:col-span-12'
        )}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {t('execution.title')}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                DEMO TRACE
              </span>
              {!showQueryInput && (
                <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {activeModeName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!showQueryInput && (
                <button
                  onClick={onAnalyze}
                  disabled={isAnalyzing}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition-all duration-150',
                    'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
                    isAnalyzing && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{t('execution.processing')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('execution.analyze')}</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => setIsExecutionExpanded(!isExecutionExpanded)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label={isExecutionExpanded ? t('viewer.collapsePanel') : t('viewer.expandPanel')}
              >
                {isExecutionExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {isExecutionExpanded && (
            <div
              className={cn(
                'mt-2.5 text-[11px]',
                showQueryInput
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2'
                  : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2.5'
              )}
            >
              {MOCK_EXECUTION_STAGES.map((stage) => {
                const isStepCompleted = !isAnalyzing || stage.step <= currentStep;
                const isStepRunning = isAnalyzing && stage.step === currentStep;
                const stageTranslationKey = STAGE_LABEL_KEYS[stage.label];
                const stageTranslatedLabel = stageTranslationKey ? t(stageTranslationKey) : stage.label;

                return (
                  <div key={stage.id} className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150',
                        isStepCompleted
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : isStepRunning
                          ? 'bg-blue-500/20 text-blue-600 dark:text-cyan-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      )}
                    >
                      {isStepRunning ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : isStepCompleted ? (
                        <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'truncate font-medium leading-snug',
                        isStepCompleted
                          ? 'text-slate-800 dark:text-slate-200'
                          : isStepRunning
                          ? 'text-blue-600 dark:text-cyan-400 font-semibold'
                          : 'text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {stageTranslatedLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

