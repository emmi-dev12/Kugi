import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toDateStr, isToday } from '../../utils/dates';
import { getLocale } from '../../utils/language';
import BlockCard from './BlockCard';
import styles from './WeekView.module.css';

function blockCoversDate(b, dateStr) {
  if (!b.end_date) return b.date === dateStr;
  return b.date <= dateStr && dateStr <= b.end_date;
}

// Jan 7 2024 was a Sunday — used as a stable reference so index matches Date#getDay().
function getDayNames(locale) {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
  );
}

export default function WeekView({ days, blocks, activeCategory, onEditBlock, onDeleteBlock, onToggleBlock, onUpdateBlock, onAddBlock, onDayClick }) {
  const { i18n } = useTranslation();
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const dayNames = getDayNames(getLocale(i18n.language));

  return (
    <div className={styles.wrap}>
      {/* scrollInner keeps headers + grid in one horizontal scroll unit on mobile */}
      <div className={styles.scrollInner}>
        <div className={styles.headers}>
          {days.map((day, i) => (
            <div key={i} className={`${styles.dayHeader} ${isToday(day) ? styles.today : ''}`}
              onClick={() => onDayClick(day)}>
              <span className={styles.dayName}>{dayNames[day.getDay()]}</span>
              <span className={styles.dayNum}>{day.getDate()}</span>
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {days.map((day, i) => {
            const dateStr = toDateStr(day);
            const dayBlocks = blocks
              .filter(b => blockCoversDate(b, dateStr) && (!activeCategory || b.category === activeCategory))
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

            return (
              <div key={i} className={styles.col}>
                {dayBlocks.map(block => (
                  <BlockCard key={block.id} block={block} variant="week"
                    draggable onDragStart={() => setDragId(block.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    onEdit={() => onEditBlock(block)}
                    onDelete={onDeleteBlock} onToggle={onToggleBlock} onUpdate={onUpdateBlock} />
                ))}
                <div
                  className={`${styles.dropZone} ${dragOver === dateStr ? styles.dragOver : ''}`}
                  onClick={() => onAddBlock(dateStr)}
                  onDragOver={e => { e.preventDefault(); setDragOver(dateStr); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault(); setDragOver(null);
                    if (dragId) { onUpdateBlock(dragId, { date: dateStr }); setDragId(null); }
                  }}
                >+</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
