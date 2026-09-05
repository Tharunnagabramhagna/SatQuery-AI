import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Phase 2: Centralized Mock Data & Types
import { DEFAULT_BASE_LAYERS, DEFAULT_OVERLAY_LAYERS, BAND_COMBINATIONS } from '../mock/mockLayers';
import { MOCK_REGIONS, MOCK_EVIDENCE } from '../mock/mockEvidence';
import { MOCK_CONFIDENCE, MOCK_STATISTICS, MOCK_PROCESSING_STAGES } from '../mock/mockAnalysisResults';
import type { VisualizationLayer, BandCombination } from '../types/visualization';

export function DashboardPage() {
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

  // Evidence ↔ Viewer interaction handlers
  const handleSelectEvidence = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    const item = MOCK_EVIDENCE.find((e) => e.id === evidenceId);
    if (item?.regionId) {
      setHighlightedRegionId(item.regionId);
    }
  };

  const handleRegionClick = (regionId: string) => {
    setHighlightedRegionId(regionId);
    const item = MOCK_EVIDENCE.find((e) => e.regionId === regionId);
    if (item) {
      setSelectedEvidenceId(item.id);
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

  // Download Report action
  const handleDownloadReport = () => {
    const reportData = {
      project: 'SatQuery AI - Space Intelligence',
      problemStatement: 'SIH26167 - Multimodal Remote Sensing',
      task: activeDisplayName,
      imageryMode: modeCategory,
      timestamp: new Date().toISOString(),
      imagery: {
        sensor: modeCategory === 'fusion' ? 'Sentinel-2 MSI + Sentinel-1 SAR' : 'Sentinel-2 MSI / Landsat 9',
        resolution: '10m GSD',
        crs: 'EPSG:4326',
        coordinates: '28.6139° N, 77.2090° E',
      },
      query: isQueryAgent ? (queryAgentQuery || 'Autonomous Query Agent Satellite Analysis') : activePresetMode.prompt,
      confidence: `${activePresetMode.confidence}% (Demo)`,
      answer: activePresetMode.answerSummary,
      evidence: activePresetMode.evidencePoints,
      detectedFeatures: activePresetMode.detectedFeaturesCount,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SatQuery_Intelligence_Report_${selectedToolId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
              Analyze Your Satellite Imagery
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Ask questions about your remote-sensing data in natural language.
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
