import { useState } from 'react';
import {
  X,
  ShieldCheck,
  MapPin,
  Layers,
  Sparkles,
  Clock,
  Box,
  Crosshair,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import type { EvidenceItem, EvidenceType } from '../../types/visualization';
import { MOCK_EVIDENCE } from '../../mock/mockEvidence';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  confidence?: number;
  evidenceItems?: EvidenceItem[];
  selectedEvidenceId?: string | null;
  onSelectEvidence?: (evidenceId: string) => void;
  onHighlightRegionOnMap?: (regionId: string) => void;
}

export function EvidenceModal({
  isOpen,
  onClose,
  confidence: _confidence = 91,
  evidenceItems = MOCK_EVIDENCE,
  selectedEvidenceId,
  onSelectEvidence,
  onHighlightRegionOnMap,
}: EvidenceModalProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string>(
    selectedEvidenceId || evidenceItems[0]?.id || 'evidence-1'
  );
  const [filterType, setFilterType] = useState<EvidenceType | 'all'>('all');

  if (!isOpen) return null;

  const currentId = selectedEvidenceId || internalSelectedId;
  const activeItem = evidenceItems.find((e) => e.id === currentId) || evidenceItems[0];

  const filteredItems = filterType === 'all'
    ? evidenceItems
    : evidenceItems.filter((item) => item.type === filterType);

  const handleSelectItem = (id: string) => {
    setInternalSelectedId(id);
    onSelectEvidence?.(id);
  };

  const handleFocusOnMap = (regionId: string) => {
    onHighlightRegionOnMap?.(regionId);
    onClose();
  };

  const getTypeIcon = (type: EvidenceType) => {
    switch (type) {
      case 'spectral':
        return <Sparkles className="w-3 h-3 text-cyan-500" />;
      case 'spatial':
        return <Layers className="w-3 h-3 text-emerald-500" />;
      case 'temporal':
        return <Clock className="w-3 h-3 text-amber-500" />;
      case 'structural':
        return <Box className="w-3 h-3 text-purple-500" />;
    }
  };

  const getTypeBadgeClass = (type: EvidenceType) => {
    switch (type) {
      case 'spectral':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 'spatial':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'temporal':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'structural':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#0a0f1e] border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Evidence Verification & Grounding Trace
                </h3>
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  DEMO EVIDENCE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-criteria analytical evidence linked to satellite imagery detections
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1 px-6 py-2 bg-slate-50 dark:bg-[#070c17] border-b border-slate-200 dark:border-slate-800 text-xs shrink-0 overflow-x-auto">
          <span className="text-[11px] font-medium text-slate-400 mr-2 shrink-0">Filter by type:</span>
          {(['all', 'spectral', 'spatial', 'temporal', 'structural'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize shrink-0',
                filterType === type
                  ? 'bg-blue-600 text-white dark:bg-cyan-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              )}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Modal Main Content: Split 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Column: Evidence List */}
          <div className="md:col-span-5 p-4 overflow-y-auto space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Detected Evidence Points ({filteredItems.length})
            </div>

            {filteredItems.map((item) => {
              const isSelected = item.id === activeItem?.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item.id)}
                  className={cn(
                    'p-3 rounded-xl border transition-all cursor-pointer text-left',
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500/50 shadow-sm ring-1 ring-blue-500/30'
                      : 'bg-white dark:bg-[#080d1a] border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1.5 py-0.5 rounded border capitalize flex items-center gap-1 shrink-0',
                        getTypeBadgeClass(item.type)
                      )}
                    >
                      {getTypeIcon(item.type)}
                      {item.type}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 dark:border-slate-800/50">
                    <span className="text-slate-400 font-mono">
                      Region: <strong className="text-slate-600 dark:text-slate-300">{item.regionId}</strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Conf:</span>
                      <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${item.confidence}%` }}
                        />
                      </div>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {item.confidence}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected Evidence Detail View */}
          <div className="md:col-span-7 p-5 overflow-y-auto flex flex-col justify-between">
            {activeItem ? (
              <div className="space-y-4">
                {/* Title & Badge */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'text-[10px] font-mono px-2 py-0.5 rounded border capitalize flex items-center gap-1',
                        getTypeBadgeClass(activeItem.type)
                      )}
                    >
                      {getTypeIcon(activeItem.type)}
                      {activeItem.type} Evidence
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ID: {activeItem.id}</span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeItem.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {activeItem.description}
                  </p>
                </div>

                {/* Before / After Thumbnail Comparison */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Bi-Temporal Verification Preview (Demo)</span>
                    <span className="font-mono text-[9px] text-slate-400">10m GSD</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 relative group">
                      <img
                        src={activeItem.thumbnailBefore || '/imagery/sat_before.jpg'}
                        alt="Before imagery"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-slate-200 backdrop-blur-xs">
                        T0 Baseline (2025)
                      </div>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 relative group">
                      <img
                        src={activeItem.thumbnailAfter || '/imagery/sat_after.jpg'}
                        alt="After imagery"
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-950/80 text-[9px] font-mono text-emerald-300 border border-emerald-500/30 backdrop-blur-xs">
                        T1 Observation (2026)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytical Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Source Model</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {activeItem.source}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Spectral Band Used</div>
                    <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {activeItem.band}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Detection Method</div>
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {activeItem.detectionMethod}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#080d1a] border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 font-medium">Demonstration Confidence</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${activeItem.confidence}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {activeItem.confidence}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Spatial Anchor Notice */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Linked Spatial Region:
                      </span>{' '}
                      <span className="font-mono text-blue-600 dark:text-cyan-400 font-medium">
                        {activeItem.regionId}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFocusOnMap(activeItem.regionId)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors shadow-xs"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Focus in Viewer</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-12">Select an evidence point to inspect details</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070c17] text-xs shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Audit ID: <strong className="font-mono text-slate-700 dark:text-slate-300">EV-20260312-91</strong></span>
            <span>•</span>
            <span className="font-mono text-amber-500">All metrics simulated demonstration data</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 font-semibold transition-colors text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
