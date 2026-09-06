import type { GroundingBox, NormalizedBounds, BoundingBox, ExecutionStage } from '../types/visualization';

// ─── Pure Coordinate Conversion Function ───────────────────────────
// Converts canonical normalized [0..1] coordinates to SVG viewBox bounds
export function toViewBoxBounds(
  normalized: NormalizedBounds,
  viewBoxWidth = 800,
  viewBoxHeight = 500
): BoundingBox {
  return {
    x: Math.round(normalized.x * viewBoxWidth),
    y: Math.round(normalized.y * viewBoxHeight),
    width: Math.round(normalized.width * viewBoxWidth),
    height: Math.round(normalized.height * viewBoxHeight),
  };
}

// ─── Centralized Mock Grounding Boxes ──────────────────────────────
// Canonical normalized spatial coordinates anchored to existing MOCK_REGIONS
export const MOCK_GROUNDING_BOXES: GroundingBox[] = [
  {
    id: 'grounding-1',
    label: 'Warehouse Complex',
    normalized: { x: 0.525, y: 0.22, width: 0.1875, height: 0.26 }, // 420, 110, 150, 130 in 800x500 (region-1)
    confidence: 93,
    regionId: 'region-1',
    category: 'building',
    isDemo: true,
  },
  {
    id: 'grounding-2',
    label: 'Foundation Excavation',
    normalized: { x: 0.4625, y: 0.5, width: 0.175, height: 0.22 }, // 370, 250, 140, 110 in 800x500 (region-2)
    confidence: 87,
    regionId: 'region-2',
    category: 'infrastructure',
    isDemo: true,
  },
  {
    id: 'grounding-3',
    label: 'Cleared Parcel',
    normalized: { x: 0.7375, y: 0.3, width: 0.1125, height: 0.24 }, // 590, 150, 90, 120 in 800x500 (region-3)
    confidence: 91,
    regionId: 'region-3',
    category: 'parcel',
    isDemo: true,
  },
  {
    id: 'grounding-4',
    label: 'Building Footprint A',
    normalized: { x: 0.55, y: 0.26, width: 0.04375, height: 0.08 }, // 440, 130, 35, 40 in 800x500 (region-4)
    confidence: 95,
    regionId: 'region-4',
    category: 'building',
    isDemo: true,
  },
  {
    id: 'grounding-5',
    label: 'Building Footprint B',
    normalized: { x: 0.6125, y: 0.29, width: 0.05, height: 0.09 }, // 490, 145, 40, 45 in 800x500 (region-5)
    confidence: 88,
    regionId: 'region-5',
    category: 'building',
    isDemo: true,
  },
];

// ─── 11 Approved Safe Execution Workflow Stages ────────────────────
export const MOCK_EXECUTION_STAGES: ExecutionStage[] = [
  { id: 'step-1', step: 1, label: 'Request Received', status: 'completed' },
  { id: 'step-2', step: 2, label: 'Input Validated', status: 'completed' },
  { id: 'step-3', step: 3, label: 'Query Understood', status: 'completed' },
  { id: 'step-4', step: 4, label: 'Task Identified', status: 'completed' },
  { id: 'step-5', step: 5, label: 'Workflow Selected', status: 'completed' },
  { id: 'step-6', step: 6, label: 'Specialist Capability Selected', status: 'completed' },
  { id: 'step-7', step: 7, label: 'Imagery Processed', status: 'completed' },
  { id: 'step-8', step: 8, label: 'Result Validated', status: 'completed' },
  { id: 'step-9', step: 9, label: 'Evidence Extracted', status: 'completed' },
  { id: 'step-10', step: 10, label: 'Confidence Estimated', status: 'completed' },
  { id: 'step-11', step: 11, label: 'Response Generated', status: 'completed' },
];
