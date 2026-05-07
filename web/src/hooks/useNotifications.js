import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'kugiNotifyMinutes';
const FIRED_KEY = 'kugiNotifyFired';
const CHECK_INTERVAL = 60_000; // check every minute

export function useNotifications(blocks) {
  const [, forceUpdate] = useState(0);
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const [minutesBefore, setMinutesBefore] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : 15;
  });
  const firedRef = useRef(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')); }
    catch { return new Set(); }
  });

  // Persist minutesBefore
  function setAndSave(mins) {
    setMinutesBefore(mins);
    localStorage.setItem(STORAGE_KEY, String(mins));
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
      const fired = firedRef.current();
      const todayStr = now.toISOString().slice(0, 10);

      blocks.forEach(block => {
        if (!block.start_time || block.completed) return;
        if (block.date < todayStr) return;

        const [h, m] = block.start_time.split(':').map(Number);
        const blockTime = new Date(block.date);
        blockTime.setHours(h, m, 0, 0);
        const diffMs = blockTime - now;
        const diffMins = diffMs / 60_000;

        // Fire when we're within [minutesBefore, minutesBefore+1) minutes away
        const key = `${block._id}-${minutesBefore}`;
        if (diffMins > 0 && diffMins <= minutesBefore + 1 && diffMins > minutesBefore - 1 && !fired.has(key)) {
          fired.add(key);
          try { localStorage.setItem(FIRED_KEY, JSON.stringify([...fired])); } catch {}

          const minsLeft = Math.round(diffMins);
          const label = minsLeft <= 1 ? 'starting now' : `in ${minsLeft} min`;

          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'NOTIFY',
              title: `${block.emoji || '📅'} ${block.title}`,
              body: `${label} · ${block.start_time}${block.end_time ? '–' + block.end_time : ''}`,
              tag: key,
            });
          } else {
            new Notification(`${block.emoji || '📅'} ${block.title}`, {
              body: `${label} · ${block.start_time}${block.end_time ? '–' + block.end_time : ''}`,
              tag: key,
              icon: '/icons/icon-192.png',
            });
          }
        }
      });
    }

    check();
    const id = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [blocks, permission, minutesBefore]);

  return { permission, minutesBefore, setMinutesBefore: setAndSave, requestPermission };
}
