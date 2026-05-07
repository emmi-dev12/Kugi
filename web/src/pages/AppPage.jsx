import { useState, useEffect, useCallback } from 'react';
import { useBlocks, useApiKey } from '../hooks/useDB';
import WeekView from '../components/Calendar/WeekView';
import DayView from '../components/Calendar/DayView';
import BlockModal from '../components/UI/BlockModal';
import KugiLogo from '../components/UI/KugiLogo';
import { CATEGORIES } from '../utils/categories';
import {
  getWeekStart, addDays, toDateStr, formatShort, formatFull,
  formatMonthYear, isToday, todayZurich
} from '../utils/dates';
import styles from './AppPage.module.css';

export default function AppPage() {
  const { blocks, createBlock, updateBlock, deleteBlock, toggleComplete } = useBlocks();
  const { apiKey, rotateApiKey } = useApiKey();

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [view, setView] = useState(isMobile ? 'day' : 'week');
  const [dayLayout, setDayLayout] = useState('timeline');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [currentDay, setCurrentDay] = useState(() => todayZurich());
  const [activeCategory, setActiveCategory] = useState(null);
  const [modal, setModal] = useState({ open: false, block: null, defaultDate: null });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Nav label
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const navLabel = view === 'week'
    ? `${formatShort(weekDays[0])} – ${formatShort(weekDays[6])} ${weekDays[0].getFullYear()}`
    : formatFull(currentDay);

  // Stats
  const scopeBlocks = view === 'week'
    ? blocks.filter(b => weekDays.map(toDateStr).includes(b.date))
    : blocks.filter(b => b.date === toDateStr(currentDay));
  const done = scopeBlocks.filter(b => b.completed).length;
  const total = scopeBlocks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (modal.open) return;
      if (e.key === 'n') openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()));
      if (e.key === 'w') setView('week');
      if (e.key === 'd') setView('day');
      if (e.key === 't' && view === 'day') setDayLayout('timeline');
      if (e.key === 'b' && view === 'day') setDayLayout('bento');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal.open, view, currentDay]);

  function openModal(block, defaultDate) {
    setModal({ open: true, block, defaultDate });
  }

  function handleSave(form) {
    if (modal.block) {
      updateBlock(modal.block.id, form);
    } else {
      createBlock(form);
    }
  }

  function nav(dir) {
    if (view === 'week') setWeekStart(d => addDays(d, dir * 7));
    else setCurrentDay(d => addDays(d, dir));
  }

  function goToday() {
    setWeekStart(getWeekStart(new Date()));
    setCurrentDay(todayZurich());
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

  return (
    <div className={styles.app}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><KugiLogo size={20} /></div>
          <span>kugi</span>
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
          </div>
          <button className="btn-primary" onClick={() => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            New Block
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          {/* Mini calendar */}
          <div>
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
                    onClick={() => { setCurrentDay(date); setWeekStart(getWeekStart(date)); }}>
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categories */}
          <div>
            <div className={styles.sectionTitle}>Categories</div>
            <div className={styles.catList}>
              <div className={`${styles.catItem} ${!activeCategory ? styles.catActive : ''}`}
                onClick={() => setActiveCategory(null)}>
                <span className={styles.catDot} style={{ background: '#555' }} />
                All
                <span className={styles.catCount}>{blocks.length}</span>
              </div>
              {Object.entries(CATEGORIES).map(([cat, info]) => {
                const count = blocks.filter(b => b.category === cat).length;
                if (!count && activeCategory !== cat) return null;
                return (
                  <div key={cat} className={`${styles.catItem} ${activeCategory === cat ? styles.catActive : ''}`}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}>
                    <span className={styles.catDot} style={{ background: info.color }} />
                    {cat}
                    <span className={styles.catCount}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* API Key */}
          <div className={styles.apiSection}>
            <div className={styles.sectionTitle}>API Key</div>
            <div className={styles.apiBox}>
              <code className={styles.apiKey}>
                {apiKey === null ? '…' : apiKeyVisible ? apiKey : '••••••••••••••••'}
              </code>
              <button className={styles.apiToggle} title={apiKeyVisible ? 'Hide' : 'Show'} onClick={() => setApiKeyVisible(v => !v)}>
                {apiKeyVisible ? '🙈' : '👁'}
              </button>
              <button className={styles.apiToggle} title="Rotate key" onClick={() => { if (confirm('Rotate API key? Your AI agent will need the new key.')) rotateApiKey(); }}>
                ↺
              </button>
            </div>
            <p className={styles.apiHint}>Use with <code>Authorization: Bearer &lt;key&gt;</code> on your Convex HTTP endpoint.</p>
          </div>
        </aside>

        {/* MAIN */}
        <main className={styles.main}>
          {view === 'week' ? (
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
          ) : (
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
        </main>
      </div>

      {/* STATS */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}><span className={styles.statDot} style={{ background: '#10b981' }} />{done} completed</div>
        <div className={styles.statItem}><span className={styles.statDot} style={{ background: '#4f7cff' }} />{total - done} remaining</div>
        <div className={styles.statItem}><span className={styles.statDot} style={{ background: '#8b5cf6' }} />{total} total{view === 'week' ? ' this week' : ' today'}</div>
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

      {/* BOTTOM NAV — mobile only */}
      <nav className={styles.bottomNav}>
        <button className={`${styles.bottomNavItem} ${view === 'week' ? styles.navActive : ''}`} onClick={() => setView('week')}>
          <span className={styles.bottomNavIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="4" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.4"/>
              <rect x="7" y="4" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.4"/>
              <rect x="12" y="4" width="3" height="12" rx="1.5" fill="currentColor" opacity="0.4"/>
              <rect x="17" y="4" width="1" height="12" rx="0.5" fill="currentColor" opacity="0.4"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Week</span>
        </button>

        <button className={`${styles.bottomNavItem} ${view === 'day' ? styles.navActive : ''}`} onClick={() => setView('day')}>
          <span className={styles.bottomNavIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="5" rx="2" fill="currentColor" opacity="0.5"/>
              <rect x="3" y="10" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.35"/>
              <rect x="3" y="15" width="8" height="2" rx="1" fill="currentColor" opacity="0.25"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Day</span>
        </button>

        <button className={styles.bottomNavAdd}
          onClick={() => openModal(null, view === 'day' ? toDateStr(currentDay) : toDateStr(todayZurich()))}>
          <div className={styles.bottomNavAddInner}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3v12M3 9h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className={styles.bottomNavAddLabel}>New</span>
        </button>

        <button className={`${styles.bottomNavItem}`} onClick={goToday}>
          <span className={styles.bottomNavIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
              <circle cx="10" cy="10" r="2.5" fill="currentColor"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Today</span>
        </button>

        <button className={`${styles.bottomNavItem}`} onClick={() => setModal({ open: false, block: null, defaultDate: null })}>
          <span className={styles.bottomNavIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
              <path d="M4 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </span>
          <span className={styles.bottomNavLabel}>Settings</span>
        </button>
      </nav>
    </div>
  );
}
