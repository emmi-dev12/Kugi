import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toDateStr, isToday } from '../../utils/dates';
import { getLocale } from '../../utils/language';
import styles from './CalendarView.module.css';

// Jan 1 2024 was a Monday — used as a stable reference for locale weekday abbreviations.
function getWeekdayLabels(locale) {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))
  );
}

export default function CalendarView({ blocks, onDaySelect }) {
  const { t, i18n } = useTranslation();
  const weekdayLabels = getWeekdayLabels(getLocale(i18n.language));
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const blocksByDate = {};
  blocks.forEach(b => {
    if (!blocksByDate[b.date]) blocksByDate[b.date] = { total: 0, done: 0 };
    blocksByDate[b.date].total++;
    if (b.completed) blocksByDate[b.date].done++;
  });

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: new Date(year, month, 1 - startOffset + i), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }

  const monthLabel = viewMonth.toLocaleDateString(getLocale(i18n.language), { month: 'long', year: 'numeric' });

  function goToday() {
    const d = new Date();
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    onDaySelect(d);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.nav}>
        <button className={styles.navBtn}
          onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <button className={styles.navBtn}
          onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
      </div>

      <button className={styles.todayBtn} onClick={goToday}>{t('calendar.goToToday')}</button>

      <div className={styles.weekLabels}>
        {weekdayLabels.map(l => (
          <div key={l} className={styles.weekLabel}>{l}</div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map(({ date, outside }, i) => {
          const ds = toDateStr(date);
          const info = blocksByDate[ds];
          const today = isToday(date);
          return (
            <div key={i}
              className={`${styles.cell} ${outside ? styles.outside : ''} ${today ? styles.today : ''}`}
              onClick={() => !outside && onDaySelect(date)}>
              <span className={styles.dayNum}>{date.getDate()}</span>
              {info && (
                <div className={styles.dots}>
                  <span className={styles.dot}
                    style={{ background: info.done === info.total ? '#10b981' : '#4f7cff' }} />
                  {info.total > 1 && <span className={styles.dotCount}>{info.total}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
