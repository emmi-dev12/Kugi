const KEY = 'kugiTimezone';

export function getTimezone() {
  return localStorage.getItem(KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function setTimezone(tz) {
  localStorage.setItem(KEY, tz);
  window.location.reload();
}

export const ALL_TIMEZONES = Intl.supportedValuesOf('timeZone');
