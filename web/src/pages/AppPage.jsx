import { useState, useEffect } from 'react';
import { useBlocks, useApiKey } from '../hooks/useDB';
import { useNotifications } from '../hooks/useNotifications';
import WeekView from '../components/Calendar/WeekView';
import DayView from '../components/Calendar/DayView';
import CompletedView from '../components/Calendar/CompletedView';
import CalendarView from '../components/Calendar/CalendarView';
import BlockModal from '../components/UI/BlockModal';
import KugiLogo from '../components/UI/KugiLogo';
import { CATEGORIES } from '../utils/categories';
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
  const { apiKey, rotateApiKey } = useApiKey();
  const { permission, minutesBefore, setMinutesBefore, requestPermission } = useNotifications(blocks);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [view, setView] = useState(isMobile ? 'day' : 'week');
  const [dayLayout, setDayLayout] = useState('bento');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [currentDay, setCurrentDay] = useState(() => todayZurich());
  const [activeCategory, setActiveCategory] = useState(null);
  const [modal, setModal] = useState({ open: false, block: null, defaultDate: null });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timezone, setTimezone] = useState(() => getTZ());

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const navLabel = view === 'week'
    ? `${formatShort(weekDays[0])} – ${formatShort(weekDays[6])} ${weekDays[0].getFullYear()}`
    : view === 'day' ? formatFull(currentDay)
    : view === 'completed' ? 'Completed'
    : 'Calendar';

  const scopeBlocks = view === 'week'
    ? blocks.filter(b => weekDays.map(toDateStr).includes(b.date))
    : view === 'day' ? blocks.filter(b => b.date === toDateStr(currentDay))
    : [];
  const done = scopeBlocks.filter(b => b.completed).length;
  const total = scopeBlocks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    const handler = (e) => {
      if (modal.open || settingsOpen) return;
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
  }, [modal.open, settingsOpen, view, currentDay]);

  function openModal(block, defaultDate) {
    setModal({ open: true, block, defaultDate });
  }

  function handleSave(form) {
    if (modal.block) updateBlock(modal.block.id, form);
    else createBlock(form);
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
          {Object.entries(CATEGORIES).map(([cat, info]) => {
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

      {/* Notifications */}
      <div className={styles.notifSection}>
        <div className={styles.sectionTitle}>Notifications</div>
        {permission === 'unsupported' ? (
          <p className={styles.apiHint}>Not supported in this browser.</p>
        ) : permission === 'granted' ? (
          <div className={styles.notifRow}>
            <span className={styles.notifLabel}>Notify me</span>
            <select className={styles.notifSelect} value={minutesBefore}
              onChange={e => setMinutesBefore(Number(e.target.value))}>
              {[5, 10, 15, 20, 30, 45, 60].map(m => (
                <option key={m} value={m}>{m} min before</option>
              ))}
            </select>
          </div>
        ) : permission === 'denied' ? (
          <p className={styles.apiHint}>Notifications blocked — enable in browser settings.</p>
        ) : (
          <button className={styles.notifEnableBtn} onClick={requestPermission}>
            Enable notifications
          </button>
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
          <button className="btn-primary" onClick={() => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            New Block
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
        <aside className={styles.sidebar}>
          <SidebarContent />
        </aside>

        {/* MAIN */}
        <main className={styles.main}>
          {view === 'week' && (
            <WeekView
              weekStart={weekStart}
              blocks={blocks}
              activeCategory={activeCategory}
              onEditBlock={block => openModal(block)}
              onDeleteBlock={deleteBlock}
              onToggleBlock={toggleComplete}
              onUpdateBlock={updateBlock}
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
              onDeleteBlock={deleteBlock}
              onToggleBlock={toggleComplete}
              onAddBlock={dateStr => openModal(null, dateStr)}
            />
          )}
          {view === 'completed' && (
            <CompletedView
              blocks={blocks}
              onToggle={toggleComplete}
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
        onSave={handleSave} onClose={() => setModal({ open: false, block: null, defaultDate: null })} />

      {/* SETTINGS SHEET — mobile only */}
      {settingsOpen && (
        <div className={styles.sheetOverlay} onClick={() => setSettingsOpen(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetTitle}>Settings</div>
            <div className={styles.sheetContent}>
              <SidebarContent showMiniCal={false} />
            </div>
          </div>
        </div>
      )}

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
