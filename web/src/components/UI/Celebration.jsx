import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './Celebration.module.css';

const COLORS = ['#5d8a6a', '#8fc49f', '#78ae8a', '#3d5c47', '#dde8e0'];
const PIECES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 0.35,
  dur: 1.6 + Math.random() * 0.9,
  color: COLORS[i % COLORS.length],
  rot: Math.random() * 360,
}));

export default function Celebration() {
  const { t } = useTranslation();
  return createPortal(
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.confetti}>
        {PIECES.map(p => (
          <span
            key={p.id}
            className={styles.piece}
            style={{
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        ))}
      </div>
      <div className={styles.message}>{t('celebration.allDone')}</div>
    </div>,
    document.body
  );
}
