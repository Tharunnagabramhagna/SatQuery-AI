import { LOCALIZED_DOCUMENTATION_SECTIONS } from '../src/mock/documentation';
import { en } from '../src/i18n/translations/en';
import { es } from '../src/i18n/translations/es';
import { fr } from '../src/i18n/translations/fr';
import { de } from '../src/i18n/translations/de';
import { hi } from '../src/i18n/translations/hi';
import { ja } from '../src/i18n/translations/ja';
import type { SupportedLanguage } from '../src/i18n/types';

const EXPECTED_SECTION_IDS = [
  'overview',
  'architecture',
  'query-agent',
  'capabilities',
  'grounding',
  'comparison',
  'optical-sar',
  'execution',
  'evidence',
  'reports',
  'frontend',
  'backend-roadmap',
  'limitations',
];

const LANGUAGES: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'hi', 'ja'];
const DICTIONARIES = { en, es, fr, de, hi, ja };

let errors: string[] = [];

console.log('=== 1. VALIDATING ALL 13 DOCUMENTATION SECTIONS ACROSS 6 LANGUAGES ===');

for (const lang of LANGUAGES) {
  const sections = LOCALIZED_DOCUMENTATION_SECTIONS[lang];
  if (!sections) {
    errors.push(`Missing documentation sections for language: ${lang}`);
    continue;
  }

  if (sections.length !== EXPECTED_SECTION_IDS.length) {
    errors.push(`Language ${lang} has ${sections.length} sections, expected ${EXPECTED_SECTION_IDS.length}`);
  }

  for (let i = 0; i < EXPECTED_SECTION_IDS.length; i++) {
    const expectedId = EXPECTED_SECTION_IDS[i];
    const sec = sections[i];

    if (!sec) {
      errors.push(`Language ${lang} is missing section at index ${i}`);
      continue;
    }

    if (sec.id !== expectedId) {
      errors.push(`Language ${lang} section at index ${i} has id '${sec.id}', expected '${expectedId}'`);
    }

    if (!sec.title || sec.title.trim() === '') {
      errors.push(`Language ${lang} section '${expectedId}' has empty title`);
    }

    if (!sec.shortDescription || sec.shortDescription.trim() === '') {
      errors.push(`Language ${lang} section '${expectedId}' has empty shortDescription`);
    }

    if (!sec.content || sec.content.length === 0) {
      errors.push(`Language ${lang} section '${expectedId}' has empty content paragraphs`);
    } else {
      sec.content.forEach((p, pIdx) => {
        if (!p || p.trim() === '') {
          errors.push(`Language ${lang} section '${expectedId}' content paragraph ${pIdx} is empty`);
        }
      });
    }

    if (sec.flowDiagram) {
      if (sec.flowDiagram.length === 0) {
        errors.push(`Language ${lang} section '${expectedId}' has empty flowDiagram`);
      }
      sec.flowDiagram.forEach((step, sIdx) => {
        if (!step || step.trim() === '') {
          errors.push(`Language ${lang} section '${expectedId}' flowDiagram step ${sIdx} is empty`);
        }
      });
    }

    if (sec.subsections) {
      sec.subsections.forEach((sub, subIdx) => {
        if (!sub.id || !sub.title || sub.title.trim() === '') {
          errors.push(`Language ${lang} section '${expectedId}' subsection ${subIdx} has empty title or id`);
        }
        if (!sub.content || sub.content.length === 0) {
          errors.push(`Language ${lang} section '${expectedId}' subsection '${sub.id}' has empty content`);
        }
        if (sub.callout && (!sub.callout.text || sub.callout.text.trim() === '')) {
          errors.push(`Language ${lang} section '${expectedId}' subsection '${sub.id}' has empty callout text`);
        }
      });
    }
  }
}

if (errors.length === 0) {
  console.log('✓ All 13 sections in all 6 languages are present, properly structured, and complete!');
} else {
  console.error(`Found ${errors.length} errors in documentation sections:`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

console.log('\n=== 2. VALIDATING UI CHROME TRANSLATION KEYS PARITY ===');
const enDocsKeys = Object.keys(en.docs).sort();
const enCategoryKeys = Object.keys(en.docs.categories).sort();

for (const lang of LANGUAGES) {
  const dict = DICTIONARIES[lang];
  const docsKeys = Object.keys(dict.docs).sort();
  const catKeys = Object.keys(dict.docs.categories).sort();

  const missingDocs = enDocsKeys.filter((k) => !(k in dict.docs));
  const missingCat = enCategoryKeys.filter((k) => !(k in dict.docs.categories));

  if (missingDocs.length > 0) {
    errors.push(`Language ${lang} is missing docs keys: ${missingDocs.join(', ')}`);
  }
  if (missingCat.length > 0) {
    errors.push(`Language ${lang} is missing docs.categories keys: ${missingCat.join(', ')}`);
  }
}

if (errors.length === 0) {
  console.log('✓ Docs translation keys have 100% parity across all 6 languages!');
} else {
  console.error(`Found errors in translation keys:`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

console.log('\n=== 3. TESTING LOCALIZED SEARCH ACROSS LANGUAGES ===');

function testSearch(lang: SupportedLanguage, query: string, expectedSectionId: string) {
  const q = query.toLowerCase();
  const sections = LOCALIZED_DOCUMENTATION_SECTIONS[lang];
  const matched = sections.filter((sec) => {
    const matchTitle = sec.title.toLowerCase().includes(q);
    const matchDesc = sec.shortDescription.toLowerCase().includes(q);
    const matchContent = sec.content.some((c) => c.toLowerCase().includes(q));
    const matchSubsections = sec.subsections?.some(
      (sub) =>
        sub.title.toLowerCase().includes(q) ||
        sub.content.some((sc) => sc.toLowerCase().includes(q))
    );
    return matchTitle || matchDesc || matchContent || matchSubsections;
  });

  const found = matched.some((m) => m.id === expectedSectionId);
  if (found) {
    console.log(`✓ [${lang.toUpperCase()}] Search '${query}' -> Found expected '${expectedSectionId}' (Total matches: ${matched.length})`);
  } else {
    console.error(`✗ [${lang.toUpperCase()}] Search '${query}' FAILED to find '${expectedSectionId}'`);
    errors.push(`[${lang}] Search '${query}' failed`);
  }
}

testSearch('en', 'Lifecycle', 'overview');
testSearch('en', 'optical + sar', 'optical-sar');
testSearch('hi', 'अवलोकन', 'overview');
testSearch('hi', 'जीवनचक्र', 'overview');
testSearch('hi', 'रोडमैप', 'backend-roadmap');
testSearch('es', 'Descripción', 'overview');
testSearch('es', 'ciclo de vida', 'overview');
testSearch('fr', 'renseignement', 'overview');
testSearch('fr', 'cycle de vie', 'overview');
testSearch('de', 'Übersicht', 'overview');
testSearch('de', 'Lebenszyklus', 'overview');
testSearch('ja', '概要', 'overview');
testSearch('ja', 'ライフサイクル', 'overview');

if (errors.length === 0) {
  console.log('\n========================================');
  console.log('🎉 ALL DOCUMENTATION LOCALIZATION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
} else {
  process.exit(1);
}
