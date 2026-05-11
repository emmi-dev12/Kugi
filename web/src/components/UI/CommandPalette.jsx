import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './CommandPalette.module.css';

const COMMANDS = [
  { id: 'today',    label: 'Go to Today',        hint: 't',   desc: 'Navigate to today in current view' },
  { id: 'week',     label: 'Switch to Week view', hint: 'w',   desc: 'Show week view' },
  { id: 'day',      label: 'Switch to Day view',  hint: 'd',   desc: 'Show day view' },
  { id: 'new',      label: 'New Block',           hint: 'n',   desc: 'Open new block modal (> new [title])' },
  { id: 'complete', label: 'Complete blocks…',    hint: null,  desc: 'Mark matching blocks complete (> complete [search])' },
  { id: 'delete',   label: 'Delete blocks…',      hint: null,  desc: 'Delete matching blocks (> delete [search])' },
  { id: 'category', label: 'Filter by category…', hint: null,  desc: 'Filter view to category (> category [name])' },
];

export default function CommandPalette({
  blocks = [],
  categories = {},
  onClose,
  onGoToBlock,
  onNavigateToday,
  onSwitchView,
  onNewBlock,
  onCompleteBlocks,
  onDeleteBlocks,
  onFilterCategory,
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const inputRef = useRef(null);

  const isCmd = query.startsWith('>');
  const cmdText = isCmd ? query.slice(1).trimStart() : '';
  const [cmdVerb, ...cmdArgParts] = cmdText.split(/\s+/);
  const cmdArg = cmdArgParts.join(' ');

  // Search mode results
  const searchResults = !isCmd && query.trim().length > 0
    ? blocks.filter(b => {
        const q = query.toLowerCase();
        return (
          b.title?.toLowerCase().includes(q) ||
          b.notes?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q) ||
          b.emoji?.includes(q)
        );
      }).slice(0, 20)
    : [];

  // Command mode results
  const cmdResults = isCmd
    ? COMMANDS.filter(c =>
        !cmdVerb || c.id.startsWith(cmdVerb.toLowerCase()) || c.label.toLowerCase().includes(cmdVerb.toLowerCase())
      )
    : [];

  const totalItems = isCmd ? cmdResults.length : searchResults.length;

  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  function executeCommand(cmd) {
    const arg = cmdArg.trim();
    if (cmd.id === 'today') { onNavigateToday?.(); onClose(); }
    else if (cmd.id === 'week') { onSwitchView?.('week'); onClose(); }
    else if (cmd.id === 'day') { onSwitchView?.('day'); onClose(); }
    else if (cmd.id === 'new') { onNewBlock?.(arg || ''); onClose(); }
    else if (cmd.id === 'complete') {
      const matches = blocks.filter(b => b.title?.toLowerCase().includes(arg.toLowerCase()));
      setConfirm({ type: 'complete', matches, arg });
    }
    else if (cmd.id === 'delete') {
      const matches = blocks.filter(b => b.title?.toLowerCase().includes(arg.toLowerCase()));
      setConfirm({ type: 'delete', matches, arg });
    }
    else if (cmd.id === 'category') {
      onFilterCategory?.(arg || null);
      onClose();
    }
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalItems - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isCmd && cmdResults[selected]) executeCommand(cmdResults[selected]);
      else if (!isCmd && searchResults[selected]) { onGoToBlock?.(searchResults[selected]); onClose(); }
    }
    if (e.key === 'Escape') {
      if (confirm) setConfirm(null);
      else onClose();
    }
  }

  function confirmAction() {
    if (!confirm) return;
    if (confirm.type === 'complete') {
      confirm.matches.forEach(b => onCompleteBlocks?.(b.id ?? b._id));
    } else if (confirm.type === 'delete') {
      confirm.matches.forEach(b => onDeleteBlocks?.(b.id ?? b._id));
    }
    setConfirm(null);
    onClose();
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} onKeyDown={handleKey}>
        <div className={styles.inputRow}>
          {isCmd
            ? <span className={styles.cmdIcon}>{'>'}</span>
            : (
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )
          }
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isCmd ? 'Type a command…' : 'Search blocks…'}
          />
          <kbd className={styles.esc}>esc</kbd>
        </div>

        {/* Confirm overlay */}
        {confirm && (
          <div className={styles.confirmBox}>
            <div className={styles.confirmMsg}>
              {confirm.type === 'complete'
                ? `Mark ${confirm.matches.length} block(s) as complete?`
                : `Delete ${confirm.matches.length} block(s)?`}
              {confirm.matches.length > 0 && (
                <ul className={styles.confirmList}>
                  {confirm.matches.slice(0, 5).map(b => <li key={b._id || b.id}>{b.emoji} {b.title}</li>)}
                  {confirm.matches.length > 5 && <li>…and {confirm.matches.length - 5} more</li>}
                </ul>
              )}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={styles.confirmOk} onClick={confirmAction}>
                {confirm.type === 'complete' ? 'Complete' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Command mode */}
        {!confirm && isCmd && cmdResults.length > 0 && (
          <div className={styles.results}>
            {cmdResults.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`${styles.result} ${i === selected ? styles.resultSelected : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => executeCommand(cmd)}
              >
                <span className={styles.cmdLabel}>{cmd.label}</span>
                <span className={styles.cmdDesc}>{cmd.desc}</span>
                {cmd.hint && <kbd className={styles.cmdHint}>{cmd.hint}</kbd>}
              </div>
            ))}
          </div>
        )}

        {/* Search mode */}
        {!confirm && !isCmd && searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map((b, i) => (
              <div
                key={b._id || b.id}
                className={`${styles.result} ${i === selected ? styles.resultSelected : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => { onGoToBlock?.(b); onClose(); }}
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

        {!confirm && query.trim().length > 0 && !isCmd && searchResults.length === 0 && (
          <div className={styles.empty}>No blocks found</div>
        )}
        {!confirm && isCmd && cmdResults.length === 0 && (
          <div className={styles.empty}>No matching command</div>
        )}

        <div className={styles.footer}>
          {isCmd ? (
            <>
              <span>↑↓ navigate</span>
              <span>↵ run</span>
              <span>esc close</span>
            </>
          ) : (
            <>
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </>
          )}
          <span className={styles.footerHint}>Type to search · {'>'} for commands</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
