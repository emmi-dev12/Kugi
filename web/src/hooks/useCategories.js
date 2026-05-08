import { useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { CATEGORIES } from '../utils/categories';

const STORAGE_KEY = 'kugiCustomCategories';

const getCustomCategories = makeFunctionReference('settings:getCustomCategories');
const setCustomCategories = makeFunctionReference('settings:setCustomCategories');

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

export function useCategories() {
  const remote = useQuery(getCustomCategories);
  const setRemote = useMutation(setCustomCategories);

  // While Convex is loading, fall back to localStorage so UI is instant
  const custom = remote ?? loadLocal();
  const categories = { ...CATEGORIES, ...custom };

  const addCategory = useCallback((name, color, emoji) => {
    if (!name.trim()) return;
    const next = { ...loadLocal(), [name.trim()]: { color, emoji } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRemote({ value: JSON.stringify(next) });
  }, [setRemote]);

  const removeCategory = useCallback((name) => {
    const next = { ...loadLocal() };
    delete next[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRemote({ value: JSON.stringify(next) });
  }, [setRemote]);

  return { categories, customCategories: custom, addCategory, removeCategory };
}
