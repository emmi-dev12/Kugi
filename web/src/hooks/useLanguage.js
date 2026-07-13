import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLangPreference, setLangPreference, detectDeviceLanguage } from '../utils/language';

export function useLanguage() {
  const { i18n } = useTranslation();
  const [preference, setPreference] = useState(() => getLangPreference()); // null | 'en' | 'de'

  const setLanguage = (lang) => {
    setLangPreference(lang);
    const effective = lang ?? detectDeviceLanguage();
    i18n.changeLanguage(effective);
    document.documentElement.lang = effective;
    setPreference(lang);
  };

  return { preference, effectiveLanguage: i18n.language, setLanguage };
}
