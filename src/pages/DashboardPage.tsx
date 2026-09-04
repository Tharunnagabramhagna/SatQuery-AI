import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceNavRail } from '../components/dashboard/WorkspaceNavRail';
import {
  WorkspaceSecondarySidebar,
  WORKSPACE_MODES,
  type AnalysisModeConfig,
  type AnalysisTool,
} from '../components/dashboard/WorkspaceSecondarySidebar';
import { DualImageryViewer } from '../components/dashboard/DualImageryViewer';
import { QueryAndExecutionPanel } from '../components/dashboard/QueryAndExecutionPanel';
import { FinalAnswerPanel } from '../components/dashboard/FinalAnswerPanel';
import { ImageMetadataPanel } from '../components/dashboard/ImageMetadataPanel';
import { WorkspaceFooter } from '../components/dashboard/WorkspaceFooter';
import { NewAnalysisModal } from '../components/dashboard/NewAnalysisModal';
import { EvidenceModal } from '../components/dashboard/EvidenceModal';
import { SystemStatusModal } from '../components/dashboard/SystemStatusModal';

const QUERY_AGENT_SUGGESTIONS = [
  'What objects are visible?',
  'How many buildings are present?',
  'Describe the scene',
];

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

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isMapHighlighted, setIsMapHighlighted] = useState(false);

  const isQueryAgent = selectedToolId === 'query_agent';
  const displayedQuery = isQueryAgent ? queryAgentQuery : activePresetMode.prompt;
  const displayedSuggestions = isQueryAgent ? QUERY_AGENT_SUGGESTIONS : activePresetMode.suggestions;
  const activeDisplayName = isQueryAgent ? 'Query Agent' : activePresetMode.name;

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
      confidence: `${activePresetMode.confidence}%`,
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

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100vh-3.5rem)] w-full bg-slate-100/50 dark:bg-[#060a14]">
      {/* 3-Column Workspace Main Structure */}
      <div className="flex flex-1 min-h-0 w-full overflow-x-auto">
        {/* Column 1: Far-Left Icon Rail */}
        <WorkspaceNavRail
          onNewAnalysis={() => setIsNewModalOpen(true)}
          onUploadImagery={() => setIsNewModalOpen(true)}
          onRecentAnalyses={() => navigate('/history')}
          onSavedResults={() => navigate('/history?filter=saved')}
          activeItem="new"
        />

        {/* Column 2: Secondary Sidebar */}
        <WorkspaceSecondarySidebar
          activeToolId={selectedToolId}
          onSelectTool={handleSelectTool}
          onNewAnalysis={() => setIsNewModalOpen(true)}
          onUploadImagery={() => setIsNewModalOpen(true)}
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

          {/* Interactive Workspace Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 items-start">
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
                  onInspectRegion={() => setIsEvidenceModalOpen(true)}
                />
              </div>

              {/* Natural Language Query Panel & AI Execution Panel */}
              <QueryAndExecutionPanel
                showQueryInput={isQueryAgent}
                currentQuery={displayedQuery}
                onQueryChange={(q) => {
                  if (isQueryAgent) setQueryAgentQuery(q);
                }}
                suggestions={displayedSuggestions}
                onSelectSuggestion={(s) => {
                  if (isQueryAgent) setQueryAgentQuery(s);
                }}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                activeModeName={activeDisplayName}
              />
            </div>

            {/* Right Inspector Column (Final Answer Panel & Image Metadata Panel) */}
            <div className="xl:col-span-3 flex flex-col gap-4 min-w-0">
              <FinalAnswerPanel
                answerSummary={activePresetMode.answerSummary}
                confidence={activePresetMode.confidence}
                evidencePoints={activePresetMode.evidencePoints}
                onViewEvidence={() => setIsEvidenceModalOpen(true)}
                onViewOnMap={handleViewOnMap}
                onDownloadReport={handleDownloadReport}
              />

              <ImageMetadataPanel modeCategory={modeCategory} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <WorkspaceFooter />

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
      />

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
}
