import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import KugiMark from '../components/UI/KugiMark';
import styles from './Setup.module.css';

export default function Setup({ onComplete }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) { setError(t('setup.errorEmpty')); return; }
    if (!trimmed.startsWith('https://') || !trimmed.includes('.convex.cloud')) {
      setError(t('setup.errorInvalid'));
      return;
    }
    setLoading(true);
    setError('');
    localStorage.setItem('kugiConvexUrl', trimmed);
    onComplete(trimmed);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <KugiMark size="lg" />
        </div>
        <h1 className={styles.title}>{t('setup.title')}</h1>
        <p className={styles.sub}>
          {t('setup.subPrefix')}
          {' '}{t('setup.subSuffix')} <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className={styles.link}>convex.dev</a> {t('setup.subSuffix2')}
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>{t('setup.label')}</label>
          <input
            className={styles.input}
            placeholder="https://your-project.convex.cloud"
            value={url}
            onChange={e => setUrl(e.target.value)}
            autoFocus
            spellCheck={false}
          />
          {error && <div className={styles.error}>{error}</div>}
          <button className={`btn-primary ${styles.btn}`} type="submit" disabled={loading}>
            {t('setup.connectButton')}
          </button>
        </form>
        <div className={styles.hint}>
          <strong>{t('setup.howToGetUrl')}</strong><br />
          1. <code>npm install convex</code><br />
          2. <code>npx convex dev</code> {t('setup.followPrompts')}<br />
          3. {t('setup.copyUrl')}
        </div>
      </div>
    </div>
  );
}
