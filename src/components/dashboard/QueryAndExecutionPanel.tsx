import { useState } from 'react';
import { ArrowRight, Check, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

interface QueryAndExecutionPanelProps {
  currentQuery: string;
  onQueryChange: (query: string) => void;
  suggestions: string[];
  onSelectSuggestion: (s: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  activeModeName: string;
}

export function QueryAndExecutionPanel({
  currentQuery,
  onQueryChange,
  suggestions,
  onSelectSuggestion,
  onAnalyze,
  isAnalyzing,
  activeModeName,
}: QueryAndExecutionPanelProps) {
  const [isExecutionExpanded, setIsExecutionExpanded] = useState(true);

  const executionSteps = [
    { label: 'Query received', done: true },
    { label: 'Input validated', done: true },
    { label: `Task identified: ${activeModeName}`, done: true },
    { label: 'Selecting specialist model', done: true },
    { label: 'Processing imagery', done: true },
    { label: 'Detecting changed regions', done: true },
    { label: 'Generating evidence', done: true },
    { label: 'Computing confidence', done: true },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 w-full">
      {/* Left Card: Natural Language Query Panel */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm">
        <div>
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2 tracking-wide">
            Natural Language Query Panel
          </div>

          <div className="relative">
            <textarea
              value={currentQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#070b15] border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium resize-none transition-colors"
              placeholder="Ask questions about your remote-sensing data..."
            />
          </div>
        </div>

        {/* Suggestions & Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Example suggestions:
            </span>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion(s)}
                className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700/60 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all duration-150',
              'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
              isAnalyzing && 'opacity-70 cursor-not-allowed'
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reasoning...</span>
              </>
            ) : (
              <>
                <span>Analyze</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Card: AI Execution Panel */}
      <div className="lg:col-span-5 rounded-xl border border-slate-300 dark:border-slate-800/90 bg-white dark:bg-[#0a0f1e]/90 p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide">
                AI Execution
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <button
              onClick={() => setIsExecutionExpanded(!isExecutionExpanded)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              {isExecutionExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {isExecutionExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[11px]">
              {executionSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <span className="truncate">{step.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {isExecutionExpanded && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 font-mono">
            <span>Latency: 412ms</span>
            <span className="text-emerald-500 font-semibold">Status: 200 OK</span>
          </div>
        )}
      </div>
    </div>
  );
}
