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
  DatasetScenario,
  DocumentationSection,
  UserProfile,
  UserPreferences,
} from '../types';
import type { SupportedLanguage } from '../i18n/types';
import { mockAnalyses } from '../mock/mockAnalyses';
import { DEMO_SCENARIOS } from '../mock/mockResponses';
import { MOCK_ANALYSIS_HISTORY } from '../mock/mockHistory';
import { MOCK_DATASET_SCENARIOS } from '../mock/mockDatasets';
import {
  getLocalizedDocumentation,
  findLocalizedDocumentationSection,
} from '../mock/mockDocumentation';

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
  return mockAnalyses;
}

export async function getAnalysisHistory(): Promise<AnalysisRecord[]> {
  // In the future: GET /api/history
  return MOCK_ANALYSIS_HISTORY;
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

// ─── Dataset & Scenario Library ───────────────────────────────────

export async function getDatasets(): Promise<DatasetScenario[]> {
  // In the future: GET /api/datasets
  return MOCK_DATASET_SCENARIOS;
}

export async function getDatasetScenarioById(id: string): Promise<DatasetScenario | undefined> {
  // In the future: GET /api/datasets/:id
  return MOCK_DATASET_SCENARIOS.find((s) => s.id === id);
}

// ─── Technical Documentation Center ───────────────────────────────

export async function getDocumentationSections(lang: SupportedLanguage = 'en'): Promise<DocumentationSection[]> {
  // In the future: GET /api/documentation/sections?lang=...
  return getLocalizedDocumentation(lang);
}

export async function getDocumentationSectionById(id: string, lang: SupportedLanguage = 'en'): Promise<DocumentationSection | undefined> {
  // In the future: GET /api/documentation/sections/:id?lang=...
  return findLocalizedDocumentationSection(id, lang);
}

// ─── User Profile & Account Settings (Backend-Ready) ──────────────

const USER_PROFILE_STORAGE_KEY = 'satquery-user';
const USER_PREFERENCES_STORAGE_KEY = 'satquery-preferences';

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Stark Visions',
  email: 'engineer@satquery.ai',
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    analysisCompletion: true,
    reportReady: true,
    productUpdates: false,
  },
  analysis: {
    rememberLastMode: true,
    openLatestOnReturn: false,
    preserveViewerState: true,
    showEvidenceByDefault: true,
  },
};

export async function getUserProfile(): Promise<UserProfile> {
  // In the future: GET /api/user/profile
  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string' && typeof parsed.email === 'string') {
        return {
          name: parsed.name,
          email: parsed.email,
          avatar: typeof parsed.avatar === 'string' && parsed.avatar ? parsed.avatar : undefined,
        };
      }
    }
  } catch {
    // ignore localStorage errors
  }
  return DEFAULT_USER_PROFILE;
}

export async function updateUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  // In the future: PUT /api/user/profile
  const current = await getUserProfile();
  const updated: UserProfile = {
    ...current,
    ...profile,
    // Email is read-only in demo mode to protect identity binding
    email: current.email,
  };

  // If avatar was explicitly cleared
  if ('avatar' in profile && !profile.avatar) {
    delete updated.avatar;
  }

  try {
    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satquery-user-update', { detail: updated }));
    }
  } catch {
    // ignore
  }
  return updated;
}

// ─── Language Preference (Backend-Ready) ──────────────────────────

const LANGUAGE_STORAGE_KEY = 'satquery-language';

export async function getLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'es' || stored === 'fr' || stored === 'de' || stored === 'hi' || stored === 'ja') {
      return stored;
    }
    return 'en';
  } catch {
    return 'en';
  }
}

export async function updateLanguage(lang: SupportedLanguage): Promise<SupportedLanguage> {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satquery-language-update', { detail: lang }));
    }
  } catch {
    // ignore
  }
  return lang;
}

export async function getUserPreferences(): Promise<UserPreferences> {
  // In the future: GET /api/user/preferences
  try {
    const raw = localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.notifications && parsed.analysis) {
        return {
          notifications: {
            ...DEFAULT_USER_PREFERENCES.notifications,
            ...parsed.notifications,
          },
          analysis: {
            ...DEFAULT_USER_PREFERENCES.analysis,
            ...parsed.analysis,
          },
        };
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_USER_PREFERENCES;
}

export async function updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
  // In the future: PUT /api/user/preferences
  const current = await getUserPreferences();
  const updated: UserPreferences = {
    notifications: {
      ...current.notifications,
      ...(preferences.notifications || {}),
    },
    analysis: {
      ...current.analysis,
      ...(preferences.analysis || {}),
    },
  };
  try {
    localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satquery-preferences-update', { detail: updated }));
    }
  } catch {
    // ignore
  }
  return updated;
}

