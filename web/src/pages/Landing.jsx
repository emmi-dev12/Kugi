import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KugiLogo from '../components/UI/KugiLogo';
import styles from './Landing.module.css';

const FEATURES = [
  { icon: '⬡', title: 'Bento blocks', desc: 'Drag blocks between days. Timeline and bento layouts for every mood.' },
  { icon: '🤖', title: 'AI agent API', desc: 'Personal bearer-auth API. Let your agents read and write your schedule.' },
  { icon: '🔒', title: 'Your data, your server', desc: 'Bring your own Convex backend. Zero central servers, zero subscriptions.' },
  { icon: '📲', title: 'Install on anything', desc: 'PWA installs on Mac, iOS, Android, Windows — no App Store, no DMG required.' },
  { icon: '⚡', title: 'Real-time sync', desc: 'Convex keeps every device in sync instantly. Open two tabs, watch them move.' },
  { icon: '🗂️', title: 'Smart categories', desc: 'Color-coded categories with per-category filtering across all views.' },
];

function detectOS() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  return 'other';
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  if (/Firefox\//.test(ua)) return 'firefox';
  return 'other';
}

export default function Landing({ onGetStarted }) {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const os = detectOS();
  const browser = detectBrowser();
  const canPrompt = !!installPrompt;

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function handleOpen() {
    if (localStorage.getItem('kugiConvexUrl')) navigate('/app');
    else onGetStarted();
  }

  async function triggerInstall() {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
    return outcome === 'accepted';
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
          {installed ? (
            <span className={styles.installedBadge}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3.5 3.5L11 3" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              App installed
            </span>
          ) : canPrompt ? (
            <button className={styles.installBtn} onClick={triggerInstall}>
              <DownloadIcon />
              Install app
            </button>
          ) : null}
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
          <h2 className={styles.installTitle}>Install on any device</h2>
          <p className={styles.installSub}>
            No App Store. No waiting. Kugi installs as a native-feeling app on every platform.
            {os !== 'other' && <strong> Your device is highlighted below.</strong>}
          </p>

          <div className={styles.osGrid}>
            <OSCard
              icon="🍎"
              label="Mac"
              current={os === 'mac'}
              installed={installed}
              steps={canPrompt
                ? ['Click Install — browser prompt appears', 'Kugi opens in its own window, no browser chrome']
                : ['Open this page in Chrome or Edge', 'Click Install in the address bar or use the button below']}
              actions={
                installed ? (
                  <span className={styles.installedBadge}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3.5 3.5L11 3" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Installed
                  </span>
                ) : canPrompt ? (
                  <button className={`btn-primary ${styles.osBtn}`} onClick={triggerInstall}>
                    <DownloadIcon /> Install as app
                  </button>
                ) : (
                  <span className={styles.osHint}>Open in Chrome or Edge to install as PWA</span>
                )
              }
            />

            <OSCard
              icon="📱"
              label="iPhone / iPad"
              current={os === 'ios'}
              installed={installed && os === 'ios'}
              steps={['Open kugi.onrender.com in Safari', 'Tap Share → "Add to Home Screen"', 'Kugi appears on your home screen']}
              actions={
                showIOSHint ? (
                  <div className={styles.iosSteps}>
                    <div className={styles.iosStep}><span className={styles.iosNum}>1</span> Open in <strong>Safari</strong></div>
                    <div className={styles.iosStep}><span className={styles.iosNum}>2</span> Tap <strong>Share</strong> <ShareIcon /> then "Add to Home Screen"</div>
                  </div>
                ) : (
                  <button className={`btn-primary ${styles.osBtn}`} onClick={() => setShowIOSHint(true)}>
                    How to install
                  </button>
                )
              }
            />

            <OSCard
              icon="🤖"
              label="Android"
              current={os === 'android'}
              installed={installed && os === 'android'}
              steps={['Open in Chrome', 'Tap Install in the address bar or menu', 'Kugi lands on your home screen']}
              actions={
                installed && os === 'android' ? (
                  <span className={styles.installedBadge}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3.5 3.5L11 3" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Installed
                  </span>
                ) : canPrompt && os === 'android' ? (
                  <button className={`btn-primary ${styles.osBtn}`} onClick={triggerInstall}>
                    <DownloadIcon /> Install
                  </button>
                ) : (
                  <span className={styles.osHint}>Open in Chrome to install</span>
                )
              }
            />

            <OSCard
              icon="🪟"
              label="Windows"
              current={os === 'windows'}
              installed={installed && os === 'windows'}
              steps={['Open in Chrome or Edge', 'Click Install in the address bar', 'Kugi opens as a standalone window']}
              actions={
                installed && os === 'windows' ? (
                  <span className={styles.installedBadge}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7l3.5 3.5L11 3" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Installed
                  </span>
                ) : canPrompt && os === 'windows' ? (
                  <button className={`btn-primary ${styles.osBtn}`} onClick={triggerInstall}>
                    <DownloadIcon /> Install
                  </button>
                ) : (
                  <span className={styles.osHint}>Open in Chrome or Edge to install</span>
                )
              }
            />
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

function OSCard({ icon, label, current, installed, steps, actions }) {
  return (
    <div className={`${styles.osCard} ${current ? styles.osCurrent : ''} ${installed ? styles.osInstalled : ''}`}>
      <div className={styles.osCardHeader}>
        <span className={styles.osIcon}>{icon}</span>
        <div>
          <div className={styles.osLabel}>{label}</div>
          {current && <div className={styles.osCurrentBadge}>Your device</div>}
        </div>
      </div>
      <ul className={styles.osStepList}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
      <div className={styles.osActionWrap}>{actions}</div>
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

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1v8M3 6l3.5 3.5L10 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 12h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }}>
      <path d="M6 1v7M3 4l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 9h8v2H2z" fill="currentColor" opacity="0.3"/>
    </svg>
  );
}
