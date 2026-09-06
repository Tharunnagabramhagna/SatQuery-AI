/**
 * SatQuery AI — Centralized Mock Dataset & Scenario Library
 *
 * Curated demonstration scenarios representing benchmark remote-sensing tasks.
 * Structured to be backend-ready: the UI consumes these via services/api.ts.
 */

import type { DatasetScenario } from '../types';

export const MOCK_DATASET_SCENARIOS: DatasetScenario[] = [
  // ─── 1. Object Grounding: Building Detection ─────────────────────
  {
    id: 'scenario-grounding-buildings',
    title: 'Urban Building Footprint Grounding',
    description: 'Localize structures and transportation corridors using bounding-box spatial grounding.',
    capability: 'grounding',
    mode: 'single_image',
    toolId: 'grounding',
    thumbnail: '/imagery/sat_after.jpg',
    modality: 'Optical High-Resolution',
    query: 'Locate all warehouse structures, building footprints, and arterial transportation corridors.',
    datasetName: 'Demo scenario based on SpaceNet building testbed',
    isDemo: true,
    confidence: 93,
    featuresCount: 47,
    expectedOutput: 'Localized 47 individual building footprints and two primary arterial access corridors with high spatial fidelity.',
    sampleEvidence: [
      '47 building bounding boxes fitted',
      'Roadway centerline digitized',
      'Spatial consistency checks passed',
    ],
    metadata: {
      sensor: 'Sentinel-2 MSI',
      resolution: '10m GSD',
      coordinates: '28.6139° N, 77.2090° E',
      crs: 'EPSG:4326 · WGS 84',
    },
  },

  // ─── 2. Visual Question Answering: Scene Understanding ──────────
  {
    id: 'scenario-vqa-landuse',
    title: 'Agricultural & Infrastructure VQA',
    description: 'Ask natural-language questions regarding land use patterns, infrastructure, and vegetative zoning.',
    capability: 'vqa',
    mode: 'single_image',
    toolId: 'vqa',
    thumbnail: '/imagery/sat_after.jpg',
    modality: 'Multispectral Optical',
    query: 'What infrastructure and agricultural land use patterns are present in this satellite scene?',
    datasetName: 'Demo scenario based on RSIVQA benchmark',
    isDemo: true,
    confidence: 88,
    featuresCount: 14,
    expectedOutput: 'Identified central rural settlement surrounded by organized crop parcels and unpaved arterial access roads.',
    sampleEvidence: [
      'Central settlement cluster verified',
      '4 agricultural parcels segmented',
      'Spectral consistency check passed',
    ],
    metadata: {
      sensor: 'Sentinel-2 MSI',
      resolution: '10m GSD',
      coordinates: '28.6139° N, 77.2090° E',
      crs: 'EPSG:4326 · WGS 84',
    },
  },

  // ─── 3. Change Detection: Surface Change Analysis ───────────────
  {
    id: 'scenario-change-detection',
    title: 'Bi-Temporal Surface Change Analysis',
    description: 'Map land-cover differences between temporal acquisitions with automated difference mask generation.',
    capability: 'change_detection',
    mode: 'compare_images',
    toolId: 'change_analysis',
    thumbnail: '/imagery/sat_before.jpg',
    modality: 'Bi-temporal Optical',
    query: 'Identify the major changes between these two images.',
    datasetName: 'Demo scenario based on WHU-CD / LEVIR-CD benchmark',
    isDemo: true,
    confidence: 91,
    featuresCount: 3,
    expectedOutput: 'Three significant structural changes were detected in the northern region, highlighting new industrial foundations.',
    sampleEvidence: [
      'Detected structural changes',
      '3 detected change regions',
      'Spatial consistency check passed',
    ],
    metadata: {
      sensor: 'Sentinel-2 MSI (T0 & T1)',
      resolution: '10m GSD',
      temporalDelta: '2025-03-12 → 2026-03-12 (365 days)',
      crs: 'EPSG:4326 · WGS 84',
    },
  },

  // ─── 4. Change Question Answering: Land Conversion ──────────────
  {
    id: 'scenario-change-vqa',
    title: 'Temporal Land Conversion VQA',
    description: 'Query quantitative transitions between agricultural land and built-up industrial expansion.',
    capability: 'change_vqa',
    mode: 'compare_images',
    toolId: 'change_vqa',
    thumbnail: '/imagery/sat_after.jpg',
    modality: 'Bi-temporal Optical',
    query: 'How much agricultural land was converted into built-up structures between 2025 and 2026?',
    datasetName: 'Demo scenario based on ChangeVQA benchmark',
    isDemo: true,
    confidence: 89,
    featuresCount: 8,
    expectedOutput: 'Approximately 14.8 hectares of previously cultivated land transitioned into warehouse foundations and access roads.',
    sampleEvidence: [
      '14.8 ha land-cover conversion verified',
      '8 new structure foundations detected',
      'Bi-temporal registration error < 0.3 px',
    ],
    metadata: {
      sensor: 'Sentinel-2 MSI (T0 & T1)',
      resolution: '10m GSD',
      temporalDelta: '2025-03-12 → 2026-03-12',
      crs: 'EPSG:4326 · WGS 84',
    },
  },

  // ─── 5. Optical + SAR Analysis ───────────────────────────────────
  {
    id: 'scenario-optical-sar',
    title: 'Multimodal Optical & Radar Analysis',
    description: 'Synthesize optical visible spectrum with synthetic aperture radar (SAR) backscatter profiles.',
    capability: 'multimodal_analysis',
    mode: 'optical_sar',
    toolId: 'optical_sar',
    thumbnail: '/imagery/sat_after.jpg',
    modality: 'Optical RGB + C-Band SAR',
    query: 'Analyze complementary structure and surface reflectance across optical and radar backscatter.',
    datasetName: 'Demo scenario based on Sentinel-1 & Sentinel-2 fused testbeds',
    isDemo: true,
    confidence: 87,
    featuresCount: 19,
    expectedOutput: 'Multimodal correlation highlights subsurface roadway foundations and metallic warehouse roofs with high dielectric contrast.',
    sampleEvidence: [
      'Optical visible land-cover baseline registered',
      'SAR backscatter intensity aligned',
      'Cross-sensor coregistration error < 0.5 px',
    ],
    metadata: {
      sensor: 'Sentinel-2 MSI + Sentinel-1 C-SAR',
      resolution: '10m GSD',
      coordinates: '28.6139° N, 77.2090° E',
      crs: 'EPSG:4326 · WGS 84',
    },
  },

  // ─── 6. Image Captioning: Scene Interpretation ──────────────────
  {
    id: 'scenario-captioning-interpretation',
    title: 'Automated Remote-Sensing Captioning',
    description: 'Generate descriptive remote-sensing captions detailing topography, vegetation coverage, and settlements.',
    capability: 'captioning',
    mode: 'single_image',
    toolId: 'captioning',
    thumbnail: '/imagery/sat_after.jpg',
    modality: 'True-Color Optical',
    query: 'Generate an exhaustive remote-sensing description of topography, land-cover, and human activity.',
    datasetName: 'Demo scenario based on UCM-Captions benchmark',
    isDemo: true,
    confidence: 94,
    featuresCount: 22,
    expectedOutput: 'High-resolution aerial view displaying agricultural fields intersecting with an emerging industrial/residential perimeter.',
    sampleEvidence: [
      'Multispectral texture analysis complete',
      'Topographic elevation gradient mapped',
      'Vegetation health index calibrated',
    ],
    metadata: {
      sensor: 'Sentinel-2 MSI',
      resolution: '10m GSD',
      coordinates: '28.6139° N, 77.2090° E',
      crs: 'EPSG:4326 · WGS 84',
    },
  },
];

/**
 * Find a dataset scenario by ID
 */
export function findDatasetScenario(id: string): DatasetScenario | undefined {
  return MOCK_DATASET_SCENARIOS.find((scenario) => scenario.id === id);
}
