import { useState, useEffect, useRef } from 'react';
import { CATEGORIES } from '../../utils/categories';
import { toDateStr } from '../../utils/dates';
import styles from './BlockModal.module.css';

const NOTIFY_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 120];

export default function BlockModal({ open, block, defaultDate, onSave, onClose, categories }) {
  const cats = categories || CATEGORIES;
  const titleRef = useRef(null);
  const emojiInputRef = useRef(null);
  const [form, setForm] = useState({
    title: '', emoji: '💼', category: 'Work',
    date: toDateStr(new Date()), end_date: '', start_time: '', end_time: '', notes: '',
    completed: false, notify_before: undefined, notify_message: '',
  });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiDraft, setEmojiDraft] = useState('');
  // 'global' | 'custom' | 'off'
  const [notifyMode, setNotifyMode] = useState('global');
  const [notifyMins, setNotifyMins] = useState(15);
  const [recurrence, setRecurrence] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmojiOpen(false);
    if (block) {
      setForm({
        title: block.title || '',
        emoji: block.emoji || '💼',
        category: block.category || 'Work',
        date: block.date || toDateStr(new Date()),
        end_date: block.end_date || '',
        start_time: block.start_time || '',
        end_time: block.end_time || '',
        notes: block.notes || '',
        completed: block.completed || false,
        notify_before: block.notify_before,
        notify_message: block.notify_message || '',
      });
      if (block.notify_before === null) { setNotifyMode('off'); setNotifyMins(15); }
      else if (block.notify_before !== undefined) { setNotifyMode('custom'); setNotifyMins(block.notify_before); }
      else { setNotifyMode('global'); setNotifyMins(15); }
      setRecurrence(block.recurrence ?? '');
    } else {
      setForm({
        title: '', emoji: '💼', category: 'Work',
        date: defaultDate || toDateStr(new Date()),
        end_date: '',
        start_time: '', end_time: '', notes: '', completed: false, notify_before: undefined,
      });
      setNotifyMode('global');
      setNotifyMins(15);
      setRecurrence('');
    }
    setTimeout(() => titleRef.current?.focus(), 80);
  }, [open, block, defaultDate]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (emojiOpen) setEmojiOpen(false); else onClose(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, emojiOpen]);

  useEffect(() => {
    if (emojiOpen) {
      setEmojiDraft('');
      setTimeout(() => emojiInputRef.current?.focus(), 30);
    }
  }, [emojiOpen]);

  if (!open) return null;

  function handleSave() {
    if (!form.title.trim()) { titleRef.current?.focus(); return; }
    const notify_before = notifyMode === 'off' ? null
      : notifyMode === 'custom' ? notifyMins
      : undefined;
    onSave({ ...form, notify_before, recurrence: recurrence || undefined });
    onClose();
  }

  function handleEmojiInput(e) {
    const val = e.target.value;
    const segs = [...new Intl.Segmenter().segment(val)];
    if (segs.length > 0) {
      const em = segs[0].segment;
      setForm(f => ({ ...f, emoji: em }));
      setEmojiDraft(em);
      setEmojiOpen(false);
    }
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

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">Emoji</label>
            <div className={styles.emojiWrap}>
              <button className={styles.emojiBtn} onClick={() => setEmojiOpen(v => !v)}>
                <span className={styles.emojiBtnIcon}>{form.emoji}</span>
                <span className={styles.emojiBtnLabel}>Change</span>
              </button>
              {emojiOpen && (
                <div className={styles.emojiPopover}>
                  <div className={styles.emojiPopoverTitle}>Type or paste any emoji</div>
                  <input
                    ref={emojiInputRef}
                    className={styles.emojiInput}
                    value={emojiDraft}
                    onChange={handleEmojiInput}
                    placeholder="😀"
                    maxLength={8}
                  />
                  <div className={styles.emojiHint}>
                    Mac: <kbd>⌃⌘Space</kbd> · Win: <kbd>Win+.</kbd>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.group}>
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category}
              onChange={e => setForm(f => ({...f, category: e.target.value}))}>
              {Object.entries(cats).map(([cat, info]) => (
                <option key={cat} value={cat}>{info.emoji} {cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">Start date</label>
            <input className="form-input" type="date" value={form.date}
              onChange={e => setForm(f => ({...f, date: e.target.value}))} />
          </div>
          <div className={styles.group}>
            <label className="form-label">End date</label>
            <input className="form-input" type="date" value={form.end_date}
              min={form.date}
              onChange={e => setForm(f => ({...f, end_date: e.target.value}))} />
          </div>
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

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">Repeat</label>
            <select className="form-select" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
              <option value=''>None</option>
              <option value='hourly'>Hourly</option>
              <option value='daily'>Daily</option>
              <option value='monthly'>Monthly</option>
              <option value='yearly'>Yearly</option>
            </select>
          </div>
          <div className={styles.group}>
            <label className="form-label">Remind me</label>
            <div className={styles.notifyRow}>
              <select className={styles.notifySelect} value={notifyMode === 'off' ? 'off' : notifyMode === 'global' ? 'global' : String(notifyMins)}
                onChange={e => {
                  const v = e.target.value;
                  if (v === 'off') { setNotifyMode('off'); }
                  else if (v === 'global') { setNotifyMode('global'); }
                  else { setNotifyMode('custom'); setNotifyMins(Number(v)); }
                }}>
                <option value='global'>Default</option>
                {NOTIFY_OPTIONS.map(m => (
                  <option key={m} value={String(m)}>{m < 60 ? `${m} min` : `${m/60} hr`} before</option>
                ))}
                <option value='off'>Off</option>
              </select>
            </div>
          </div>
        </div>

        {notifyMode !== 'off' && (
          <div className={styles.group}>
            <label className="form-label">Notification message <span style={{fontWeight:400,opacity:.55}}>(optional)</span></label>
            <input
              className="form-input"
              placeholder="e.g. Hope it's delicious! 🍜"
              value={form.notify_message}
              onChange={e => setForm(f => ({ ...f, notify_message: e.target.value }))}
            />
          </div>
        )}

        <div className={styles.footer}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            {block ? 'Save Changes' : 'Create Block'}
          </button>
        </div>
      </div>
    </div>
  );
}
