import type { DemoScenario, AnalysisResponse } from '../types';

function createDemoResponse(overrides: Partial<AnalysisResponse>): AnalysisResponse {
  return {
    analysisId: `demo-${Date.now()}`,
    status: 'completed',
    task: 'vqa',
    answer: '',
    confidence: 0,
    evidence: [],
    visualizations: [],
    executionTrace: [],
    warnings: [],
    isDemo: true,
    ...overrides,
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'demo-vqa',
    name: 'Visual Question Answering Demo',
    description: 'Ask a question about objects visible in a satellite image.',
    mode: 'single_image',
    capability: 'vqa',
    query: 'What objects are visible in this image?',
    imageLabels: ['Satellite Image'],
    mockResponse: createDemoResponse({
      task: 'vqa',
      answer:
        'The image shows an urban area with residential buildings, road networks, vegetation patches, and a water body in the northeast quadrant. Several commercial structures are visible along the main road.',
      confidence: 0.82,
      evidence: [
        {
          type: 'visual',
          description: 'Identified urban structures through spectral and spatial pattern analysis.',
          source: 'VQA Model',
        },
      ],
      executionTrace: [
        { step: 1, action: 'Query Understanding', detail: 'Parsed visual question about scene content', duration: 120, status: 'completed' },
        { step: 2, action: 'Image Preprocessing', detail: 'Normalized input imagery', duration: 340, status: 'completed' },
        { step: 3, action: 'VQA Inference', detail: 'Generated answer from visual features and query', duration: 1800, status: 'completed' },
        { step: 4, action: 'Evidence Generation', detail: 'Compiled supporting evidence', duration: 200, status: 'completed' },
      ],
    }),
  },
  {
    id: 'demo-grounding',
    name: 'Object Grounding Demo',
    description: 'Locate all buildings in a satellite image.',
    mode: 'single_image',
    capability: 'grounding',
    query: 'Find all buildings.',
    imageLabels: ['Satellite Image'],
    mockResponse: createDemoResponse({
      task: 'grounding',
      answer: 'Identified 47 building structures across the image. Buildings are concentrated in the central and southern regions.',
      confidence: 0.89,
      evidence: [
        {
          type: 'spatial',
          description: 'Building footprints detected via grounding model with bounding box annotations.',
          source: 'Grounding Model',
        },
      ],
      executionTrace: [
        { step: 1, action: 'Query Understanding', detail: 'Identified grounding task for building detection', duration: 95, status: 'completed' },
        { step: 2, action: 'Image Preprocessing', detail: 'Prepared image tiles for grounding model', duration: 410, status: 'completed' },
        { step: 3, action: 'Grounding Inference', detail: 'Detected and localized building structures', duration: 2200, status: 'completed' },
        { step: 4, action: 'Post-processing', detail: 'Filtered and consolidated detections', duration: 180, status: 'completed' },
      ],
    }),
  },
  {
    id: 'demo-change',
    name: 'Change Detection Demo',
    description: 'Detect changes between two temporal satellite images.',
    mode: 'compare_images',
    capability: 'change_detection',
    query: 'What changed between these two images?',
    imageLabels: ['Before Image', 'After Image'],
    mockResponse: createDemoResponse({
      task: 'change_detection',
      answer:
        'Significant urban expansion detected in the eastern region. Approximately 12 hectares of vegetation have been converted to built-up area. Road network has expanded with two new arterial connections.',
      confidence: 0.85,
      evidence: [
        {
          type: 'temporal',
          description: 'Change regions identified through bi-temporal image comparison.',
          source: 'Change Detection Model',
        },
      ],
      executionTrace: [
        { step: 1, action: 'Query Understanding', detail: 'Identified change detection task', duration: 110, status: 'completed' },
        { step: 2, action: 'Image Registration', detail: 'Aligned bi-temporal image pair', duration: 890, status: 'completed' },
        { step: 3, action: 'Change Detection', detail: 'Computed change map from aligned images', duration: 2400, status: 'completed' },
        { step: 4, action: 'Change Interpretation', detail: 'Classified and described detected changes', duration: 600, status: 'completed' },
      ],
    }),
  },
  {
    id: 'demo-optical-sar',
    name: 'Optical + SAR Demo',
    description: 'Analyze complementary information across optical and SAR modalities.',
    mode: 'optical_sar',
    capability: 'multimodal_analysis',
    query: 'Compare the optical and SAR imagery.',
    imageLabels: ['Optical Image', 'SAR Image'],
    mockResponse: createDemoResponse({
      task: 'multimodal_analysis',
      answer:
        'The optical image reveals land-cover distribution including vegetation, water, and urban areas. The SAR image provides complementary structural and moisture information, highlighting metallic structures and water bodies with high backscatter contrast. The fusion reveals features not visible in either modality alone.',
      confidence: 0.78,
      evidence: [
        {
          type: 'multimodal',
          description: 'Cross-modal analysis combining optical spectral and SAR backscatter features.',
          source: 'Multimodal Fusion Model',
        },
      ],
      executionTrace: [
        { step: 1, action: 'Query Understanding', detail: 'Identified multimodal analysis task', duration: 130, status: 'completed' },
        { step: 2, action: 'Optical Processing', detail: 'Extracted spectral features from optical image', duration: 720, status: 'completed' },
        { step: 3, action: 'SAR Processing', detail: 'Extracted backscatter features from SAR image', duration: 680, status: 'completed' },
        { step: 4, action: 'Multimodal Fusion', detail: 'Combined features for joint analysis', duration: 1900, status: 'completed' },
        { step: 5, action: 'Interpretation', detail: 'Generated cross-modal insights', duration: 450, status: 'completed' },
      ],
    }),
  },
];
