/**
 * SatQuery AI — Centralized Mock Analysis History
 *
 * 10 demo history entries reusing existing mock data values.
 * Confidence, dates, imagery, and summaries are derived from
 * existing centralized mock data (mockAnalysisResults, mockEvidence, WORKSPACE_MODES).
 */

import type { AnalysisRecord } from '../types';

export const MOCK_ANALYSIS_HISTORY: AnalysisRecord[] = [
  // ─── Single Image VQA ──────────────────────────────────────────
  {
    id: 'history-001',
    title: 'Land Use Pattern Analysis',
    query: 'What infrastructure and agricultural land use patterns are present in this satellite scene?',
    mode: 'single_image',
    capability: 'vqa',
    status: 'completed',
    date: '2026-09-05T14:30:00Z',
    modality: 'Optical',
    isDemo: true,
    resultSummary: 'Identified central rural settlement surrounded by organized crop parcels and unpaved arterial access roads.',
    confidence: 88,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 3,
    imageryType: 'optical',
  },
  {
    id: 'history-002',
    title: 'Scene Content Identification',
    query: 'What objects are visible in this satellite image?',
    mode: 'single_image',
    capability: 'vqa',
    status: 'completed',
    date: '2026-09-03T09:15:00Z',
    modality: 'Optical',
    isDemo: true,
    resultSummary: 'Urban area with residential buildings, road networks, vegetation patches, and a water body in the northeast quadrant.',
    confidence: 82,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 2,
    imageryType: 'optical',
  },

  // ─── Object Grounding ──────────────────────────────────────────
  {
    id: 'history-003',
    title: 'Building Detection & Grounding',
    query: 'Locate all warehouse structures, building footprints, and arterial transportation corridors.',
    mode: 'single_image',
    capability: 'grounding',
    status: 'completed',
    date: '2026-09-04T16:45:00Z',
    modality: 'Optical',
    isDemo: true,
    resultSummary: 'Localized 47 individual building footprints and two primary arterial access corridors.',
    confidence: 93,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 5,
    imageryType: 'optical',
  },
  {
    id: 'history-004',
    title: 'Road Network Extraction',
    query: 'Find all roads and transportation corridors.',
    mode: 'single_image',
    capability: 'grounding',
    status: 'completed',
    date: '2026-08-30T11:20:00Z',
    modality: 'Optical',
    isDemo: true,
    resultSummary: 'Extracted primary and secondary road networks across the analysis area.',
    confidence: 89,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 3,
    imageryType: 'optical',
  },

  // ─── Change Analysis ──────────────────────────────────────────
  {
    id: 'history-005',
    title: 'Urban Expansion Detection',
    query: 'Identify regions with significant urban expansion between the two dates.',
    mode: 'compare_images',
    capability: 'change_detection',
    status: 'completed',
    date: '2026-09-02T10:00:00Z',
    modality: 'Bi-temporal Optical',
    isDemo: true,
    resultSummary: 'Detected 14.8 hectares of land-use change including new warehouse construction and foundation excavation.',
    confidence: 91,
    thumbnail: '/imagery/sat_before.jpg',
    evidenceCount: 5,
    imageryType: 'optical',
    comparisonDates: { t0: '2025-03-12', t1: '2026-03-12' },
  },
  {
    id: 'history-006',
    title: 'Vegetation Change Monitoring',
    query: 'What vegetation changes occurred between these two images?',
    mode: 'compare_images',
    capability: 'change_vqa',
    status: 'completed',
    date: '2026-08-28T13:30:00Z',
    modality: 'Bi-temporal Optical',
    isDemo: true,
    resultSummary: 'Vegetation removal across eastern parcel detected via temporal NDVI comparison.',
    confidence: 87,
    thumbnail: '/imagery/sat_before.jpg',
    evidenceCount: 3,
    imageryType: 'optical',
    comparisonDates: { t0: '2025-03-12', t1: '2026-03-12' },
  },

  // ─── Optical + SAR ─────────────────────────────────────────────
  {
    id: 'history-007',
    title: 'Multimodal Surface Analysis',
    query: 'Compare the optical and SAR imagery for this region.',
    mode: 'optical_sar',
    capability: 'multimodal_analysis',
    status: 'completed',
    date: '2026-09-01T08:45:00Z',
    modality: 'Optical + SAR',
    isDemo: true,
    resultSummary: 'Optical image reveals land-cover distribution. Demo SAR view provides complementary structural visualization.',
    confidence: 78,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 2,
    imageryType: 'optical_sar',
  },
  {
    id: 'history-008',
    title: 'Cross-Modal Terrain Assessment',
    query: 'Analyze terrain features across optical and SAR modalities.',
    mode: 'optical_sar',
    capability: 'multimodal_analysis',
    status: 'completed',
    date: '2026-08-25T15:10:00Z',
    modality: 'Optical + SAR',
    isDemo: true,
    resultSummary: 'Demo multimodal observation comparing optical RGB and SAR visual treatment for terrain features.',
    confidence: 75,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 2,
    imageryType: 'optical_sar',
  },

  // ─── Image Captioning ─────────────────────────────────────────
  {
    id: 'history-009',
    title: 'Scene Description Generation',
    query: 'Generate an exhaustive remote-sensing description of topography, land-cover, and human activity.',
    mode: 'single_image',
    capability: 'captioning',
    status: 'completed',
    date: '2026-08-22T12:00:00Z',
    modality: 'Optical',
    isDemo: true,
    resultSummary: 'High-resolution aerial view displaying agricultural fields intersecting with an emerging industrial/residential perimeter.',
    confidence: 94,
    thumbnail: '/imagery/sat_after.jpg',
    evidenceCount: 3,
    imageryType: 'optical',
  },

  // ─── Demo Status Entries ───────────────────────────────────────
  {
    id: 'history-010',
    title: 'Coastal Erosion Assessment',
    query: 'Assess coastal erosion patterns from temporal imagery.',
    mode: 'compare_images',
    capability: 'change_detection',
    status: 'failed',
    date: '2026-08-20T09:30:00Z',
    modality: 'Bi-temporal Optical',
    isDemo: true,
    resultSummary: 'Demo analysis could not be completed.',
    confidence: 0,
    thumbnail: '/imagery/sat_before.jpg',
    evidenceCount: 0,
    imageryType: 'optical',
    comparisonDates: { t0: '2025-03-12', t1: '2026-03-12' },
  },
];

/**
 * Find a history record by ID
 */
export function findHistoryRecord(id: string): AnalysisRecord | undefined {
  return MOCK_ANALYSIS_HISTORY.find((record) => record.id === id);
}
