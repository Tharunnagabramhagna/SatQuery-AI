import { SUPPORTED_LANGUAGES } from '../src/i18n/types';
import { en } from '../src/i18n/translations/en';
import { es } from '../src/i18n/translations/es';
import { fr } from '../src/i18n/translations/fr';
import { de } from '../src/i18n/translations/de';
import { hi } from '../src/i18n/translations/hi';
import { ja } from '../src/i18n/translations/ja';

const dictionaries = { en, es, fr, de, hi, ja };

console.log('--- 1. Testing Supported Languages ---');
console.log('Count:', SUPPORTED_LANGUAGES.length);
SUPPORTED_LANGUAGES.forEach((lang) => {
  console.log(`  [${lang.code}] ${lang.name} (${lang.nativeName}) - isSupported: ${lang.isSupported}`);
  if (!lang.isSupported) throw new Error(`Language ${lang.code} is marked as unsupported!`);
});

console.log('\n--- 2. Testing Translation Key Parity Across All 6 Languages ---');
function getDeepKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.keys(obj).flatMap((key) => {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return getDeepKeys(value, path);
    }
    return [path];
  });
}

const enKeys = new Set(getDeepKeys(en));
console.log(`English Canonical Key Count: ${enKeys.size}`);

for (const [code, dict] of Object.entries(dictionaries)) {
  const dictKeys = new Set(getDeepKeys(dict));
  console.log(`  [${code}] Key count: ${dictKeys.size}`);

  const missingFromDict = [...enKeys].filter((k) => !dictKeys.has(k));
  if (missingFromDict.length > 0) {
    console.error(`  ERROR: Language [${code}] is missing ${missingFromDict.length} keys:`, missingFromDict);
    process.exit(1);
  }

  const extraInDict = [...dictKeys].filter((k) => !enKeys.has(k));
  if (extraInDict.length > 0) {
    console.error(`  ERROR: Language [${code}] has ${extraInDict.length} extra keys:`, extraInDict);
    process.exit(1);
  }
}
console.log('✓ 100% Key Parity Confirmed across en, es, fr, de, hi, ja!');

console.log('\n--- 3. Testing Sample Translations Across Key Components ---');
const sampleKeys = [
  'nav.dashboard',
  'nav.history',
  'sidebar.queryAgent',
  'viewer.swipe',
  'viewer.sideBySide',
  'viewer.optical',
  'viewer.sarDemo',
  'queryAgent.title',
  'queryAgent.suggestion1',
  'settings.title',
  'history.title',
  'datasets.title',
];

for (const key of sampleKeys) {
  const parts = key.split('.');
  console.log(`\nKey: ${key}`);
  for (const [code, dict] of Object.entries(dictionaries)) {
    let val: any = dict;
    for (const part of parts) {
      val = val?.[part];
    }
    console.log(`  [${code}] ${val}`);
  }
}

console.log('\n=============================================');
console.log('✓ ALL I18N LOCALIZATION TESTS PASSED SUCCESSFULLY!');
console.log('=============================================');
