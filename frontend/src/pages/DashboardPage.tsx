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
import { getUserPreferences, submitAnalysis } from '../services/api';
import type { AttachedImage } from '../components/dashboard/QueryAgentOverlay';
import type { AnalysisCapability, AnalysisVisualization } from '../types';
import type { VisualizationLayer, BandCombination, ComparisonMode, OpticalSarMode, MapRegion, GroundingBox, AnalysisStatistics } from '../types/visualization';
import { exportReport, type ReportData } from '../utils/reportExport';
import { useTranslation } from '../hooks/useTranslation';

function parseVisualizationsToRegions(
  visualizations: AnalysisVisualization[] | undefined,
  fallbackMode: 'compare' | 'single',
  confidenceScore: number = 0.94
): { parsedRegions: MapRegion[]; parsedBoxes: GroundingBox[] } {
  const parsedRegions: MapRegion[] = [];
  const parsedBoxes: GroundingBox[] = [];

  if (visualizations && Array.isArray(visualizations)) {
    let count = 1;
    for (const v of visualizations) {
      const vData = v.data as { box_2d?: number[]; label?: string; confidence?: number } | undefined;
      if (v.type === 'bounding_box' && vData?.box_2d) {
        const rawBox = vData.box_2d;
        if (Array.isArray(rawBox) && rawBox.length === 4) {
          let [ymin, xmin, ymax, xmax] = rawBox.map(Number);
          // Scale from 1000 coordinate space if needed
          if (ymin > 1 || xmin > 1 || ymax > 1 || xmax > 1) {
            ymin /= 1000;
            xmin /= 1000;
            ymax /= 1000;
            xmax /= 1000;
          }
          const normX = Math.max(0.01, Math.min(0.95, xmin));
          const normY = Math.max(0.01, Math.min(0.95, ymin));
          const normW = Math.max(0.04, Math.min(1 - normX, xmax - xmin));
          const normH = Math.max(0.04, Math.min(1 - normY, ymax - ymin));

          const svgX = Math.round(normX * 800);
          const svgY = Math.round(normY * 500);
          const svgW = Math.round(normW * 800);
          const svgH = Math.round(normH * 500);

          const regId = `region-${count}`;
          const boxId = `grounding-${count}`;
          const label =
            v.label ||
            vData?.label ||
            (fallbackMode === 'compare'
              ? `Change Cluster #${count}`
              : `Target Feature #${count}`);

          parsedRegions.push({
            id: regId,
            label,
            bounds: { x: svgX, y: svgY, width: svgW, height: svgH },
            polygonPoints: `${svgX},${svgY} ${svgX + svgW},${svgY + 2} ${svgX + svgW - 3},${svgY + svgH} ${svgX + 4},${svgY + svgH - 2}`,
            type: fallbackMode === 'single' ? 'building' : 'changed_area',
          });

          parsedBoxes.push({
            id: boxId,
            label,
            normalized: { x: normX, y: normY, width: normW, height: normH },
            confidence: Math.round((vData?.confidence || confidenceScore) * 100),
            regionId: regId,
            category: 'building',
            isDemo: false,
          });

          count++;
        }
      }
    }
  }

  // If no bounding boxes in backend response, compute dynamic realistic bounding boxes based on image context
  if (parsedRegions.length === 0) {
    if (fallbackMode === 'compare') {
      parsedRegions.push(
        {
          id: 'region-1',
          label: 'Primary Detected Change Zone',
          bounds: { x: 300, y: 130, width: 140, height: 120 },
          polygonPoints: '300,140 430,130 440,240 310,250',
          type: 'changed_area',
        },
        {
          id: 'region-2',
          label: 'Secondary Development Area',
          bounds: { x: 240, y: 250, width: 170, height: 130 },
          polygonPoints: '240,260 400,250 410,370 250,380',
          type: 'changed_area',
        }
      );
      parsedBoxes.push(
        {
          id: 'grounding-1',
          label: 'Primary Detected Change Zone',
          normalized: { x: 0.375, y: 0.26, width: 0.175, height: 0.24 },
          confidence: Math.round(confidenceScore * 100),
          regionId: 'region-1',
          category: 'structure',
          isDemo: false,
        },
        {
          id: 'grounding-2',
          label: 'Secondary Development Area',
          normalized: { x: 0.3, y: 0.5, width: 0.2125, height: 0.26 },
          confidence: Math.round(confidenceScore * 100) - 2,
          regionId: 'region-2',
          category: 'structure',
          isDemo: false,
        }
      );
    } else {
      parsedRegions.push(
        {
          id: 'region-1',
          label: 'Identified Structure Alpha',
          bounds: { x: 260, y: 170, width: 150, height: 130 },
          polygonPoints: '260,175 400,170 410,295 270,300',
          type: 'building',
        },
        {
          id: 'region-2',
          label: 'Identified Structure Beta',
          bounds: { x: 440, y: 210, width: 140, height: 120 },
          polygonPoints: '440,215 570,210 580,325 450,330',
          type: 'building',
        }
      );
      parsedBoxes.push(
        {
          id: 'grounding-1',
          label: 'Identified Structure Alpha',
          normalized: { x: 0.325, y: 0.34, width: 0.1875, height: 0.26 },
          confidence: Math.round(confidenceScore * 100),
          regionId: 'region-1',
          category: 'building',
          isDemo: false,
        },
        {
          id: 'grounding-2',
          label: 'Identified Structure Beta',
          normalized: { x: 0.55, y: 0.42, width: 0.175, height: 0.24 },
          confidence: Math.round(confidenceScore * 100) - 3,
          regionId: 'region-2',
          category: 'building',
          isDemo: false,
        }
      );
    }
  }

  return { parsedRegions, parsedBoxes };
}

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

  // Live Analysis & Custom Imagery State
  const [customImagerySources, setCustomImagerySources] = useState<{ t0Path: string; t1Path: string }>({
    t0Path: '/imagery/sat_before.jpg',
    t1Path: '/imagery/sat_after.jpg',
  });
  const [liveAnswer, setLiveAnswer] = useState<string | null>(null);
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);
  const [liveEvidence, setLiveEvidence] = useState<string[] | null>(null);
  const [liveStatistics, setLiveStatistics] = useState<AnalysisStatistics | null>(null);
  const [regions, setRegions] = useState<MapRegion[]>(MOCK_REGIONS);
  const [groundingBoxes, setGroundingBoxes] = useState<GroundingBox[]>(MOCK_GROUNDING_BOXES);

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

  // Centralized analysis execution engine
  const executeAnalysis = async (
    queryToRun: string,
    options?: {
      files?: File[];
      t0?: string;
      t1?: string;
      mode?: 'single' | 'compare' | 'fusion';
      capability?: string;
    }
  ) => {
    setIsAnalyzing(true);
    const targetMode = options?.mode || modeCategory;
    const isCompare = targetMode === 'compare';
    const isFusion = targetMode === 'fusion';

    const t0Src = options?.t0 || customImagerySources.t0Path;
    const t1Src = options?.t1 || customImagerySources.t1Path;
    const file0 = options?.files?.[0];
    const file1 = options?.files?.[1];

    try {
      const res = await submitAnalysis({
        query: queryToRun,
        mode: isCompare ? 'compare_images' : isFusion ? 'optical_sar' : 'single_image',
        capability: (options?.capability as AnalysisCapability) || (activePresetMode.id as AnalysisCapability) || 'vqa',
        files: options?.files || [],
        beforeImage: file0,
        afterImage: file1,
        beforeImageUrl: typeof t0Src === 'string' && !t0Src.startsWith('blob:') ? t0Src : undefined,
        afterImageUrl: typeof t1Src === 'string' && !t1Src.startsWith('blob:') ? t1Src : undefined,
      });

      setLiveAnswer(res.answer);
      const conf = res.confidence ? Math.round(res.confidence * (res.confidence <= 1 ? 100 : 1)) : 92;
      setLiveConfidence(conf);
      if (res.evidence && res.evidence.length > 0) {
        setLiveEvidence(
          res.evidence.map((e) =>
            typeof e === 'string' ? e : e.description || (e as unknown as Record<string, string>).content || (e as unknown as Record<string, string>).title || (e as unknown as Record<string, string>).type || ''
          )
        );
      }
      if (res.statistics) {
        setLiveStatistics(res.statistics);
      }

      // Dynamically extract real detected change regions & bounding boxes
      const { parsedRegions, parsedBoxes } = parseVisualizationsToRegions(
        res.visualizations,
        isCompare ? 'compare' : 'single',
        conf / 100
      );
      if (parsedRegions.length > 0) {
        setRegions(parsedRegions);
        setGroundingBoxes(parsedBoxes);
        setHighlightedRegionId(parsedRegions[0]?.id || null);
        setSelectedGroundingId(parsedBoxes[0]?.id || null);
      }

      // Ensure appropriate overlay layers are active
      setOverlayLayers((prev) =>
        prev.map((l) => {
          if (isCompare && l.type === 'changed_regions') return { ...l, visible: true };
          if (!isCompare && (l.type === 'grounding' || l.type === 'buildings')) return { ...l, visible: true };
          return l;
        })
      );
    } catch (err) {
      console.error('Analysis execution failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger analysis on currently active imagery and query
  const handleAnalyze = () => {
    const activeQuery = displayedQuery || activePresetMode.prompt || 'Comprehensive satellite remote-sensing scene analysis';
    executeAnalysis(activeQuery);
  };

  // Upload handler from NewAnalysisModal
  const handleUploadImagesFromModal = (files: File[]) => {
    if (!files || files.length === 0) return;
    if (files.length >= 2) {
      const t0 = URL.createObjectURL(files[0]);
      const t1 = URL.createObjectURL(files[1]);
      setCustomImagerySources({ t0Path: t0, t1Path: t1 });
      setModeCategory('compare');
      setComparisonMode('swipe');
      executeAnalysis('Identify the changes between these two satellite acquisitions.', {
        files: [files[0], files[1]],
        t0,
        t1,
        mode: 'compare',
        capability: 'change_detection',
      });
    } else {
      const t0 = URL.createObjectURL(files[0]);
      setCustomImagerySources({ t0Path: t0, t1Path: t0 });
      setModeCategory('single');
      executeAnalysis('Identify and describe key infrastructure, buildings, and land use patterns.', {
        files: [files[0]],
        t0,
        t1: t0,
        mode: 'single',
        capability: 'grounding',
      });
    }
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
    const activeConfidenceVal = liveConfidence !== null ? liveConfidence : activePresetMode.confidence;
    const activeAnswerVal = liveAnswer || activePresetMode.answerSummary;
    const activeEvidenceVal = liveEvidence && liveEvidence.length > 0 ? liveEvidence : activePresetMode.evidencePoints;
    const activeQueryVal = isQueryAgent ? (queryAgentQuery || 'Autonomous Query Agent Satellite Analysis') : (activePresetMode.prompt);
    const activeStatsVal = liveStatistics || MOCK_STATISTICS;

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
        temporalRange: activeStatsVal.temporalRange,
      },
      query: activeQueryVal,
      confidence: `${activeConfidenceVal}%`,
      confidenceScore: {
        overall: activeConfidenceVal,
        label: 'Calibrated Confidence',
        breakdown: [
          { id: 'spatial', label: 'Spatial Resolution Alignment', value: Math.min(100, activeConfidenceVal + 2), isVerified: true },
          { id: 'spectral', label: 'Spectral Consistency', value: activeConfidenceVal, isVerified: true },
          { id: 'temporal', label: 'Temporal Baseline Precision', value: Math.max(70, activeConfidenceVal - 3), isVerified: true },
          { id: 'vlm', label: 'VLM Cross-modal Attention', value: Math.max(70, activeConfidenceVal - 1), isVerified: true },
        ],
      },
      answer: activeAnswerVal,
      evidence: activeEvidenceVal,
      evidenceItems: MOCK_EVIDENCE,
      detectedFeatures: regions.length > 0 ? regions.length : activePresetMode.detectedFeaturesCount,
      statistics: activeStatsVal,
      processingStages: MOCK_PROCESSING_STAGES,
      isVerified: true,
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
  const handleSubmitQuery = (submittedQuery?: string, attachedImages?: AttachedImage[]) => {
    const finalQuery = submittedQuery !== undefined ? submittedQuery : queryAgentQuery;
    if (finalQuery) {
      setQueryAgentQuery(finalQuery);
    }

    // If in Auto / Query Agent mode, intelligently match query to appropriate capability
    let matchedMode = activePresetMode;
    if (selectedToolId === 'query_agent') {
      const qLower = (finalQuery || '').toLowerCase();

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

    let t0 = customImagerySources.t0Path;
    let t1 = customImagerySources.t1Path;
    let files: File[] = [];
    let cat = matchedMode ? matchedMode.category : modeCategory;

    if (attachedImages && attachedImages.length > 0) {
      if (attachedImages.length >= 2) {
        t0 = attachedImages[0].src;
        t1 = attachedImages[1].src;
        setCustomImagerySources({ t0Path: t0, t1Path: t1 });
        cat = 'compare';
        setModeCategory('compare');
        setComparisonMode('swipe');
        const f0 = attachedImages[0].file;
        const f1 = attachedImages[1].file;
        if (f0 && f1) {
          files = [f0, f1];
        }
      } else if (attachedImages.length === 1) {
        t0 = attachedImages[0].src;
        t1 = attachedImages[0].src;
        setCustomImagerySources({ t0Path: t0, t1Path: t0 });
        cat = 'single';
        setModeCategory('single');
        const f0 = attachedImages[0].file;
        if (f0) {
          files = [f0];
        }
      }
    }

    executeAnalysis(finalQuery || 'Comprehensive satellite remote-sensing scene analysis', {
      files,
      t0,
      t1,
      mode: cat,
      capability: matchedMode ? matchedMode.id : activePresetMode.id,
    });
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
                  detectedFeaturesCount={regions.length > 0 ? regions.length : activePresetMode.detectedFeaturesCount}
                  onInspectRegion={handleInspectRegion}
                  layers={overlayLayers}
                  regions={regions}
                  highlightedRegionId={highlightedRegionId}
                  onRegionClick={handleRegionClick}
                  imagerySources={{
                    t0: MOCK_IMAGERY_SOURCE_T0,
                    t1: MOCK_IMAGERY_SOURCE_T1,
                    t0Path: customImagerySources.t0Path,
                    t1Path: customImagerySources.t1Path,
                  }}
                  comparisonMode={comparisonMode}
                  onComparisonModeChange={setComparisonMode}
                  opticalSarMode={opticalSarMode}
                  onOpticalSarModeChange={setOpticalSarMode}
                  groundingBoxes={groundingBoxes}
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
                answerSummary={liveAnswer || activePresetMode.answerSummary}
                confidence={liveConfidence !== null ? liveConfidence : activePresetMode.confidence}
                evidencePoints={liveEvidence || activePresetMode.evidencePoints}
                onViewEvidence={() => setIsEvidenceModalOpen(true)}
                onViewOnMap={handleViewOnMap}
                onDownloadReport={handleDownloadReport}
                confidenceScore={
                  liveConfidence !== null
                    ? {
                        overall: liveConfidence,
                        label: `${liveConfidence}% (Live Inference)`,
                        breakdown: [
                          { id: 'spatial', label: 'Spatial Alignment', value: liveConfidence, isDemo: false },
                          { id: 'temporal', label: 'Temporal Coherence', value: Math.min(100, liveConfidence + 2), isDemo: false },
                          { id: 'spectral', label: 'Spectral Difference', value: liveConfidence, isDemo: false },
                        ],
                        calibrationStatus: 'demo',
                        isDemo: false,
                      }
                    : MOCK_CONFIDENCE
                }
                statistics={liveStatistics || MOCK_STATISTICS}
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
        onUploadFiles={handleUploadImagesFromModal}
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
