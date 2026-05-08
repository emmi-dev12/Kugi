import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import styles from './CompletedView.module.css';

export default function CompletedView({ blocks, onToggle, onEdit }) {
  const completed = [...blocks.filter(b => b.completed)]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.start_time || '').localeCompare(a.start_time || ''));

  if (completed.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>✓</div>
        <div className={styles.emptyText}>Nothing completed yet.</div>
        <div className={styles.emptyHint}>Mark blocks done and they'll appear here.</div>
      </div>
    );
  }

  const grouped = completed.reduce((acc, block) => {
    (acc[block.date] = acc[block.date] || []).push(block);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.count}>{completed.length}</span>
        <span className={styles.countLabel}>blocks completed</span>
      </div>
      <div className={styles.list}>
        {dates.map(date => (
          <div key={date} className={styles.group}>
            <div className={styles.dateLabel}>{formatDate(date)}</div>
            {grouped[date].map(block => {
              const color = getColor(block.category);
              const rgb = hexRgb(color);
              return (
                <div key={block.id} className={styles.block}
                  style={{ borderLeft: `3px solid ${color}`, background: `rgba(${rgb},0.08)` }}
                  onClick={() => onEdit(block)}>
                  <span className={styles.emoji}>{block.emoji || getCatEmoji(block.category)}</span>
                  <div className={styles.info}>
                    <div className={styles.title}>{block.title}</div>
                    {block.start_time && (
                      <div className={styles.time}>
                        {block.start_time}{block.end_time ? ` – ${block.end_time}` : ''}
                      </div>
                    )}
                  </div>
                  <span className={styles.badge}>{block.category}</span>
                  <button className={styles.undoBtn}
                    onClick={e => { e.stopPropagation(); onToggle(block.id); }}
                    title="Mark incomplete">↩</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}
