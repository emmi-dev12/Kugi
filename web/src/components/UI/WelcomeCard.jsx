import styles from './WelcomeCard.module.css';

export default function WelcomeCard({ onNewBlock, onQuickAdd, onSearch, onDismiss }) {
  return (
    <div className={styles.card}>
      <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">✕</button>
      <div className={styles.kicker}>welcome to kugi</div>
      <p className={styles.lead}>Your calendar, the calm way. Three ways to start:</p>
      <div className={styles.actions}>
        <button className={styles.action} onClick={onQuickAdd}>
          <span className={styles.actionIcon}>⚡</span>
          <span className={styles.actionTitle}>Quick add</span>
          <span className={styles.actionDesc}>Type “Lunch 1–2pm tomorrow”</span>
          <kbd className={styles.kbd}>Q</kbd>
        </button>
        <button className={styles.action} onClick={onNewBlock}>
          <span className={styles.actionIcon}>＋</span>
          <span className={styles.actionTitle}>New block</span>
          <span className={styles.actionDesc}>Fill in the details yourself</span>
          <kbd className={styles.kbd}>N</kbd>
        </button>
        <button className={styles.action} onClick={onSearch}>
          <span className={styles.actionIcon}>⌘</span>
          <span className={styles.actionTitle}>Command palette</span>
          <span className={styles.actionDesc}>Search & run anything</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </button>
      </div>
    </div>
  );
}
