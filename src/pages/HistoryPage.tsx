import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  History,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Sparkles,
  Layers,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { getAnalysisHistory } from '../services/api';
import type { AnalysisRecord, AnalysisMode } from '../types';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { cn } from '../utils/cn';

type StatusFilter = 'all' | 'completed' | 'in_progress' | 'failed';
type ModeFilter = 'all' | AnalysisMode;

export function HistoryPage() {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let mounted = true;
    getAnalysisHistory()
      .then((records) => {
        if (mounted) {
          setHistoryItems(records);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load analysis history:', err);
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      // Mode filter
      if (modeFilter !== 'all' && item.mode !== modeFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Search filter (query, title, capability)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = item.query?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesCapability = item.capability?.toLowerCase().includes(q);
        if (!matchesQuery && !matchesTitle && !matchesCapability) return false;
      }

      return true;
    });
  }, [historyItems, modeFilter, statusFilter, searchQuery]);

  const handleOpenAnalysis = (item: AnalysisRecord) => {
    if (item.status === 'failed') return;
    navigate('/dashboard', {
      state: {
        analysisId: item.id,
        analysisMode: item.mode,
        toolId: item.capability,
      },
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setModeFilter('all');
    setStatusFilter('all');
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getModeLabel = (mode: AnalysisMode) => {
    switch (mode) {
      case 'single_image':
        return 'Single Image';
      case 'compare_images':
        return 'Compare Images';
      case 'optical_sar':
        return 'Optical + SAR';
      default:
        return mode;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <History className="w-6 h-6 text-cyan-500" aria-hidden="true" />
              Analysis History
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              Demo Archive
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Browse and reopen previous simulated reasoning runs, spatial detections, and multimodal analyses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/dashboard')}
            icon={<Sparkles className="w-3.5 h-3.5 text-cyan-500" />}
          >
            New Analysis
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, query, or capability..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              aria-label="Search analysis history"
            />
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 pl-1 pr-1">
              <Filter className="w-3 h-3" /> Mode:
            </span>
            {(['all', 'single_image', 'compare_images', 'optical_sar'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setModeFilter(mode)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                  modeFilter === mode
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                )}
              >
                {mode === 'all' ? 'All' : getModeLabel(mode)}
              </button>
            ))}
          </div>

          {/* Status Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 pl-1 pr-1">
              Status:
            </span>
            {(['all', 'completed', 'in_progress', 'failed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                  statusFilter === status
                    ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                {status === 'all'
                  ? 'All'
                  : status === 'in_progress'
                  ? 'In Progress'
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results summary bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredItems.length}</span> of {historyItems.length} demonstration records
          </div>
          {(searchQuery || modeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState
          message="Loading demonstration history..."
          subMessage="Retrieving pre-computed remote-sensing analysis runs"
          variant="card"
          className="py-16"
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching analysis records found"
          description={
            searchQuery
              ? `No records match "${searchQuery}" with the current filters.`
              : 'No analysis records found for the selected mode and status.'
          }
          actionLabel="Reset Filters"
          onAction={resetFilters}
          secondaryActionLabel="Open Workspace"
          onSecondaryAction={() => navigate('/dashboard')}
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isCompleted = item.status === 'completed';
            const isInProgress = item.status === 'in_progress';
            const isFailed = item.status === 'failed';

            return (
              <div
                key={item.id}
                className={cn(
                  'group flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 bg-white/70 dark:bg-[#0b1120]/70 backdrop-blur-sm shadow-sm hover:shadow-md',
                  isCompleted
                    ? 'border-slate-200 dark:border-slate-800 hover:border-cyan-500/40'
                    : isFailed
                    ? 'border-rose-300/40 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-cyan-300/40 dark:border-cyan-900/40 bg-cyan-50/20 dark:bg-cyan-950/10'
                )}
              >
                <div>
                  {/* Top header row: Badges and Date */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Mode Badge */}
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5 text-cyan-500" />
                        {getModeLabel(item.mode)}
                      </span>

                      {/* Capability Badge */}
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                        {item.capability.replace('_', ' ')}
                      </span>

                      {/* Status Badge */}
                      {isCompleted && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                        </span>
                      )}
                      {isInProgress && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1 animate-pulse">
                          <Clock className="w-2.5 h-2.5" /> In Progress (Demo)
                        </span>
                      )}
                      {isFailed && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> Failed (Demo)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(item.date)}</span>
                    </div>
                  </div>

                  {/* Body with Thumbnail + Title/Query */}
                  <div className="flex gap-3 items-start mb-3">
                    {/* Thumbnail */}
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt="Demo analysis preview"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 px-1 py-0.2 bg-black/60 text-[9px] text-white/80 font-mono tracking-tighter">
                        DEMO
                      </span>
                    </div>

                    {/* Query & Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-cyan-500 transition-colors">
                        {item.title || item.query}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        "{item.query}"
                      </p>
                    </div>
                  </div>

                  {/* Summary / Result snippet */}
                  {item.resultSummary && (
                    <div className="p-2 rounded-lg bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 mb-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 mr-1.5">
                        Observation:
                      </span>
                      <span className="line-clamp-2">{item.resultSummary}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Metadata stats & Open Analysis button */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {item.confidence !== undefined && item.confidence > 0 && (
                      <span className="flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Confidence: <strong className="text-slate-700 dark:text-slate-200">{item.confidence}%</strong>
                      </span>
                    )}
                    {item.evidenceCount !== undefined && item.evidenceCount > 0 && (
                      <span className="hidden sm:inline-block">
                        Evidence: <strong className="text-slate-700 dark:text-slate-200">{item.evidenceCount}</strong>
                      </span>
                    )}
                    {item.comparisonDates && (
                      <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400">
                        {item.comparisonDates.t0} → {item.comparisonDates.t1}
                      </span>
                    )}
                  </div>

                  {isCompleted ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenAnalysis(item)}
                      className="font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 px-2.5 py-1 text-xs"
                    >
                      <span>Open Analysis</span>
                      <ArrowUpRight className="w-3.5 h-3.5 ml-1 text-cyan-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Button>
                  ) : isInProgress ? (
                    <span className="text-[11px] text-sky-500 dark:text-sky-400 italic">
                      Simulated in progress
                    </span>
                  ) : (
                    <span className="text-[11px] text-rose-500 dark:text-rose-400 italic">
                      Simulated failure
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
