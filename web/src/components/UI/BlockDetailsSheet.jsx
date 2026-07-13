import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import styles from './BlockDetailsSheet.module.css';

export default function BlockDetailsSheet({ block, onClose, onEdit, onToggle, onDelete }) {
  const { t } = useTranslation();
  if (!block) return null;

  const color = getColor(block.category);
  const rgb = hexRgb(color);
  const time = block.start_time
    ? `${block.start_time}${block.end_time ? ' – ' + block.end_time : ''}`
    : null;
  const dateLabel = block.end_date && block.end_date !== block.date
    ? `${block.date} – ${block.end_date}`
    : block.date;

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
          {block.completed && <div className={styles.doneChip}>✓ {t('blockDetails.done')}</div>}
        </div>

        <div className={styles.rows}>
          {block.date && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t('blockDetails.date')}</span>
              <span className={styles.rowValue}>{dateLabel}</span>
            </div>
          )}
          {time && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t('blockDetails.time')}</span>
              <span className={styles.rowValue}>{time}</span>
            </div>
          )}
          {block.notes && (
            <div className={styles.row} style={{ alignItems: 'flex-start' }}>
              <span className={styles.rowLabel}>{t('blockDetails.notes')}</span>
              <span className={styles.rowValue} style={{ whiteSpace: 'pre-wrap' }}>{block.notes}</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => { onEdit(block); onClose(); }}>✎ {t('blockCard.edit')}</button>
          <button className={styles.actionBtn} onClick={() => { onToggle(block.id); onClose(); }}>
            {block.completed ? `↩ ${t('blockCard.undo')}` : `✓ ${t('blockDetails.done')}`}
          </button>
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => { onDelete(block.id); onClose(); }}>✕ {t('common.delete')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
