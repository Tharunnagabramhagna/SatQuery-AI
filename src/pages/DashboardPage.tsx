import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkspaceNavRail } from '../components/dashboard/WorkspaceNavRail';
import {
  WorkspaceSecondarySidebar,
  WORKSPACE_MODES,
  type AnalysisModeConfig,
} from '../components/dashboard/WorkspaceSecondarySidebar';
import { DualImageryViewer } from '../components/dashboard/DualImageryViewer';
import { QueryAndExecutionPanel } from '../components/dashboard/QueryAndExecutionPanel';
import { FinalAnswerPanel } from '../components/dashboard/FinalAnswerPanel';
import { ImageMetadataPanel } from '../components/dashboard/ImageMetadataPanel';
import { WorkspaceFooter } from '../components/dashboard/WorkspaceFooter';
import { NewAnalysisModal } from '../components/dashboard/NewAnalysisModal';
import { EvidenceModal } from '../components/dashboard/EvidenceModal';
import { SystemStatusModal } from '../components/dashboard/SystemStatusModal';

export function DashboardPage() {
  const navigate = useNavigate();

  // Active analysis mode (Default: 'change_analysis' to exactly match reference screenshot)
  const [activeMode, setActiveMode] = useState<AnalysisModeConfig>(
    () => WORKSPACE_MODES.find((m) => m.id === 'change_analysis') || WORKSPACE_MODES[3]
  );

  // Sub-nav category ('single' | 'compare' | 'fusion')
  const [modeCategory, setModeCategory] = useState<'single' | 'compare' | 'fusion'>('compare');

  // Query state
  const [currentQuery, setCurrentQuery] = useState(
    'Identify the major changes between these two images.'
  );

  // Analyzing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isMapHighlighted, setIsMapHighlighted] = useState(false);

  // Mode selection handler
  const handleSelectMode = (mode: AnalysisModeConfig) => {
    setActiveMode(mode);
    setModeCategory(mode.category);
    setCurrentQuery(mode.prompt);
  };

  // Category switch handler (Single / Compare / Fusion)
  const handleCategoryChange = (cat: 'single' | 'compare' | 'fusion') => {
    setModeCategory(cat);
    const matchingMode = WORKSPACE_MODES.find((m) => m.category === cat);
    if (matchingMode) {
      setActiveMode(matchingMode);
      setCurrentQuery(matchingMode.prompt);
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
      task: activeMode.name,
      timestamp: new Date().toISOString(),
      imagery: {
        sensor: 'Sentinel-2 MSI / Landsat 9',
        resolution: '10m GSD',
        crs: 'EPSG:4326',
        coordinates: '28.6139° N, 77.2090° E',
      },
      query: currentQuery,
      confidence: `${activeMode.confidence}%`,
      answer: activeMode.answerSummary,
      evidence: activeMode.evidencePoints,
      detectedFeatures: activeMode.detectedFeaturesCount,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SatQuery_Intelligence_Report_${activeMode.id}_${Date.now()}.json`;
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

    handleSelectMode(targetMode);
  };

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100vh-3.25rem)] w-full bg-slate-100/50 dark:bg-[#060a14]">
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
          activeModeId={activeMode.id}
          onSelectMode={handleSelectMode}
          onNewAnalysis={() => setIsNewModalOpen(true)}
          onUploadImagery={() => setIsNewModalOpen(true)}
          onSavedResults={() => navigate('/history?filter=saved')}
        />

        {/* Column 3: Central Workspace & Right Inspector */}
        <div className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 py-4 overflow-y-auto">
          {/* Main Title & Subtitle Header matching reference screenshot */}
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Analyze Your Satellite Imagery
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
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
                  detectedFeaturesCount={activeMode.detectedFeaturesCount}
                  onInspectRegion={() => setIsEvidenceModalOpen(true)}
                />
              </div>

              {/* Natural Language Query Panel & AI Execution Panel */}
              <QueryAndExecutionPanel
                currentQuery={currentQuery}
                onQueryChange={setCurrentQuery}
                suggestions={activeMode.suggestions}
                onSelectSuggestion={(s) => setCurrentQuery(s)}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
                activeModeName={activeMode.name}
              />
            </div>

            {/* Right Inspector Column (Final Answer Panel & Image Metadata Panel) */}
            <div className="xl:col-span-3 flex flex-col gap-3 min-w-0">
              <FinalAnswerPanel
                answerSummary={activeMode.answerSummary}
                confidence={activeMode.confidence}
                evidencePoints={activeMode.evidencePoints}
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
        confidence={activeMode.confidence}
      />

      <SystemStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
}
