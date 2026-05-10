import { useState, useEffect, useRef } from 'react';
import { useBlocks, useApiKey } from '../hooks/useDB';
import SettingsModal from '../components/UI/SettingsModal';
import { useNotifications } from '../hooks/useNotifications';
import { useCategories } from '../hooks/useCategories';
import WeekView from '../components/Calendar/WeekView';
import DayView from '../components/Calendar/DayView';
import CompletedView from '../components/Calendar/CompletedView';
import CalendarView from '../components/Calendar/CalendarView';
import BlockModal from '../components/UI/BlockModal';
import KugiLogo from '../components/UI/KugiLogo';
import CategoryManager from '../components/UI/CategoryManager';
import SearchModal from '../components/UI/SearchModal';
import {
  getWeekStart, addDays, toDateStr, formatShort, formatFull,
  formatMonthYear, isToday, todayZurich
} from '../utils/dates';
import { getTZ, setTZ, allTimezones } from '../utils/timezone';
import styles from './AppPage.module.css';

function changeConvexUrl() {
  if (confirm('Change your Convex URL? You will be taken to the setup screen.')) {
    localStorage.removeItem('kugiConvexUrl');
    window.location.href = '/setup';
  }
}

export default function AppPage() {
  const { blocks, createBlock, updateBlock, deleteBlock, toggleComplete } = useBlocks();
  const { categories, customCategories, addCategory, removeCategory, editCategory } = useCategories();
  const { apiKey, rotateApiKey } = useApiKey();
  const [timezone, setTimezone] = useState(() => getTZ());
  const { permission, pushActive, reminders, addReminder, updateReminder, removeReminder, requestPermission, disablePush } = useNotifications(blocks, timezone);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [view, setView] = useState(isMobile ? 'day' : 'week');
  const [dayLayout, setDayLayout] = useState('bento');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [currentDay, setCurrentDay] = useState(() => todayZurich());
  const [activeCategory, setActiveCategory] = useState(null);
  const [modal, setModal] = useState({ open: false, block: null, defaultDate: null });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('kugiTheme') || 'dark');
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('kugiSidebarWidth') || '220', 10));
  const isResizing = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const historyRef = useRef([]);
  const futureRef = useRef([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kugiTheme', theme);
  }, [theme]);

  function startResize(e) {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e) => {
      if (!isResizing.current) return;
      const w = Math.min(360, Math.max(160, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = (e) => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const w = Math.min(360, Math.max(160, e.clientX));
      localStorage.setItem('kugiSidebarWidth', w);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function recordAction(undoFn, redoFn) {
    historyRef.current.push({ undo: undoFn, redo: redoFn });
    futureRef.current = [];
    if (historyRef.current.length > 50) historyRef.current.shift();
  }

  async function handleCreate(data) {
    const id = await createBlock(data);
    recordAction(
      () => deleteBlock(id),
      () => createBlock(data)
    );
    return id;
  }

  function handleUpdate(id, fields) {
    const prev = blocks.find(b => b.id === id);
    updateBlock(id, fields);
    if (prev) {
      const prevFields = Object.fromEntries(
        Object.keys(fields).map(k => [k, prev[k] ?? ''])
      );
      recordAction(
        () => updateBlock(id, prevFields),
        () => updateBlock(id, fields)
      );
    }
  }

  function handleDelete(id) {
    const block = blocks.find(b => b.id === id);
    deleteBlock(id);
    if (block) {
      const { id: _id, _id: __id, _creationTime, ...data } = block;
      recordAction(
        () => createBlock(data),
        () => {}
      );
    }
  }

  function handleToggle(id) {
    toggleComplete(id);
    recordAction(
      () => toggleComplete(id),
      () => toggleComplete(id)
    );
  }

  function undo() {
    const action = historyRef.current.pop();
    if (!action) return;
    action.undo();
    futureRef.current.push(action);
    showToast('Undone');
  }

  function redo() {
    const action = futureRef.current.pop();
    if (!action) return;
    action.redo();
    historyRef.current.push(action);
    showToast('Redone');
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navLabel = view === 'week'
    ? `${formatShort(weekDays[0])} – ${formatShort(weekDays[6])} ${weekDays[0].getFullYear()}`
    : view === 'day' ? formatFull(currentDay)
    : view === 'completed' ? 'Completed'
    : 'Calendar';

  const weekDateStrsSet = new Set(weekDays.map(toDateStr));
  const scopeBlocks = view === 'week'
    ? blocks.filter(b => [...weekDateStrsSet].some(ds => (!b.end_date ? b.date === ds : b.date <= ds && ds <= b.end_date)))
    : view === 'day' ? blocks.filter(b => { const ds = toDateStr(currentDay); return !b.end_date ? b.date === ds : b.date <= ds && ds <= b.end_date; })
    : [];
  const done = scopeBlocks.filter(b => b.completed).length;
  const total = scopeBlocks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if ((meta && e.key === 'k') || (!modal.open && !settingsOpen && !searchOpen && e.key === '/')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (modal.open || settingsOpen || searchOpen) return;
      if (e.key === 'n') openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()));
      if (e.key === 'w') setView('week');
      if (e.key === 'd') setView('day');
      if (e.key === 'f') setView('completed');
      if (e.key === 't' && view === 'day') setDayLayout('timeline');
      if (e.key === 'b' && view === 'day') setDayLayout('bento');
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal.open, settingsOpen, searchOpen, view, currentDay]);

  function openModal(block, defaultDate) {
    setModal({ open: true, block, defaultDate });
  }

  function handleSave(form) {
    if (modal.block) handleUpdate(modal.block.id, form);
    else handleCreate(form);
  }

  function nav(dir) {
    if (view === 'week') setWeekStart(d => addDays(d, dir * 7));
    else if (view === 'day') setCurrentDay(d => addDays(d, dir));
  }

  function goToday() {
    setWeekStart(getWeekStart(new Date()));
    setCurrentDay(todayZurich());
    setView('day');
  }

  // Mini calendar
  const calRef = view === 'week' ? weekStart : currentDay;
  const monthStart = new Date(calRef.getFullYear(), calRef.getMonth(), 1);
  const monthEnd = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 0);
  let startDow = monthStart.getDay(); startDow = startDow === 0 ? 6 : startDow - 1;
  const miniDays = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(monthStart); d.setDate(d.getDate() - i); miniDays.push({ date: d, other: true });
  }
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    miniDays.push({ date: new Date(calRef.getFullYear(), calRef.getMonth(), d), other: false });
  }
  const weekDateStrs = weekDays.map(toDateStr);

  const SidebarContent = ({ showMiniCal = true }) => (
    <>
      {/* Theme toggle — mobile sheet only */}
      {!showMiniCal && (
        <div className={styles.notifSection}>
          <div className={styles.sectionTitle}>Appearance</div>
          <button className={styles.changeUrlBtn} onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Switch to light mode' : '🌙 Switch to dark mode'}
          </button>
        </div>
      )}

      {/* Mini calendar — desktop sidebar only */}
      {showMiniCal && <div>
        <div className={styles.miniCalHeader}>{formatMonthYear(calRef)}</div>
        <div className={styles.miniCalGrid}>
          {['M','T','W','T','F','S','S'].map((l, i) => (
            <div key={i} className={styles.miniCalLabel}>{l}</div>
          ))}
          {miniDays.map(({ date, other }, i) => {
            const ds = toDateStr(date);
            const today = isToday(date);
            const inWeek = view === 'week' && weekDateStrs.includes(ds);
            const selected = view === 'day' && ds === toDateStr(currentDay);
            return (
              <div key={i}
                className={`${styles.miniCalDay} ${other ? styles.otherMonth : ''} ${today ? styles.todayDot : ''} ${inWeek ? styles.inWeek : ''} ${selected ? styles.selectedDay : ''}`}
                onClick={() => { setCurrentDay(date); setWeekStart(getWeekStart(date)); setSettingsOpen(false); }}>
                {date.getDate()}
              </div>
            );
          })}
        </div>
      </div>}

      {/* Categories */}
      <div>
        <div className={styles.sectionTitle}>Categories</div>
        <div className={styles.catList}>
          <div className={`${styles.catItem} ${!activeCategory ? styles.catActive : ''}`}
            onClick={() => { setActiveCategory(null); setSettingsOpen(false); }}>
            <span className={styles.catDot} style={{ background: '#555' }} />
            All
            <span className={styles.catCount}>{blocks.length}</span>
          </div>
          {Object.entries(categories).map(([cat, info]) => {
            const count = blocks.filter(b => b.category === cat).length;
            if (!count && activeCategory !== cat) return null;
            return (
              <div key={cat} className={`${styles.catItem} ${activeCategory === cat ? styles.catActive : ''}`}
                onClick={() => { setActiveCategory(activeCategory === cat ? null : cat); setSettingsOpen(false); }}>
                <span className={styles.catDot} style={{ background: info.color }} />
                {cat}
                <span className={styles.catCount}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage categories */}
      <div>
        <div className={styles.sectionTitle}>Manage Categories</div>
        <CategoryManager
          categories={categories}
          customCategories={customCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onEdit={editCategory}
        />
      </div>

      {/* Notifications */}
      <div className={styles.notifSection}>
        <div className={styles.sectionTitle}>Notifications</div>
        {permission === 'unsupported' ? (
          <p className={styles.apiHint}>Not supported in this browser.</p>
        ) : permission === 'denied' ? (
          <p className={styles.apiHint}>Notifications blocked — enable in browser settings.</p>
        ) : permission !== 'granted' ? (
          <button className={styles.notifEnableBtn} onClick={requestPermission}>
            Enable notifications
          </button>
        ) : (
          <>
          <div className={pushActive ? styles.pushActive : styles.pushInactive}>
            {pushActive
              ? <><span>🔔</span> Push server active</>
              : <><span>🔕</span> Push server inactive — <button className={styles.pushLink} onClick={requestPermission}>re-enable</button></>}
            {pushActive && <button className={styles.pushDisableBtn} onClick={disablePush} title="Disable push">✕</button>}
          </div>
          <div className={styles.reminderList}>
            {reminders.map(r => {
              const isDayScale = r.offsetMinutes >= 1440;
              return (
                <div key={r.id} className={styles.reminderCard}>
                  <div className={styles.reminderRow}>
                    <select
                      className={styles.reminderSelect}
                      value={r.offsetMinutes}
                      onChange={e => updateReminder(r.id, { offsetMinutes: Number(e.target.value) })}
                    >
                      {[
                        [5,   '5 min before'],
                        [10,  '10 min before'],
                        [15,  '15 min before'],
                        [20,  '20 min before'],
                        [30,  '30 min before'],
                        [45,  '45 min before'],
                        [60,  '1 hour before'],
                        [120, '2 hours before'],
                        [180, '3 hours before'],
                        [360, '6 hours before'],
                        [720, '12 hours before'],
                        [1440,'1 day before'],
                        [2880,'2 days before'],
                        [4320,'3 days before'],
                      ].map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                    <button className={styles.reminderDelete} onClick={() => removeReminder(r.id)} title="Remove">✕</button>
                  </div>
                  {isDayScale && (
                    <div className={styles.reminderRow}>
                      <span className={styles.reminderAtLabel}>at</span>
                      <input
                        type="time"
                        className={styles.reminderTime}
                        value={r.atTime || '09:00'}
                        onChange={e => updateReminder(r.id, { atTime: e.target.value })}
                      />
                    </div>
                  )}
                  <input
                    className={styles.reminderMsg}
                    placeholder="Custom message (optional)"
                    value={r.message || ''}
                    onChange={e => updateReminder(r.id, { message: e.target.value })}
                  />
                </div>
              );
            })}
            {reminders.length < 3 && (
              <button className={styles.addReminderBtn} onClick={addReminder}>
                + Add reminder
              </button>
            )}
          </div>
          </>
        )}
      </div>

      {/* Timezone */}
      <div className={styles.notifSection}>
        <div className={styles.sectionTitle}>Timezone</div>
        <select
          className={styles.notifSelect}
          value={timezone}
          onChange={e => {
            setTZ(e.target.value);
            setTimezone(e.target.value);
          }}
        >
          {allTimezones().map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Settings */}
      <div className={styles.apiSection}>
        <div className={styles.sectionTitle}>API Key</div>
        <div className={styles.apiBox}>
          <code className={styles.apiKey}>
            {apiKey === undefined ? 'loading…'
              : apiKey === null ? 'generating…'
              : apiKeyVisible ? apiKey : '••••••••••••••••'}
          </code>
          {apiKey && <>
            <button className={styles.apiToggle} title={apiKeyVisible ? 'Hide' : 'Show'} onClick={() => setApiKeyVisible(v => !v)}>
              {apiKeyVisible ? '🙈' : '👁'}
            </button>
            <button className={styles.apiToggle} title="Copy key" onClick={() => navigator.clipboard.writeText(apiKey).then(() => {
              const btn = document.activeElement;
              const prev = btn.textContent;
              btn.textContent = '✓';
              setTimeout(() => { btn.textContent = prev; }, 1200);
            })}>
              ⎘
            </button>
            <button className={styles.apiToggle} title="Rotate key" onClick={() => { if (confirm('Rotate API key? Your AI agent will need the new key.')) rotateApiKey(); }}>
              ↺
            </button>
          </>}
        </div>
        <p className={styles.apiHint}>Use with <code>Authorization: Bearer &lt;key&gt;</code> on your Convex HTTP endpoint.</p>

        <button className={styles.changeUrlBtn} onClick={changeConvexUrl}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 6a5 5 0 0 1 9.5-2M11 6a5 5 0 0 1-9.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M9 1.5l1.5 2.5-2.5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Change Convex URL
        </button>
      </div>
    </>
  );

  return (
    <div className={styles.app}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><KugiLogo size={20} /></div>
          <span className={styles.logoText}>kugi</span>
        </div>
        <div className={styles.headerCenter}>
          <button className="btn-icon" onClick={() => nav(-1)}>‹</button>
          <span className={styles.navLabel}>{navLabel}</span>
          <button className="btn-icon" onClick={() => nav(1)}>›</button>
          <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={goToday}>Today</button>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'week' ? styles.active : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`${styles.viewBtn} ${view === 'day' ? styles.active : ''}`} onClick={() => setView('day')}>Day</button>
            <button className={`${styles.viewBtn} ${view === 'completed' ? styles.active : ''}`} onClick={() => setView('completed')}>Finished</button>
          </div>
          <button className="btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{ fontSize: 15 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className={styles.searchBtn} onClick={() => setSearchOpen(true)} title="Search blocks (/)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className={styles.searchBtnText}>Search</span>
            <kbd className={styles.searchKbd}>⌘K</kbd>
          </button>
          <button className="btn-primary" onClick={() => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            New Block
          </button>
          <button className={styles.settingsBtn} onClick={() => setSettingsOpen(v => !v)} title="Settings">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.37 13.37l1.41 1.41M3.22 14.78l1.41-1.41M13.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {/* Settings gear — mobile only */}
        <button className={styles.mobileSettingsBtn} onClick={() => setSettingsOpen(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.37 13.37l1.41 1.41M3.22 14.78l1.41-1.41M13.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        {/* SIDEBAR — desktop */}
        <aside className={styles.sidebar} style={{ width: sidebarWidth }}>
          <SidebarContent />
        </aside>
        <div className={styles.resizeHandle} onMouseDown={startResize} />

        {/* MAIN */}
        <main className={styles.main}>
          {view === 'week' && (
            <WeekView
              days={weekDays}
              blocks={blocks}
              activeCategory={activeCategory}
              onEditBlock={block => openModal(block)}
              onDeleteBlock={handleDelete}
              onToggleBlock={handleToggle}
              onUpdateBlock={handleUpdate}
              onAddBlock={dateStr => openModal(null, dateStr)}
              onDayClick={day => { setCurrentDay(day); setView('day'); }}
            />
          )}
          {view === 'day' && (
            <DayView
              day={currentDay}
              blocks={blocks}
              activeCategory={activeCategory}
              layout={dayLayout}
              onSetLayout={setDayLayout}
              onEditBlock={block => openModal(block)}
              onDeleteBlock={handleDelete}
              onToggleBlock={handleToggle}
              onAddBlock={dateStr => openModal(null, dateStr)}
            />
          )}
          {view === 'completed' && (
            <CompletedView
              blocks={blocks}
              onToggle={handleToggle}
              onEdit={block => openModal(block)}
            />
          )}
          {view === 'calendar' && (
            <CalendarView
              blocks={blocks}
              onDaySelect={day => { setCurrentDay(day); setView('day'); }}
            />
          )}
        </main>
      </div>

      {/* STATS */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}><span className={styles.statDot} style={{ background: '#10b981' }} />{done} done</div>
        <div className={styles.statItem}><span className={styles.statDot} style={{ background: '#4f7cff' }} />{total - done} left</div>
        <div className={styles.statItem}><span className={styles.statDot} style={{ background: '#8b5cf6' }} />{total} total</div>
        {total > 0 && (
          <div className={styles.statItem} style={{ marginLeft: 'auto', gap: 8 }}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.pctLabel}>{pct}%</span>
          </div>
        )}
      </div>

      <BlockModal open={modal.open} block={modal.block} defaultDate={modal.defaultDate}
        onSave={handleSave} onClose={() => setModal({ open: false, block: null, defaultDate: null })}
        categories={categories} />

      {searchOpen && (
        <SearchModal
          blocks={blocks}
          onClose={() => setSearchOpen(false)}
          onGoToBlock={block => {
            setCurrentDay(new Date(block.date + 'T12:00:00'));
            setView('day');
          }}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        permission={permission}
        pushActive={pushActive}
        reminders={reminders}
        onRequestPermission={requestPermission}
        onDisablePush={disablePush}
        onAddReminder={addReminder}
        onUpdateReminder={updateReminder}
        onRemoveReminder={removeReminder}
        timezone={timezone}
        onTimezoneChange={tz => { setTimezone(tz); setTZ(tz); }}
        apiKey={apiKey}
        apiKeyVisible={apiKeyVisible}
        onToggleApiKeyVisible={() => setApiKeyVisible(v => !v)}
        onCopyApiKey={() => { navigator.clipboard.writeText(apiKey); }}
        onRotateApiKey={() => { if (confirm('Rotate API key? Your AI agent will need the new key.')) rotateApiKey(); }}
        onChangeConvexUrl={changeConvexUrl}
        categories={categories}
        customCategories={customCategories}
        CategoryManager={CategoryManager}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
        onEditCategory={editCategory}
      />

      {/* BOTTOM NAV — mobile only */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.bottomNavItem} ${view === 'week' ? styles.navActive : ''}`} onClick={() => { setView('week'); setSettingsOpen(false); }}>
          <span className={styles.bottomNavIcon}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="5" width="3.5" height="12" rx="1.5" fill="currentColor"/>
              <rect x="7.5" y="5" width="3.5" height="12" rx="1.5" fill="currentColor" opacity="0.6"/>
              <rect x="13" y="5" width="3.5" height="12" rx="1.5" fill="currentColor" opacity="0.35"/>
              <rect x="18.5" y="5" width="1.5" height="12" rx="0.75" fill="currentColor" opacity="0.2"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Week</span>
        </button>

        <button className={`${styles.bottomNavItem} ${view === 'day' && !settingsOpen ? styles.navActive : ''}`} onClick={() => { setView('day'); setSettingsOpen(false); }}>
          <span className={styles.bottomNavIcon}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="3" width="16" height="6" rx="2" fill="currentColor"/>
              <rect x="3" y="11" width="16" height="3.5" rx="1.5" fill="currentColor" opacity="0.5"/>
              <rect x="3" y="16.5" width="10" height="2.5" rx="1.25" fill="currentColor" opacity="0.3"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Day</span>
        </button>

        <button className={styles.bottomNavAdd}
          onClick={() => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}>
          <div className={styles.bottomNavAddInner}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 3v14M3 10h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
        </button>

        <button className={`${styles.bottomNavItem} ${view === 'completed' && !settingsOpen ? styles.navActive : ''}`}
          onClick={() => { setView('completed'); setSettingsOpen(false); }}>
          <span className={styles.bottomNavIcon}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
              <path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Finished</span>
        </button>

        <button className={`${styles.bottomNavItem} ${view === 'calendar' && !settingsOpen ? styles.navActive : ''}`}
          onClick={() => { setView('calendar'); setSettingsOpen(false); }}>
          <span className={styles.bottomNavIcon}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.7"/>
              <path d="M7 3v4M15 3v4M3 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Cal</span>
        </button>
      </nav>
    </div>
  );
}
