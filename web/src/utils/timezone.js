const KEY = 'kugiTimezone';

export function getTimezone() {
  return localStorage.getItem(KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function setTimezone(tz) {
  localStorage.setItem(KEY, tz);
  window.location.reload();
}

// Intl.supportedValuesOf not available in Safari < 15.4 — fallback to common list
const FALLBACK_TZ = [
  'Pacific/Honolulu','America/Anchorage','America/Los_Angeles','America/Denver',
  'America/Chicago','America/New_York','America/Sao_Paulo','Atlantic/Azores',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Zurich','Europe/Rome',
  'Europe/Helsinki','Europe/Moscow','Asia/Dubai','Asia/Karachi','Asia/Kolkata',
  'Asia/Dhaka','Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Asia/Seoul',
  'Australia/Sydney','Pacific/Auckland',
];

export const ALL_TIMEZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); }
  catch { return FALLBACK_TZ; }
})();
