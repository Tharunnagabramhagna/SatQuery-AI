import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Search,
  Filter,
  Layers,
  ArrowRight,
  X,
  Play,
  RotateCcw,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  FileCode2,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import { getDatasets, uploadDatasetZip } from '../services/api';
import type { DatasetScenario, AnalysisMode } from '../types';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../utils/cn';

type ModeFilter = 'all' | AnalysisMode;

export function DatasetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<DatasetScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [selectedScenario, setSelectedScenario] = useState<DatasetScenario | null>(null);

  const loadScenarios = () => {
    setIsLoading(true);
    getDatasets()
      .then((data) => {
        setScenarios(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dataset scenarios:', err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadScenarios();
  }, []);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadMessage(null);
      const res = await uploadDatasetZip(file);
      setUploadMessage(`Success: ${res.message}`);
      loadScenarios();
    } catch (err: any) {
      setUploadMessage(`Error: ${err.message || 'Failed to upload dataset'}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedScenario(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      // Mode filter
      if (modeFilter !== 'all' && scenario.mode !== modeFilter) {
        return false;
      }

      // Search query filter (title, description, capability, modality, datasetName)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = scenario.title.toLowerCase().includes(q);
        const matchesDesc = scenario.description.toLowerCase().includes(q);
        const matchesCap = scenario.capability.toLowerCase().includes(q);
        const matchesModal = scenario.modality.toLowerCase().includes(q);
        const matchesDataset = scenario.datasetName?.toLowerCase().includes(q) || false;

        if (!matchesTitle && !matchesDesc && !matchesCap && !matchesModal && !matchesDataset) {
          return false;
        }
      }

      return true;
    });
  }, [scenarios, modeFilter, searchQuery]);

  const handleLaunchAnalysis = (scenario: DatasetScenario) => {
    navigate('/dashboard', {
      state: {
        scenario,
        scenarioId: scenario.id,
        analysisMode: scenario.mode,
        toolId: scenario.toolId || scenario.capability,
      },
    });
  };


  const resetFilters = () => {
    setSearchQuery('');
    setModeFilter('all');
  };

  const getModeLabel = (mode: AnalysisMode) => {
    switch (mode) {
      case 'single_image':
        return t('viewer.singleImage');
      case 'compare_images':
        return t('viewer.compareImages');
      case 'optical_sar':
        return t('viewer.opticalSar');
      default:
        return mode;
    }
  };

  const getCapabilityLabel = (cap: string) => {
    switch (cap) {
      case 'grounding':
        return t('datasets.capGrounding');
      case 'vqa':
        return t('datasets.capVqa');
      case 'change_detection':
        return t('datasets.capChangeDetection');
      case 'change_vqa':
        return t('datasets.capChangeVqa');
      case 'multimodal_analysis':
        return t('datasets.capMultimodalFusion');
      case 'captioning':
        return t('datasets.capCaptioning');
      default:
        return cap.replace('_', ' ');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 space-y-6">
      {/* ─── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Database className="w-6 h-6 text-cyan-500" aria-hidden="true" />
              {t('datasets.title')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('datasets.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              disabled={isUploading}
              className="hidden"
            />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm transition-colors cursor-pointer">
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting ZIP...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" /> Upload Dataset (.zip)
                </>
              )}
            </span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/dashboard')}
            icon={<Sparkles className="w-3.5 h-3.5 text-cyan-500" />}
          >
            {t('datasets.openWorkspace')}
          </Button>
        </div>
      </div>

      {uploadMessage && (
        <div
          className={cn(
            'p-3 rounded-lg text-xs font-medium border transition-all',
            uploadMessage.startsWith('Success')
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
          )}
        >
          {uploadMessage}
        </div>
      )}

      {/* ─── Search & Filter Bar ─────────────────────────────────── */}
      <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('datasets.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              aria-label="Search scenarios"
            />
          </div>

          {/* Mode Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 pl-1 pr-1">
              <Filter className="w-3 h-3" /> {t('history.filterMode')}
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
                {mode === 'all' ? t('datasets.all') : getModeLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count & Clear Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            {t('common.showing')} <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredScenarios.length}</span> {t('common.of')} {scenarios.length} {t('datasets.curatedScenarios')}
          </div>
          {(searchQuery || modeFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> {t('datasets.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Scenario Cards Grid ─────────────────────────────────── */}
      {isLoading ? (
        <LoadingState
          message={t('datasets.loadingScenarios')}
          subMessage={t('datasets.loadingSubMessage')}
          variant="card"
          className="py-16"
        />
      ) : filteredScenarios.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('datasets.noScenariosFound')}
          description={
            searchQuery
              ? t('datasets.noScenariosMatch').replace('{query}', searchQuery)
              : t('datasets.noScenariosMode')
          }
          actionLabel={t('datasets.clearFilters')}
          onAction={resetFilters}
          secondaryActionLabel={t('datasets.openWorkspace')}
          onSecondaryAction={() => navigate('/dashboard')}
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredScenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md hover:border-cyan-500/40 transition-all duration-200"
            >
              {/* Card Image Header */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <img
                  src={scenario.thumbnail}
                  alt={scenario.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Top Overlay Badges */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-black/60 text-white/90 backdrop-blur-sm border border-white/10 flex items-center gap-1">
                    <Layers className="w-2.5 h-2.5 text-cyan-400" />
                    {getModeLabel(scenario.mode)}
                  </span>
                </div>

                {/* Bottom Overlay Modality Tag */}
                <div className="absolute bottom-2 left-2.5 right-2.5">
                  <span className="text-[10px] font-mono text-cyan-300 drop-shadow-sm truncate block">
                    {scenario.modality}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {getCapabilityLabel(scenario.capability)}
                    </span>
                    {scenario.confidence !== undefined && (
                      <span className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {scenario.confidence}% Conf.
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-500 transition-colors line-clamp-1 mb-1">
                    {scenario.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
                    {scenario.description}
                  </p>
                </div>

                {/* Card Action Row */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]">
                    {scenario.datasetName}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedScenario(scenario)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 hover:underline cursor-pointer"
                  >
                    <span>{t('datasets.viewDetails')}</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Scenario Detail Modal ───────────────────────────────── */}
      {selectedScenario && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="scenario-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSelectedScenario(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-[#0c1324] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {getCapabilityLabel(selectedScenario.capability)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedScenario(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-700 dark:text-slate-300">
              {/* Image Preview Banner */}
              <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                <img
                  src={selectedScenario.thumbnail}
                  alt={selectedScenario.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div>
                    <h2 id="scenario-modal-title" className="text-base sm:text-lg font-bold text-white drop-shadow-sm">
                      {selectedScenario.title}
                    </h2>
                    <p className="text-[11px] text-cyan-300 font-mono">
                      {selectedScenario.modality} · {getModeLabel(selectedScenario.mode)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description & Dataset Reference */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  {t('datasets.scenarioOverview')}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedScenario.description}
                </p>
                {selectedScenario.datasetName && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">
                    {t('datasets.source')}: {selectedScenario.datasetName}
                  </p>
                )}
              </div>

              {/* Metadata Grid */}
              {selectedScenario.metadata && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-cyan-500" /> {t('datasets.platformSensorMetadata')}
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    {selectedScenario.metadata.sensor && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">{t('datasets.sensorPlatform')}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedScenario.metadata.sensor}</span>
                      </div>
                    )}
                    {selectedScenario.metadata.resolution && (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">{t('datasets.spatialResolution')}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{selectedScenario.metadata.resolution}</span>
                      </div>
                    )}
                    {selectedScenario.metadata.coordinates && (
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-cyan-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">{t('datasets.geoCoordinates')}</span>
                          <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">{selectedScenario.metadata.coordinates}</span>
                        </div>
                      </div>
                    )}
                    {selectedScenario.metadata.temporalDelta && (
                      <div className="flex items-start gap-1">
                        <Clock className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">{t('datasets.temporalAcquisition')}</span>
                          <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">{selectedScenario.metadata.temporalDelta}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Demonstration Query */}
              <div className="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 block mb-1">
                  {t('datasets.demoQueryPrompt')}
                </span>
                <p className="text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed">
                  "{selectedScenario.query}"
                </p>
              </div>

              {/* Expected Output */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                  {t('datasets.expectedObservation')}
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  {selectedScenario.expectedOutput}
                </p>
              </div>

              {/* Sample Evidence Points */}
              {selectedScenario.sampleEvidence && selectedScenario.sampleEvidence.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                    {t('datasets.preCalculatedEvidence')}
                  </span>
                  <div className="space-y-1">
                    {selectedScenario.sampleEvidence.map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedScenario(null)}
              >
                {t('common.close')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleLaunchAnalysis(selectedScenario)}
                icon={<Play className="w-3.5 h-3.5 fill-current" />}
              >
                {t('datasets.launchAnalysis')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
