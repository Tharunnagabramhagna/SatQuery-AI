import { useEffect, useRef, useCallback } from 'react';
import {
  X,
  Bot,
  ArrowRight,
  Loader2,
  Sparkles,
  MessageSquare,
  FileText,
  ScanSearch,
  GitCompare,
  MessageSquareDiff,
  Layers,
  Zap,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { DualImageryViewer } from './DualImageryViewer';
import { QueryAndExecutionPanel } from './QueryAndExecutionPanel';
import { FinalAnswerPanel } from './FinalAnswerPanel';
import { ImageMetadataPanel } from './ImageMetadataPanel';
import {
  ANALYSIS_TOOLS,
  WORKSPACE_MODES,
  type AnalysisTool,
  type AnalysisModeConfig,
} from './WorkspaceSecondarySidebar';

const OVERLAY_SUGGESTIONS = [
  'Detect changes between images',
  'Count buildings in this area',
  'Describe the scene',
  'Identify land-use patterns',
];

interface QueryAgentOverlayProps {
  isOpen: boolean;
  onClose: () => void;

  // Analysis state
  selectedToolId: string;
  onSelectTool: (tool: AnalysisTool) => void;

  // Imagery
  modeCategory: 'single' | 'compare' | 'fusion';
  onCategoryChange: (cat: 'single' | 'compare' | 'fusion') => void;

  // Query
  queryAgentQuery: string;
  onQueryChange: (query: string) => void;

  // Analysis
  onAnalyze: () => void;
  isAnalyzing: boolean;
  activeDisplayName: string;
  activePresetMode: AnalysisModeConfig;

  // Evidence & metadata
  onViewEvidence: () => void;
  onViewOnMap: () => void;
  onDownloadReport: () => void;

  // Imagery viewer
  detectedFeaturesCount: number;
  onInspectRegion: (regionId: string) => void;
}

export function QueryAgentOverlay({
  isOpen,
  onClose,
  selectedToolId,
  onSelectTool,
  modeCategory,
  onCategoryChange,
  queryAgentQuery,
  onQueryChange,
  onAnalyze,
  isAnalyzing,
  activeDisplayName,
  activePresetMode,
  onViewEvidence,
  onViewOnMap,
  onDownloadReport,
  detectedFeaturesCount,
  onInspectRegion,
}: QueryAgentOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Auto-focus the chat input when the overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to let the overlay animation settle
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Backdrop click handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle selecting an analysis tool inside the overlay
  const handleToolSelect = (tool: AnalysisTool) => {
    onSelectTool(tool);
    if (tool.modeId) {
      const mode = WORKSPACE_MODES.find((m) => m.id === tool.modeId);
      if (mode) {
        onCategoryChange(mode.category);
      }
    }
  };

  if (!isOpen) return null;

  const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    vqa: MessageSquare,
    captioning: FileText,
    grounding: ScanSearch,
    change_analysis: GitCompare,
    change_vqa: MessageSquareDiff,
    optical_sar: Layers,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/55 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Query Agent analysis workspace"
    >
      {/* Overlay Container */}
      <div
        ref={overlayRef}
        className="relative w-full max-w-7xl bg-white dark:bg-[#0a0f1e] border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-[0.97] duration-200"
        style={{ maxHeight: '90vh', height: '90vh' }}
      >
        {/* ──────────── Header Bar ──────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#070b15] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-600/20 dark:to-cyan-500/20 text-blue-600 dark:text-cyan-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Query Agent
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Your AI satellite analysis workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close Query Agent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ──────────── Scrollable Workspace Body ──────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-5">
          {/* ── Chat / Query Section ── */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0c1120]/80 p-5">
            {/* Welcome message */}
            <div className="flex items-start gap-3 mb-4">
              <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  Hello! I'm your SatQuery AI Agent.
                </p>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                  Ask me anything about your satellite data — I'll automatically select the right analysis capability and process your query.
                </p>
              </div>
            </div>

            {/* Suggested query chips */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                Try:
              </span>
              {OVERLAY_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onQueryChange(s)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700/60 transition-colors shrink-0 whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Large chat input */}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={queryAgentQuery}
                onChange={(e) => onQueryChange(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 text-[13px] leading-relaxed text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#070b15] border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-cyan-500/30 focus:border-blue-500 dark:focus:border-cyan-500/50 font-medium resize-none transition-colors pr-24"
                placeholder="Ask anything about your satellite imagery..."
              />
              <button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className={cn(
                  'absolute right-3 bottom-3 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all duration-150',
                  'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
                  isAnalyzing && 'opacity-70 cursor-not-allowed'
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reasoning…</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Analysis Tools Bar ── */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">
              Analysis Capabilities
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {/* Auto pill (future) */}
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/40 shrink-0 cursor-default"
                title="Auto mode — coming soon"
              >
                <Zap className="w-3 h-3" />
                <span>Auto</span>
              </button>

              {ANALYSIS_TOOLS.map((tool) => {
                const Icon = toolIcons[tool.id] || MessageSquare;
                const isActive = selectedToolId === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolSelect(tool)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150 shrink-0',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-cyan-300 border-blue-300 dark:border-cyan-600/40 shadow-sm'
                        : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tool.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Satellite Imagery Viewer ── */}
          <DualImageryViewer
            modeCategory={modeCategory}
            onCategoryChange={onCategoryChange}
            detectedFeaturesCount={detectedFeaturesCount}
            onInspectRegion={(id) => onInspectRegion(id)}
          />

          {/* ── AI Execution (reuse existing component, execution-only) ── */}
          <QueryAndExecutionPanel
            showQueryInput={false}
            currentQuery={queryAgentQuery}
            onQueryChange={onQueryChange}
            suggestions={[]}
            onSelectSuggestion={() => {}}
            onAnalyze={onAnalyze}
            isAnalyzing={isAnalyzing}
            activeModeName={activeDisplayName}
          />

          {/* ── Results & Evidence (2-column grid) ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <FinalAnswerPanel
              answerSummary={activePresetMode.answerSummary}
              confidence={activePresetMode.confidence}
              evidencePoints={activePresetMode.evidencePoints}
              onViewEvidence={onViewEvidence}
              onViewOnMap={onViewOnMap}
              onDownloadReport={onDownloadReport}
            />
            <ImageMetadataPanel modeCategory={modeCategory} />
          </div>
        </div>
      </div>
    </div>
  );
}
