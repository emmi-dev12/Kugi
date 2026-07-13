import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../../utils/categories';
import styles from './CategoryManager.module.css';

const DEFAULT_COLORS = ['#4f7cff','#8b5cf6','#10b981','#f59e0b','#f43f5e','#ec4899','#6b7280','#94a3b8','#0ea5e9','#84cc16'];

function EmojiInput({ emoji, onEmoji }) {
  const [draft, setDraft] = useState('');
  return (
    <input
      className={styles.emojiInput}
      value={draft}
      onChange={e => {
        const segs = [...new Intl.Segmenter().segment(e.target.value)];
        if (segs.length) { onEmoji(segs[0].segment); setDraft(segs[0].segment); }
        else setDraft(e.target.value);
      }}
      maxLength={8}
      placeholder={emoji}
    />
  );
}

export default function CategoryManager({ categories, customCategories, onAdd, onRemove, onEdit }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState(DEFAULT_COLORS[0]);
  const [addEmoji, setAddEmoji] = useState('🏷');

  const [editingCat, setEditingCat] = useState(null); // cat name being edited
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  function startEdit(cat, info) {
    setEditingCat(cat);
    setEditName(cat);
    setEditColor(info.color);
    setEditEmoji(info.emoji);
    setAdding(false);
  }

  function handleEditSave() {
    if (!editName.trim()) return;
    onEdit(editingCat, editName, editColor, editEmoji);
    setEditingCat(null);
  }

  function handleAdd() {
    if (!addName.trim()) return;
    onAdd(addName, addColor, addEmoji);
    setAddName(''); setAddColor(DEFAULT_COLORS[0]); setAddEmoji('🏷');
    setAdding(false);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.list}>
        {Object.entries(categories).map(([cat, info]) => {
          const isDefault = !!CATEGORIES[cat];

          if (editingCat === cat) return (
            <div key={cat} className={styles.form}>
              <div className={styles.formRow}>
                <EmojiInput emoji={editEmoji} onEmoji={setEditEmoji} />
                <input
                  className={styles.nameInput}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditingCat(null); }}
                  autoFocus
                />
              </div>
              <div className={styles.colorRow}>
                {DEFAULT_COLORS.map(c => (
                  <button key={c} className={`${styles.colorSwatch} ${editColor === c ? styles.colorActive : ''}`}
                    style={{ background: c }} onClick={() => setEditColor(c)} />
                ))}
              </div>
              <div className={styles.formBtns}>
                <button className={styles.cancelBtn} onClick={() => setEditingCat(null)}>{t('common.cancel')}</button>
                <button className={styles.addConfirmBtn} onClick={handleEditSave}>{t('common.save')}</button>
              </div>
            </div>
          );

          return (
            <div key={cat} className={styles.item}>
              <span className={styles.dot} style={{ background: info.color }} />
              <span className={styles.itemEmoji}>{info.emoji}</span>
              <span className={styles.itemName}>{cat}</span>
              {!isDefault && (
                <>
                  <button className={styles.editBtn} onClick={() => startEdit(cat, info)} title={t('blockCard.edit')}>✎</button>
                  <button className={styles.removeBtn} onClick={() => onRemove(cat)} title={t('categoryManager.remove')}>✕</button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className={styles.form}>
          <div className={styles.formRow}>
            <EmojiInput emoji={addEmoji} onEmoji={setAddEmoji} />
            <input
              className={styles.nameInput}
              placeholder={t('categoryManager.namePlaceholder')}
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              autoFocus
            />
          </div>
          <div className={styles.colorRow}>
            {DEFAULT_COLORS.map(c => (
              <button key={c} className={`${styles.colorSwatch} ${addColor === c ? styles.colorActive : ''}`}
                style={{ background: c }} onClick={() => setAddColor(c)} />
            ))}
          </div>
          <div className={styles.formBtns}>
            <button className={styles.cancelBtn} onClick={() => setAdding(false)}>{t('common.cancel')}</button>
            <button className={styles.addConfirmBtn} onClick={handleAdd}>{t('categoryManager.add')}</button>
          </div>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => { setAdding(true); setEditingCat(null); }}>+ {t('categoryManager.addCategory')}</button>
      )}
    </div>
  );
}
