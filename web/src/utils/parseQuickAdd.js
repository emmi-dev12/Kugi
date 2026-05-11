import * as chrono from 'chrono-node';

export function parseQuickAdd(input, defaultDate = new Date()) {
  if (!input.trim()) return null;

  // Parse date/time from the string
  const results = chrono.parse(input, defaultDate, { forwardDate: true });

  let date = defaultDate;
  let start_time = undefined;
  let end_time = undefined;
  let titleText = input;

  if (results.length > 0) {
    const r = results[0];
    date = r.start.date();

    if (r.start.isCertain('hour')) {
      const h = String(r.start.get('hour')).padStart(2, '0');
      const m = String(r.start.get('minute') ?? 0).padStart(2, '0');
      start_time = `${h}:${m}`;
    }
    if (r.end && r.end.isCertain('hour')) {
      const h = String(r.end.get('hour')).padStart(2, '0');
      const m = String(r.end.get('minute') ?? 0).padStart(2, '0');
      end_time = `${h}:${m}`;
    }

    // Remove the matched date/time text from the title
    titleText = (input.slice(0, r.index) + input.slice(r.index + r.text.length)).trim();
  }

  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  return {
    title: titleText || input.trim(),
    date: dateStr,
    start_time,
    end_time,
  };
}
