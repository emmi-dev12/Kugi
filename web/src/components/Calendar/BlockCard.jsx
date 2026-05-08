import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import BlockDetailsSheet from '../UI/BlockDetailsSheet';
import styles from './BlockCard.module.css';

export default function BlockCard({ block, variant = 'week', onEdit, onDelete, onToggle, draggable, onDragStart, onDragEnd }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const color = getColor(block.category);
  const rgb = hexRgb(color);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const time = block.start_time
    ? `${block.start_time}${block.end_time ? ' – ' + block.end_time : ''}`
    : null;

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  function handleCardClick() {
    if (isMobile()) {
      setSheetOpen(true);
    } else {
      onEdit(block);
    }
  }

  return (
    <>
      <div
        className={`${styles.card} ${styles[variant]} ${block.completed ? styles.completed : ''}`}
        style={{
          background: `rgba(${rgb},${variant === 'bento' ? (isLight ? 0.22 : 0.15) : (isLight ? 0.18 : 0.14)})`,
          borderColor: `rgba(${rgb},${variant === 'bento' ? (isLight ? 0.55 : 0.32) : (isLight ? 0.45 : 0.28)})`,
          borderLeft: `3px solid rgba(${rgb},${isLight ? 0.9 : 0.7})`,
        }}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={handleCardClick}
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

        {/* Desktop hover actions */}
        <div className={styles.actions} onClick={e => e.stopPropagation()}>
          <button className={styles.actionBtn} onClick={() => setDetailsOpen(true)} title="Details">ℹ</button>
          <button className={styles.actionBtn} onClick={() => onToggle(block.id)}
            title={block.completed ? 'Undo' : 'Complete'}>
            {block.completed ? '↩' : '✓'}
          </button>
          <button className={styles.actionBtn} onClick={() => onEdit(block)} title="Edit">✎</button>
          <button className={styles.actionBtn} onClick={() => onDelete(block.id)} title="Delete">✕</button>
        </div>
      </div>

      {sheetOpen && createPortal(
        <div className={styles.sheetOverlay} onClick={() => setSheetOpen(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetBlockName}>
              <span>{block.emoji || getCatEmoji(block.category)}</span>
              {block.title}
            </div>
            <button className={styles.sheetItem} onClick={() => { setSheetOpen(false); setDetailsOpen(true); }}>
              <span className={styles.sheetIcon}>ℹ</span> View details
            </button>
            <button className={styles.sheetItem} onClick={() => { onEdit(block); setSheetOpen(false); }}>
              <span className={styles.sheetIcon}>✎</span> Edit block
            </button>
            <button className={styles.sheetItem} onClick={() => { onToggle(block.id); setSheetOpen(false); }}>
              <span className={styles.sheetIcon}>{block.completed ? '↩' : '✓'}</span>
              {block.completed ? 'Mark incomplete' : 'Mark complete'}
            </button>
            <button className={`${styles.sheetItem} ${styles.sheetDanger}`}
              onClick={() => { onDelete(block.id); setSheetOpen(false); }}>
              <span className={styles.sheetIcon}>✕</span> Delete block
            </button>
            <button className={styles.sheetCancel} onClick={() => setSheetOpen(false)}>
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {detailsOpen && (
        <BlockDetailsSheet
          block={block}
          onClose={() => setDetailsOpen(false)}
          onEdit={(b) => { setDetailsOpen(false); onEdit(b); }}
          onToggle={(id) => { onToggle(id); setDetailsOpen(false); }}
          onDelete={(id) => { onDelete(id); setDetailsOpen(false); }}
        />
      )}
    </>
  );
}
