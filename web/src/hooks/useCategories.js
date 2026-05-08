import { useState, useEffect, useCallback } from 'react';
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
  const [custom, setCustom] = useState(loadLocal);

  // When Convex data arrives, take it as the source of truth
  useEffect(() => {
    if (remote !== undefined) {
      setCustom(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
    }
  }, [remote]);

  const categories = { ...CATEGORIES, ...custom };

  const addCategory = useCallback((name, color, emoji) => {
    if (!name.trim()) return;
    setCustom(prev => {
      const next = { ...prev, [name.trim()]: { color, emoji } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRemote({ value: JSON.stringify(next) });
      return next;
    });
  }, [setRemote]);

  const removeCategory = useCallback((name) => {
    setCustom(prev => {
      const next = { ...prev };
      delete next[name];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRemote({ value: JSON.stringify(next) });
      return next;
    });
  }, [setRemote]);

  const editCategory = useCallback((oldName, newName, color, emoji) => {
    if (!newName.trim()) return;
    setCustom(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k === oldName ? newName.trim() : k] = k === oldName ? { color, emoji } : v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRemote({ value: JSON.stringify(next) });
      return next;
    });
  }, [setRemote]);

  return { categories, customCategories: custom, addCategory, removeCategory, editCategory };
}
