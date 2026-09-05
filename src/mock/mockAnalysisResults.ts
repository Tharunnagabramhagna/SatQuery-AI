import type {
  ConfidenceScore,
  AnalysisStatistics,
  ProcessingStage,
  ImagerySource,
} from '../types/visualization';

// ─── Mock Imagery Sources ────────────────────────────────────────

export const MOCK_IMAGERY_SOURCE_T0: ImagerySource = {
  id: 'src-t0',
  label: 'Previous Acquisition (T0)',
  sensor: 'Sentinel-2 MSI',
  acquisitionDate: '2025-03-12',
  resolution: '10m GSD',
  crs: 'EPSG:4326',
  bounds: '28.60°N–28.63°N, 77.20°E–77.22°E',
  isDemo: true,
};

export const MOCK_IMAGERY_SOURCE_T1: ImagerySource = {
  id: 'src-t1',
  label: 'Current Acquisition (T1)',
  sensor: 'Sentinel-2 MSI',
  acquisitionDate: '2026-03-12',
  resolution: '10m GSD',
  crs: 'EPSG:4326',
  bounds: '28.60°N–28.63°N, 77.20°E–77.22°E',
  isDemo: true,
};

// ─── Mock Confidence Score ───────────────────────────────────────

export const MOCK_CONFIDENCE: ConfidenceScore = {
  overall: 91,
  label: 'Demo Confidence',
  breakdown: [
    { id: 'spatial', label: 'Spatial Consistency', value: 93, isDemo: true },
    { id: 'spectral', label: 'Spectral Match', value: 88, isDemo: true },
    { id: 'temporal', label: 'Temporal Coherence', value: 91, isDemo: true },
    { id: 'model', label: 'Model Agreement', value: 86, isDemo: true },
  ],
  calibrationStatus: 'demo',
  isDemo: true,
};

// ─── Mock Analysis Statistics ────────────────────────────────────

export const MOCK_STATISTICS: AnalysisStatistics = {
  areaChangedHectares: 14.8,
  buildingCount: 47,
  vegetationCoverPercent: 38,
  builtUpPercent: 24,
  landUseChanges: [
    { category: 'Built-up', percentage: 24, color: '#facc15' },
    { category: 'Vegetation', percentage: 38, color: '#22c55e' },
    { category: 'Water', percentage: 8, color: '#3b82f6' },
    { category: 'Bare Soil', percentage: 18, color: '#d97706' },
    { category: 'Agriculture', percentage: 12, color: '#84cc16' },
  ],
  temporalRange: {
    t0: '2025-03-12',
    t1: '2026-03-12',
  },
  isDemo: true,
};

// ─── Mock Processing Stages ──────────────────────────────────────

export const MOCK_PROCESSING_STAGES: ProcessingStage[] = [
  { id: 'ingest', label: 'Imagery Ingestion', status: 'completed', description: 'Sentinel-2 L2A tiles loaded' },
  { id: 'preprocess', label: 'Radiometric Correction', status: 'completed', description: 'Atmospheric correction applied' },
  { id: 'register', label: 'Image Co-registration', status: 'completed', description: 'Sub-pixel alignment verified' },
  { id: 'detect', label: 'Change Detection', status: 'completed', description: 'Bi-temporal analysis complete' },
  { id: 'segment', label: 'Feature Segmentation', status: 'completed', description: 'Building footprints extracted' },
  { id: 'classify', label: 'Land Use Classification', status: 'completed', description: 'Multi-class classification applied' },
  { id: 'validate', label: 'Evidence Generation', status: 'completed', description: 'Confidence scoring complete' },
  { id: 'visualize', label: 'Visualization Rendering', status: 'completed', description: 'Overlay layers generated' },
];
