import { createPortal } from 'react-dom';
import { toDateStr, addDays, timeToMins, isToday } from '../../utils/dates';
import { getTZ } from '../../utils/timezone';
import { getColor, getCatEmoji } from '../../utils/categories';
import styles from './PlanMyDay.module.css';

// Reference for "a full day" of focus when drawing the load bar (10h).
const FULL_DAY_MINS = 10 * 60;

function coversDate(b, dateStr) {
  if (!b.end_date) return b.date === dateStr;
  return b.date <= dateStr && dateStr <= b.end_date;
}

export default function PlanMyDay({ day, blocks, onClose, onEditBlock, onUpdateBlock }) {
  const todayStr = toDateStr(day);
  const yesterdayStr = toDateStr(addDays(day, -1));

  const dayBlocks = blocks.filter(b => coversDate(b, todayStr));
  const timed = dayBlocks.filter(b => b.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const unscheduled = dayBlocks.filter(b => !b.start_time && !b.completed);
  const carryOver = blocks.filter(b => coversDate(b, yesterdayStr) && !b.completed);

  const scheduledMins = timed.reduce((sum, b) => {
    const s = timeToMins(b.start_time);
    const e = b.end_time ? timeToMins(b.end_time) : s + 60;
    return sum + Math.max(0, e - s);
  }, 0);
  const loadPct = Math.min(100, Math.round((scheduledMins / FULL_DAY_MINS) * 100));
  const hrs = Math.floor(scheduledMins / 60);
  const mins = scheduledMins % 60;
  const doneCount = dayBlocks.filter(b => b.completed).length;

  function bringCarryOver() {
    carryOver.forEach(b => onUpdateBlock(b.id, { date: todayStr }));
  }

  const dateLabel = day.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: getTZ() });

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <div className={styles.kicker}>plan your day</div>
            <div className={styles.date}>{dateLabel}{isToday(day) ? ' · today' : ''}</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Load */}
        <div className={styles.load}>
          <div className={styles.loadRow}>
            <span className={styles.loadLabel}>
              {hrs > 0 ? `${hrs}h ` : ''}{mins > 0 ? `${mins}m` : (hrs === 0 ? '0m' : '')} scheduled
            </span>
            <span className={styles.loadMeta}>{dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''} · {doneCount} done</span>
          </div>
          <div className={styles.loadTrack}>
            <div className={styles.loadFill} style={{ width: `${loadPct}%` }} />
          </div>
        </div>

        {/* Carry over */}
        {carryOver.length > 0 && (
          <div className={styles.carry}>
            <div className={styles.carryText}>
              <strong>{carryOver.length}</strong> unfinished from yesterday
            </div>
            <button className={styles.carryBtn} onClick={bringCarryOver}>Bring to today</button>
          </div>
        )}

        {/* Unscheduled */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Unscheduled · {unscheduled.length}</div>
          {unscheduled.length === 0 ? (
            <div className={styles.emptyRow}>Everything has a time. Nice.</div>
          ) : (
            unscheduled.map(b => (
              <button key={b.id} className={styles.item} onClick={() => { onEditBlock(b); onClose(); }}>
                <span className={styles.itemDot} style={{ background: getColor(b.category) }} />
                <span className={styles.itemEmoji}>{b.emoji || getCatEmoji(b.category)}</span>
                <span className={styles.itemTitle}>{b.title}</span>
                <span className={styles.itemAction}>Set time →</span>
              </button>
            ))
          )}
        </div>

        {/* Agenda preview */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Timeline · {timed.length}</div>
          {timed.length === 0 ? (
            <div className={styles.emptyRow}>No timed blocks yet.</div>
          ) : (
            timed.map(b => (
              <button key={b.id} className={`${styles.item} ${b.completed ? styles.itemDone : ''}`} onClick={() => { onEditBlock(b); onClose(); }}>
                <span className={styles.itemTime}>{b.start_time}</span>
                <span className={styles.itemEmoji}>{b.emoji || getCatEmoji(b.category)}</span>
                <span className={styles.itemTitle}>{b.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
