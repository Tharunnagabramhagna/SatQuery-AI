import { readFileSync } from 'fs';
import { en } from '../src/i18n/translations/en';

const typesContent = readFileSync('src/i18n/types.ts', 'utf-8');

// Parse interface TranslationSchema { ... }
const match = typesContent.match(/export interface TranslationSchema \{([\s\S]*?)\n\}/);
if (!match) {
  console.error('Could not find TranslationSchema');
  process.exit(1);
}

const body = match[1];
const sections: Record<string, string[]> = {};
let currentSection = '';

for (const line of body.split('\n')) {
  const secMatch = line.match(/^\s\s([a-zA-Z0-9]+):\s*\{/);
  if (secMatch) {
    currentSection = secMatch[1];
    sections[currentSection] = [];
    continue;
  }
  const keyMatch = line.match(/^\s\s\s\s([a-zA-Z0-9]+):\s*string;/);
  if (keyMatch && currentSection) {
    sections[currentSection].push(keyMatch[1]);
  }
}

console.log('Sections found in TranslationSchema:', Object.keys(sections).length);

const missing: Record<string, string[]> = {};
let totalExpected = 0;
let totalMissing = 0;

for (const [sec, keys] of Object.entries(sections)) {
  totalExpected += keys.length;
  const enSec = (en as any)[sec];
  if (!enSec) {
    missing[sec] = keys;
    totalMissing += keys.length;
    continue;
  }
  const secMissing = keys.filter((k) => enSec[k] === undefined);
  if (secMissing.length > 0) {
    missing[sec] = secMissing;
    totalMissing += secMissing.length;
  }
}

console.log(`Total expected keys: ${totalExpected}`);
console.log(`Total missing in en.ts: ${totalMissing}`);
console.log('Missing breakdown:', JSON.stringify(missing, null, 2));
