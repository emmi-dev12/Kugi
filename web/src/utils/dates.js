// All dates in Europe/Zurich (Switzerland) timezone, DD.MM.YYYY HH:MM format

const TZ = 'Europe/Zurich';

export function now() {
  return new Date();
}

export function toZurich(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: TZ }));
}

export function todayZurich() {
  const d = toZurich(new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateStr(date) {
  // YYYY-MM-DD for storage (timezone-aware)
  const d = toZurich(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDisplay(date) {
  // DD.MM.YYYY
  const d = toZurich(date);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

export function formatDateTime(date) {
  // DD.MM.YYYY HH:MM
  const d = toZurich(date);
  return `${formatDisplay(date)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function formatShort(date) {
  // DD.MM
  const d = toZurich(date);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
}

export function formatFull(date) {
  return date.toLocaleDateString('de-CH', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatMonthYear(date) {
  return date.toLocaleDateString('de-CH', { timeZone: TZ, month: 'long', year: 'numeric' });
}

export function isToday(date) {
  return toDateStr(date) === toDateStr(new Date());
}

export function getWeekStart(date) {
  const d = toZurich(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minsToPx(m) {
  return (m / 60) * 64;
}
