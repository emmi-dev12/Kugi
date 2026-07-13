import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DeleteRecurringModal.module.css';

export default function DeleteRecurringModal({ open, onConfirm, onClose }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('this');
  const [futureDays, setFutureDays] = useState(7);

  if (!open) return null;

  function handleDelete() {
    onConfirm({ mode, futureDays: mode === 'future' ? futureDays : undefined });
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.title}>{t('deleteRecurring.title')}</div>
        <p className={styles.subtitle}>{t('deleteRecurring.subtitle')}</p>

        <div className={styles.options}>
          <label className={styles.option}>
            <input type="radio" name="deleteMode" value="this"
              checked={mode === 'this'} onChange={() => setMode('this')} />
            <span className={styles.optionText}>{t('deleteRecurring.onlyThis')}</span>
          </label>

          <label className={styles.option}>
            <input type="radio" name="deleteMode" value="future"
              checked={mode === 'future'} onChange={() => setMode('future')} />
            <span className={styles.optionText}>
              {t('deleteRecurring.thisAndFutureWithin')}
              {mode === 'future' && (
                <select className={styles.select} value={futureDays}
                  onChange={e => setFutureDays(Number(e.target.value))}>
                  <option value={7}>{t('deleteRecurring.days', { count: 7 })}</option>
                  <option value={30}>{t('deleteRecurring.days', { count: 30 })}</option>
                  <option value={90}>{t('deleteRecurring.days', { count: 90 })}</option>
                  <option value={180}>{t('deleteRecurring.days', { count: 180 })}</option>
                </select>
              )}
            </span>
          </label>

          <label className={styles.option}>
            <input type="radio" name="deleteMode" value="all"
              checked={mode === 'all'} onChange={() => setMode('all')} />
            <span className={styles.optionText}>{t('deleteRecurring.thisAndAllFuture')}</span>
          </label>
        </div>

        <div className={styles.footer}>
          <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className={styles.deleteBtn} onClick={handleDelete}>{t('common.delete')}</button>
        </div>
      </div>
    </div>
  );
}
