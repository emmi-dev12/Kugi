import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './SearchModal.module.css';

export default function SearchModal({ blocks, onClose, onGoToBlock }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  const results = query.trim().length < 1 ? [] : blocks.filter(b => {
    const q = query.toLowerCase();
    return (
      b.title?.toLowerCase().includes(q) ||
      b.notes?.toLowerCase().includes(q) ||
      b.category?.toLowerCase().includes(q) ||
      b.emoji?.includes(q)
    );
  }).slice(0, 20);

  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { onGoToBlock(results[selected]); onClose(); }
    if (e.key === 'Escape') onClose();
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} onKeyDown={handleKey}>
        <div className={styles.inputRow}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search blocks…"
          />
          <kbd className={styles.esc}>esc</kbd>
        </div>
        {results.length > 0 && (
          <div className={styles.results}>
            {results.map((b, i) => (
              <div
                key={b.id}
                className={`${styles.result} ${i === selected ? styles.resultSelected : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => { onGoToBlock(b); onClose(); }}
              >
                <span className={styles.resultEmoji}>{b.emoji || '📦'}</span>
                <div className={styles.resultInfo}>
                  <span className={styles.resultTitle}>{b.title}</span>
                  {b.notes && (
                    <span className={styles.resultNotes}>
                      {b.notes.slice(0, 60)}{b.notes.length > 60 ? '…' : ''}
                    </span>
                  )}
                </div>
                <div className={styles.resultMeta}>
                  <span className={styles.resultCat}>{b.category}</span>
                  <span className={styles.resultDate}>{b.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {query.trim().length > 0 && results.length === 0 && (
          <div className={styles.empty}>No blocks found</div>
        )}
        <div className={styles.footer}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
