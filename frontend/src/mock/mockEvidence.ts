import type { EvidenceItem, MapRegion } from '../types/visualization';

// ─── Mock Map Regions (stable IDs for evidence ↔ viewer linking) ─

export const MOCK_REGIONS: MapRegion[] = [
  {
    id: 'region-1',
    label: 'Northern Warehouse Complex',
    bounds: { x: 420, y: 110, width: 150, height: 130 },
    polygonPoints: '420,120 540,110 570,220 440,240',
    type: 'changed_area',
  },
  {
    id: 'region-2',
    label: 'Central Structural Foundation',
    bounds: { x: 370, y: 250, width: 140, height: 110 },
    polygonPoints: '370,260 480,250 510,340 390,360',
    type: 'changed_area',
  },
  {
    id: 'region-3',
    label: 'Eastern Cleared Parcel',
    bounds: { x: 590, y: 150, width: 90, height: 120 },
    polygonPoints: '590,160 670,150 680,260 600,270',
    type: 'changed_area',
  },
  {
    id: 'region-4',
    label: 'Building Footprint A',
    bounds: { x: 440, y: 130, width: 35, height: 40 },
    type: 'building',
  },
  {
    id: 'region-5',
    label: 'Building Footprint B',
    bounds: { x: 490, y: 145, width: 40, height: 45 },
    type: 'building',
  },
];

// ─── Mock Evidence Items ─────────────────────────────────────────

export const MOCK_EVIDENCE: EvidenceItem[] = [
  {
    id: 'evidence-1',
    title: 'New Warehouse Construction',
    description:
      'Spectral analysis confirms high-reflectance roofing material consistent with corrugated metal warehouse construction detected in the northern region.',
    type: 'spectral',
    regionId: 'region-1',
    source: 'VLM Change Detection Model',
    band: 'B04 (Red) + B08 (NIR)',
    detectionMethod: 'Bi-temporal spectral differencing',
    confidence: 94,
    thumbnailBefore: '/imagery/sat_before.jpg',
    thumbnailAfter: '/imagery/sat_after.jpg',
    isDemo: true,
  },
  {
    id: 'evidence-2',
    title: 'Foundation Excavation Detected',
    description:
      'Spatial texture analysis reveals ground disturbance patterns consistent with large-scale foundation excavation and earthmoving activity.',
    type: 'spatial',
    regionId: 'region-2',
    source: 'Object Grounding Model',
    band: 'B03 (Green) + B04 (Red)',
    detectionMethod: 'Texture gradient analysis',
    confidence: 87,
    thumbnailBefore: '/imagery/sat_before.jpg',
    thumbnailAfter: '/imagery/sat_after.jpg',
    isDemo: true,
  },
  {
    id: 'evidence-3',
    title: 'Land Clearance Activity',
    description:
      'Temporal comparison shows vegetation removal across 4.2 hectares in the eastern parcel between T0 and T1 acquisition dates.',
    type: 'temporal',
    regionId: 'region-3',
    source: 'Change VQA Agent',
    band: 'NDVI (B08-B04)/(B08+B04)',
    detectionMethod: 'NDVI temporal differencing',
    confidence: 91,
    thumbnailBefore: '/imagery/sat_before.jpg',
    thumbnailAfter: '/imagery/sat_after.jpg',
    isDemo: true,
  },
  {
    id: 'evidence-4',
    title: 'Structural Footprint Verification',
    description:
      'Building footprint geometry validated against high-resolution sub-pixel analysis confirming rectangular structural signatures.',
    type: 'structural',
    regionId: 'region-4',
    source: 'Building Segmentation Model',
    band: 'B02 (Blue) + B04 (Red)',
    detectionMethod: 'Edge detection + morphological analysis',
    confidence: 88,
    thumbnailBefore: '/imagery/sat_before.jpg',
    thumbnailAfter: '/imagery/sat_after.jpg',
    isDemo: true,
  },
  {
    id: 'evidence-5',
    title: 'Access Road Extension',
    description:
      'Linear feature extraction identifies new unpaved access road connecting warehouse complex to existing arterial corridor.',
    type: 'spatial',
    regionId: 'region-5',
    source: 'Road Extraction Model',
    band: 'B04 (Red) + B11 (SWIR)',
    detectionMethod: 'Centerline extraction + classification',
    confidence: 82,
    thumbnailBefore: '/imagery/sat_before.jpg',
    thumbnailAfter: '/imagery/sat_after.jpg',
    isDemo: true,
  },
];
