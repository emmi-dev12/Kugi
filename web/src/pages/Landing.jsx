import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KugiLogo from '../components/UI/KugiLogo';
import styles from './Landing.module.css';

const FEATURES = [
  { icon: '⬡', title: 'Bento blocks', desc: 'Drag between days. Timeline and bento layouts for every mood.' },
  { icon: '🤖', title: 'AI agent API', desc: 'Bearer-auth REST API. Any LLM can read and write your schedule.' },
  { icon: '🔒', title: 'Your data, your server', desc: 'Bring your own Convex backend. Zero central servers, ever.' },
  { icon: '📲', title: 'Install anywhere', desc: 'PWA on Mac, iOS, Android, Windows. No App Store.' },
  { icon: '⚡', title: 'Real-time sync', desc: 'Convex keeps every device in sync instantly.' },
  { icon: '🔔', title: 'Smart reminders', desc: 'Push + Telegram with per-block custom messages.' },
];

const AI_PROMPT = `Fetch my Kugi API docs first: GET https://[your-deployment].convex.site/api/docs
Use my Bearer token from Settings → Developer.
Then: organize today's blocks, set up Telegram reminders, sync Google Calendar, and help me plan the week.
Always call /api/docs at the start of every session — it contains the full API reference.`;

const AI_PRINCIPLES = [
  { title: 'Fetch docs first', desc: 'The agent reads the full API reference before every session' },
  { title: 'One Bearer token', desc: 'Paste it once. Every agent that has it can do everything you can' },
  { title: 'Full read/write', desc: 'Create, complete, delete, bulk-edit, set notifications, sync calendars' },
];

function detectOS() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  return 'other';
}

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function Landing({ onGetStarted }) {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const os = detectOS();
  const canPrompt = !!installPrompt;

  const heroRef = useRef(null);
  const previewRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
      window.__pwaInstallPrompt = null;
    }
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleMouseMove = useCallback((e) => {
    const el = heroRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -4, y: dx * 3 });
  }, []);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

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

  function copyPrompt() {
    navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const [aiRef, aiInView] = useInView();
  const [featRef, featInView] = useInView();
  const [howRef, howInView] = useInView();
  const [installRef, installInView] = useInView();

  return (
    <div className={styles.page}>

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><KugiLogo size={16} /></div>
            <span className={styles.brandName}>kugi</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#agent" className={styles.navLink}>AI Agent</a>
            <a href="#install" className={styles.navLink}>Install</a>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
          </div>
          <button className={styles.navCta} onClick={handleOpen}>Open App</button>
        </div>
      </nav>

      {/* HERO */}
      <section
        className={styles.hero}
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={styles.heroStripe} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Free forever · Open source · BYOC
          </div>

          <h1 className={styles.heroTitle}>
            Your AI-ready<br />block calendar
          </h1>

          <p className={styles.heroSub}>
            Plan your week in beautiful bento blocks. Connect your AI agents.
            Own your data — no subscription, no central server, ever.
          </p>

          <div className={styles.heroCTA}>
            <button className={styles.ctaPrimary} onClick={handleOpen}>
              Start for free
            </button>
            {installed ? (
              <span className={styles.installedBadge}>
                <CheckIcon />
                Installed
              </span>
            ) : canPrompt ? (
              <button className={styles.ctaSecondary} onClick={triggerInstall}>
                <DownloadIcon />
                Install app
              </button>
            ) : null}
          </div>
        </div>

        {/* 3D preview */}
        <div className={styles.previewWrap}>
          <div
            ref={previewRef}
            className={styles.previewWindow}
            style={{
              transform: `perspective(1200px) rotateX(calc(8deg + ${tilt.x}deg)) rotateY(${tilt.y}deg)`,
              transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.8s cubic-bezier(0.23,1,0.32,1)' : 'transform 0.1s linear',
            }}
          >
            <div className={styles.previewBar}>
              <span className={styles.trafficDot} style={{ background: '#ff5f57' }} />
              <span className={styles.trafficDot} style={{ background: '#febc2e' }} />
              <span className={styles.trafficDot} style={{ background: '#28c840' }} />
              <span className={styles.previewTitle}>kugi — Week of May 5–11</span>
            </div>
            <div className={styles.previewGrid}>
              {['Mon 5', 'Tue 6', 'Wed 7', 'Thu 8', 'Fri 9', 'Sat 10', 'Sun 11'].map((d, i) => (
                <div key={i} className={styles.previewCol}>
                  <div className={styles.previewDay}>{d}</div>
                  {i === 0 && <>
                    <MockBlock color="#5d8a6a" title="Deep Work" time="09–11" emoji="💻" />
                    <MockBlock color="#6b8a7a" title="Gym" time="12–13" emoji="🏋️" />
                  </>}
                  {i === 1 && <>
                    <MockBlock color="#7a8a5d" title="Planning" time="10–11" emoji="🗂️" />
                    <MockBlock color="#a05a5a" title="Call" time="14–15" emoji="📞" />
                  </>}
                  {i === 2 && <MockBlock color="#5d7a8a" title="Research" time="09–12" emoji="🔬" />}
                  {i === 3 && <>
                    <MockBlock color="#a08a5d" title="Writing" time="10–12" emoji="✍️" />
                    <MockBlock color="#5d8a6a" title="Walk" time="17–18" emoji="🚶" />
                  </>}
                  {i === 4 && <MockBlock color="#7a6a8a" title="Review" time="11–12" emoji="👁️" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className={`${styles.section} ${featInView ? styles.inView : ''}`}
        ref={featRef}
      >
        <div className={styles.sectionInner}>
          <div className={styles.eyebrow}>Features</div>
          <h2 className={styles.sectionTitle}>Everything you need.<br />Nothing you don't.</h2>
          <div className={styles.featGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} className={styles.featCard} style={{ transitionDelay: `${i * 60}ms` }}>
                <div className={styles.featIcon}>{f.icon}</div>
                <div className={styles.featCardTitle}>{f.title}</div>
                <div className={styles.featCardDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI AGENT */}
      <section
        id="agent"
        className={`${styles.section} ${aiInView ? styles.inView : ''}`}
        ref={aiRef}
      >
        <div className={styles.sectionInner} style={{ maxWidth: 780 }}>
          <div className={styles.eyebrow}>AI Agent</div>
          <h2 className={styles.sectionTitle}>Your AI agent.<br />Already home.</h2>
          <p className={styles.sectionSub}>
            Give any LLM one prompt and it can read, write, and manage your entire schedule.
          </p>

          <div className={styles.promptCard}>
            <div className={styles.promptCardHeader}>
              <span className={styles.promptLabel}>Starter prompt</span>
              <button
                className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
                onClick={copyPrompt}
              >
                {copied ? (
                  <><CheckIcon size={12} /> Copied</>
                ) : (
                  <><CopyIcon /> Copy</>
                )}
              </button>
            </div>
            <pre className={styles.promptBlock}>{AI_PROMPT}</pre>
          </div>

          <div className={styles.principlesGrid}>
            {AI_PRINCIPLES.map((p, i) => (
              <div key={i} className={styles.principleCard}>
                <div className={styles.principleNum}>{i + 1}</div>
                <div>
                  <div className={styles.principleTitle}>{p.title}</div>
                  <div className={styles.principleDesc}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        className={`${styles.section} ${howInView ? styles.inView : ''}`}
        ref={howRef}
      >
        <div className={styles.sectionInner} style={{ maxWidth: 560 }}>
          <div className={styles.eyebrow}>Quick start</div>
          <h2 className={styles.sectionTitle}>Up in 3 minutes</h2>
          <div className={styles.steps}>
            {[
              { n: '1', t: 'Deploy Convex', d: 'Run npx convex dev once. Free tier covers everything.' },
              { n: '2', t: 'Connect Kugi', d: 'Paste your deployment URL. Your calendar is ready instantly.' },
              { n: '3', t: 'Install & block', d: 'Install as a PWA, create blocks, plug in your AI agent.' },
            ].map((s, i) => (
              <div key={i} className={styles.step} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className={styles.stepNumWrap}>
                  <div className={styles.stepNum}>{s.n}</div>
                  {i < 2 && <div className={styles.stepLine} />}
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepTitle}>{s.t}</div>
                  <div className={styles.stepDesc}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48, textAlign: 'center' }}>
            <button className={styles.ctaPrimary} onClick={handleOpen}>
              Get started free
            </button>
          </div>
        </div>
      </section>

      {/* INSTALL */}
      <section
        id="install"
        className={`${styles.section} ${installInView ? styles.inView : ''}`}
        ref={installRef}
      >
        <div className={styles.sectionInner}>
          <div className={styles.eyebrow}>Install</div>
          <h2 className={styles.sectionTitle}>Install on any device</h2>
          <p className={styles.sectionSub}>
            No App Store. No waiting. Kugi installs as a native-feeling app on every platform.
            {os !== 'other' && <> <strong style={{ color: '#dde8e0' }}>Your device is highlighted below.</strong></>}
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
                  <span className={styles.installedBadge}><CheckIcon /> Installed</span>
                ) : canPrompt ? (
                  <button className={styles.installOsBtn} onClick={triggerInstall}>
                    <DownloadIcon /> Install as app
                  </button>
                ) : (
                  <a className={styles.installOsBtn} href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer">
                    Get Chrome to install
                  </a>
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
                    <div className={styles.iosStep}><span className={styles.iosNum}>2</span> Tap <strong>Share</strong> then "Add to Home Screen"</div>
                  </div>
                ) : (
                  <button className={styles.installOsBtn} onClick={() => setShowIOSHint(true)}>
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
                  <span className={styles.installedBadge}><CheckIcon /> Installed</span>
                ) : canPrompt && os === 'android' ? (
                  <button className={styles.installOsBtn} onClick={triggerInstall}><DownloadIcon /> Install</button>
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
                  <span className={styles.installedBadge}><CheckIcon /> Installed</span>
                ) : canPrompt && os === 'windows' ? (
                  <button className={styles.installOsBtn} onClick={triggerInstall}><DownloadIcon /> Install</button>
                ) : (
                  <span className={styles.osHint}>Open in Chrome or Edge to install</span>
                )
              }
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><KugiLogo size={14} /></div>
            <span className={styles.brandName}>kugi</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
            <a href="https://github.com/emmi-dev12/Kugi/releases" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Releases</a>
            <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Convex</a>
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
    <div className={styles.mockBlock} style={{ borderLeft: `2px solid ${color}`, background: `${color}1a` }}>
      <span style={{ fontSize: 10 }}>{emoji}</span>
      <div>
        <div className={styles.mockTitle}>{title}</div>
        <div className={styles.mockTime}>{time}</div>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v7M3 5.5 6 9l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function CheckIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}
