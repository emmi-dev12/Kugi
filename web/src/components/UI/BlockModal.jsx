import { useState, useEffect, useRef } from 'react';
import { CATEGORIES, EMOJIS } from '../../utils/categories';
import { toDateStr } from '../../utils/dates';
import styles from './BlockModal.module.css';

export default function BlockModal({ open, block, defaultDate, onSave, onClose }) {
  const titleRef = useRef(null);
  const [form, setForm] = useState({
    title: '', emoji: '💼', category: 'Work',
    date: toDateStr(new Date()), start_time: '', end_time: '', notes: '',
  });

  useEffect(() => {
    if (!open) return;
    if (block) {
      setForm({
        title: block.title || '',
        emoji: block.emoji || '💼',
        category: block.category || 'Work',
        date: block.date || toDateStr(new Date()),
        start_time: block.start_time || '',
        end_time: block.end_time || '',
        notes: block.notes || '',
      });
    } else {
      setForm({
        title: '', emoji: '💼', category: 'Work',
        date: defaultDate || toDateStr(new Date()),
        start_time: '', end_time: '', notes: '',
      });
    }
    setTimeout(() => titleRef.current?.focus(), 80);
  }, [open, block, defaultDate]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  function handleSave() {
    if (!form.title.trim()) { titleRef.current?.focus(); return; }
    onSave(form);
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.title}>{block ? 'Edit Block' : 'New Block'}</div>

        <div className={styles.group}>
          <label className="form-label">Title</label>
          <input ref={titleRef} className="form-input" placeholder="What are you doing?"
            value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>

        <div className={styles.group}>
          <label className="form-label">Emoji</label>
          <div className={styles.emojiGrid}>
            {EMOJIS.map(em => (
              <button key={em} className={`${styles.emojiOpt} ${form.emoji === em ? styles.selected : ''}`}
                onClick={() => setForm(f => ({...f, emoji: em}))}>{em}</button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <label className="form-label">Category</label>
          <select className="form-select" value={form.category}
            onChange={e => setForm(f => ({...f, category: e.target.value}))}>
            {Object.entries(CATEGORIES).map(([cat, info]) => (
              <option key={cat} value={cat}>{info.emoji} {cat}</option>
            ))}
          </select>
        </div>

        <div className={styles.group}>
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date}
            onChange={e => setForm(f => ({...f, date: e.target.value}))} />
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">Start</label>
            <input className="form-input" type="time" value={form.start_time}
              onChange={e => setForm(f => ({...f, start_time: e.target.value}))} />
          </div>
          <div className={styles.group}>
            <label className="form-label">End</label>
            <input className="form-input" type="time" value={form.end_time}
              onChange={e => setForm(f => ({...f, end_time: e.target.value}))} />
          </div>
        </div>

        <div className={styles.group}>
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" placeholder="Any extra context…"
            value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
        </div>

        <div className={styles.footer}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Block</button>
        </div>
      </div>
    </div>
  );
}
