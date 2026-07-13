const LANG_KEY = 'kugiLanguage';

export const SUPPORTED_LANGUAGES = ['en', 'de'];

export function detectDeviceLanguage() {
  const raw = navigator.language || 'en';
  const base = raw.slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
}

// null = "auto" (no explicit override stored)
export function getLangPreference() {
  return localStorage.getItem(LANG_KEY);
}

export function setLangPreference(lang) {
  if (lang === null) localStorage.removeItem(LANG_KEY);
  else localStorage.setItem(LANG_KEY, lang);
}

export function getEffectiveLanguage() {
  const stored = getLangPreference();
  return stored && SUPPORTED_LANGUAGES.includes(stored) ? stored : detectDeviceLanguage();
}

export function getLocale(lang = getEffectiveLanguage()) {
  return lang === 'de' ? 'de-DE' : 'en-US';
}
