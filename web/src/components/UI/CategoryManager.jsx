import { useState } from 'react';
import { CATEGORIES, EMOJIS } from '../../utils/categories';
import styles from './CategoryManager.module.css';

const DEFAULT_COLORS = ['#4f7cff','#8b5cf6','#10b981','#f59e0b','#f43f5e','#ec4899','#6b7280','#94a3b8','#0ea5e9','#84cc16'];

export default function CategoryManager({ categories, customCategories, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [emoji, setEmoji] = useState('🏷');
  const [emojiDraft, setEmojiDraft] = useState('');

  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name, color, emoji);
    setName(''); setColor(DEFAULT_COLORS[0]); setEmoji('🏷'); setEmojiDraft('');
    setAdding(false);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        {Object.entries(categories).map(([cat, info]) => {
          const isDefault = !!CATEGORIES[cat];
          return (
            <div key={cat} className={styles.item}>
              <span className={styles.dot} style={{ background: info.color }} />
              <span className={styles.itemEmoji}>{info.emoji}</span>
              <span className={styles.itemName}>{cat}</span>
              {!isDefault && (
                <button className={styles.removeBtn} onClick={() => onRemove(cat)} title="Remove">✕</button>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className={styles.form}>
          <div className={styles.formRow}>
            <input
              className={styles.emojiInput}
              value={emojiDraft}
              onChange={e => {
                const segs = [...new Intl.Segmenter().segment(e.target.value)];
                if (segs.length) { setEmoji(segs[0].segment); setEmojiDraft(segs[0].segment); }
                else setEmojiDraft(e.target.value);
              }}
              maxLength={8}
              placeholder={emoji}
            />
            <input
              className={styles.nameInput}
              placeholder="Category name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              autoFocus
            />
          </div>
          <div className={styles.colorRow}>
            {DEFAULT_COLORS.map(c => (
              <button key={c} className={`${styles.colorSwatch} ${color === c ? styles.colorActive : ''}`}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className={styles.formBtns}>
            <button className={styles.cancelBtn} onClick={() => setAdding(false)}>Cancel</button>
            <button className={styles.addConfirmBtn} onClick={handleAdd}>Add</button>
          </div>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Add category</button>
      )}
    </div>
  );
}
