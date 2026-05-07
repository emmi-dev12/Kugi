import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KugiLogo from '../components/UI/KugiLogo';
import styles from './Landing.module.css';

const FEATURES = [
  { icon: '⬡', title: 'Bento blocks', desc: 'Drag blocks between days. Timeline and bento layouts for every mood.' },
  { icon: '🤖', title: 'AI agent API', desc: 'Personal bearer-auth API. Let your agents read and write your schedule.' },
  { icon: '🔒', title: 'Your data, your server', desc: 'Bring your own Convex backend. Zero central servers, zero subscriptions.' },
  { icon: '📲', title: 'Install on anything', desc: 'PWA installs on Mac, iOS, Android, Windows — no App Store, no DMG.' },
  { icon: '⚡', title: 'Real-time sync', desc: 'Convex keeps every device in sync instantly. Open two tabs, watch them move.' },
  { icon: '🗂️', title: 'Smart categories', desc: 'Color-coded categories with per-category filtering across all views.' },
];

export default function Landing({ onGetStarted }) {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    // Already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function handleOpen() {
    if (localStorage.getItem('kugiConvexUrl')) navigate('/app');
    else onGetStarted();
  }

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

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
            <a href="#install" className={styles.navLink}>Install</a>
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
          Plan your week in beautiful bento blocks. Connect your AI agents. Own your data — no subscription, no central server, ever.
        </p>
        <div className={styles.heroCTA}>
          <button className={`btn-primary ${styles.ctaMain}`} onClick={handleOpen}>
            Start for free →
          </button>
          {!installed && installPrompt && (
            <button className={styles.installBtn} onClick={handleInstall}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1v9M3.5 7.5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 14h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Install app
            </button>
          )}
          {installed && (
            <span className={styles.installedBadge}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3.5 3.5L11 3" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Installed
            </span>
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
                  <MockBlock color="#4f7cff" title="Deep Work" time="09–11" emoji="💻" />
                  <MockBlock color="#10b981" title="Gym" time="12–13" emoji="🏋️" />
                </>}
                {i === 1 && <>
                  <MockBlock color="#8b5cf6" title="Planning" time="10–11" emoji="🗂️" />
                  <MockBlock color="#f43f5e" title="Call" time="14–15" emoji="📞" />
                </>}
                {i === 2 && <MockBlock color="#4f7cff" title="Research" time="09–12" emoji="🔬" />}
                {i === 3 && <>
                  <MockBlock color="#fbbf24" title="Writing" time="10–12" emoji="✍️" />
                  <MockBlock color="#10b981" title="Walk" time="17–18" emoji="🚶" />
                </>}
                {i === 4 && <MockBlock color="#8b5cf6" title="Review" time="11–12" emoji="👁️" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSTALL SECTION */}
      <section className={styles.installSection} id="install">
        <div className={styles.installInner}>
          <div className={styles.installLeft}>
            <h2 className={styles.installTitle}>Install on any device</h2>
            <p className={styles.installSub}>No App Store. No DMG. No waiting. One click and kugi lives in your dock or home screen — looking and feeling exactly like a native app.</p>
            <div className={styles.platforms}>
              <Platform icon="🍎" label="Mac" sub="Chrome or Edge" />
              <Platform icon="📱" label="iPhone" sub="Safari → Share" />
              <Platform icon="🤖" label="Android" sub="Chrome → Install" />
              <Platform icon="🪟" label="Windows" sub="Edge or Chrome" />
            </div>
            {!installed && installPrompt && (
              <button className={`btn-primary ${styles.ctaMain}`} onClick={handleInstall} style={{ marginTop: 28 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v9M3 7l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Install now — it's free
              </button>
            )}
            {installed && (
              <div className={styles.installedMsg}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                App installed — check your dock
              </div>
            )}
            {!installPrompt && !installed && (
              <p className={styles.installHint}>
                Open in <strong>Chrome or Edge</strong> on Mac to install. On iPhone, tap the Share button in Safari → "Add to Home Screen".
              </p>
            )}
          </div>
          <div className={styles.installRight}>
            <div className={styles.phoneFrame}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                <div className={styles.phoneHeader}>
                  <span className={styles.phoneHeaderTitle}>Today · Thu 8</span>
                </div>
                <div className={styles.phoneBlocks}>
                  <PhoneBlock color="#4f7cff" title="Deep Work" time="09:00–11:00" emoji="💻" />
                  <PhoneBlock color="#10b981" title="Gym" time="12:00–13:00" emoji="🏋️" />
                  <PhoneBlock color="#8b5cf6" title="Planning" time="15:00–16:00" emoji="🗂️" />
                </div>
                <div className={styles.phoneNav}>
                  <span className={styles.phoneNavDot} style={{ background: '#4f7cff' }} />
                  <div className={styles.phoneNavFab} />
                  <span className={styles.phoneNavDot} />
                </div>
              </div>
            </div>
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
                <div className={styles.featIcon}>{f.icon}</div>
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
              { n: '1', t: 'Deploy Convex', d: 'Run npx convex dev once. Free tier covers everything.' },
              { n: '2', t: 'Connect Kugi', d: 'Paste your deployment URL. Your calendar is ready instantly.' },
              { n: '3', t: 'Install & block', d: 'Install as a PWA, create blocks, plug in your AI agent.' },
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

function Platform({ icon, label, sub }) {
  return (
    <div className={styles.platform}>
      <span className={styles.platformIcon}>{icon}</span>
      <div className={styles.platformLabel}>{label}</div>
      <div className={styles.platformSub}>{sub}</div>
    </div>
  );
}

function PhoneBlock({ color, title, time, emoji }) {
  return (
    <div className={styles.phoneBlock} style={{ borderLeft: `2px solid ${color}`, background: `${color}20` }}>
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <div>
        <div className={styles.phoneBlockTitle}>{title}</div>
        <div className={styles.phoneBlockTime}>{time}</div>
      </div>
    </div>
  );
}
