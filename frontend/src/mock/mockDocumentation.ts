/**
 * SatQuery AI — Centralized Technical Documentation Data
 *
 * All 13 sections representing the platform's actual capabilities,
 * architectural paradigms, workspace interactions, and planned integrations.
 * Localized across 6 languages (en, es, fr, de, hi, ja) and served via services/api.ts.
 */

import type { DocumentationSection } from '../types';
import type { SupportedLanguage } from '../i18n/types';
import {
  LOCALIZED_DOCUMENTATION_SECTIONS,
  getLocalizedDocumentation,
  findLocalizedDocumentationSection,
} from './documentation';

export {
  LOCALIZED_DOCUMENTATION_SECTIONS,
  getLocalizedDocumentation,
  findLocalizedDocumentationSection,
};

// Canonical default (English) export for backward compatibility
export const MOCK_DOCUMENTATION_SECTIONS: DocumentationSection[] = LOCALIZED_DOCUMENTATION_SECTIONS.en;

/**
 * Find a documentation section by ID (supports optional language parameter)
 */
export function findDocumentationSection(
  id: string,
  lang: SupportedLanguage = 'en'
): DocumentationSection | undefined {
  return findLocalizedDocumentationSection(id, lang);
}
