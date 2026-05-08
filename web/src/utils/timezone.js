const TZ_KEY = 'kugiTimezone';

export function getTZ() {
  return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function setTZ(tz) {
  localStorage.setItem(TZ_KEY, tz);
}

export function allTimezones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [
      'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Zurich',
      'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai',
      'Asia/Kolkata', 'Asia/Seoul', 'Australia/Sydney', 'Pacific/Auckland',
    ];
  }
}
