import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import BlockDetailsSheet from '../UI/BlockDetailsSheet';
import styles from './BlockCard.module.css';

export default function BlockCard({ block, variant = 'week', onEdit, onDelete, onToggle, onUpdate, draggable, onDragStart, onDragEnd }) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.title);
  const longPressRef = useRef(null);
  const color = getColor(block.category);
  const rgb = hexRgb(color);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const time = block.start_time
    ? `${block.start_time}${block.end_time ? ' – ' + block.end_time : ''}`
    : null;

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

  function handleCardClick() {
    if (editing) return;
    if (isMobile()) {
      setSheetOpen(true);
    } else {
      onEdit(block);
    }
  }

  function beginEdit(e) {
    if (!onUpdate) return;
    e.stopPropagation();
    setDraft(block.title);
    setEditing(true);
  }

  function commitEdit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== block.title) onUpdate(block.id, { title: next });
  }

  // Long-press to edit on touch devices
  function onTitlePointerDown(e) {
    if (!onUpdate || !isMobile()) return;
    longPressRef.current = setTimeout(() => beginEdit(e), 500);
  }
  function clearLongPress() {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  }

  return (
    <>
      <div
        className={`${styles.card} ${styles[variant]} ${block.completed ? styles.completed : ''}`}
        style={{
          background: `rgba(${rgb},${variant === 'bento' ? (isLight ? 0.32 : 0.15) : (isLight ? 0.26 : 0.14)})`,
          borderColor: `rgba(${rgb},${variant === 'bento' ? (isLight ? 0.7 : 0.32) : (isLight ? 0.6 : 0.28)})`,
          borderLeft: `3px solid rgba(${rgb},${isLight ? 1.0 : 0.7})`,
        }}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={handleCardClick}
      >
        <span className={styles.emoji}>{block.emoji || getCatEmoji(block.category)}</span>
        {editing ? (
          <input
            className={styles.titleEdit}
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
            }}
          />
        ) : (
          <div
            className={`${styles.title} ${block.completed ? styles.done : ''}`}
            onDoubleClick={beginEdit}
            onPointerDown={onTitlePointerDown}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
          >{block.title}</div>
        )}

        {variant === 'bento' && block.notes && (
          <div className={styles.notes}>{block.notes}</div>
        )}

        <div className={styles.meta}>
          {time && <span className={styles.time}>{time}</span>}
          <span className={styles.badge}>{block.category}</span>
        </div>

        {/* Desktop hover actions */}
        <div className={styles.actions} onClick={e => e.stopPropagation()}>
          <button className={styles.actionBtn} onClick={() => setDetailsOpen(true)} title={t('blockCard.details')}>ℹ</button>
          <button className={styles.actionBtn} onClick={() => onToggle(block.id)}
            title={block.completed ? t('blockCard.undo') : t('blockCard.complete')}>
            {block.completed ? '↩' : '✓'}
          </button>
          <button className={styles.actionBtn} onClick={() => onEdit(block)} title={t('blockCard.edit')}>✎</button>
          <button className={styles.actionBtn} onClick={() => onDelete(block.id)} title={t('common.delete')}>✕</button>
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
              <span className={styles.sheetIcon}>ℹ</span> {t('blockCard.viewDetails')}
            </button>
            <button className={styles.sheetItem} onClick={() => { onEdit(block); setSheetOpen(false); }}>
              <span className={styles.sheetIcon}>✎</span> {t('blockCard.editBlock')}
            </button>
            <button className={styles.sheetItem} onClick={() => { onToggle(block.id); setSheetOpen(false); }}>
              <span className={styles.sheetIcon}>{block.completed ? '↩' : '✓'}</span>
              {block.completed ? t('blockCard.markIncomplete') : t('blockCard.markComplete')}
            </button>
            <button className={`${styles.sheetItem} ${styles.sheetDanger}`}
              onClick={() => { onDelete(block.id); setSheetOpen(false); }}>
              <span className={styles.sheetIcon}>✕</span> {t('blockCard.deleteBlock')}
            </button>
            <button className={styles.sheetCancel} onClick={() => setSheetOpen(false)}>
              {t('common.cancel')}
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
