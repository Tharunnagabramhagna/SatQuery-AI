// ─── Analysis Modes ──────────────────────────────────────────────

export type AnalysisMode = 'single_image' | 'compare_images' | 'optical_sar';

export type AnalysisCapability =
  | 'vqa'
  | 'captioning'
  | 'grounding'
  | 'change_detection'
  | 'change_vqa'
  | 'change_localization'
  | 'multimodal_analysis';

export interface CapabilityInfo {
  id: AnalysisCapability;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  mode: AnalysisMode;
}

export interface ModeInfo {
  id: AnalysisMode;
  name: string;
  description: string;
  icon: string;
  capabilities: AnalysisCapability[];
}

// ─── Upload ──────────────────────────────────────────────────────

export type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'uploaded' | 'error';

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  metadata: ImageMetadata | null;
  error: string | null;
}

export interface ImageMetadata {
  filename: string;
  fileSize: number;
  dimensions: { width: number; height: number } | null;
  format: string;
  sensor: string | null;
  acquisitionDate: string | null;
  crs: string | null;
  resolution: string | null;
  bands: number | null;
  bounds: string | null;
  isDemo: boolean;
}

// ─── Analysis ────────────────────────────────────────────────────

export type AnalysisStatus = 'idle' | 'validating' | 'uploading' | 'analyzing' | 'completed' | 'error';

export interface AnalysisRequest {
  query: string;
  mode: AnalysisMode;
  capability: AnalysisCapability;
  files: File[];
}

export interface AnalysisResponse {
  analysisId: string;
  status: AnalysisStatus;
  task: AnalysisCapability;
  answer: string;
  confidence: number;
  evidence: AnalysisEvidence[];
  visualizations: AnalysisVisualization[];
  executionTrace: ExecutionTraceStep[];
  warnings: string[];
  isDemo: boolean;
}

export interface AnalysisEvidence {
  type: string;
  description: string;
  source: string;
}

export interface AnalysisVisualization {
  type: 'bounding_box' | 'polygon' | 'mask' | 'heatmap' | 'point';
  data: unknown;
  label: string;
}

export interface ExecutionTraceStep {
  step: number;
  action: string;
  detail: string;
  duration: number;
  status: 'completed' | 'skipped' | 'failed';
}

// ─── Analysis Record (History) ───────────────────────────────────

export interface AnalysisRecord {
  id: string;
  query: string;
  mode: AnalysisMode;
  capability: AnalysisCapability;
  status: 'completed' | 'failed' | 'in_progress';
  date: string;
  modality: string;
  isDemo: boolean;
  response?: AnalysisResponse;
}

// ─── Demo ────────────────────────────────────────────────────────

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  mode: AnalysisMode;
  capability: AnalysisCapability;
  query: string;
  imageLabels: string[];
  mockResponse: AnalysisResponse;
}

// ─── Error ───────────────────────────────────────────────────────

export interface ValidationError {
  field: 'image' | 'image_before' | 'image_after' | 'image_optical' | 'image_sar' | 'mode' | 'capability' | 'query';
  message: string;
}

// ─── System ──────────────────────────────────────────────────────

export type SystemHealthStatus = 'operational' | 'degraded' | 'down' | 'demo';

export interface SystemStatus {
  status: SystemHealthStatus;
  label: string;
  isDemo: boolean;
  lastChecked: string;
}

// ─── Navigation ──────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  section?: string;
}

// ─── Analysis Workflow State ─────────────────────────────────────

export type AnalysisStep = 1 | 2 | 3 | 4 | 5;

export interface AnalysisWorkflowState {
  currentStep: AnalysisStep;
  mode: AnalysisMode | null;
  capability: AnalysisCapability | null;
  query: string;
  images: Record<string, UploadedImage | null>;
  status: AnalysisStatus;
  errors: ValidationError[];
  isDemo: boolean;
  response: AnalysisResponse | null;
}
