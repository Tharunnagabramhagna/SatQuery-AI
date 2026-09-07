import { useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  Command,
  Lightbulb,
  AlertCircle
} from 'lucide-react';
import type { AnalysisMode, AnalysisStatus } from '../../types';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

interface QueryInterfaceProps {
  query: string;
  onQueryChange: (query: string) => void;
  onAnalyze: () => void;
  status: AnalysisStatus;
  mode: AnalysisMode | null;
  error?: string;
}

const EXAMPLE_PROMPTS_BY_MODE: Record<string, string[]> = {
  single_image: [
    'Find all buildings.',
    'Describe the major land-cover patterns in this scene.',
    'How many water bodies are visible?',
    'What types of agricultural vegetation are present?',
  ],
  compare_images: [
    'What changed between these images?',
    'Identify regions with significant urban expansion.',
    'Detect deforestation or vegetation loss.',
    'Highlight infrastructure developed between T1 and T2.',
  ],
  optical_sar: [
    'Compare the optical and SAR imagery.',
    'Identify flooded zones penetrated by SAR radar.',
    'Differentiate urban structures using SAR backscatter.',
    'Cross-reference cloud-obscured areas using radar imagery.',
  ],
};

export function QueryInterface({
  query,
  onQueryChange,
  onAnalyze,
  status,
  mode,
  error,
}: QueryInterfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAnalyzing = status === 'analyzing';

  // Handle Ctrl/Cmd + Enter to trigger analysis
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isAnalyzing && query.trim()) {
          onAnalyze();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnalyzing, query, onAnalyze]);

  const examplePrompts = mode
    ? EXAMPLE_PROMPTS_BY_MODE[mode] || EXAMPLE_PROMPTS_BY_MODE['single_image']
    : EXAMPLE_PROMPTS_BY_MODE['single_image'];

  return (
    <div className="w-full bg-white dark:bg-[#0a0f1e]/90 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-lg transition-colors duration-150">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            What would you like to know?
          </h3>
        </div>

        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            disabled={isAnalyzing}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Query Input Box */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={3}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          disabled={isAnalyzing}
          placeholder="Ask anything about this satellite imagery... (e.g. Find all buildings, detect urban expansion, or compare optical and SAR observations)"
          className={cn(
            'w-full bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl p-3.5 text-sm',
            'border transition-all resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            error
              ? 'border-red-400 dark:border-red-500/50 focus:border-red-500'
              : 'border-slate-200 dark:border-slate-800 focus:border-blue-500/60',
            isAnalyzing && 'opacity-60 cursor-not-allowed'
          )}
        />

        {/* Action Bar inside/below Query Box */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Command className="w-3 h-3" />
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent">Ctrl</kbd> + <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent">Enter</kbd> to analyze</span>
          </div>

          <Button
            size="lg"
            variant="primary"
            loading={isAnalyzing}
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="w-full sm:w-auto shadow-md shadow-blue-600/25 px-6 font-semibold"
          >
            {isAnalyzing ? (
              'Analyzing Imagery...'
            ) : (
              <span className="flex items-center gap-2">
                Analyze <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Inline Query Error */}
      {error && (
        <div className="flex items-center gap-1.5 mt-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Contextual Example Prompts */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400/80" />
          <span>Example queries for this modality:</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {examplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isAnalyzing}
              onClick={() => onQueryChange(prompt)}
              className="text-left text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
