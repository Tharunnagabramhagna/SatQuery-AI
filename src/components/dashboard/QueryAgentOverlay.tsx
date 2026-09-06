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
  ChevronDown,
  ImagePlus,
  XCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  ANALYSIS_TOOLS,
  type AnalysisTool,
} from './WorkspaceSecondarySidebar';
import { useTheme } from '../../hooks/useTheme';

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

// Dashboard imagery available for "Use Current Images"
const DASHBOARD_IMAGERY = [
  {
    id: 'sat_before',
    label: 'Previous Image (2025-03-12)',
    src: '/imagery/sat_before.jpg',
    alt: 'Previous Satellite Imagery',
  },
  {
    id: 'sat_after',
    label: 'Current Image (2026-03-12)',
    src: '/imagery/sat_after.jpg',
    alt: 'Current Satellite Imagery',
  },
  {
    id: 'sat_detail',
    label: 'Detail Image',
    src: '/imagery/sat_detail.jpg',
    alt: 'Satellite Detail Imagery',
  },
];

interface AttachedImage {
  name: string;
  src: string;
  type: 'uploaded' | 'dashboard';
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Fullscreen / Maximized state
  const [isMaximized, setIsMaximized] = useState(false);

  // Attached images state
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  // "Use Current Images" dropdown state
  const [isCurrentImagesOpen, setIsCurrentImagesOpen] = useState(false);
  const currentImagesRef = useRef<HTMLDivElement>(null);

  // Reset maximized state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setIsMaximized(false);
      setIsCurrentImagesOpen(false);
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
        if (isCurrentImagesOpen) {
          setIsCurrentImagesOpen(false);
        } else if (isMaximized) {
          setIsMaximized(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMaximized, isCurrentImagesOpen, onClose]);

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

  // Close "Use Current Images" dropdown when clicking outside
  useEffect(() => {
    if (!isCurrentImagesOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (currentImagesRef.current && !currentImagesRef.current.contains(e.target as Node)) {
        setIsCurrentImagesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCurrentImagesOpen]);

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

  // "Add Images" — trigger native file picker
  const handleAddImages = () => {
    fileInputRef.current?.click();
  };

  // Handle file selection from native picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: AttachedImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const objectUrl = URL.createObjectURL(file);
        newImages.push({
          name: file.name,
          src: objectUrl,
          type: 'uploaded',
        });
      }
    }
    setAttachedImages((prev) => [...prev, ...newImages]);

    // Reset file input so re-selecting the same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // "Use Current Images" — attach a dashboard image
  const handleSelectDashboardImage = (image: typeof DASHBOARD_IMAGERY[0]) => {
    // Prevent duplicates
    const exists = attachedImages.some((a) => a.src === image.src);
    if (!exists) {
      setAttachedImages((prev) => [
        ...prev,
        { name: image.label, src: image.src, type: 'dashboard' },
      ]);
    }
    setIsCurrentImagesOpen(false);
  };

  // Remove an attached image
  const handleRemoveImage = (index: number) => {
    setAttachedImages((prev) => {
      const removed = prev[index];
      // Revoke object URL if it was an upload
      if (removed && removed.type === 'uploaded') {
        URL.revokeObjectURL(removed.src);
      }
      return prev.filter((_, i) => i !== index);
    });
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
        backgroundColor: isDark
          ? (isMaximized ? 'rgba(3, 7, 18, 0.95)' : 'rgba(3, 7, 18, 0.6)')
          : (isMaximized ? 'rgba(100, 116, 139, 0.85)' : 'rgba(100, 116, 139, 0.45)'),
        backdropFilter: isMaximized ? 'blur(12px)' : 'blur(5px)',
        WebkitBackdropFilter: isMaximized ? 'blur(12px)' : 'blur(5px)',
      }}
    >
      {/* Hidden file input for "Add Images" */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ──────── Centered Glassmorphic Workspace Container ──────── */}
      <div
        ref={overlayRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative flex flex-col overflow-hidden transition-all duration-200',
          isDark ? 'text-slate-100' : 'text-slate-800',
          isMaximized
            ? 'w-screen h-screen max-w-none rounded-none border-0 shadow-none'
            : cn(
                'w-[88vw] max-w-[1220px] rounded-2xl shadow-2xl animate-in fade-in zoom-in-[0.99] duration-150',
                isDark
                  ? 'border border-cyan-500/25 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_35px_rgba(6,182,212,0.08)]'
                  : 'border border-slate-300/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]'
              )
        )}
        style={{
          backgroundColor: isDark ? 'rgba(10, 18, 36, 0.96)' : 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          height: isMaximized ? '100vh' : 'min(76vh, 730px)',
          minHeight: isMaximized ? '100vh' : '520px',
        }}
      >
        {/* ────── 1. Header Bar ────── */}
        <div className={cn(
          'flex items-center justify-between px-6 py-3.5 border-b shrink-0',
          isDark
            ? 'border-slate-800/90 bg-slate-950/40'
            : 'border-slate-200 bg-slate-50/80'
        )}>
          <div className="flex items-center gap-3.5">
            <div className={cn(
              'p-2 rounded-xl border shadow-sm',
              isDark
                ? 'bg-gradient-to-br from-blue-600/30 to-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-gradient-to-br from-blue-500/15 to-cyan-500/10 text-blue-600 border-blue-300/50'
            )}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className={cn(
                'text-[15px] font-bold tracking-tight leading-tight',
                isDark ? 'text-slate-100' : 'text-slate-900'
              )}>
                Query Agent
              </h2>
              <p className={cn(
                'text-[11.5px] leading-tight mt-0.5',
                isDark ? 'text-slate-400' : 'text-slate-500'
              )}>
                Your AI partner for satellite imagery analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMaximized && (
              <span className={cn(
                'text-[10px] font-mono font-semibold px-2 py-0.5 rounded border hidden sm:inline-flex items-center gap-1',
                isDark
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                  : 'text-blue-600 bg-blue-50 border-blue-200'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full animate-pulse',
                  isDark ? 'bg-cyan-400' : 'bg-blue-500'
                )} />
                MAXIMIZED WORKSPACE
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className={cn(
                'p-1.5 rounded-lg border transition-colors',
                isMaximized
                  ? isDark
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30'
                    : 'bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border-transparent hover:border-slate-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent hover:border-slate-300'
              )}
              title={isMaximized ? 'Restore View (Esc)' : 'Maximize (Fullscreen)'}
              aria-label={isMaximized ? 'Restore View' : 'Maximize View'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'p-1.5 rounded-lg border border-transparent transition-colors',
                isDark
                  ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 hover:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300'
              )}
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
          <div className={cn(
            'w-[260px] lg:w-[290px] shrink-0 border-r flex flex-col overflow-y-auto px-4 py-4',
            isDark
              ? 'border-slate-800/80 bg-slate-950/20'
              : 'border-slate-200 bg-slate-50/60'
          )}>
            <h3 className={cn(
              'text-[11px] font-bold uppercase tracking-wider mb-3 px-1',
              isDark ? 'text-slate-300' : 'text-slate-600'
            )}>
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
                        ? isDark
                          ? 'bg-blue-600/20 text-white border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold'
                          : 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm font-semibold'
                        : isDark
                          ? 'text-slate-300 hover:text-white hover:bg-slate-800/50 border-transparent'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                        isActive
                          ? isDark ? 'text-cyan-300' : 'text-blue-600'
                          : isDark ? 'text-slate-400' : 'text-slate-500'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={cn(
                        'text-xs leading-tight',
                        isActive
                          ? isDark ? 'text-white font-semibold' : 'text-blue-700 font-semibold'
                          : isDark ? 'text-slate-200' : 'text-slate-700'
                      )}>
                        {tool.name}
                      </span>
                      <span className={cn(
                        'text-[10px] truncate leading-tight mt-0.5',
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      )}>
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
            <div className={cn(
              'rounded-xl border p-4 shadow-sm',
              isDark
                ? 'border-slate-800/80 bg-slate-900/40'
                : 'border-slate-200 bg-white/70'
            )}>
              {/* Agent Greeting */}
              <div className="flex items-start gap-3 mb-3">
                <div className={cn(
                  'w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-sm mt-0.5',
                  isDark
                    ? 'bg-blue-500/20 text-cyan-400 border-cyan-500/30'
                    : 'bg-blue-50 text-blue-600 border-blue-200'
                )}>
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className={cn(
                    'text-[13px] font-bold leading-snug',
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  )}>
                    Hello! I'm your SatQuery AI Agent.
                  </h4>
                  <p className={cn(
                    'text-[11.5px] leading-relaxed mt-0.5',
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  )}>
                    I can help you analyze satellite imagery using advanced AI models. Ask me anything about your imagery, and I'll choose the right analysis tool for you.
                  </p>
                </div>
              </div>

              {/* Try Asking Title */}
              <div className="mb-2">
                <span className={cn(
                  'text-[11px] font-semibold',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}>
                  Try asking:
                </span>
              </div>

              {/* 6 Suggestion Buttons Grid (3 cols x 2 rows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {OVERLAY_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onQueryChange(suggestion);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      'px-3 py-2 rounded-lg text-left text-[11px] font-medium border transition-all duration-150 leading-snug shadow-sm',
                      isDark
                        ? 'bg-slate-900/70 hover:bg-blue-950/40 text-slate-300 hover:text-cyan-300 border-slate-700/60 hover:border-cyan-500/40'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* ────── Middle Box: Chat Query Input ────── */}
            <div className={cn(
              'rounded-xl border p-3 shadow-inner flex flex-col transition-all',
              isDark
                ? 'border-slate-700/70 bg-slate-900/70 focus-within:ring-1 focus-within:ring-cyan-500/40 focus-within:border-cyan-500/60'
                : 'border-slate-200 bg-white focus-within:ring-1 focus-within:ring-blue-400/40 focus-within:border-blue-400/60'
            )}>
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
                className={cn(
                  'w-full px-1 py-1 text-xs sm:text-[12.5px] leading-relaxed bg-transparent border-0 focus:outline-none resize-none font-medium',
                  isDark
                    ? 'text-slate-100 placeholder:text-slate-500'
                    : 'text-slate-800 placeholder:text-slate-400'
                )}
                placeholder="Ask anything about your satellite imagery..."
              />

              {/* Attached Images Preview Strip */}
              {attachedImages.length > 0 && (
                <div className={cn(
                  'flex flex-wrap gap-2 pt-2 mt-1 border-t',
                  isDark ? 'border-slate-800/70' : 'border-slate-200'
                )}>
                  {attachedImages.map((img, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'relative group flex items-center gap-2 px-2 py-1.5 rounded-lg border',
                        isDark
                          ? 'bg-slate-800/80 border-slate-700/60'
                          : 'bg-slate-50 border-slate-200'
                      )}
                    >
                      <img
                        src={img.src}
                        alt={img.name}
                        className="w-8 h-8 rounded object-cover border border-slate-600/30"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className={cn(
                          'text-[10px] font-medium truncate max-w-[120px]',
                          isDark ? 'text-slate-200' : 'text-slate-700'
                        )}>
                          {img.name}
                        </span>
                        <span className={cn(
                          'text-[9px]',
                          img.type === 'dashboard'
                            ? isDark ? 'text-cyan-400' : 'text-blue-500'
                            : isDark ? 'text-emerald-400' : 'text-emerald-600'
                        )}>
                          {img.type === 'dashboard' ? 'Dashboard' : 'Uploaded'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className={cn(
                          'p-0.5 rounded-full transition-colors',
                          isDark
                            ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700/80'
                            : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'
                        )}
                        title="Remove image"
                        aria-label={`Remove ${img.name}`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Action Bar */}
              <div className={cn(
                'flex items-center justify-between gap-2 pt-2 mt-1 border-t',
                isDark ? 'border-slate-800/70' : 'border-slate-200'
              )}>
                <div className="flex items-center gap-2">
                  {/* Add Images Button */}
                  <button
                    type="button"
                    onClick={handleAddImages}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                      isDark
                        ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border-slate-700/60'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 border-slate-200'
                    )}
                  >
                    <ImagePlus className={cn(
                      'w-3.5 h-3.5',
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    )} />
                    <span>Add Images</span>
                  </button>

                  {/* Use Current Images Button with Dropdown */}
                  <div className="relative" ref={currentImagesRef}>
                    <button
                      type="button"
                      onClick={() => setIsCurrentImagesOpen(!isCurrentImagesOpen)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                        isCurrentImagesOpen
                          ? isDark
                            ? 'bg-blue-900/40 text-cyan-300 border-cyan-500/40'
                            : 'bg-blue-50 text-blue-700 border-blue-300'
                          : isDark
                            ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border-slate-700/60'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 border-slate-200'
                      )}
                    >
                      <Globe className={cn(
                        'w-3.5 h-3.5',
                        isCurrentImagesOpen
                          ? isDark ? 'text-cyan-400' : 'text-blue-600'
                          : isDark ? 'text-slate-400' : 'text-slate-500'
                      )} />
                      <span>Use Current Images</span>
                      <ChevronDown className={cn(
                        'w-3 h-3 transition-transform',
                        isCurrentImagesOpen && 'rotate-180'
                      )} />
                    </button>

                    {/* Dropdown */}
                    {isCurrentImagesOpen && (
                      <div className={cn(
                        'absolute bottom-full left-0 mb-2 w-72 rounded-xl border shadow-xl z-10 overflow-hidden',
                        isDark
                          ? 'bg-slate-900 border-slate-700/70 shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.5)]'
                          : 'bg-white border-slate-200 shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.1)]'
                      )}>
                        <div className={cn(
                          'px-3 py-2 border-b',
                          isDark ? 'border-slate-800' : 'border-slate-100'
                        )}>
                          <span className={cn(
                            'text-[10px] font-bold uppercase tracking-wider',
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          )}>
                            Dashboard Imagery
                          </span>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          {DASHBOARD_IMAGERY.map((image) => {
                            const isAlreadyAttached = attachedImages.some((a) => a.src === image.src);
                            return (
                              <button
                                key={image.id}
                                type="button"
                                onClick={() => handleSelectDashboardImage(image)}
                                disabled={isAlreadyAttached}
                                className={cn(
                                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
                                  isAlreadyAttached
                                    ? isDark
                                      ? 'opacity-50 cursor-not-allowed bg-slate-800/30'
                                      : 'opacity-50 cursor-not-allowed bg-slate-50'
                                    : isDark
                                      ? 'hover:bg-slate-800/70 text-slate-200 hover:text-white'
                                      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                                )}
                              >
                                <img
                                  src={image.src}
                                  alt={image.alt}
                                  className={cn(
                                    'w-12 h-8 object-cover rounded border',
                                    isDark ? 'border-slate-700' : 'border-slate-200'
                                  )}
                                />
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className={cn(
                                    'text-[11px] font-medium truncate',
                                    isDark ? 'text-slate-200' : 'text-slate-700'
                                  )}>
                                    {image.label}
                                  </span>
                                  <span className={cn(
                                    'text-[9px]',
                                    isDark ? 'text-slate-500' : 'text-slate-400'
                                  )}>
                                    {image.src}
                                  </span>
                                </div>
                                {isAlreadyAttached && (
                                  <CheckCircle2 className={cn(
                                    'w-3.5 h-3.5 shrink-0',
                                    isDark ? 'text-emerald-400' : 'text-emerald-500'
                                  )} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
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

            {/* ────── Bottom Card: Current Imagery Context ────── */}
            <div className={cn(
              'rounded-xl border p-3.5 shadow-sm',
              isDark
                ? 'border-slate-800/80 bg-slate-900/40'
                : 'border-slate-200 bg-white/70'
            )}>
              <div className="flex items-center gap-2 mb-2.5">
                <h5 className={cn(
                  'text-xs font-semibold',
                  isDark ? 'text-slate-200' : 'text-slate-800'
                )}>
                  Current Imagery Context
                </h5>
                <div className={cn(
                  'flex items-center gap-1 text-[11px] font-medium',
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                )}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{modeCategory === 'single' ? '1 image loaded' : '2 images loaded'}</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Thumbnails */}
                <div className="flex items-center gap-3">
                  {modeCategory !== 'single' && (
                    <div>
                      <span className={cn(
                        'block text-[10px] font-medium mb-1',
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      )}>
                        Previous Image (2025-03-12)
                      </span>
                      <img
                        src="/imagery/sat_before.jpg"
                        alt="Previous Satellite Imagery"
                        className={cn(
                          'w-36 h-20 sm:w-44 sm:h-22 object-cover rounded-lg border shadow-sm',
                          isDark ? 'border-slate-700/70' : 'border-slate-200'
                        )}
                      />
                    </div>
                  )}

                  <div>
                    <span className={cn(
                      'block text-[10px] font-medium mb-1',
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    )}>
                      {modeCategory === 'single' ? 'Satellite Scene (2026-03-12)' : 'Current Image (2026-03-12)'}
                    </span>
                    <img
                      src="/imagery/sat_after.jpg"
                      alt="Current Satellite Imagery"
                      className={cn(
                        'w-36 h-20 sm:w-44 sm:h-22 object-cover rounded-lg border shadow-sm',
                        isDark ? 'border-slate-700/70' : 'border-slate-200'
                      )}
                    />
                  </div>
                </div>

                {/* Imagery Metadata Key-Value List */}
                <div className={cn(
                  'grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] w-full md:w-auto shrink-0 pr-2',
                  isDark ? 'text-slate-400' : 'text-slate-500'
                )}>
                  <div className="flex items-center gap-2">
                    <MapPin className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                    <span>Location</span>
                    <span className={cn('font-medium ml-auto', isDark ? 'text-slate-200' : 'text-slate-800')}>New Delhi, India</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Compass className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                    <span>Coordinates</span>
                    <span className={cn('font-medium font-mono text-[10px] ml-auto', isDark ? 'text-slate-200' : 'text-slate-800')}>28.6139° N, 77.2090° E</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Database className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                    <span>Source</span>
                    <span className={cn('font-medium ml-auto', isDark ? 'text-slate-200' : 'text-slate-800')}>Sentinel-2</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Grid className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                    <span>Resolution</span>
                    <span className={cn('font-medium ml-auto', isDark ? 'text-slate-200' : 'text-slate-800')}>10 m</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Crop className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                    <span>Area</span>
                    <span className={cn('font-medium ml-auto', isDark ? 'text-slate-200' : 'text-slate-800')}>12.4 km²</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Cloud className={cn('w-3.5 h-3.5 shrink-0', isDark ? 'text-slate-500' : 'text-slate-400')} />
                    <span>Cloud Cover</span>
                    <span className={cn('font-medium ml-auto', isDark ? 'text-slate-200' : 'text-slate-800')}>2.3%</span>
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
