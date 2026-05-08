import { useState, useCallback } from 'react';
import { CATEGORIES } from '../utils/categories';

const STORAGE_KEY = 'kugiCustomCategories';

function loadCustom() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

export function useCategories() {
  const [custom, setCustom] = useState(loadCustom);

  const categories = { ...CATEGORIES, ...custom };

  const addCategory = useCallback((name, color, emoji) => {
    if (!name.trim()) return;
    setCustom(prev => {
      const next = { ...prev, [name.trim()]: { color, emoji } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeCategory = useCallback((name) => {
    setCustom(prev => {
      const next = { ...prev };
      delete next[name];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { categories, customCategories: custom, addCategory, removeCategory };
}
