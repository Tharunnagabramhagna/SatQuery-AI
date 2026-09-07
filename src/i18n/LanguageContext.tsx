import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SupportedLanguage, TranslationSchema, LanguageOption } from './types';
import { SUPPORTED_LANGUAGES } from './types';
import { en } from './translations/en';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { de } from './translations/de';
import { hi } from './translations/hi';
import { ja } from './translations/ja';
import { getLanguage, updateLanguage } from '../services/api';

const TRANSLATIONS: Record<SupportedLanguage, TranslationSchema> = {
  en,
  es,
  fr,
  de,
  hi,
  ja,
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  languages: LanguageOption[];
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function resolvePath(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const segments = path.split('.');
  let current: unknown = obj;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  // Load initial language from API abstraction on mount
  useEffect(() => {
    let mounted = true;
    getLanguage().then((stored) => {
      if (mounted && (stored as SupportedLanguage) in TRANSLATIONS) {
        const validated = stored as SupportedLanguage;
        setLanguageState(validated);
        if (typeof document !== 'undefined') {
          document.documentElement.lang = validated;
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (newLang: SupportedLanguage) => {
    if (!(newLang in TRANSLATIONS)) return;
    setLanguageState(newLang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
    }
    await updateLanguage(newLang);
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      // 1. Try active language
      let text = resolvePath(TRANSLATIONS[language], path);

      // 2. Fallback to English
      if (!text && language !== 'en') {
        text = resolvePath(TRANSLATIONS.en, path);
      }

      // 3. Fallback to path string if not in dictionaries
      if (!text) {
        text = path;
      }

      // 4. Interpolate parameters if any (e.g. {{count}})
      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          text = text!.replace(new RegExp(`{{${key}}}`, 'g'), String(val));
        });
      }

      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        languages: SUPPORTED_LANGUAGES,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export const useI18n = useTranslation;
