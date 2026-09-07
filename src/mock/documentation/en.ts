import type { DocumentationSection } from '../../types';

export const enDocumentationSections: DocumentationSection[] = [
  // ─── 1. Overview ──────────────────────────────────────────────────
  {
    id: 'overview',
    title: 'SatQuery AI Overview',
    shortDescription: 'Multimodal satellite intelligence platform translating natural-language queries into evidence-backed visual observations.',
    category: 'core',
    icon: 'Compass',
    isDemo: true,
    flowDiagram: [
      'User Query',
      'Query Agent',
      'Analysis Workflow',
      'Dual Imagery Viewer',
      'Spatial Evidence',
      'Confidence Scoring',
      'Intelligence Report',
    ],
    content: [
      'SatQuery AI is an interactive remote-sensing intelligence interface designed to eliminate the complexity of extracting geospatial insights from multi-temporal and multimodal satellite imagery.',
      'Rather than requiring manual GIS band algebra, manual visual photointerpretation, or separate geospatial tools, operators pose natural-language questions directly to the workspace. SatQuery AI routes queries through specialized analytical workflows, grounds observations to pixel regions, correlates multi-sensor layers, and outputs downloadable verification reports.',
      'The current platform represents a high-fidelity frontend demonstration designed for the SIH26167 evaluation, executing pre-calibrated remote-sensing reasoning workflows across real satellite scenes.',
    ],
    subsections: [
      {
        id: 'core-workflow',
        title: 'End-to-End Query Lifecycle',
        content: [
          '1. Natural-Language Ingestion: The operator enters a query or selects from scenario presets.',
          '2. Query Agent Understanding: Intent routing maps the query to the correct analysis mode and tool capability.',
          '3. Workspace Activation: The interactive imagery canvas configures single, bi-temporal, or multi-sensor displays.',
          '4. Evidence & Grounding: Visual bounding boxes, spatial masks, and multi-factor confidence indices link findings to ground truth.',
          '5. Synthesis & Export: Observations are summarized in the Final Answer Panel and exportable to publication-grade reports.',
        ],
        callout: {
          type: 'note',
          text: 'The current application is a frontend demonstration sandbox. Queries and workflows run against curated benchmark scenes with simulated backend execution.',
        },
      },
    ],
  },

  // ─── 2. System Architecture ───────────────────────────────────────
  {
    id: 'architecture',
    title: 'System Architecture',
    shortDescription: 'Frontend architecture overview and clean separation boundaries for future backend and model integration.',
    category: 'core',
    icon: 'Network',
    flowDiagram: [
      'User Interface (React 19)',
      'Query Agent Overlay',
      'Dual Imagery Canvas',
      'Layer & Grounding Engines',
      'Service Layer (api.ts)',
      'Centralized Data Store',
      'Future Backend API',
    ],
    content: [
      'SatQuery AI is architected with strict boundary separation between presentation components, state orchestration, and data access services. This ensures that transitioning from demonstration mock data to live cloud-hosted VLM endpoints requires zero component rewrites.',
      'The workspace is built around an extensible layout: an application shell providing theme and notification contexts, a secondary sidebar for tool selection, a high-performance interactive dual canvas, an AI execution monitoring drawer, and an intelligence inspector column.',
    ],
    subsections: [
      {
        id: 'arch-separation',
        title: 'Current Frontend vs. Planned Backend',
        content: [
          '• Current Demonstration Environment: The React client communicates with an asynchronous service abstraction layer (`src/services/api.ts`), which returns centralized mock datasets, pre-computed evidence graphs, and demonstration metadata.',
          '• Future Production Architecture (Planned): The identical service layer will dispatch REST/WebSocket requests to a containerized Python backend running Vision-Language Model (VLM) routing, GDAL/Rasterio spatial tiling, and vector search embeddings.',
        ],
        codeBlock: {
          language: 'typescript',
          code: `// Clean service boundary in src/services/api.ts:
// CURRENT: Delegates to centralized mock datasets
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  return executeMockAnalysis(request);
}

// FUTURE (Planned): Direct backend proxy replacement
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/v1/analysis', {
    method: 'POST',
    body: JSON.stringify(request)
  });
  return response.json();
}`,
        },
        callout: {
          type: 'info',
          text: 'No UI component directly imports mock data files. All components consume typed domain contracts through the services abstraction.',
        },
      },
    ],
  },

  // ─── 3. Query Agent ───────────────────────────────────────────────
  {
    id: 'query-agent',
    title: 'Query Agent Pipeline',
    shortDescription: 'Natural-language orchestration layer routing operator prompts to specialized remote-sensing analytical capabilities.',
    category: 'agent',
    icon: 'Bot',
    flowDiagram: [
      'Query Ingestion',
      'Semantic Intent Parsing',
      'Capability Classification',
      'Tool Mode Selection',
      'Canvas Reconfiguration',
      'Workspace Execution',
    ],
    content: [
      'The Query Agent serves as the intelligent natural-language entry point for the SatQuery AI system. Rather than forcing the analyst to manually select raster algorithms or band combinations, the Query Agent interprets user intent and activates the appropriate specialist mode.',
      'Accessible via the top-bar launcher or the dedicated secondary sidebar, the Query Agent overlay provides focused input with automatic suggestion prompts and capability recommendations.',
    ],
    subsections: [
      {
        id: 'agent-routing',
        title: 'Capability Routing Logic',
        content: [
          'The Query Agent classifies incoming queries into one of the six specialized analysis tools based on linguistic cues and sensor requirements:',
          '• Grounding Intent: Queries seeking counts, structure locations, or spatial identification trigger the Object Grounding tool.',
          '• Temporal Intent: Queries mentioning differences, expansion, or year-over-year transitions trigger Change Analysis or Change VQA.',
          '• Multimodal Intent: Queries referencing radar backscatter, moisture, or cross-sensor verification trigger the Optical + SAR tool.',
          '• Interpretive Intent: Open-ended composition queries trigger Scene Captioning or Single Image VQA.',
        ],
        callout: {
          type: 'tip',
          text: 'Query Agent operates independently of the imagery category, allowing analysts to transition between Single, Compare, and Fusion views without losing their active query state.',
        },
      },
    ],
  },

  // ─── 4. Analysis Capabilities ─────────────────────────────────────
  {
    id: 'capabilities',
    title: 'Analysis Capabilities',
    shortDescription: 'Comprehensive breakdown of the six core remote-sensing analytical capabilities available in the workspace.',
    category: 'agent',
    icon: 'Layers',
    content: [
      'SatQuery AI implements six specialized capabilities designed to cover the complete spectrum of satellite imagery interpretation tasks.',
      'Each capability is equipped with calibrated prompt templates, contextual suggestion chips, and linked evidence visualization overlays.',
    ],
    subsections: [
      {
        id: 'cap-vqa',
        title: '1. Single Image VQA (Visual Question Answering)',
        content: [
          '• Purpose: Answer open natural-language questions about features present in a single scene.',
          '• Typical Queries: "What infrastructure and agricultural land use patterns are present in this satellite scene?"',
          '• Demonstration Output: Synthesized narrative identifying rural settlements, crop parcel zoning, and unpaved arterial roadways with 88% demonstration confidence.',
        ],
      },
      {
        id: 'cap-captioning',
        title: '2. Remote-Sensing Scene Captioning',
        content: [
          '• Purpose: Generate exhaustive paragraph-level descriptions of topography, land cover, and human activity.',
          '• Typical Queries: "Generate an exhaustive remote-sensing description of topography, land-cover, and human activity."',
          '• Demonstration Output: Multi-sentence scene analysis detailing elevation gradients, vegetative health, and industrial perimeters.',
        ],
      },
      {
        id: 'cap-grounding',
        title: '3. Object Grounding',
        content: [
          '• Purpose: Detect, localize, and bound queried objects or building structures.',
          '• Typical Queries: "Locate all warehouse structures, building footprints, and arterial transportation corridors."',
          '• Demonstration Output: 47 discrete bounding box coordinates mapped over the image with category tagging and spatial consistency checks.',
        ],
      },
      {
        id: 'cap-change-detection',
        title: '4. Bi-Temporal Change Detection',
        content: [
          '• Purpose: Identify structural and surface land-cover differences between two temporal acquisitions.',
          '• Typical Queries: "Identify the major changes between these two images."',
          '• Demonstration Output: Difference region highlights, polygon masks, and categorical transition breakdowns between T0 (2025) and T1 (2026).',
        ],
      },
      {
        id: 'cap-change-vqa',
        title: '5. Change Question Answering (Change VQA)',
        content: [
          '• Purpose: Answer quantitative questions regarding temporal land-use conversions.',
          '• Typical Queries: "How much agricultural land was converted into built-up structures between 2025 and 2026?"',
          '• Demonstration Output: Metric estimation (14.8 hectares converted, 8 new foundations) with sub-pixel registration error verification.',
        ],
      },
      {
        id: 'cap-multimodal',
        title: '6. Optical + SAR Multimodal Analysis',
        content: [
          '• Purpose: Correlate optical multispectral reflectance with synthetic aperture radar (SAR) backscatter intensity.',
          '• Typical Queries: "Analyze complementary structure and surface reflectance across optical and radar backscatter."',
          '• Demonstration Output: Dual-channel visual composite highlighting surface features and metallic structures with high dielectric contrast.',
        ],
      },
    ],
  },

  // ─── 5. Object Grounding & Evidence ───────────────────────────────
  {
    id: 'grounding',
    title: 'Object Grounding & Spatial Evidence',
    shortDescription: 'Spatial bounding box detection, region highlighting, and bidirectional evidence linking.',
    category: 'workspace',
    icon: 'ScanSearch',
    flowDiagram: [
      'User Prompt',
      'Grounding Inference',
      'Bounding Boxes (47 Regions)',
      'Evidence Graph Linking',
      'Canvas Highlighting',
    ],
    content: [
      'A core differentiator of SatQuery AI is its ability to ground AI responses directly to pixel coordinates in the imagery, rather than returning ungrounded text hallucinations.',
      'In Object Grounding mode, the canvas renders normalized bounding box overlays across detected structures. Selecting a bounding box highlights the corresponding evidence item in the Evidence Drawer, and clicking an evidence card pans and pulses the associated spatial box on the canvas.',
    ],
    subsections: [
      {
        id: 'grounding-linking',
        title: 'Bidirectional Linking Architecture',
        content: [
          '• Canvas to Evidence: Clicking any of the 47 bounding boxes automatically selects the matching evidence card in `EvidenceModal` and updates `selectedGroundingId`.',
          '• Evidence to Canvas: Clicking "Inspect on Map" from any evidence point triggers a 2.5-second pulsing highlight on the target region.',
          '• Category Tagging: Bounding boxes are tagged with metadata tags (`building`, `infrastructure`, `corridor`) and confidence ratings.',
        ],
        callout: {
          type: 'tip',
          text: 'Bounding box coordinates are normalized ([0, 1] space), allowing vector overlays to scale fluidly with canvas zoom levels without pixel distortion.',
        },
      },
    ],
  },

  // ─── 6. Before / After Comparison ─────────────────────────────────
  {
    id: 'comparison',
    title: 'Before / After Comparison Workflow',
    shortDescription: 'Bi-temporal satellite analysis featuring interactive swipe sliders and synchronized side-by-side inspection.',
    category: 'workspace',
    icon: 'GitCompare',
    content: [
      'Remote-sensing change analysis relies on precise comparison of co-registered temporal acquisitions. SatQuery AI provides multiple viewer interaction models to inspect land-use transitions between Baseline (T0: 2025-03-12) and Observation (T1: 2026-03-12).',
    ],
    subsections: [
      {
        id: 'comparison-modes',
        title: 'Interactive Viewer Modes',
        content: [
          '1. Swipe Comparison Mode: Uses a draggable vertical divider with CSS clip-path masking to reveal Before imagery on the left and After imagery on the right with sub-pixel alignment.',
          '2. Side-by-Side Mode: Renders twin synchronized viewports displaying T0 and T1 simultaneously with unified pan and zoom tracking.',
          '3. Single Layer Toggle: Allows instant switching between temporal baselines with layer opacity controls in the Layer Controls Panel.',
        ],
        callout: {
          type: 'note',
          text: 'Imagery acquisitions in the demo share identical 10m Ground Sample Distance (GSD) resolution and EPSG:4326 projection parameters to demonstrate ideal coregistered comparisons.',
        },
      },
    ],
  },

  // ─── 7. Optical + SAR Workspace ───────────────────────────────────
  {
    id: 'optical-sar',
    title: 'Optical + SAR Workspace',
    shortDescription: 'Multisensor visualization combining optical visible reflectance with simulated radar backscatter.',
    category: 'workspace',
    icon: 'Binary',
    isDemo: true,
    content: [
      'Optical sensors capture surface spectral reflectance in visible and near-infrared bands, but are limited by solar illumination and cloud cover. Synthetic Aperture Radar (SAR) transmits microwave pulses that penetrate clouds and provide structural and roughness data.',
      'SatQuery AI incorporates an Optical + SAR workspace designed to explore how multisensor data can be synthesized in a unified geospatial viewport.',
    ],
    subsections: [
      {
        id: 'sar-demo-notice',
        title: 'Demonstration Simulation Notice',
        content: [
          '• Current Implementation: The SAR layer in the current application is a simulated demonstration visualization calibrated for UI evaluation.',
          '• Sensor Parameters: The demonstration models a Sentinel-2 MSI visible optical base combined with a Sentinel-1 C-Band synthetic aperture radar cross-polarization (VV/VH) simulation.',
          '• Limitations: The current frontend does not perform live Doppler beam sharpening, radar speckle filtering, or real-time dielectric permittivity calculation. These data pipelines are planned for backend integration.',
        ],
        callout: {
          type: 'warning',
          text: 'SAR presentations and backscatter overlays in this version are simulated for demonstration purposes. Real sensor fusion will be handled by the backend processing pipeline.',
        },
      },
    ],
  },

  // ─── 8. AI Execution Workflow ─────────────────────────────────────
  {
    id: 'execution',
    title: 'AI Execution Workflow',
    shortDescription: 'The 11-stage safe execution pipeline tracing remote-sensing analysis from prompt ingestion to response delivery.',
    category: 'agent',
    icon: 'Activity',
    flowDiagram: [
      '1. Request Received',
      '2. Input Validated',
      '3. Query Understood',
      '4. Task Identified',
      '5. Workflow Selected',
      '6. Specialist Capability Selected',
      '7. Imagery Processed',
      '8. Result Validated',
      '9. Evidence Extracted',
      '10. Confidence Estimated',
      '11. Response Generated',
    ],
    content: [
      'To provide complete transparency into how analytical conclusions are reached, SatQuery AI implements an 11-stage execution trace matching the real-time progress monitor in the AI Execution Panel.',
      'Each stage validates preconditions, prevents ungrounded hallucinations, and ensures that evidence and confidence scores are calculated before any final observation is synthesized.',
    ],
    subsections: [
      {
        id: 'execution-stages',
        title: 'The 11 Approved Safe Pipeline Stages',
        content: [
          '• Step 1 — Request Received: Ingests the natural-language query and active image context from the client session.',
          '• Step 2 — Input Validated: Verifies raster bounds, spectral band availability, and spatial coordinate registration.',
          '• Step 3 — Query Understood: Parses semantic entities, target features, and spatial constraints.',
          '• Step 4 — Task Identified: Categorizes the query type (Grounding, VQA, Change Detection, Multimodal).',
          '• Step 5 — Workflow Selected: Configures single, bi-temporal, or cross-sensor processing pipelines.',
          '• Step 6 — Specialist Capability Selected: Binds specialized model prompts and detection heuristics.',
          '• Step 7 — Imagery Processed: Executes spatial filtering, radiometric normalization, and difference masking.',
          '• Step 8 — Result Validated: Applies consistency checks against baseline land-use signatures.',
          '• Step 9 — Evidence Extracted: Generates spatial bounding boxes and numerical observation statistics.',
          '• Step 10 — Confidence Estimated: Calculates multi-factor confidence indices across spatial, spectral, and temporal dimensions.',
          '• Step 11 — Response Generated: Compiles final summary narrative, updates inspector panels, and unlocks report exports.',
        ],
        callout: {
          type: 'info',
          text: 'This 11-stage pipeline represents the exact execution sequence displayed in the workspace QueryAndExecutionPanel.',
        },
      },
    ],
  },

  // ─── 9. Evidence & Confidence ─────────────────────────────────────
  {
    id: 'evidence',
    title: 'Evidence & Confidence Scoring',
    shortDescription: 'Multi-factor confidence breakdown, spatial consistency verification, and evidence inspection.',
    category: 'intelligence',
    icon: 'ShieldCheck',
    content: [
      'Satellite intelligence demands rigorous verification. SatQuery AI replaces opaque single-number scores with a four-pillar multi-factor confidence model and verifiable evidence cards.',
    ],
    subsections: [
      {
        id: 'confidence-breakdown',
        title: 'Confidence Breakdown Pillars',
        content: [
          '• Spatial Consistency (93% Demo): Verifies geometric coherence, boundary conformity, and expected architectural geometries.',
          '• Spectral Match (88% Demo): Measures multispectral band reflectance alignment against standard vegetation/built-up signatures.',
          '• Temporal Coherence (91% Demo): Validates that observed changes adhere to plausible physical and temporal growth rates.',
          '• Model Agreement (86% Demo): Compares cross-model heuristic agreement across detection pipelines.',
        ],
        callout: {
          type: 'note',
          text: 'Confidence scores are calibrated demonstration values representing model agreement heuristics. They do not constitute formal statistical proof.',
        },
      },
      {
        id: 'evidence-modal',
        title: 'Evidence Modal Drawer',
        content: [
          'Clicking "View Evidence" opens the Evidence Modal, presenting detailed verification points for each detected region, including detection methodology, spectral band corroboration, and direct canvas highlighting.',
        ],
      },
    ],
  },

  // ─── 10. Reports & Data Export ────────────────────────────────────
  {
    id: 'reports',
    title: 'Intelligence Reports & Data Export',
    shortDescription: 'Publication-ready reporting formats including formatted PDF, structured JSON, and clean text export.',
    category: 'intelligence',
    icon: 'FileSpreadsheet',
    content: [
      'Analytical workflows culminate in exportable intelligence artifacts that can be distributed to decision-makers, included in planning dossiers, or ingested into downstream GIS systems.',
      'The Final Answer Panel includes an export dispatcher supporting three distinct formats generated directly in the browser via client-side Blob packaging.',
    ],
    subsections: [
      {
        id: 'report-formats',
        title: 'Supported Export Formats',
        content: [
          '• PDF Publication Report: Formatted multi-page executive briefing generated using jsPDF, complete with cover metadata, problem statement, executive answer summary, evidence tables, sensor specifications, and formal demonstration notices.',
          '• JSON Structured Data: Machine-readable JSON artifact containing full spatial coordinate bounds, confidence breakdowns, category percentages, and processing trace steps for automated pipeline ingestion.',
          '• TXT Plaintext Report: Clean, formatted ASCII briefing optimized for lightweight review and low-bandwidth transmission.',
        ],
        callout: {
          type: 'tip',
          text: 'Report file sizes are dynamically calculated from the generated Blob buffer upon download, avoiding unverified placeholder estimates.',
        },
      },
    ],
  },

  // ─── 11. Frontend Architecture ────────────────────────────────────
  {
    id: 'frontend',
    title: 'Frontend Architecture & Design System',
    shortDescription: 'Modern React 19 single-page application built with TypeScript, Tailwind CSS, and custom geospatial design tokens.',
    category: 'engineering',
    icon: 'Code2',
    content: [
      'The SatQuery AI frontend is engineered to enterprise aerospace specifications, balancing high information density with intuitive visual hierarchy and rapid response times.',
      'The interface is fully responsive, supporting desktop workstations, tablet displays, and mobile views with tailored layouts.',
    ],
    subsections: [
      {
        id: 'tech-stack',
        title: 'Technology Stack & Architecture',
        content: [
          '• Framework: React 19 with TypeScript for type-safe component contracts and strict interface enforcement.',
          '• Styling: Tailwind CSS configured with a tailored aerospace palette, custom CSS variables, and full dark/light theme switching.',
          '• Routing: React Router DOM with URL hash synchronization for documentation and state-cleansed navigation for analysis restoration.',
          '• Icons: Lucide React for consistent geospatial and systems iconography.',
          '• Resilience: Global Error Boundary components wrapping route views to isolate render faults while preserving application navigation.',
        ],
      },
    ],
  },

  // ─── 12. Backend Integration Roadmap ──────────────────────────────
  {
    id: 'backend-roadmap',
    title: 'Backend Integration Roadmap',
    shortDescription: 'Planned architecture and API contracts for connecting the frontend to live VLM models and raster processing engines.',
    category: 'engineering',
    icon: 'Milestone',
    isPlanned: true,
    content: [
      'The SatQuery AI frontend is intentionally decoupled from mock implementations. Every data interaction flows through `src/services/api.ts`, establishing clean boundaries for future backend connectivity.',
      'This roadmap outlines the planned transition from demonstration data to a production cloud-native remote sensing inference engine.',
    ],
    subsections: [
      {
        id: 'roadmap-phases',
        title: 'Planned Architecture Integration Stages',
        content: [
          '• Stage 1 — API Gateway: Bind REST endpoints for analysis submissions (`POST /api/v1/analysis`), scenario fetching (`GET /api/v1/scenarios`), and historical session retrieval (`GET /api/v1/history`).',
          '• Stage 2 — VLM Model Routing: Integrate specialized vision-language models for zero-shot satellite VQA, scene captioning, and open-vocabulary spatial grounding.',
          '• Stage 3 — Raster Tiling & GIS Engine: Deploy cloud-optimized GeoTIFF (COG) tiling microservices running GDAL/Rasterio for on-the-fly band ratio calculations (NDVI, NDWI).',
          '• Stage 4 — Live SAR Processing: Implement radar pre-processing pipelines handling real Sentinel-1 GRD ingestion, terrain correction, and speckle filtering.',
        ],
        callout: {
          type: 'info',
          text: 'Status: PLANNED. The current release is a standalone frontend prototype. No live backend servers or external API credentials are required.',
        },
      },
    ],
  },

  // ─── 13. Demo Limitations ─────────────────────────────────────────
  {
    id: 'limitations',
    title: 'Platform Demo Limitations',
    shortDescription: 'Transparent disclosure of sandbox parameters, simulated features, and prototype operating constraints.',
    category: 'core',
    icon: 'AlertTriangle',
    isDemo: true,
    content: [
      'SatQuery AI is currently deployed as a demonstration prototype for evaluation in the Smart India Hackathon (SIH26167). To ensure complete transparency, operators and evaluators should note the following constraints:',
    ],
    subsections: [
      {
        id: 'limitations-list',
        title: 'Current Sandbox Constraints',
        content: [
          '1. Simulated Reasoning: Query responses, feature counts, and land-use transition statistics are pre-computed demonstration artifacts.',
          '2. Curated Testbeds: Analysis is calibrated against sample Sentinel-2 optical scenes and simulated SAR composites rather than live global satellite tasking.',
          '3. Offline Operation: The application executes entirely client-side without making external network calls to model inference servers.',
          '4. Visual SAR Presentation: Radar backscatter overlays represent visual demonstration treatments rather than physical wave backscatter measurements.',
          '5. Non-Persistent Storage: Analysis history and user sessions reside in client state and do not persist across browser cache resets.',
        ],
        callout: {
          type: 'warning',
          text: 'This system is intended for UI/UX demonstration and evaluation of remote-sensing AI concepts. It should not be used for live operational navigation or emergency planning.',
        },
      },
    ],
  },
];
