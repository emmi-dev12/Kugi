import { useState } from 'react';
import { toDateStr, isToday, formatShort } from '../../utils/dates';
import BlockCard from './BlockCard';
import styles from './WeekView.module.css';

export default function WeekView({ days, blocks, activeCategory, onEditBlock, onDeleteBlock, onToggleBlock, onUpdateBlock, onAddBlock, onDayClick }) {
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div className={styles.wrap} data-cols={days.length}>
      <div className={styles.headers} style={{ gridTemplateColumns: `repeat(${days.length},1fr)` }}>
        {days.map((day, i) => (
          <div key={i} className={`${styles.dayHeader} ${isToday(day) ? styles.today : ''}`}
            onClick={() => onDayClick(day)}>
            <span className={styles.dayName}>{dayNames[day.getDay()]}</span>
            <span className={styles.dayNum}>{day.getDate()}</span>
          </div>
        ))}
      </div>

      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${days.length},1fr)` }}>
        {days.map((day, i) => {
          const dateStr = toDateStr(day);
          const dayBlocks = blocks
            .filter(b => b.date === dateStr && (!activeCategory || b.category === activeCategory))
            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

          return (
            <div key={i} className={styles.col}>
              {dayBlocks.map(block => (
                <BlockCard key={block.id} block={block} variant="week"
                  draggable onDragStart={() => setDragId(block.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); }}
                  onEdit={() => onEditBlock(block)}
                  onDelete={onDeleteBlock} onToggle={onToggleBlock} />
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
  );
}
