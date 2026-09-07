import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  WorkspaceSecondarySidebar,
  WORKSPACE_MODES,
  type AnalysisModeConfig,
  type AnalysisTool,
} from '../components/dashboard/WorkspaceSecondarySidebar';
import { DualImageryViewer } from '../components/dashboard/DualImageryViewer';
import { QueryAndExecutionPanel } from '../components/dashboard/QueryAndExecutionPanel';
import { FinalAnswerPanel } from '../components/dashboard/FinalAnswerPanel';
import { LayerControlsPanel } from '../components/dashboard/LayerControlsPanel';
import { ImageMetadataPanel } from '../components/dashboard/ImageMetadataPanel';
import { WorkspaceFooter } from '../components/dashboard/WorkspaceFooter';
import { NewAnalysisModal } from '../components/dashboard/NewAnalysisModal';
import { EvidenceModal } from '../components/dashboard/EvidenceModal';
import { SystemStatusModal } from '../components/dashboard/SystemStatusModal';
import { QueryAgentOverlay } from '../components/dashboard/QueryAgentOverlay';

// Phase 2 & 4: Centralized Mock Data & Types
import { DEFAULT_BASE_LAYERS, DEFAULT_OVERLAY_LAYERS, BAND_COMBINATIONS } from '../mock/mockLayers';
import { MOCK_REGIONS, MOCK_EVIDENCE } from '../mock/mockEvidence';
import {
  MOCK_CONFIDENCE,
  MOCK_STATISTICS,
  MOCK_PROCESSING_STAGES,
  MOCK_IMAGERY_SOURCE_T0,
  MOCK_IMAGERY_SOURCE_T1,
} from '../mock/mockAnalysisResults';
import { MOCK_GROUNDING_BOXES } from '../mock/mockGrounding';
import { findHistoryRecord } from '../mock/mockHistory';
import { findDatasetScenario } from '../mock/mockDatasets';
import { getUserPreferences } from '../services/api';
import type { VisualizationLayer, BandCombination, ComparisonMode, OpticalSarMode } from '../types/visualization';
import { exportReport, type ReportData } from '../utils/reportExport';
import { useTranslation } from '../hooks/useTranslation';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Selected analysis tool (Default: 'change_analysis' to match reference)
  const [selectedToolId, setSelectedToolId] = useState<string>('change_analysis');

  // Independent imagery configuration category ('single' | 'compare' | 'fusion')
  const [modeCategory, setModeCategory] = useState<'single' | 'compare' | 'fusion'>('compare');

  // Active preset mode config for intelligence evidence & metadata
  const [activePresetMode, setActivePresetMode] = useState<AnalysisModeConfig>(
    () => WORKSPACE_MODES.find((m) => m.id === 'change_analysis') || WORKSPACE_MODES[3]
  );

  // User-controlled Query Agent query state (preserved across tool switches)
  const [queryAgentQuery, setQueryAgentQuery] = useState<string>('');

  // Analyzing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Query Agent overlay state
  const [isQueryAgentOpen, setIsQueryAgentOpen] = useState(false);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isMapHighlighted, setIsMapHighlighted] = useState(false);

  // ─── Phase 2: Centralized Layer State ─────────────────────────────
  const [baseLayers, setBaseLayers] = useState<VisualizationLayer[]>(DEFAULT_BASE_LAYERS);
  const [overlayLayers, setOverlayLayers] = useState<VisualizationLayer[]>(DEFAULT_OVERLAY_LAYERS);
  const [activeBandCombo, setActiveBandCombo] = useState<BandCombination>('true_color');

  // ─── Phase 2: Evidence ↔ Viewer Linking State ─────────────────────
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>('evidence-1');
  const [highlightedRegionId, setHighlightedRegionId] = useState<string | null>('region-1');

  // ─── Phase 3: Centralized Comparison, Optical/SAR & Grounding State ─
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('swipe');
  const [opticalSarMode, setOpticalSarMode] = useState<OpticalSarMode>('combined');
  const [selectedGroundingId, setSelectedGroundingId] = useState<string | null>('grounding-1');

  // ─── Phase 4: Restore Analysis from History Navigation ───────────
  const location = useLocation();

  useEffect(() => {
    const navState = location.state as {
      analysisId?: string;
      scenarioId?: string;
      analysisMode?: string;
      toolId?: string;
    } | null;

    if (navState?.scenarioId) {
      const scenario = findDatasetScenario(navState.scenarioId);
      if (scenario) {
        // Map mode to category: 'single_image' -> 'single', 'compare_images' -> 'compare', 'optical_sar' -> 'fusion'
        const category: 'single' | 'compare' | 'fusion' =
          scenario.mode === 'single_image'
            ? 'single'
            : scenario.mode === 'compare_images'
            ? 'compare'
            : 'fusion';
        setModeCategory(category);

        const targetToolId = navState.toolId || scenario.toolId || scenario.capability;
        const matchingMode =
          WORKSPACE_MODES.find((m) => m.id === targetToolId) ||
          WORKSPACE_MODES.find((m) => m.id === scenario.capability) ||
          WORKSPACE_MODES.find((m) => m.category === category) ||
          WORKSPACE_MODES[0];

        if (matchingMode) {
          setActivePresetMode({
            ...matchingMode,
            prompt: scenario.query || matchingMode.prompt,
            answerSummary: scenario.expectedOutput || matchingMode.answerSummary,
            confidence: scenario.confidence && scenario.confidence > 0 ? scenario.confidence : matchingMode.confidence,
            evidencePoints: scenario.sampleEvidence && scenario.sampleEvidence.length > 0 ? scenario.sampleEvidence : matchingMode.evidencePoints,
          });
          setSelectedToolId(matchingMode.id);
        }

        if (scenario.capability === 'grounding' || category === 'single') {
          setSelectedGroundingId('grounding-1');
          setOverlayLayers((prev) =>
            prev.map((l) => (l.type === 'grounding' ? { ...l, visible: true } : l))
          );
        }

        if (category === 'compare') {
          setComparisonMode('swipe');
        } else if (category === 'fusion') {
          setOpticalSarMode('combined');
        }
      }

      // Clear navigation state so refresh or back/forward doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    } else if (navState?.analysisId) {
      const record = findHistoryRecord(navState.analysisId);
      if (record) {
        // Map mode to category: 'single_image' -> 'single', 'compare_images' -> 'compare', 'optical_sar' -> 'fusion'
        const category: 'single' | 'compare' | 'fusion' =
          record.mode === 'single_image'
            ? 'single'
            : record.mode === 'compare_images'
            ? 'compare'
            : 'fusion';
        setModeCategory(category);

        // Find best matching preset mode
        const matchingMode =
          WORKSPACE_MODES.find((m) => m.id === record.capability) ||
          WORKSPACE_MODES.find((m) => m.category === category) ||
          WORKSPACE_MODES[0];

        if (matchingMode) {
          setActivePresetMode({
            ...matchingMode,
            prompt: record.query || matchingMode.prompt,
            answerSummary: record.resultSummary || matchingMode.answerSummary,
            confidence: record.confidence && record.confidence > 0 ? record.confidence : matchingMode.confidence,
          });
          setSelectedToolId(matchingMode.id);
        }

        if (record.capability === 'grounding' || category === 'single') {
          setSelectedGroundingId('grounding-1');
          setOverlayLayers((prev) =>
            prev.map((l) => (l.type === 'grounding' ? { ...l, visible: true } : l))
          );
        }

        if (category === 'compare') {
          setComparisonMode('swipe');
        } else if (category === 'fusion') {
          setOpticalSarMode('combined');
        }
      }

      // Clear navigation state so refresh or back/forward doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    } else {
      // Check user preferences to restore last analysis mode if enabled
      getUserPreferences().then((prefs) => {
        if (prefs.analysis.rememberLastMode) {
          try {
            const savedModeId = localStorage.getItem('satquery-last-mode');
            if (savedModeId) {
              const matchingMode = WORKSPACE_MODES.find((m) => m.id === savedModeId);
              if (matchingMode) {
                setActivePresetMode(matchingMode);
                setSelectedToolId(matchingMode.id);
                setModeCategory(matchingMode.category);
              }
            }
          } catch {
            // ignore localStorage error
          }
        }
      });
    }
  }, [location.state, location.pathname, navigate]);

  const isQueryAgent = selectedToolId === 'query_agent';
  const displayedQuery = isQueryAgent ? queryAgentQuery : activePresetMode.prompt;
  const activeDisplayName = isQueryAgent ? 'Query Agent' : activePresetMode.name;

  // Layer control handlers
  const handleBaseLayerChange = (layerId: string) => {
    setBaseLayers((prev) =>
      prev.map((layer) => ({
        ...layer,
        visible: layer.id === layerId,
      }))
    );
  };

  const handleOverlayToggle = (layerId: string) => {
    setOverlayLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  const handleOverlayOpacityChange = (layerId: string, opacity: number) => {
    setOverlayLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
    );
  };

  const handleBandCombinationChange = (combo: BandCombination) => {
    setActiveBandCombo(combo);
  };

  // Evidence ↔ Viewer interaction handlers (null-safe)
  const handleSelectEvidence = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    const item = MOCK_EVIDENCE.find((e) => e.id === evidenceId);
    if (item?.regionId) {
      setHighlightedRegionId(item.regionId);
      const matchingGrounding = MOCK_GROUNDING_BOXES.find((b) => b.regionId === item.regionId);
      if (matchingGrounding) {
        setSelectedGroundingId(matchingGrounding.id);
      }
    }
  };

  // Grounding selection handler (null-safe evidence linking)
  const handleSelectGrounding = (groundingId: string, regionId: string) => {
    setSelectedGroundingId(groundingId);
    setHighlightedRegionId(regionId);
    const matchingEvidence = MOCK_EVIDENCE.find((e) => e.regionId === regionId);
    if (matchingEvidence) {
      setSelectedEvidenceId(matchingEvidence.id);
    }
  };

  // Region click handler (null-safe evidence & grounding linking)
  const handleRegionClick = (regionId: string) => {
    setHighlightedRegionId(regionId);
    const matchingGrounding = MOCK_GROUNDING_BOXES.find((b) => b.regionId === regionId);
    if (matchingGrounding) {
      setSelectedGroundingId(matchingGrounding.id);
    }
    const matchingEvidence = MOCK_EVIDENCE.find((e) => e.regionId === regionId);
    if (matchingEvidence) {
      setSelectedEvidenceId(matchingEvidence.id);
    }
  };

  const handleInspectRegion = (regionId: string) => {
    handleRegionClick(regionId);
    setIsEvidenceModalOpen(true);
  };

  const handleHighlightRegionOnMap = (regionId: string) => {
    setHighlightedRegionId(regionId);
    setIsMapHighlighted(true);
    setTimeout(() => {
      setIsMapHighlighted(false);
    }, 2500);
  };

  // Tool selection handler
  const handleSelectTool = (tool: AnalysisTool) => {
    setSelectedToolId(tool.id);

    // Architectural rule: Query Agent MUST NOT modify modeCategory!
    // It operates on whatever imagery context is currently active.
    if (tool.id === 'query_agent') {
      return;
    }

    // Preset tool selected: apply its imagery configuration and load mode
    const mode = WORKSPACE_MODES.find((m) => m.id === (tool.modeId || tool.id));
    if (mode) {
      setActivePresetMode(mode);
      setModeCategory(mode.category);
      try {
        localStorage.setItem('satquery-last-mode', mode.id);
      } catch {
        // ignore
      }
      if (tool.id === 'grounding') {
        setOverlayLayers((prev) =>
          prev.map((l) => (l.type === 'grounding' ? { ...l, visible: true } : l))
        );
        setSelectedGroundingId('grounding-1');
        handleSelectGrounding('grounding-1', 'region-1');
      } else if (tool.id === 'change_analysis' || tool.id === 'change_vqa') {
        setComparisonMode('swipe');
      } else if (tool.id === 'optical_sar') {
        setOpticalSarMode('combined');
      }
    }
  };

  // Category switch handler in imagery viewer (Single / Compare / Fusion)
  const handleCategoryChange = (cat: 'single' | 'compare' | 'fusion') => {
    setModeCategory(cat);

    // When Query Agent is active, changing imagery mode (Single / Compare / Fusion)
    // preserves Query Agent as the active capability!
    if (selectedToolId === 'query_agent') {
      return;
    }

    // If on a preset tool whose category doesn't match the new category,
    // switch to a preset mode matching this imagery mode
    if (activePresetMode.category !== cat) {
      const matchingMode = WORKSPACE_MODES.find((m) => m.category === cat);
      if (matchingMode) {
        setActivePresetMode(matchingMode);
        setSelectedToolId(matchingMode.id);
      }
    }
  };

  // Trigger analysis simulation
  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1100);
  };

  // View on map action
  const handleViewOnMap = () => {
    setIsMapHighlighted(true);
    setTimeout(() => {
      setIsMapHighlighted(false);
    }, 2500);
  };

  // Download Report action supporting JSON, TXT, and PDF from unified report data
  const handleDownloadReport = async (format: 'json' | 'txt' | 'pdf' = 'json') => {
    const reportData: ReportData = {
      project: 'SatQuery AI - Space Intelligence',
      problemStatement: 'SIH26167 - Multimodal Remote Sensing',
      task: activeDisplayName,
      taskId: selectedToolId,
      imageryMode: modeCategory,
      timestamp: new Date().toISOString(),
      imagery: {
        sensor: modeCategory === 'fusion' ? 'Sentinel-2 MSI + Sentinel-1 SAR' : 'Sentinel-2 MSI / Landsat 9',
        resolution: '10m GSD',
        crs: 'EPSG:4326',
        coordinates: '28.6139° N, 77.2090° E',
        temporalRange: MOCK_STATISTICS.temporalRange,
      },
      query: isQueryAgent ? (queryAgentQuery || 'Autonomous Query Agent Satellite Analysis') : activePresetMode.prompt,
      confidence: `${activePresetMode.confidence}% (Demo)`,
      confidenceScore: MOCK_CONFIDENCE,
      answer: activePresetMode.answerSummary,
      evidence: activePresetMode.evidencePoints,
      evidenceItems: MOCK_EVIDENCE,
      detectedFeatures: activePresetMode.detectedFeaturesCount,
      statistics: MOCK_STATISTICS,
      processingStages: MOCK_PROCESSING_STAGES,
      isDemo: true,
    };

    await exportReport(reportData, format);
  };

  // Preset loading handler
  const handleLoadPreset = (presetId: string) => {
    const targetMode =
      WORKSPACE_MODES.find((m) => m.id.includes(presetId)) ||
      WORKSPACE_MODES.find((m) => m.category === presetId) ||
      WORKSPACE_MODES[3];

    setActivePresetMode(targetMode);
    setSelectedToolId(targetMode.id);
    setModeCategory(targetMode.category);
  };

  // Query Agent overlay handlers
  const handleOpenQueryAgent = () => {
    setSelectedToolId('query_agent');
    setIsQueryAgentOpen(true);
  };

  const handleCloseQueryAgent = () => {
    setIsQueryAgentOpen(false);
  };

  // Submit query handler: captures query, selects capability if Auto, closes overlay, starts analysis
  const handleSubmitQuery = (submittedQuery?: string) => {
    const finalQuery = submittedQuery !== undefined ? submittedQuery : queryAgentQuery;
    if (finalQuery) {
      setQueryAgentQuery(finalQuery);
    }

    // If in Auto / Query Agent mode, intelligently match query to appropriate capability
    if (selectedToolId === 'query_agent') {
      const qLower = (finalQuery || '').toLowerCase();
      let matchedMode = activePresetMode;

      if (
        qLower.includes('building') ||
        qLower.includes('count') ||
        qLower.includes('locate') ||
        qLower.includes('road')
      ) {
        matchedMode = WORKSPACE_MODES.find((m) => m.id === 'grounding') || activePresetMode;
      } else if (
        qLower.includes('describe') ||
        qLower.includes('land use') ||
        qLower.includes('scene')
      ) {
        matchedMode = WORKSPACE_MODES.find((m) => m.id === 'captioning') || activePresetMode;
      } else if (
        qLower.includes('change') ||
        qLower.includes('urban') ||
        qLower.includes('vegetation')
      ) {
        matchedMode = WORKSPACE_MODES.find((m) => m.id === 'change_analysis') || activePresetMode;
      } else if (
        qLower.includes('radar') ||
        qLower.includes('sar') ||
        qLower.includes('optical') ||
        qLower.includes('penetration')
      ) {
        matchedMode = WORKSPACE_MODES.find((m) => m.id === 'optical_sar') || activePresetMode;
      } else if (
        qLower.includes('one image') ||
        qLower.includes('infrastructure')
      ) {
        matchedMode = WORKSPACE_MODES.find((m) => m.id === 'vqa') || activePresetMode;
      }

      if (matchedMode) {
        setActivePresetMode(matchedMode);
        setModeCategory(matchedMode.category);
        if (matchedMode.id === 'grounding') {
          setOverlayLayers((prev) =>
            prev.map((l) => (l.type === 'grounding' ? { ...l, visible: true } : l))
          );
          setSelectedGroundingId('grounding-1');
          handleSelectGrounding('grounding-1', 'region-1');
        } else if (matchedMode.id === 'change_analysis' || matchedMode.id === 'change_vqa') {
          setComparisonMode('swipe');
        } else if (matchedMode.id === 'optical_sar') {
          setOpticalSarMode('combined');
        }
      }
    }

    // Close overlay immediately
    setIsQueryAgentOpen(false);

    // Start analysis workflow on dashboard
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1100);
  };

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100vh-3.5rem)] w-full bg-slate-100/50 dark:bg-[#060a14]">
      {/* Main Workspace Structure */}
      <div className="flex flex-1 min-h-0 w-full overflow-x-auto">
        {/* Left Navigation Sidebar */}
        <WorkspaceSecondarySidebar
          isQueryAgentOpen={isQueryAgentOpen}
          onOpenQueryAgent={handleOpenQueryAgent}
          onNewAnalysis={() => setIsNewModalOpen(true)}
          onUploadImagery={() => setIsNewModalOpen(true)}
          onRecentAnalyses={() => navigate('/history')}
          onSavedResults={() => navigate('/history?filter=saved')}
        />

        {/* Column 3: Central Workspace & Right Inspector */}
        <div className="flex-1 flex flex-col min-w-0 px-5 py-4 overflow-y-auto">
          {/* Main Title & Subtitle Header matching reference screenshot */}
          <div className="mb-4">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {t('dashboard.title')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* Interactive Workspace Grid — visually present underneath; dimmed & inert when overlay is open */}
          <div
            className={`grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 items-start transition-opacity duration-200 ${
              isQueryAgentOpen ? 'pointer-events-none select-none' : ''
            }`}
            aria-hidden={isQueryAgentOpen}
          >
            {/* Center-Left Content Column (Map Viewer + Query/Execution Panels) */}
            <div className="xl:col-span-9 flex flex-col gap-4 min-w-0">
              {/* Dual Satellite Map Viewer */}
              <div
                className={`transition-all duration-300 ${
                  isMapHighlighted ? 'ring-2 ring-yellow-400 rounded-xl shadow-lg' : ''
                }`}
              >
                <DualImageryViewer
                  modeCategory={modeCategory}
                  onCategoryChange={handleCategoryChange}
                  detectedFeaturesCount={activePresetMode.detectedFeaturesCount}
                  onInspectRegion={handleInspectRegion}
                  layers={overlayLayers}
                  regions={MOCK_REGIONS}
                  highlightedRegionId={highlightedRegionId}
                  onRegionClick={handleRegionClick}
                  imagerySources={{
                    t0: MOCK_IMAGERY_SOURCE_T0,
                    t1: MOCK_IMAGERY_SOURCE_T1,
                    t0Path: '/imagery/sat_before.jpg',
                    t1Path: '/imagery/sat_after.jpg',
                  }}
                  comparisonMode={comparisonMode}
                  onComparisonModeChange={setComparisonMode}
                  opticalSarMode={opticalSarMode}
                  onOpticalSarModeChange={setOpticalSarMode}
                  groundingBoxes={MOCK_GROUNDING_BOXES}
                  selectedGroundingId={selectedGroundingId}
                  onSelectGrounding={handleSelectGrounding}
                />
              </div>

              {/* AI Execution Panel (Query Agent chat is solely inside the Query Agent Overlay) */}
              <QueryAndExecutionPanel
                showQueryInput={false}
                currentQuery={displayedQuery}
                onQueryChange={() => {}}
                suggestions={[]}
                onSelectSuggestion={() => {}}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                activeModeName={activeDisplayName}
              />
            </div>

            {/* Right Inspector Column (Final Answer Panel, Layer Controls & Image Metadata Panel) */}
            <div className="xl:col-span-3 flex flex-col gap-4 min-w-0">
              <FinalAnswerPanel
                answerSummary={activePresetMode.answerSummary}
                confidence={activePresetMode.confidence}
                evidencePoints={activePresetMode.evidencePoints}
                onViewEvidence={() => setIsEvidenceModalOpen(true)}
                onViewOnMap={handleViewOnMap}
                onDownloadReport={handleDownloadReport}
                confidenceScore={MOCK_CONFIDENCE}
                statistics={MOCK_STATISTICS}
                processingStages={MOCK_PROCESSING_STAGES}
              />

              <LayerControlsPanel
                baseLayers={baseLayers}
                overlayLayers={overlayLayers}
                bandCombinations={BAND_COMBINATIONS}
                activeBandCombination={activeBandCombo}
                onBaseLayerChange={handleBaseLayerChange}
                onOverlayToggle={handleOverlayToggle}
                onOverlayOpacityChange={handleOverlayOpacityChange}
                onBandCombinationChange={handleBandCombinationChange}
              />

              <ImageMetadataPanel modeCategory={modeCategory} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <WorkspaceFooter />

      {/* Query Agent Overlay — Focused Input & Intelligence Launcher matching IMAGE 1 */}
      <QueryAgentOverlay
        isOpen={isQueryAgentOpen}
        onClose={handleCloseQueryAgent}
        selectedToolId={selectedToolId}
        onSelectTool={handleSelectTool}
        modeCategory={modeCategory}
        queryAgentQuery={queryAgentQuery}
        onQueryChange={setQueryAgentQuery}
        onSubmitQuery={handleSubmitQuery}
        isAnalyzing={isAnalyzing}
      />

      {/* Supporting Interactive Modals */}
      <NewAnalysisModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onLoadPreset={handleLoadPreset}
      />

      <EvidenceModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        confidence={activePresetMode.confidence}
        evidenceItems={MOCK_EVIDENCE}
        selectedEvidenceId={selectedEvidenceId}
        onSelectEvidence={handleSelectEvidence}
        onHighlightRegionOnMap={handleHighlightRegionOnMap}
      />

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
}
