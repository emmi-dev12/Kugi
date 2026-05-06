import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KugiLogo from '../components/UI/KugiLogo';
import styles from './Landing.module.css';

const FEATURES = [
  { emoji: '📅', title: 'Week & Day Views', desc: 'Drag blocks between days. Timeline and Bento layouts for every mood.' },
  { emoji: '🗂️', title: 'Smart Categories', desc: 'Color-coded categories with per-category filtering across all views.' },
  { emoji: '🤖', title: 'AI Agent API', desc: 'Personal API key lets your AI agents read and write your schedule.' },
  { emoji: '🔒', title: 'Your Data, Your Server', desc: 'BYOC — bring your own Convex backend. Zero central servers, zero subscriptions.' },
  { emoji: '📱', title: 'Mobile PWA', desc: 'Install to your home screen. Looks and feels like a native app on iOS & Android.' },
  { emoji: '🌍', title: 'Switzerland Time', desc: 'Europe/Zurich timezone, DD.MM.YYYY HH:MM format — built for precision.' },
];

export default function Landing({ onGetStarted }) {
  const navigate = useNavigate();
  const [release, setRelease] = useState(null);

  function handleOpen() {
    if (localStorage.getItem('kugiConvexUrl')) {
      navigate('/app');
    } else {
      onGetStarted();
    }
  }

  useEffect(() => {
    fetch('https://api.github.com/repos/emmi-dev12/Kugi/releases/latest')
      .then(r => r.json())
      .then(data => { if (data.tag_name) setRelease(data); })
      .catch(() => {});
  }, []);

  const intelAsset = release?.assets?.find(a => a.name.endsWith('-x64.dmg'));
  const armAsset = release?.assets?.find(a => a.name.endsWith('-arm64.dmg'));

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><KugiLogo size={18} /></div>
            <span>kugi</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
            <button className="btn-primary" onClick={handleOpen} style={{ padding: '7px 18px', fontSize: 13 }}>
              Open App
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroBadge}>✦ Free forever · Open source · BYOC</div>
        <h1 className={styles.heroTitle}>
          Your AI-ready<br />
          <span className={styles.heroGrad}>block calendar</span>
        </h1>
        <p className={styles.heroSub}>
          Plan your week in beautiful blocks. Connect your AI agents. Own your data — no subscription, no central server, ever.
        </p>
        <div className={styles.heroCTA}>
          <button className={`btn-primary ${styles.ctaMain}`} onClick={handleOpen}>
            Start for free →
          </button>
          {release ? (
            <div className={styles.downloads}>
              {intelAsset && (
                <a className={styles.dlBtn} href={intelAsset.browser_download_url}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Mac (Intel)
                </a>
              )}
              {armAsset && (
                <a className={styles.dlBtn} href={armAsset.browser_download_url}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Mac (Apple Silicon)
                </a>
              )}
              <span className={styles.dlVersion}>{release.tag_name}</span>
            </div>
          ) : (
            <a href="https://github.com/emmi-dev12/Kugi/releases" target="_blank" rel="noopener noreferrer" className={styles.dlBtn}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Download for macOS
            </a>
          )}
        </div>
      </section>

      {/* PREVIEW */}
      <section className={styles.preview}>
        <div className={styles.previewWindow}>
          <div className={styles.previewBar}>
            <span className={styles.dot} style={{ background: '#f43f5e' }} />
            <span className={styles.dot} style={{ background: '#fbbf24' }} />
            <span className={styles.dot} style={{ background: '#10b981' }} />
            <span className={styles.previewTitle}>kugi — Week of May 5–11</span>
          </div>
          <div className={styles.previewGrid}>
            {['Mon 5','Tue 6','Wed 7','Thu 8','Fri 9','Sat 10','Sun 11'].map((d, i) => (
              <div key={i} className={styles.previewCol}>
                <div className={styles.previewDay}>{d}</div>
                {i === 0 && <>
                  <MockBlock color="#4f7cff" title="Deep Work" time="09:00–11:00" emoji="💻" />
                  <MockBlock color="#10b981" title="Gym" time="12:00–13:00" emoji="🏋️" />
                </>}
                {i === 1 && <>
                  <MockBlock color="#8b5cf6" title="Planning" time="10:00–11:00" emoji="🗂️" />
                  <MockBlock color="#f43f5e" title="Call" time="14:00–15:00" emoji="📞" />
                </>}
                {i === 2 && <>
                  <MockBlock color="#4f7cff" title="Research" time="09:00–12:00" emoji="🔬" />
                </>}
                {i === 3 && <>
                  <MockBlock color="#fbbf24" title="Writing" time="10:00–12:00" emoji="✍️" />
                  <MockBlock color="#10b981" title="Walk" time="17:00–18:00" emoji="🚶" />
                </>}
                {i === 4 && <>
                  <MockBlock color="#8b5cf6" title="Review" time="11:00–12:00" emoji="👁️" />
                </>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features} id="features">
        <div className={styles.featuresInner}>
          <h2 className={styles.featTitle}>Everything you need. Nothing you don't.</h2>
          <div className={styles.featGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} className={styles.featCard}>
                <div className={styles.featEmoji}>{f.emoji}</div>
                <div className={styles.featCardTitle}>{f.title}</div>
                <div className={styles.featCardDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.how}>
        <div className={styles.howInner}>
          <h2 className={styles.featTitle}>Up in 3 minutes</h2>
          <div className={styles.steps}>
            {[
              { n: '1', t: 'Deploy Convex', d: 'Run npx convex dev once. Free tier is more than enough.' },
              { n: '2', t: 'Connect Kugi', d: 'Paste your deployment URL. Done — your account is set up.' },
              { n: '3', t: 'Block your week', d: 'Create blocks, drag them around, connect your AI agent.' },
            ].map((s, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <div>
                  <div className={styles.stepTitle}>{s.t}</div>
                  <div className={styles.stepDesc}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <button className={`btn-primary ${styles.ctaMain}`} onClick={handleOpen} style={{ marginTop: 40 }}>
            Get started free →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><KugiLogo size={16} /></div>
            <span>kugi</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
            <a href="https://github.com/emmi-dev12/Kugi/releases" target="_blank" rel="noopener noreferrer" className={styles.navLink}>Releases</a>
            <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className={styles.navLink}>Convex</a>
          </div>
          <div className={styles.footerMeta}>MIT License · Made with ❤️ in Switzerland</div>
        </div>
      </footer>
    </div>
  );
}

function MockBlock({ color, title, time, emoji }) {
  return (
    <div className={styles.mockBlock} style={{ borderLeft: `3px solid ${color}`, background: `${color}22` }}>
      <span style={{ fontSize: 11 }}>{emoji}</span>
      <div>
        <div className={styles.mockTitle}>{title}</div>
        <div className={styles.mockTime}>{time}</div>
      </div>
    </div>
  );
}
