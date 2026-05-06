import { useState, useEffect, useCallback } from 'react';
import { useBlocks } from '../hooks/useDB';
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

  const [view, setView] = useState('week');
  const [dayLayout, setDayLayout] = useState('timeline');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [currentDay, setCurrentDay] = useState(() => todayZurich());
  const [activeCategory, setActiveCategory] = useState(null);
  const [modal, setModal] = useState({ open: false, block: null, defaultDate: null });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey] = useState(() => {
    let k = localStorage.getItem('kugiApiKey');
    if (!k) { k = 'kugi_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b=>b.toString(16).padStart(2,'0')).join(''); localStorage.setItem('kugiApiKey', k); }
    return k;
  });

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
            <div className={styles.sectionTitle}>Your API Key</div>
            <div className={styles.apiBox}>
              <code className={styles.apiKey}>
                {apiKeyVisible ? apiKey : '••••••••••••••••'}
              </code>
              <button className={styles.apiToggle} onClick={() => setApiKeyVisible(v => !v)}>
                {apiKeyVisible ? '🙈' : '👁'}
              </button>
            </div>
            <p className={styles.apiHint}>Use this key to connect your AI agent via the Kugi API.</p>
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
    </div>
  );
}
