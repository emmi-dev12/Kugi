import { useState, useEffect, useCallback } from 'react';

// In-memory DB backed by localStorage. Replaces Convex for the "bring your own" model.
// When a Convex URL is configured, the app connects to that instead.

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load() {
  try { return JSON.parse(localStorage.getItem('kugiBlocks') || '[]'); }
  catch { return []; }
}

function save(blocks) {
  localStorage.setItem('kugiBlocks', JSON.stringify(blocks));
}

export function useBlocks() {
  const [blocks, setBlocks] = useState(load);

  const refresh = useCallback(() => setBlocks(load()), []);

  const createBlock = useCallback((data) => {
    const b = { id: uid(), completed: false, ...data };
    const next = [...load(), b];
    save(next);
    setBlocks(next);
    return b.id;
  }, []);

  const updateBlock = useCallback((id, fields) => {
    const next = load().map(b => b.id === id ? { ...b, ...fields } : b);
    save(next);
    setBlocks(next);
  }, []);

  const deleteBlock = useCallback((id) => {
    const next = load().filter(b => b.id !== id);
    save(next);
    setBlocks(next);
  }, []);

  const toggleComplete = useCallback((id) => {
    const next = load().map(b => b.id === id ? { ...b, completed: !b.completed } : b);
    save(next);
    setBlocks(next);
  }, []);

  return { blocks, createBlock, updateBlock, deleteBlock, toggleComplete, refresh };
}
