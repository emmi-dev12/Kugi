import { useState } from 'react';
import KugiLogo from '../components/UI/KugiLogo';
import styles from './Setup.module.css';

export default function Setup({ onComplete }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter your Convex URL.'); return; }
    if (!trimmed.startsWith('https://') || !trimmed.includes('.convex.cloud')) {
      setError('URL must be a valid Convex deployment URL (e.g. https://xxx.convex.cloud)');
      return;
    }
    localStorage.setItem('kugiConvexUrl', trimmed);
    onComplete(trimmed);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}><KugiLogo size={28} /></div>
          <span className={styles.logoText}>kugi</span>
        </div>
        <h1 className={styles.title}>Connect your workspace</h1>
        <p className={styles.sub}>
          Kugi uses your own Convex backend — your data stays yours, forever free.
          Deploy one at <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className={styles.link}>convex.dev</a> and paste the URL below.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Convex Deployment URL</label>
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
            Connect workspace →
          </button>
        </form>
        <div className={styles.hint}>
          <strong>How to get your URL:</strong><br />
          1. <code>npm install convex</code><br />
          2. <code>npx convex dev</code> (follow prompts to create a project)<br />
          3. Copy the deployment URL from the dashboard or terminal output
        </div>
      </div>
    </div>
  );
}
