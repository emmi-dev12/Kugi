import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import styles from './BlockCard.module.css';

export default function BlockCard({ block, variant = 'week', onEdit, onDelete, onToggle, draggable, onDragStart, onDragEnd }) {
  const color = getColor(block.category);
  const rgb = hexRgb(color);
  const time = block.start_time
    ? `${block.start_time}${block.end_time ? ' – ' + block.end_time : ''}`
    : null;

  return (
    <div
      className={`${styles.card} ${styles[variant]} ${block.completed ? styles.completed : ''}`}
      style={{
        background: `rgba(${rgb},${variant === 'bento' ? '0.15' : '0.14'})`,
        borderColor: `rgba(${rgb},${variant === 'bento' ? '0.32' : '0.28'})`,
        borderLeft: `3px solid rgba(${rgb},0.7)`,
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(block)}
    >
      <span className={styles.emoji}>{block.emoji || getCatEmoji(block.category)}</span>
      <div className={`${styles.title} ${block.completed ? styles.done : ''}`}>{block.title}</div>

      {variant === 'bento' && block.notes && (
        <div className={styles.notes}>{block.notes}</div>
      )}

      <div className={styles.meta}>
        {time && <span className={styles.time}>{time}</span>}
        <span className={styles.badge}>{block.category}</span>
      </div>

      <div className={styles.actions} onClick={e => e.stopPropagation()}>
        <button className={styles.actionBtn} onClick={() => onToggle(block.id)}
          title={block.completed ? 'Undo' : 'Complete'}>
          {block.completed ? '↩' : '✓'}
        </button>
        <button className={styles.actionBtn} onClick={() => onEdit(block)} title="Edit">✎</button>
        <button className={styles.actionBtn} onClick={() => onDelete(block.id)} title="Delete">✕</button>
      </div>
    </div>
  );
}
