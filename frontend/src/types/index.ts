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
  beforeImage?: File;
  afterImage?: File;
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
  /** Phase 4: Rich history display fields */
  title?: string;
  resultSummary?: string;
  confidence?: number;
  thumbnail?: string;
  evidenceCount?: number;
  imageryType?: 'optical' | 'sar' | 'optical_sar';
  comparisonDates?: { t0: string; t1: string };
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

// ─── Dataset & Scenario Library (Backend-Ready) ───────────────────

export interface DatasetScenario {
  id: string;
  title: string;
  description: string;
  capability: AnalysisCapability;
  mode: AnalysisMode;
  toolId?: string;
  thumbnail: string;
  modality: string;
  query: string;
  datasetName?: string;
  isDemo: boolean;
  confidence?: number;
  featuresCount?: number;
  expectedOutput: string;
  sampleEvidence: string[];
  metadata?: {
    sensor?: string;
    resolution?: string;
    coordinates?: string;
    crs?: string;
    temporalDelta?: string;
  };
}

// ─── Technical Documentation Center (Backend-Ready) ───────────────

export interface DocumentationCallout {
  type: 'note' | 'tip' | 'warning' | 'info';
  text: string;
}

export interface DocumentationSubsection {
  id: string;
  title: string;
  content: string[];
  codeBlock?: {
    language: string;
    code: string;
  };
  callout?: DocumentationCallout;
}

export interface DocumentationSection {
  id: string;
  title: string;
  shortDescription: string;
  category: 'core' | 'agent' | 'workspace' | 'intelligence' | 'engineering';
  icon: string;
  isDemo?: boolean;
  isPlanned?: boolean;
  content: string[];
  subsections?: DocumentationSubsection[];
  flowDiagram?: string[];
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

// ─── Account Settings (Backend-Ready) ───────────────────────────

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

export interface NotificationPreferences {
  analysisCompletion: boolean;
  reportReady: boolean;
  productUpdates: boolean;
}

export interface AnalysisPreferences {
  rememberLastMode: boolean;
  openLatestOnReturn: boolean;
  preserveViewerState: boolean;
  showEvidenceByDefault: boolean;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  analysis: AnalysisPreferences;
}

