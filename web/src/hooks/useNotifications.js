import { useEffect, useRef, useState } from 'react';

const REMINDERS_KEY = 'kugiReminders';
const FIRED_KEY = 'kugiNotifyFired';
const CHECK_INTERVAL = 60_000;

function loadReminders() {
  try {
    const v = JSON.parse(localStorage.getItem(REMINDERS_KEY));
    if (Array.isArray(v) && v.length) return v;
  } catch {}
  // Migrate from old single-value setting
  const old = localStorage.getItem('kugiNotifyMinutes');
  return [{ id: 'default', offsetMinutes: old ? Number(old) : 15, atTime: '09:00', message: '' }];
}

function loadFired() {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveFired(set) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...set])); } catch {}
}

function fireNotification(title, body, tag) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'NOTIFY', title, body, tag });
  } else {
    new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
  }
}

export function useNotifications(blocks) {
  const [, forceUpdate] = useState(0);
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const [reminders, setReminders] = useState(loadReminders);
  const firedRef = useRef(loadFired());

  function saveReminders(rs) {
    setReminders(rs);
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(rs));
  }

  function addReminder() {
    if (reminders.length >= 3) return;
    saveReminders([...reminders, { id: Date.now().toString(), offsetMinutes: 30, atTime: '09:00', message: '' }]);
  }

  function updateReminder(id, patch) {
    saveReminders(reminders.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function removeReminder(id) {
    saveReminders(reminders.filter(r => r.id !== id));
  }

  async function requestPermission() {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
    forceUpdate(n => n + 1);
  }

  useEffect(() => {
    if (permission !== 'granted') return;
    if (!blocks?.length) return;

    function check() {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const fired = firedRef.current;

      blocks.forEach(block => {
        if (block.completed) return;
        if (block.date < todayStr) return;

        reminders.forEach(reminder => {
          const key = `${block._id}-${reminder.id}`;
          if (fired.has(key)) return;

          const isDayScale = reminder.offsetMinutes >= 1440;
          let shouldFire = false;
          let autoLabel = '';

          if (isDayScale) {
            const daysBack = Math.floor(reminder.offsetMinutes / 1440);
            const atTime = reminder.atTime || '09:00';
            // Parse block date safely (avoid timezone shift)
            const [bY, bM, bD] = block.date.split('-').map(Number);
            const target = new Date(bY, bM - 1, bD);
            target.setDate(target.getDate() - daysBack);
            const [th, tm] = atTime.split(':').map(Number);
            target.setHours(th, tm, 0, 0);
            const diffMins = (target - now) / 60_000;
            shouldFire = diffMins >= -1 && diffMins < 1;
            autoLabel = daysBack === 1 ? 'Tomorrow' : `In ${daysBack} days`;
          } else if (block.start_time) {
            const [bY, bM, bD] = block.date.split('-').map(Number);
            const [h, m] = block.start_time.split(':').map(Number);
            const blockTime = new Date(bY, bM - 1, bD, h, m, 0, 0);
            const diffMins = (blockTime - now) / 60_000;
            const off = reminder.offsetMinutes;
            shouldFire = diffMins > 0 && diffMins <= off + 1 && diffMins > off - 1;
            const left = Math.round(diffMins);
            autoLabel = left <= 1 ? 'Starting now' : `In ${left} min`;
          }

          if (shouldFire) {
            fired.add(key);
            saveFired(fired);
            const timeStr = block.start_time
              ? ` · ${block.start_time}${block.end_time ? '–' + block.end_time : ''}`
              : '';
            const body = reminder.message || `${autoLabel}${timeStr}`;
            fireNotification(`${block.emoji || '📅'} ${block.title}`, body, key);
          }
        });
      });
    }

    check();
    const id = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [blocks, permission, reminders]);

  return { permission, reminders, addReminder, updateReminder, removeReminder, requestPermission };
}
