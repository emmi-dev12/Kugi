import { useState } from 'react';
import { toDateStr, isToday, formatFull, minsToPx, timeToMins } from '../../utils/dates';
import { getTZ } from '../../utils/timezone';
import { getColor, getCatEmoji, hexRgb } from '../../utils/categories';
import BlockCard from './BlockCard';
import styles from './DayView.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayView({ day, blocks, activeCategory, layout, onSetLayout, onEditBlock, onDeleteBlock, onToggleBlock, onAddBlock }) {
  const dateStr = toDateStr(day);
  const dayBlocks = blocks
    .filter(b => b.date === dateStr && (!activeCategory || b.category === activeCategory))
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const timed = dayBlocks.filter(b => b.start_time);
  const untimed = dayBlocks.filter(b => !b.start_time);

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.date}>
            {day.toLocaleDateString('en-US', { weekday: 'long', timeZone: getTZ() })}
            {isToday(day) && <span className={styles.todayTag}> — Today</span>}
            <br />
            <span className={styles.dateSub}>
              {day.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: getTZ() })}
            </span>
          </div>
          <div className={styles.subtitle}>
            {dayBlocks.length} block{dayBlocks.length !== 1 ? 's' : ''} · {dayBlocks.filter(b => b.completed).length} done
          </div>
        </div>
        <div className={styles.layoutToggle}>
          <button className={`${styles.layoutBtn} ${layout === 'timeline' ? styles.active : ''}`}
            onClick={() => onSetLayout('timeline')}>⏱ Timeline</button>
          <button className={`${styles.layoutBtn} ${layout === 'bento' ? styles.active : ''}`}
            onClick={() => onSetLayout('bento')}>⊞ Bento</button>
        </div>
      </div>

      {layout === 'timeline' ? (
        <TimelineBody timed={timed} untimed={untimed} dateStr={dateStr}
          nowMins={isToday(day) ? nowMins : null}
          onEditBlock={onEditBlock} onDeleteBlock={onDeleteBlock}
          onToggleBlock={onToggleBlock} onAddBlock={onAddBlock} />
      ) : (
        <BentoBody dayBlocks={dayBlocks} dateStr={dateStr}
          onEditBlock={onEditBlock} onDeleteBlock={onDeleteBlock}
          onToggleBlock={onToggleBlock} onAddBlock={onAddBlock} />
      )}
    </div>
  );
}

function TimelineBody({ timed, untimed, dateStr, nowMins, onEditBlock, onDeleteBlock, onToggleBlock, onAddBlock }) {
  return (
    <div className={styles.timelineOuter}>
      <div className={styles.timelineBody}>
        <div className={styles.timeCol}>
          {HOURS.map(h => (
            <div key={h} className={styles.timeLabel}>{h === 0 ? '' : `${String(h).padStart(2,'0')}:00`}</div>
          ))}
        </div>
        <div className={styles.schedCol}>
          {HOURS.map(h => (
            <div key={h} className={styles.timeRow}
              onClick={() => {
                const block = onAddBlock(dateStr);
                // pre-fill time handled by parent
              }} />
          ))}
          {nowMins !== null && (
            <div className={styles.nowLine} style={{ top: minsToPx(nowMins) }} />
          )}
          {timed.map(block => {
            const color = getColor(block.category);
            const rgb = hexRgb(color);
            const startM = timeToMins(block.start_time);
            const endM = block.end_time ? timeToMins(block.end_time) : startM + 60;
            const height = Math.max(minsToPx(endM - startM), 32);
            const dur = endM - startM;
            const showBadge = height > 50;
            const showNotes = height > 76 && block.notes;
            return (
              <div key={block.id}
                className={`${styles.timedBlock} ${block.completed ? styles.completed : ''}`}
                style={{
                  top: minsToPx(startM), height,
                  background: `rgba(${rgb},0.18)`,
                  borderColor: `rgba(${rgb},0.4)`,
                  borderLeft: `3px solid ${color}`,
                }}
                onClick={() => onEditBlock(block)}
              >
                <div className={styles.timedInner}>
                  <span style={{ fontSize: 15 }}>{block.emoji || getCatEmoji(block.category)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`${styles.timedTitle} ${block.completed ? styles.done : ''}`}>{block.title}</div>
                    <div className={styles.timedTime}>{block.start_time} – {block.end_time || '?'} · {dur}m</div>
                    {showNotes && <div className={styles.timedNotes}>{block.notes}</div>}
                    {showBadge && <span className={styles.timedBadge}>{block.category}</span>}
                  </div>
                </div>
                <div className={styles.timedActions} onClick={e => e.stopPropagation()}>
                  <button className={styles.actionBtn} onClick={() => onToggleBlock(block.id)}>{block.completed ? '↩' : '✓'}</button>
                  <button className={styles.actionBtn} onClick={() => onEditBlock(block)}>✎</button>
                  <button className={styles.actionBtn} onClick={() => onDeleteBlock(block.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {untimed.length > 0 && (
        <div className={styles.unscheduled}>
          <div className={styles.unscheduledTitle}>📌 Unscheduled ({untimed.length})</div>
          <div className={styles.unscheduledGrid}>
            {untimed.map(block => {
              const color = getColor(block.category);
              const rgb = hexRgb(color);
              return (
                <div key={block.id} className={styles.unscheduledBlock}
                  style={{ background: `rgba(${rgb},0.14)`, borderColor: `rgba(${rgb},0.3)` }}
                  onClick={() => onEditBlock(block)}>
                  <span>{block.emoji || getCatEmoji(block.category)}</span>
                  <div>
                    <div className={`${styles.timedTitle} ${block.completed ? styles.done : ''}`}>{block.title}</div>
                    <span className={styles.timedBadge}>{block.category}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BentoBody({ dayBlocks, dateStr, onEditBlock, onDeleteBlock, onToggleBlock, onAddBlock }) {
  if (dayBlocks.length === 0) {
    return (
      <div className={styles.empty}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="3" y="3" width="19" height="19" rx="5" fill="rgba(79,124,255,0.25)"/>
          <rect x="26" y="3" width="19" height="19" rx="5" fill="rgba(139,92,246,0.25)"/>
          <rect x="3" y="26" width="19" height="19" rx="5" fill="rgba(16,185,129,0.25)"/>
          <rect x="26" y="26" width="19" height="19" rx="5" fill="rgba(244,63,94,0.25)"/>
        </svg>
        <span>Kein Block heute. Füge einen hinzu!</span>
      </div>
    );
  }
  return (
    <div className={styles.bentoWrap}>
      <div className={styles.bentoGrid}>
        {dayBlocks.map(block => (
          <BlockCard key={block.id} block={block} variant="bento"
            onEdit={() => onEditBlock(block)}
            onDelete={onDeleteBlock} onToggle={onToggleBlock} />
        ))}
        <div className={styles.addCard} onClick={() => onAddBlock(dateStr)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
