import type { DocumentationSection } from '../../types';
import type { SupportedLanguage } from '../../i18n/types';
import { enDocumentationSections } from './en';
import { esDocumentationSections } from './es';
import { frDocumentationSections } from './fr';
import { deDocumentationSections } from './de';
import { hiDocumentationSections } from './hi';
import { jaDocumentationSections } from './ja';

export const LOCALIZED_DOCUMENTATION_SECTIONS: Record<SupportedLanguage, DocumentationSection[]> = {
  en: enDocumentationSections,
  es: esDocumentationSections,
  fr: frDocumentationSections,
  de: deDocumentationSections,
  hi: hiDocumentationSections,
  ja: jaDocumentationSections,
};

export function getLocalizedDocumentation(lang: SupportedLanguage = 'en'): DocumentationSection[] {
  return LOCALIZED_DOCUMENTATION_SECTIONS[lang] || LOCALIZED_DOCUMENTATION_SECTIONS.en;
}

export function findLocalizedDocumentationSection(
  id: string,
  lang: SupportedLanguage = 'en'
): DocumentationSection | undefined {
  const sections = getLocalizedDocumentation(lang);
  return sections.find((s) => s.id === id);
}
