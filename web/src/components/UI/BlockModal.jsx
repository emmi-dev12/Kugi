import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../../utils/categories';
import { toDateStr } from '../../utils/dates';
import styles from './BlockModal.module.css';

const MAX_REMINDERS = 6;

export default function BlockModal({ open, block, defaultDate, onSave, onClose, categories }) {
  const { t } = useTranslation();
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
  // notifyMode: 'global' | 'custom' | 'off'
  const [notifyMode, setNotifyMode] = useState('global');
  // per-block reminders (custom mode): [] = off, [{offsetMinutes, message},...] = custom
  const [blockReminders, setBlockReminders] = useState([{ atTime: '08:00', message: '' }]);
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
      if (block.blockReminders !== undefined) {
        if (block.blockReminders.length === 0) { setNotifyMode('off'); setBlockReminders([]); }
        else { setNotifyMode('custom'); setBlockReminders(block.blockReminders.map(r => ({ atTime: r.atTime ?? '08:00', message: r.message ?? '' }))); }
      } else if (block.notify_before === null) {
        setNotifyMode('off'); setBlockReminders([]);
      } else {
        setNotifyMode('global'); setBlockReminders([{ atTime: '08:00', message: '' }]);
      }
      setRecurrence(block.recurrence ?? '');
    } else {
      setForm({
        title: '', emoji: '💼', category: 'Work',
        date: defaultDate || toDateStr(new Date()),
        end_date: '',
        start_time: '', end_time: '', notes: '', completed: false, notify_before: undefined,
      });
      setNotifyMode('global');
      setBlockReminders([{ atTime: '08:00', message: '' }]);
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
    // blockReminders: [] = off, [{offsetMinutes,message},...] = custom, undefined = global
    const blockRemindersOut = notifyMode === 'off' ? []
      : notifyMode === 'custom' ? blockReminders.filter(r => r.atTime).map(r => ({
          atTime: r.atTime,
          // omit message if empty string so it doesn't override global template needlessly
          ...(r.message?.trim() ? { message: r.message.trim() } : {}),
        }))
      : undefined;
    // keep notify_before for push notification compat
    const notify_before = notifyMode === 'off' ? null : undefined;
    onSave({ ...form, notify_before, blockReminders: blockRemindersOut, recurrence: recurrence || undefined });
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
        <div className={styles.title}>{block ? t('blockModal.editTitle') : t('blockModal.newTitle')}</div>

        <div className={styles.group}>
          <label className="form-label">{t('blockModal.titleLabel')}</label>
          <input ref={titleRef} className="form-input" placeholder={t('blockModal.titlePlaceholder')}
            value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.emoji')}</label>
            <div className={styles.emojiWrap}>
              <button className={styles.emojiBtn} onClick={() => setEmojiOpen(v => !v)}>
                <span className={styles.emojiBtnIcon}>{form.emoji}</span>
                <span className={styles.emojiBtnLabel}>{t('blockModal.change')}</span>
              </button>
              {emojiOpen && (
                <div className={styles.emojiPopover}>
                  <div className={styles.emojiPopoverTitle}>{t('blockModal.emojiTypeOrPaste')}</div>
                  <input
                    ref={emojiInputRef}
                    className={styles.emojiInput}
                    value={emojiDraft}
                    onChange={handleEmojiInput}
                    placeholder="😀"
                    maxLength={8}
                  />
                  <div className={styles.emojiHint}>
                    {t('blockModal.emojiHintMac')} <kbd>⌃⌘Space</kbd> · {t('blockModal.emojiHintWin')} <kbd>Win+.</kbd>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.group}>
            <label className="form-label">{t('blockModal.category')}</label>
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
            <label className="form-label">{t('blockModal.startDate')}</label>
            <input className="form-input" type="date" value={form.date}
              onChange={e => setForm(f => ({...f, date: e.target.value}))} />
          </div>
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.endDate')}</label>
            <input className="form-input" type="date" value={form.end_date}
              min={form.date}
              onChange={e => setForm(f => ({...f, end_date: e.target.value}))} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.start')}</label>
            <input className="form-input" type="time" value={form.start_time}
              onChange={e => setForm(f => ({...f, start_time: e.target.value}))} />
          </div>
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.end')}</label>
            <input className="form-input" type="time" value={form.end_time}
              onChange={e => setForm(f => ({...f, end_time: e.target.value}))} />
          </div>
        </div>

        <div className={styles.group}>
          <label className="form-label">{t('blockModal.notes')}</label>
          <textarea className="form-textarea" placeholder={t('blockModal.notesPlaceholder')}
            value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.repeat')}</label>
            <select className="form-select" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
              <option value=''>{t('blockModal.repeatNone')}</option>
              <option value='hourly'>{t('blockModal.repeatHourly')}</option>
              <option value='daily'>{t('blockModal.repeatDaily')}</option>
              <option value='monthly'>{t('blockModal.repeatMonthly')}</option>
              <option value='yearly'>{t('blockModal.repeatYearly')}</option>
            </select>
          </div>
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.remindMe')}</label>
            <select className={styles.notifySelect} value={notifyMode}
              onChange={e => {
                const v = e.target.value;
                setNotifyMode(v);
                if (v === 'custom' && blockReminders.length === 0) setBlockReminders([{ atTime: '08:00', message: '' }]);
              }}>
              <option value='global'>{t('blockModal.remindDefault')}</option>
              <option value='custom'>{t('blockModal.remindCustom')}</option>
              <option value='off'>{t('blockModal.remindOff')}</option>
            </select>
          </div>
        </div>

        {notifyMode === 'custom' && (
          <div className={styles.group}>
            <label className="form-label">
              {t('blockModal.reminderTimes')} <span style={{fontWeight:400,opacity:.55}}>{t('blockModal.reminderTimesMax', { count: MAX_REMINDERS })}</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blockReminders.map((r, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input className="form-input" type="time" style={{ flex: 1 }} value={r.atTime ?? ''}
                      onChange={e => {
                        const next = [...blockReminders];
                        next[i] = { ...next[i], atTime: e.target.value };
                        setBlockReminders(next);
                      }} />
                    <button type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
                      onClick={() => setBlockReminders(blockReminders.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </div>
                  <input
                    className="form-input"
                    style={{ fontSize: 12 }}
                    placeholder={t('blockModal.reminderMessagePlaceholder', { index: i + 1 })}
                    value={r.message ?? ''}
                    onChange={e => {
                      const next = [...blockReminders];
                      next[i] = { ...next[i], message: e.target.value };
                      setBlockReminders(next);
                    }}
                  />
                </div>
              ))}
              {blockReminders.length < MAX_REMINDERS && (
                <button type="button" className="btn-secondary"
                  style={{ alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setBlockReminders([...blockReminders, { atTime: '08:00', message: '' }])}>
                  {t('blockModal.addReminder')}
                </button>
              )}
            </div>
          </div>
        )}

        {notifyMode !== 'off' && (
          <div className={styles.group}>
            <label className="form-label">{t('blockModal.notifyMessageLabel')} <span style={{fontWeight:400,opacity:.55}}>{t('blockModal.optional')}</span></label>
            <input
              className="form-input"
              placeholder={t('blockModal.notifyMessagePlaceholder')}
              value={form.notify_message}
              onChange={e => setForm(f => ({ ...f, notify_message: e.target.value }))}
            />
          </div>
        )}

        <div className={styles.footer}>
          <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={handleSave}>
            {block ? t('blockModal.saveChanges') : t('blockModal.createBlock')}
          </button>
        </div>
      </div>
    </div>
  );
}
