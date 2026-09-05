import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Bot,
  Sparkles,
  Image as ImageIcon,
  FileText,
  ScanSearch,
  TrendingUp,
  MessageSquareDiff,
  Layers,
  Maximize2,
  Minimize2,
  Paperclip,
  Globe,
  Send,
  Loader2,
  MapPin,
  Compass,
  Database,
  Grid,
  Crop,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  ANALYSIS_TOOLS,
  type AnalysisTool,
} from './WorkspaceSecondarySidebar';

const OVERLAY_SUGGESTIONS = [
  'What are the main changes between these two images?',
  'How many buildings are in this area?',
  'Describe the land use in this image',
  'Detect roads and highways',
  'Has there been urban expansion in this region?',
  'Compare vegetation changes over time',
];

// Virtual Auto tool — always first capability
const AUTO_TOOL: AnalysisTool = {
  id: 'auto',
  name: 'Auto (Let AI decide)',
  icon: Sparkles,
  description: 'Automatically choose the best tool',
};

// Map tool IDs to specific descriptive subtitles matching IMAGE 1
const TOOL_SUBTITLES: Record<string, string> = {
  auto: 'Automatically choose the best tool',
  vqa: 'Ask questions about one image',
  captioning: 'Generate detailed descriptions',
  grounding: 'Locate objects in imagery',
  change_analysis: 'Detect changes between images',
  change_vqa: 'Ask questions about changes',
  optical_sar: 'Multi-modal analysis (Optical + SAR)',
};

interface QueryAgentOverlayProps {
  isOpen: boolean;
  onClose: () => void;

  // Selected tool state
  selectedToolId: string;
  onSelectTool: (tool: AnalysisTool) => void;

  // Imagery context
  modeCategory: 'single' | 'compare' | 'fusion';

  // Query state
  queryAgentQuery: string;
  onQueryChange: (query: string) => void;

  // Analysis trigger (captures query, closes overlay, runs dashboard analysis)
  onSubmitQuery: (submittedQuery?: string) => void;
  isAnalyzing: boolean;
}

export function QueryAgentOverlay({
  isOpen,
  onClose,
  selectedToolId,
  onSelectTool,
  modeCategory,
  queryAgentQuery,
  onQueryChange,
  onSubmitQuery,
  isAnalyzing,
}: QueryAgentOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fullscreen / Maximized state
  const [isMaximized, setIsMaximized] = useState(false);

  // Reset maximized state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setIsMaximized(false);
    }
  }, [isOpen]);

  // Track active tool inside overlay (defaults to 'auto' if query_agent is active)
  const activeToolId = selectedToolId === 'query_agent' ? 'auto' : selectedToolId;

  // Escape key handler: exits maximized mode first, or closes overlay if not maximized
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isMaximized) {
          setIsMaximized(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMaximized, onClose]);

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

  // Auto-focus the chat input immediately when the overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Backdrop click handler: close when clicking outside overlay container
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Submit query handler: captures query, triggers analysis, and closes overlay
  const handleSend = (queryToSend?: string) => {
    if (isAnalyzing) return;
    const finalQuery = (queryToSend !== undefined ? queryToSend : queryAgentQuery).trim();
    onSubmitQuery(finalQuery);
  };

  // Tool selection handler
  const handleToolClick = (tool: AnalysisTool) => {
    if (tool.id === 'auto') {
      onSelectTool({ id: 'query_agent', name: 'Query Agent', icon: Bot });
    } else {
      onSelectTool(tool);
    }
  };

  if (!isOpen) return null;

  const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    auto: Sparkles,
    vqa: ImageIcon,
    captioning: FileText,
    grounding: ScanSearch,
    change_analysis: TrendingUp,
    change_vqa: MessageSquareDiff,
    optical_sar: Layers,
  };

  const allTools = [AUTO_TOOL, ...ANALYSIS_TOOLS];

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center transition-all duration-200',
        isMaximized ? 'p-0' : 'p-4 sm:p-6 lg:p-8'
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Query Agent"
      style={{
        backgroundColor: isMaximized ? 'rgba(3, 7, 18, 0.95)' : 'rgba(3, 7, 18, 0.6)',
        backdropFilter: isMaximized ? 'blur(12px)' : 'blur(5px)',
        WebkitBackdropFilter: isMaximized ? 'blur(12px)' : 'blur(5px)',
      }}
    >
      {/* ──────── Centered Glassmorphic Workspace Container matching IMAGE 1 ──────── */}
      <div
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'dark relative flex flex-col overflow-hidden text-slate-100 transition-all duration-200',
          isMaximized
            ? 'w-screen h-screen max-w-none rounded-none border-0 shadow-none'
            : 'w-[88vw] max-w-[1220px] rounded-2xl border border-slate-700/60 dark:border-cyan-500/25 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_35px_rgba(6,182,212,0.08)] animate-in fade-in zoom-in-[0.99] duration-150'
        )}
        style={{
          backgroundColor: 'rgba(10, 18, 36, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          height: isMaximized ? '100vh' : 'min(76vh, 730px)',
          minHeight: isMaximized ? '100vh' : '520px',
        }}
      >
        {/* ────── 1. Header Bar ────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800/90 bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/30 to-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-100 tracking-tight leading-tight">
                Query Agent
              </h2>
              <p className="text-[11.5px] text-slate-400 leading-tight mt-0.5">
                Your AI partner for satellite imagery analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMaximized && (
              <span className="text-[10px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                MAXIMIZED WORKSPACE
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className={cn(
                'p-1.5 rounded-lg border transition-colors',
                isMaximized
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border-transparent hover:border-slate-700'
              )}
              title={isMaximized ? 'Restore View (Esc)' : 'Maximize (Fullscreen)'}
              aria-label={isMaximized ? 'Restore View' : 'Maximize View'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-colors"
              title="Close (Esc)"
              aria-label="Close Query Agent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ────── 2. Two-Column Main Workspace ────── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ────── Left Column: Analysis Tools ────── */}
          <div className="w-[260px] lg:w-[290px] shrink-0 border-r border-slate-800/80 flex flex-col overflow-y-auto bg-slate-950/20 px-4 py-4">
            <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-3 px-1">
              Analysis Tools
            </h3>

            <div className="space-y-1.5">
              {allTools.map((tool) => {
                const Icon = toolIcons[tool.id] || Sparkles;
                const isActive = activeToolId === tool.id;
                const subtitle = TOOL_SUBTITLES[tool.id] || tool.description || '';

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolClick(tool)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 border',
                      isActive
                        ? 'bg-blue-600/20 text-white border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50 border-transparent'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                        isActive ? 'text-cyan-300' : 'text-slate-400'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={cn('text-xs leading-tight', isActive ? 'text-white font-semibold' : 'text-slate-200')}>
                        {tool.name}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                        {subtitle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ────── Right Column: Chat & Input & Imagery Context ────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-4 space-y-3.5">
            {/* ────── Top Card: AI Welcome & Suggested Questions ────── */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 shadow-sm">
              {/* Agent Greeting */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-slate-100 leading-snug">
                    Hello! I'm your SatQuery AI Agent.
                  </h4>
                  <p className="text-[11.5px] text-slate-300 leading-relaxed mt-0.5">
                    I can help you analyze satellite imagery using advanced AI models. Ask me anything about your imagery, and I'll choose the right analysis tool for you.
                  </p>
                </div>
              </div>

              {/* Try Asking Title */}
              <div className="mb-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Try asking:
                </span>
              </div>

              {/* 6 Suggestion Buttons Grid (3 cols x 2 rows) matching IMAGE 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {OVERLAY_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onQueryChange(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-2 rounded-lg text-left text-[11px] font-medium bg-slate-900/70 hover:bg-blue-950/40 text-slate-300 hover:text-cyan-300 border border-slate-700/60 hover:border-cyan-500/40 transition-all duration-150 leading-snug shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* ────── Middle Box: Chat Query Input matching IMAGE 1 ────── */}
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-inner flex flex-col focus-within:ring-1 focus-within:ring-cyan-500/40 focus-within:border-cyan-500/60 transition-all">
              <textarea
                ref={inputRef}
                value={queryAgentQuery}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                className="w-full px-1 py-1 text-xs sm:text-[12.5px] leading-relaxed text-slate-100 bg-transparent border-0 focus:outline-none resize-none placeholder:text-slate-500 font-medium"
                placeholder="Ask anything about your satellite imagery..."
              />

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-slate-800/70">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    <span>Add Images</span>
                  </button>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Use Current Images</span>
                    <span className="text-[10px] text-slate-400">▾</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isAnalyzing}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all duration-150',
                    'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25',
                    isAnalyzing && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ────── Bottom Card: Current Imagery Context matching IMAGE 1 ────── */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <h5 className="text-xs font-semibold text-slate-200">
                  Current Imagery Context
                </h5>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{modeCategory === 'single' ? '1 image loaded' : '2 images loaded'}</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Thumbnails */}
                <div className="flex items-center gap-3">
                  {modeCategory !== 'single' && (
                    <div>
                      <span className="block text-[10px] font-medium text-slate-400 mb-1">
                        Previous Image (2025-03-12)
                      </span>
                      <img
                        src="/imagery/sat_before.jpg"
                        alt="Previous Satellite Imagery"
                        className="w-36 h-20 sm:w-44 sm:h-22 object-cover rounded-lg border border-slate-700/70 shadow-sm"
                      />
                    </div>
                  )}

                  <div>
                    <span className="block text-[10px] font-medium text-slate-400 mb-1">
                      {modeCategory === 'single' ? 'Satellite Scene (2026-03-12)' : 'Current Image (2026-03-12)'}
                    </span>
                    <img
                      src="/imagery/sat_after.jpg"
                      alt="Current Satellite Imagery"
                      className="w-36 h-20 sm:w-44 sm:h-22 object-cover rounded-lg border border-slate-700/70 shadow-sm"
                    />
                  </div>
                </div>

                {/* Imagery Metadata Key-Value List matching IMAGE 1 */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-400 w-full md:w-auto shrink-0 pr-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Location</span>
                    <span className="text-slate-200 font-medium ml-auto">New Delhi, India</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Coordinates</span>
                    <span className="text-slate-200 font-medium font-mono text-[10px] ml-auto">28.6139° N, 77.2090° E</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Source</span>
                    <span className="text-slate-200 font-medium ml-auto">Sentinel-2</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Grid className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Resolution</span>
                    <span className="text-slate-200 font-medium ml-auto">10 m</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Crop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Area</span>
                    <span className="text-slate-200 font-medium ml-auto">12.4 km²</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Cloud className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Cloud Cover</span>
                    <span className="text-slate-200 font-medium ml-auto">2.3%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
