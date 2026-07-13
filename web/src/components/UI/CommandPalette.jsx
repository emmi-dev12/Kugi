import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './CommandPalette.module.css';

function getCommands(t) {
  return [
    { id: 'today',    label: t('commandPalette.commands.today.label'),    hint: 't',  desc: t('commandPalette.commands.today.desc') },
    { id: 'week',     label: t('commandPalette.commands.week.label'),     hint: 'w',  desc: t('commandPalette.commands.week.desc') },
    { id: 'day',      label: t('commandPalette.commands.day.label'),      hint: 'd',  desc: t('commandPalette.commands.day.desc') },
    { id: 'new',      label: t('commandPalette.commands.new.label'),      hint: 'n',  desc: t('commandPalette.commands.new.desc') },
    { id: 'complete', label: t('commandPalette.commands.complete.label'), hint: null, desc: t('commandPalette.commands.complete.desc') },
    { id: 'delete',   label: t('commandPalette.commands.delete.label'),   hint: null, desc: t('commandPalette.commands.delete.desc') },
    { id: 'category', label: t('commandPalette.commands.category.label'), hint: null, desc: t('commandPalette.commands.category.desc') },
  ];
}

// Keyboard cheatsheet surfaced in the empty-state starter panel.
function getShortcuts(t) {
  return [
    { keys: 'N', label: t('commandPalette.shortcuts.newBlock') },
    { keys: 'Q', label: t('commandPalette.shortcuts.quickAdd') },
    { keys: 'P', label: t('commandPalette.shortcuts.planMyDay') },
    { keys: 'W / D / F', label: t('commandPalette.shortcuts.weekDayFinished') },
    { keys: 'T', label: t('commandPalette.shortcuts.today') },
    { keys: '⌘Z', label: t('commandPalette.shortcuts.undo') },
  ];
}

// Lightweight fuzzy: every char of the query appears in order in the text.
function subseq(text, q) {
  if (!q) return true;
  let i = 0;
  for (let c = 0; c < text.length && i < q.length; c++) {
    if (text[c] === q[i]) i++;
  }
  return i === q.length;
}

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
  onBulkDelete,
  onBulkComplete,
  onFilterCategory,
}) {
  const { t } = useTranslation();
  const COMMANDS = getCommands(t);
  const SHORTCUTS = getShortcuts(t);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(null); // 'delete' | 'complete'
  const inputRef = useRef(null);

  const isCmd = query.startsWith('>');
  const cmdText = isCmd ? query.slice(1).trimStart() : '';
  const [cmdVerb, ...cmdArgParts] = cmdText.split(/\s+/);
  const cmdArg = cmdArgParts.join(' ');

  const searchResults = !isCmd && query.trim().length > 0
    ? blocks.filter(b => {
        const q = query.toLowerCase();
        const qTight = q.replace(/\s+/g, '');
        return (
          b.title?.toLowerCase().includes(q) ||
          b.notes?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q) ||
          b.emoji?.includes(q) ||
          subseq((b.title || '').toLowerCase(), qTight)
        );
      }).slice(0, 50)
    : [];

  const showStarter = !isCmd && query.trim().length === 0;

  const cmdResults = isCmd
    ? COMMANDS.filter(c =>
        !cmdVerb || c.id.startsWith(cmdVerb.toLowerCase()) || c.label.toLowerCase().includes(cmdVerb.toLowerCase())
      )
    : [];

  const totalItems = isCmd ? cmdResults.length : searchResults.length;
  const allChecked = searchResults.length > 0 && searchResults.every(b => checkedIds.has(b._id || b.id));
  const someChecked = checkedIds.size > 0;

  useEffect(() => { setSelected(0); setCheckedIds(new Set()); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  function toggleCheck(id, e) {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll(e) {
    e.stopPropagation();
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(searchResults.map(b => b._id || b.id)));
    }
  }

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

  function starterClick(cmd) {
    // Nav commands run immediately; arg-taking commands prefill command mode.
    if (['today', 'week', 'day'].includes(cmd.id)) {
      executeCommand(cmd);
    } else {
      setQuery(`> ${cmd.id} `);
      inputRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalItems - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isCmd && cmdResults[selected]) executeCommand(cmdResults[selected]);
      else if (!isCmd && searchResults[selected] && !someChecked) { onGoToBlock?.(searchResults[selected]); onClose(); }
    }
    if (e.key === 'Escape') {
      if (bulkConfirm) { setBulkConfirm(null); return; }
      if (confirm) { setConfirm(null); return; }
      onClose();
    }
    if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !isCmd) {
      e.preventDefault();
      setCheckedIds(new Set(searchResults.map(b => b._id || b.id)));
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

  function doBulkAction(type) {
    const ids = [...checkedIds];
    if (type === 'delete') {
      onBulkDelete?.(ids);
    } else if (type === 'complete') {
      onBulkComplete?.(ids);
    }
    setBulkConfirm(null);
    setCheckedIds(new Set());
    onClose();
  }

  const checkedCount = checkedIds.size;

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
            placeholder={isCmd ? t('commandPalette.typeCommand') : t('commandPalette.searchBlocks')}
          />
          <kbd className={styles.esc}>esc</kbd>
        </div>

        {/* Bulk selection toolbar */}
        {!isCmd && searchResults.length > 0 && (
          <div className={styles.selectionBar}>
            <label className={styles.selectAllLabel}>
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className={styles.checkbox}
              />
              {allChecked ? t('commandPalette.deselectAll') : t('commandPalette.selectAll', { count: searchResults.length })}
            </label>
            {someChecked && (
              <div className={styles.bulkActions}>
                <span className={styles.checkedCount}>{t('commandPalette.selectedCount', { count: checkedCount })}</span>
                <button
                  className={styles.bulkBtn}
                  onClick={() => setBulkConfirm('complete')}
                >
                  {t('commandPalette.complete')}
                </button>
                <button
                  className={`${styles.bulkBtn} ${styles.bulkBtnDelete}`}
                  onClick={() => setBulkConfirm('delete')}
                >
                  {t('common.delete')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bulk confirm overlay */}
        {bulkConfirm && (
          <div className={styles.confirmBox}>
            <div className={styles.confirmMsg}>
              {bulkConfirm === 'delete'
                ? t('commandPalette.confirmDeleteBulk', { count: checkedCount })
                : t('commandPalette.confirmCompleteBulk', { count: checkedCount })}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setBulkConfirm(null)}>{t('common.cancel')}</button>
              <button
                className={bulkConfirm === 'delete' ? styles.confirmOk : styles.confirmComplete}
                onClick={() => doBulkAction(bulkConfirm)}
              >
                {bulkConfirm === 'delete' ? t('common.delete') : t('commandPalette.complete')}
              </button>
            </div>
          </div>
        )}

        {/* Command confirm overlay */}
        {confirm && !bulkConfirm && (
          <div className={styles.confirmBox}>
            <div className={styles.confirmMsg}>
              {confirm.type === 'complete'
                ? t('commandPalette.confirmCompleteMatches', { count: confirm.matches.length })
                : t('commandPalette.confirmDeleteMatches', { count: confirm.matches.length })}
              {confirm.matches.length > 0 && (
                <ul className={styles.confirmList}>
                  {confirm.matches.slice(0, 5).map(b => <li key={b._id || b.id}>{b.emoji} {b.title}</li>)}
                  {confirm.matches.length > 5 && <li>{t('commandPalette.andMore', { count: confirm.matches.length - 5 })}</li>}
                </ul>
              )}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
              <button className={styles.confirmOk} onClick={confirmAction}>
                {confirm.type === 'complete' ? t('commandPalette.complete') : t('common.delete')}
              </button>
            </div>
          </div>
        )}

        {/* Starter — shown on empty query for discoverability */}
        {!confirm && !bulkConfirm && showStarter && (
          <div className={styles.starter}>
            <div className={styles.starterSection}>
              <div className={styles.starterLabel}>{t('commandPalette.quickCommands')}</div>
              {COMMANDS.map(cmd => (
                <div key={cmd.id} className={styles.starterCmd} onClick={() => starterClick(cmd)}>
                  <span className={styles.cmdLabel}>{cmd.label}</span>
                  {cmd.hint && <kbd className={styles.cmdHint}>{cmd.hint}</kbd>}
                </div>
              ))}
            </div>
            <div className={styles.starterSection}>
              <div className={styles.starterLabel}>{t('commandPalette.keyboardShortcuts')}</div>
              <div className={styles.shortcutGrid}>
                {SHORTCUTS.map(s => (
                  <div key={s.keys} className={styles.shortcutRow}>
                    <kbd className={styles.shortcutKbd}>{s.keys}</kbd>
                    <span className={styles.shortcutLabel}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Command mode */}
        {!confirm && !bulkConfirm && isCmd && cmdResults.length > 0 && (
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
        {!confirm && !bulkConfirm && !isCmd && searchResults.length > 0 && (
          <div className={styles.results}>
            {searchResults.map((b, i) => {
              const bid = b._id || b.id;
              const checked = checkedIds.has(bid);
              return (
                <div
                  key={bid}
                  className={`${styles.result} ${i === selected ? styles.resultSelected : ''} ${checked ? styles.resultChecked : ''}`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={(e) => {
                    if (someChecked) {
                      toggleCheck(bid, e);
                    } else {
                      onGoToBlock?.(b);
                      onClose();
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    className={styles.rowCheckbox}
                    checked={checked}
                    onChange={() => {}}
                    onClick={(e) => toggleCheck(bid, e)}
                  />
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
              );
            })}
          </div>
        )}

        {!confirm && !bulkConfirm && query.trim().length > 0 && !isCmd && searchResults.length === 0 && (
          <div className={styles.empty}>{t('commandPalette.noBlocksFound')}</div>
        )}
        {!confirm && !bulkConfirm && isCmd && cmdResults.length === 0 && (
          <div className={styles.empty}>{t('commandPalette.noMatchingCommand')}</div>
        )}

        <div className={styles.footer}>
          {isCmd ? (
            <>
              <span>{t('commandPalette.footer.navigate')}</span>
              <span>{t('commandPalette.footer.run')}</span>
              <span>{t('commandPalette.footer.close')}</span>
            </>
          ) : someChecked ? (
            <>
              <span>{t('commandPalette.footer.deselect')}</span>
              <span>{t('commandPalette.footer.selectAll')}</span>
            </>
          ) : (
            <>
              <span>{t('commandPalette.footer.navigate')}</span>
              <span>{t('commandPalette.footer.open')}</span>
              <span>{t('commandPalette.footer.selectAll')}</span>
              <span>{t('commandPalette.footer.close')}</span>
            </>
          )}
          <span className={styles.footerHint}>{t('commandPalette.footer.hint')}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
