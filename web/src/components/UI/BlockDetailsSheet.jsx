import { createPortal } from 'react-dom';
import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import styles from './BlockDetailsSheet.module.css';

export default function BlockDetailsSheet({ block, onClose, onEdit, onToggle, onDelete }) {
  if (!block) return null;

  const color = getColor(block.category);
  const rgb = hexRgb(color);
  const time = block.start_time
    ? `${block.start_time}${block.end_time ? ' – ' + block.end_time : ''}`
    : null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.hero} style={{ background: `rgba(${rgb},0.18)`, borderColor: `rgba(${rgb},0.3)` }}>
          <span className={styles.heroEmoji}>{block.emoji || getCatEmoji(block.category)}</span>
          <div className={styles.heroText}>
            <div className={styles.heroTitle}>{block.title}</div>
            <div className={styles.heroBadge} style={{ color, borderColor: `rgba(${rgb},0.4)`, background: `rgba(${rgb},0.12)` }}>
              {block.category}
            </div>
          </div>
          {block.completed && <div className={styles.doneChip}>✓ Done</div>}
        </div>

        <div className={styles.rows}>
          {block.date && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Date</span>
              <span className={styles.rowValue}>{block.date}</span>
            </div>
          )}
          {time && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>Time</span>
              <span className={styles.rowValue}>{time}</span>
            </div>
          )}
          {block.notes && (
            <div className={styles.row} style={{ alignItems: 'flex-start' }}>
              <span className={styles.rowLabel}>Notes</span>
              <span className={styles.rowValue} style={{ whiteSpace: 'pre-wrap' }}>{block.notes}</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => { onEdit(block); onClose(); }}>✎ Edit</button>
          <button className={styles.actionBtn} onClick={() => { onToggle(block.id); onClose(); }}>
            {block.completed ? '↩ Undo' : '✓ Done'}
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => { onDelete(block.id); onClose(); }}>✕ Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
