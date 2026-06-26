import { useState, useEffect, useRef } from 'react';
import { useBlocks, useApiKey } from '../hooks/useDB';
import DeleteRecurringModal from '../components/UI/DeleteRecurringModal';
import SettingsModal from '../components/UI/SettingsModal';
import { useNotifications } from '../hooks/useNotifications';
import { useCategories } from '../hooks/useCategories';
import WeekView from '../components/Calendar/WeekView';
import DayView from '../components/Calendar/DayView';
import CompletedView from '../components/Calendar/CompletedView';
import CalendarView from '../components/Calendar/CalendarView';
import BlockModal from '../components/UI/BlockModal';
import KugiMark from '../components/UI/KugiMark';
import CategoryManager from '../components/UI/CategoryManager';
import SearchModal from '../components/UI/SearchModal';
import CommandPalette from '../components/UI/CommandPalette';
import QuickAdd from '../components/UI/QuickAdd';
import PlanMyDay from '../components/UI/PlanMyDay';
import Celebration from '../components/UI/Celebration';
import WelcomeCard from '../components/UI/WelcomeCard';
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
  const { blocks, createBlock, updateBlock, deleteBlock, toggleComplete, bulkDelete, bulkComplete, createRecurring, deleteRecurring } = useBlocks();
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
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('kugiSidebarWidth') || '220', 10));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kugiSidebarCollapsed') === 'true');
  const isResizing = useRef(false);
  const quickAddRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => localStorage.getItem('kugiWelcomeDismissed') === 'true');
  const [toast, setToast] = useState(null);
  const [deleteRecurringTarget, setDeleteRecurringTarget] = useState(null);
  const historyRef = useRef([]);
  const futureRef = useRef([]);

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('kugiSidebarCollapsed', next);
  }

  function startResize(e) {
    if (sidebarCollapsed) return;
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
    if (block?.recurrenceGroupId) {
      setDeleteRecurringTarget(block);
      return;
    }
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
    const block = blocks.find(b => b.id === id);
    toggleComplete(id);
    recordAction(
      () => toggleComplete(id),
      () => toggleComplete(id)
    );
    // Celebrate finishing the last open block of a day.
    if (block && !block.completed) {
      const covers = (b) => b.end_date ? (b.date <= block.date && block.date <= b.end_date) : b.date === block.date;
      const dayBlocks = blocks.filter(covers);
      const remaining = dayBlocks.filter(b => b.id !== id && !b.completed);
      if (dayBlocks.length >= 1 && remaining.length === 0) triggerCelebration();
    }
  }

  function triggerCelebration() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { showToast('All done for the day ✓'); return; }
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 2400);
  }

  function dismissWelcome() {
    setWelcomeDismissed(true);
    localStorage.setItem('kugiWelcomeDismissed', 'true');
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

  // Compact label for the mobile header (the full date wraps on a phone).
  const navLabelShort = view === 'day'
    ? currentDay.toLocaleDateString('en-US', { timeZone: getTZ(), weekday: 'short', day: 'numeric', month: 'short' })
    : view === 'week'
    ? `${formatShort(weekDays[0])} – ${formatShort(weekDays[6])}`
    : navLabel;

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
      if (e.key === 'Escape' && planOpen) { setPlanOpen(false); return; }
      if (modal.open || settingsOpen || searchOpen || planOpen) return;
      if (e.key === 'n') openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()));
      if (e.key === 'w') setView('week');
      if (e.key === 'd') setView('day');
      if (e.key === 'f') setView('completed');
      if (e.key === 't') goToday();
      if (e.key === 'p') { e.preventDefault(); setPlanOpen(true); }
      if (e.key === 'l' && view === 'day') setDayLayout('timeline');
      if (e.key === 'b' && view === 'day') setDayLayout('bento');
      if (e.key === 'q') { e.preventDefault(); quickAddRef.current?.focus(); }
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal.open, settingsOpen, searchOpen, planOpen, view, currentDay]);

  function openModal(block, defaultDate) {
    setModal({ open: true, block, defaultDate });
  }

  function handleQuickAdd(blockData) {
    handleCreate(blockData);
    showToast('Block added');
  }

  function handleSave(form) {
    if (modal.block) {
      handleUpdate(modal.block.id, form);
    } else if (form.recurrence) {
      createRecurring(form);
    } else {
      handleCreate(form);
    }
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
    </>
  );

  return (
    <div className={styles.app}>
      {/* HEADER */}
      <header className={styles.header}>
        <KugiMark size="md" className={styles.logo} />
        <div className={styles.headerCenter}>
          <button className="btn-icon" onClick={() => nav(-1)} aria-label="Previous">‹</button>
          <span className={styles.navLabel}>
            <span className={styles.navLabelFull}>{navLabel}</span>
            <span className={styles.navLabelShort}>{navLabelShort}</span>
          </span>
          <button className="btn-icon" onClick={() => nav(1)} aria-label="Next">›</button>
          <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={goToday}>Today</button>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'week' ? styles.active : ''}`} onClick={() => setView('week')}>Week</button>
            <button className={`${styles.viewBtn} ${view === 'day' ? styles.active : ''}`} onClick={() => setView('day')}>Day</button>
            <button className={`${styles.viewBtn} ${view === 'completed' ? styles.active : ''}`} onClick={() => setView('completed')}>Finished</button>
          </div>
          <button className={styles.planBtn} onClick={() => setPlanOpen(true)} title="Plan my day (p)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9L13 13M13 3l-1.1 1.1M4.1 11.9L3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className={styles.planBtnText}>Plan</span>
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
        <aside
          className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}
          style={sidebarCollapsed ? {} : { width: sidebarWidth }}
        >
          <button className={styles.collapseBtn} onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>
          {!sidebarCollapsed && <SidebarContent />}
        </aside>
        <div className={styles.resizeHandle} onMouseDown={startResize} style={sidebarCollapsed ? { pointerEvents: 'none', opacity: 0 } : {}} />

        {/* MAIN */}
        <main className={styles.main}>
          <QuickAdd
            ref={quickAddRef}
            onAdd={handleQuickAdd}
            defaultDate={view === 'day' ? currentDay : todayZurich()}
          />
          {blocks.length === 0 && !welcomeDismissed && (
            <WelcomeCard
              onNewBlock={() => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}
              onQuickAdd={() => quickAddRef.current?.focus()}
              onSearch={() => setSearchOpen(true)}
              onDismiss={dismissWelcome}
            />
          )}
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
              onUpdateBlock={handleUpdate}
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
        <CommandPalette
          blocks={blocks}
          categories={categories}
          onClose={() => setSearchOpen(false)}
          onGoToBlock={block => {
            setCurrentDay(new Date(block.date + 'T12:00:00'));
            setView('day');
          }}
          onNavigateToday={goToday}
          onSwitchView={setView}
          onNewBlock={title => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}
          onCompleteBlocks={id => toggleComplete(id)}
          onDeleteBlocks={id => handleDelete(id)}
          onBulkDelete={ids => bulkDelete(ids)}
          onBulkComplete={ids => bulkComplete(ids)}
          onFilterCategory={cat => setActiveCategory(cat)}
        />
      )}

      {planOpen && (
        <PlanMyDay
          day={currentDay}
          blocks={blocks}
          onClose={() => setPlanOpen(false)}
          onEditBlock={block => openModal(block)}
          onUpdateBlock={handleUpdate}
        />
      )}

      {celebrate && <Celebration />}

      {toast && <div className={styles.toast}>{toast}</div>}

      <DeleteRecurringModal
        open={deleteRecurringTarget !== null}
        onClose={() => setDeleteRecurringTarget(null)}
        onConfirm={({ mode, futureDays }) => {
          deleteRecurring({ id: deleteRecurringTarget._id, mode, futureDays });
          setDeleteRecurringTarget(null);
        }}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
