import { useState } from 'react';
import styles from './DeleteRecurringModal.module.css';

export default function DeleteRecurringModal({ open, onConfirm, onClose }) {
  const [mode, setMode] = useState('this');
  const [futureDays, setFutureDays] = useState(7);

  if (!open) return null;

  function handleDelete() {
    onConfirm({ mode, futureDays: mode === 'future' ? futureDays : undefined });
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.title}>Delete recurring block</div>
        <p className={styles.subtitle}>Which blocks do you want to delete?</p>

        <div className={styles.options}>
          <label className={styles.option}>
            <input type="radio" name="deleteMode" value="this"
              checked={mode === 'this'} onChange={() => setMode('this')} />
            <span className={styles.optionText}>Only this block</span>
          </label>

          <label className={styles.option}>
            <input type="radio" name="deleteMode" value="future"
              checked={mode === 'future'} onChange={() => setMode('future')} />
            <span className={styles.optionText}>
              This and future blocks within:
              {mode === 'future' && (
                <select className={styles.select} value={futureDays}
                  onChange={e => setFutureDays(Number(e.target.value))}>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                </select>
              )}
            </span>
          </label>

          <label className={styles.option}>
            <input type="radio" name="deleteMode" value="all"
              checked={mode === 'all'} onChange={() => setMode('all')} />
            <span className={styles.optionText}>This and all future blocks in this series</span>
          </label>
        </div>

        <div className={styles.footer}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}
