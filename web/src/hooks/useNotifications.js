import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

const fn = {
  getVapidPublicKey:  makeFunctionReference('push:getVapidPublicKey'),
  initVapidKeys:      makeFunctionReference('push:initVapidKeys'),
  saveSubscription:   makeFunctionReference('push:saveSubscription'),
  deleteMySubscription: makeFunctionReference('push:deleteMySubscription'),
  hasSubscription:    makeFunctionReference('push:hasSubscription'),
  setReminders:       makeFunctionReference('settings:setReminders'),
  setTimezone:        makeFunctionReference('settings:setTimezone'),
};

const REMINDERS_KEY = 'kugiReminders';
const CHECK_INTERVAL = 60_000;

function loadReminders() {
  try {
    const v = JSON.parse(localStorage.getItem(REMINDERS_KEY));
    if (Array.isArray(v) && v.length) return v;
  } catch {}
  const old = localStorage.getItem('kugiNotifyMinutes');
  return [{ id: 'default', offsetMinutes: old ? Number(old) : 15, atTime: '09:00', message: '' }];
}

function loadFired() {
  try { return new Set(JSON.parse(localStorage.getItem('kugiNotifyFired') || '[]')); }
  catch { return new Set(); }
}

function saveFired(set) {
  try { localStorage.setItem('kugiNotifyFired', JSON.stringify([...set])); } catch {}
}

function fireNotification(title, body, tag) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'NOTIFY', title, body, tag });
  } else {
    new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
  }
}

export function useNotifications(blocks, timezone) {
  const [, forceUpdate] = useState(0);
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const [reminders, setReminders] = useState(loadReminders);
  const [pushActive, setPushActive] = useState(false);
  const firedRef = useRef(loadFired());
  const currentEndpointRef = useRef(null);

  const vapidPublicKey = useQuery(fn.getVapidPublicKey);
  const initVapidKeys = useMutation(fn.initVapidKeys);
  const saveSubscription = useMutation(fn.saveSubscription);
  const deleteMySubscription = useMutation(fn.deleteMySubscription);
  const setRemindersOnServer = useMutation(fn.setReminders);
  const setTimezoneOnServer = useMutation(fn.setTimezone);

  // Check existing endpoint against Convex
  const existingEndpoint = currentEndpointRef.current;
  const isSubscribed = useQuery(
    fn.hasSubscription,
    existingEndpoint ? { endpoint: existingEndpoint } : 'skip'
  );

  useEffect(() => {
    if (isSubscribed !== undefined) setPushActive(!!isSubscribed);
  }, [isSubscribed]);

  // Sync reminders to Convex whenever they change
  useEffect(() => {
    setRemindersOnServer({ value: JSON.stringify(reminders) }).catch(() => {});
  }, [reminders]);

  // Sync timezone to Convex whenever it changes
  useEffect(() => {
    if (timezone) setTimezoneOnServer({ value: timezone }).catch(() => {});
  }, [timezone]);

  // Ensure VAPID keys exist when first permission granted
  useEffect(() => {
    if (permission === 'granted' && vapidPublicKey === null) {
      initVapidKeys().catch(() => {});
    }
  }, [permission, vapidPublicKey]);

  // Register push subscription once we have the VAPID key
  useEffect(() => {
    if (permission !== 'granted' || !vapidPublicKey || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(async reg => {
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }
        currentEndpointRef.current = sub.endpoint;
        await saveSubscription({
          subscription: JSON.stringify(sub),
          userAgent: navigator.userAgent,
        });
        setPushActive(true);
      } catch (e) {
        console.warn('Push subscription failed:', e);
      }
    });
  }, [permission, vapidPublicKey]);

  async function requestPermission() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    forceUpdate(n => n + 1);
    return result;
  }

  async function disablePush() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await deleteMySubscription({ endpoint: sub.endpoint });
      currentEndpointRef.current = null;
    }
    setPushActive(false);
  }

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

  // Client-side fallback: still fire in-browser notifications when app is open
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

  return {
    permission,
    pushActive,
    reminders,
    addReminder,
    updateReminder,
    removeReminder,
    requestPermission,
    disablePush,
  };
}

// Convert VAPID base64url public key to Uint8Array for the browser API
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
