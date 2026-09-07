import type {
  VisualizationLayer,
  BandCombinationOption,
} from '../types/visualization';

// ─── Default Base Layers ─────────────────────────────────────────

export const DEFAULT_BASE_LAYERS: VisualizationLayer[] = [
  {
    id: 'base_rgb',
    name: 'Natural Color (RGB)',
    category: 'base',
    type: 'rgb',
    visible: true,
    opacity: 100,
    description: 'Standard true-color composite (B04-B03-B02)',
  },
  {
    id: 'base_nir',
    name: 'False Color (NIR)',
    category: 'base',
    type: 'nir',
    visible: false,
    opacity: 100,
    description: 'Near-infrared composite highlighting vegetation health',
  },
  {
    id: 'base_ndvi',
    name: 'NDVI Vegetation',
    category: 'base',
    type: 'ndvi',
    visible: false,
    opacity: 100,
    description: 'Normalized Difference Vegetation Index',
  },
  {
    id: 'base_sar',
    name: 'SAR Backscatter',
    category: 'base',
    type: 'sar',
    visible: false,
    opacity: 100,
    description: 'Synthetic Aperture Radar VV/VH polarization',
  },
];

// ─── Default Overlay Layers ──────────────────────────────────────

export const DEFAULT_OVERLAY_LAYERS: VisualizationLayer[] = [
  {
    id: 'overlay_buildings',
    name: 'Building Detections',
    category: 'overlay',
    type: 'buildings',
    visible: true,
    opacity: 80,
    color: '#facc15', // gold
    description: 'Detected building footprints and structures',
  },
  {
    id: 'overlay_changed_regions',
    name: 'Changed Regions',
    category: 'overlay',
    type: 'changed_regions',
    visible: true,
    opacity: 70,
    color: '#f59e0b', // amber
    description: 'Areas with detected temporal changes',
  },
  {
    id: 'overlay_roads',
    name: 'Road Networks',
    category: 'overlay',
    type: 'roads',
    visible: false,
    opacity: 60,
    color: '#e2e8f0', // slate-200
    description: 'Digitized road centerlines and corridors',
  },
  {
    id: 'overlay_grounding',
    name: 'Grounding Boxes',
    category: 'overlay',
    type: 'grounding',
    visible: true,
    opacity: 90,
    color: '#38bdf8', // sky-400
    description: 'AI localized bounding boxes & object tags (Demo)',
  },
  {
    id: 'overlay_vegetation',
    name: 'Vegetation Mask',
    category: 'overlay',
    type: 'vegetation',
    visible: false,
    opacity: 50,
    color: '#22c55e', // green
    description: 'Classified vegetation cover areas',
  },
];

// ─── Band Combinations ──────────────────────────────────────────

export const BAND_COMBINATIONS: BandCombinationOption[] = [
  {
    id: 'true_color',
    name: 'True Color',
    description: 'B04 (Red), B03 (Green), B02 (Blue)',
    bands: 'B04-B03-B02',
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    description: 'B11 (SWIR), B08 (NIR), B02 (Blue)',
    bands: 'B11-B08-B02',
  },
  {
    id: 'urban',
    name: 'Urban',
    description: 'B12 (SWIR), B11 (SWIR), B04 (Red)',
    bands: 'B12-B11-B04',
  },
  {
    id: 'water',
    name: 'Water',
    description: 'B03 (Green), B08 (NIR), B11 (SWIR)',
    bands: 'B03-B08-B11',
  },
];
