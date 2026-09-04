/**
 * SatQuery AI — Service Abstraction Layer
 *
 * All data access goes through this module.
 * Currently delegates to mock data; structured for future API replacement.
 *
 * When the backend is ready, replace the mock implementations below
 * with actual fetch/axios calls. The rest of the app remains unchanged.
 */

import type {
  AnalysisRequest,
  AnalysisResponse,
  AnalysisRecord,
  SystemStatus,
  DemoScenario,
} from '../types';
import { mockAnalyses } from '../mock/mockAnalyses';
import { DEMO_SCENARIOS } from '../mock/mockResponses';

// ─── Simulate network delay ─────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Analysis ────────────────────────────────────────────────────

export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  // In the future: POST /api/analysis
  await delay(2500);

  // Find a matching demo scenario or return a generic demo response
  const scenario = DEMO_SCENARIOS.find(
    (s) => s.mode === request.mode && s.capability === request.capability
  );

  if (scenario) {
    return {
      ...scenario.mockResponse,
      analysisId: `demo-${Date.now()}`,
    };
  }

  return {
    analysisId: `demo-${Date.now()}`,
    status: 'completed',
    task: request.capability,
    answer: `[DEMO] Analysis completed for query: "${request.query}". This is a demo response — connect to the SatQuery backend for real analysis results.`,
    confidence: 0.75,
    evidence: [],
    visualizations: [],
    executionTrace: [
      { step: 1, action: 'Query Understanding', detail: 'Parsed user query', duration: 100, status: 'completed' },
      { step: 2, action: 'Analysis', detail: 'Demo analysis executed', duration: 2000, status: 'completed' },
    ],
    warnings: ['This is a demo response. Connect to the SatQuery AI backend for real analysis.'],
    isDemo: true,
  };
}

// ─── Analysis History ────────────────────────────────────────────

export async function getRecentAnalyses(): Promise<AnalysisRecord[]> {
  // In the future: GET /api/analyses?limit=10&sort=date:desc
  await delay(300);
  return mockAnalyses;
}

// ─── System Health ───────────────────────────────────────────────

export async function getSystemStatus(): Promise<SystemStatus> {
  // In the future: GET /api/health
  await delay(200);
  return {
    status: 'demo',
    label: 'Demo Environment',
    isDemo: true,
    lastChecked: new Date().toISOString(),
  };
}

// ─── Demo Scenarios ──────────────────────────────────────────────

export function getDemoScenarios(): DemoScenario[] {
  return DEMO_SCENARIOS;
}

export function getDemoScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}
