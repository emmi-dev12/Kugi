import { useTranslation } from 'react-i18next';
import styles from './WelcomeCard.module.css';

export default function WelcomeCard({ onNewBlock, onQuickAdd, onSearch }) {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <div className={styles.kicker}>{t('welcomeCard.kicker')}</div>
      <p className={styles.lead}>{t('welcomeCard.lead')}</p>
      <div className={styles.actions}>
        <button className={styles.action} onClick={onQuickAdd}>
          <span className={styles.actionIcon}>⚡</span>
          <span className={styles.actionTitle}>{t('welcomeCard.quickAddTitle')}</span>
          <span className={styles.actionDesc}>{t('welcomeCard.quickAddDesc')}</span>
          <kbd className={styles.kbd}>Q</kbd>
        </button>
        <button className={styles.action} onClick={onNewBlock}>
          <span className={styles.actionIcon}>＋</span>
          <span className={styles.actionTitle}>{t('welcomeCard.newBlockTitle')}</span>
          <span className={styles.actionDesc}>{t('welcomeCard.newBlockDesc')}</span>
          <kbd className={styles.kbd}>N</kbd>
        </button>
        <button className={styles.action} onClick={onSearch}>
          <span className={styles.actionIcon}>⌘</span>
          <span className={styles.actionTitle}>{t('welcomeCard.paletteTitle')}</span>
          <span className={styles.actionDesc}>{t('welcomeCard.paletteDesc')}</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </button>
      </div>
    </div>
  );
}
