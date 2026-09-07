// ─── Visualization Layer Types ───────────────────────────────────

export type LayerCategory = 'base' | 'overlay';
export type BaseLayerType = 'rgb' | 'nir' | 'ndvi' | 'sar';
export type OverlayLayerType = 'buildings' | 'changed_regions' | 'roads' | 'vegetation' | 'grounding';
export type BandCombination = 'true_color' | 'agriculture' | 'urban' | 'water';

export interface VisualizationLayer {
  id: string;
  name: string;
  category: LayerCategory;
  type: BaseLayerType | OverlayLayerType;
  visible: boolean;
  opacity: number; // 0–100
  color?: string; // overlay display color
  description?: string;
}

export interface BandCombinationOption {
  id: BandCombination;
  name: string;
  description: string;
  bands: string;
}

// ─── Map Region & Geometry ───────────────────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapRegion {
  id: string;
  label: string;
  bounds: BoundingBox;
  /** SVG polygon points string for complex shapes */
  polygonPoints?: string;
  type: 'building' | 'changed_area' | 'road' | 'vegetation' | 'point_of_interest';
}

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

// ─── Imagery Source ──────────────────────────────────────────────

export interface ImagerySource {
  id: string;
  label: string;
  sensor: string;
  acquisitionDate: string;
  resolution: string;
  crs: string;
  bounds?: string;
  isDemo: boolean;
}

// ─── Evidence Types ──────────────────────────────────────────────

export type EvidenceType = 'spectral' | 'spatial' | 'temporal' | 'structural';

export interface EvidenceItem {
  id: string;
  title: string;
  description: string;
  type: EvidenceType;
  /** Stable region ID linking to MapRegion */
  regionId: string;
  /** Source model or method */
  source: string;
  /** Spectral band used */
  band: string;
  /** Detection method description */
  detectionMethod: string;
  /** Confidence for this specific evidence (0–100) */
  confidence: number;
  /** Thumbnail image path (mock) */
  thumbnailBefore?: string;
  thumbnailAfter?: string;
  isDemo: boolean;
}

// ─── Confidence Types ────────────────────────────────────────────

export interface ConfidenceBreakdownDimension {
  id: string;
  label: string;
  value: number; // 0–100
  isDemo: boolean;
}

export interface ConfidenceScore {
  overall: number; // 0–100
  label: string; // e.g. "Demo Confidence"
  breakdown: ConfidenceBreakdownDimension[];
  calibrationStatus: 'demo' | 'not_available'; // never claim "calibrated" in mock
  isDemo: boolean;
}

// ─── Analysis Statistics ─────────────────────────────────────────

export interface LandUseChange {
  category: string;
  percentage: number;
  color: string;
}

export interface AnalysisStatistics {
  areaChangedHectares: number;
  buildingCount: number;
  vegetationCoverPercent: number;
  builtUpPercent: number;
  landUseChanges: LandUseChange[];
  temporalRange: {
    t0: string;
    t1: string;
  };
  isDemo: boolean;
}

// ─── Analysis Result (Phase 2 Enhanced) ──────────────────────────

export interface AnalysisResultPhase2 {
  id: string;
  query: string;
  analysisType: string;
  imagerySource: ImagerySource;
  answerSummary: string;
  confidence: ConfidenceScore;
  evidence: EvidenceItem[];
  statistics: AnalysisStatistics;
  processingStages: ProcessingStage[];
  regions: MapRegion[];
  isDemo: boolean;
}

export interface ProcessingStage {
  id: string;
  label: string;
  status: 'completed' | 'skipped' | 'pending';
  description?: string;
}

// ─── Phase 3 Modes & Grounding Types ──────────────────────────────

export type ComparisonMode = 'swipe' | 'side_by_side';
export type OpticalSarMode = 'optical' | 'sar' | 'combined';

export interface NormalizedBounds {
  x: number;      // 0..1
  y: number;      // 0..1
  width: number;  // 0..1
  height: number; // 0..1
}

export interface GroundingBox {
  id: string;
  label: string;
  normalized: NormalizedBounds;
  confidence: number; // e.g. 93 for "Demo Confidence 93%"
  regionId: string;   // stable link to MOCK_REGIONS
  category: 'building' | 'structure' | 'infrastructure' | 'parcel';
  isDemo: boolean;
}

export interface ExecutionStage {
  id: string;
  step: number;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

