import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KugiLogo from '../components/UI/KugiLogo';
import styles from './Landing.module.css';

/* ─── constants ─── */

const AI_PROMPT = `Fetch my Kugi API docs first: GET https://[deployment].convex.site/api/docs
Use my Bearer token from Settings → Developer.
Then: organize today's blocks, set up Telegram reminders,
sync Google Calendar, and help me plan the week.
Always call /api/docs at the start of every session.`;

const WEEK_BLOCKS = [
  { id: 1, day: 0, title: 'Deep Work',   time: '09–11', color: '#5d8a6a', emoji: '💻', notes: 'Focus session — auth module refactor.' },
  { id: 2, day: 0, title: 'Standup',     time: '11–12', color: '#7a8a5d', emoji: '🗣️', notes: 'Daily sync. Keep it short.' },
  { id: 3, day: 0, title: 'Lunch',       time: '12–13', color: '#6b8a7a', emoji: '🥗', notes: null },
  { id: 4, day: 1, title: 'Planning',    time: '10–11', color: '#7a8a5d', emoji: '🗂️', notes: 'Sprint planning session.' },
  { id: 5, day: 1, title: 'Client Call', time: '14–15', color: '#a05a5a', emoji: '📞', notes: 'Prepare the live demo beforehand.' },
  { id: 6, day: 2, title: 'Research',    time: '09–12', color: '#5d7a8a', emoji: '🔬', notes: 'New rendering approach investigation.' },
  { id: 7, day: 2, title: 'Code Review', time: '14–15', color: '#5d8a6a', emoji: '👁️', notes: 'Review open PRs from the team.' },
  { id: 8, day: 3, title: 'Writing',     time: '10–12', color: '#a08a5d', emoji: '✍️', notes: 'Draft the technical spec doc.' },
  { id: 9, day: 3, title: 'Walk',        time: '17–18', color: '#6b8a7a', emoji: '🚶', notes: null },
  { id: 10, day: 4, title: 'Review',     time: '11–12', color: '#7a6a8a', emoji: '👁️', notes: 'Weekly retro and review.' },
  { id: 11, day: 4, title: 'Deploy',     time: '15–16', color: '#5d8a6a', emoji: '🚀', notes: 'Ship the v1.2 release.' },
];

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DATES = ['5', '6', '7', '8', '9'];

/* ─── utilities ─── */

function detectOS() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Win/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  return 'other';
}

function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

/* ─── main component ─── */

export default function Landing({ onGetStarted }) {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [copied, setCopied] = useState(false);
  const os = detectOS();
  const canPrompt = !!installPrompt;

  const isMobileDevice = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const [previewMode, setPreviewMode] = useState(isMobileDevice ? 'mobile' : 'desktop');
  const [previewDay, setPreviewDay] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState(null);

  const handleBlockClick = useCallback((block) => {
    setSelectedBlock(prev => prev?.id === block.id ? null : block);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.__pwaInstallPrompt) { setInstallPrompt(window.__pwaInstallPrompt); window.__pwaInstallPrompt = null; }
    const h = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  function handleOpen() {
    if (localStorage.getItem('kugiConvexUrl')) navigate('/app');
    else onGetStarted();
  }

  async function triggerInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const [bentoRef, bentoInView] = useInView();
  const [devRef, devInView] = useInView();
  const [ctaRef, ctaInView] = useInView();

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <div className={styles.brandMark}><KugiLogo size={14} /></div>
            <span className={styles.brandName}>kugi</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#developer" className={styles.navLink}>Developer</a>
            <a href="#install" className={styles.navLink}>Install</a>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
          </div>
          <button className={styles.navCta} onClick={handleOpen}>Open App</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroStripe} aria-hidden />

        {/* Left: copy */}
        <div className={styles.heroLeft}>
          <div className={styles.heroPill}>
            <span className={styles.heroPillDot} />
            Free forever · Open source · BYOC
          </div>

          <h1 className={styles.heroH1}>
            Clarity<br />
            is the<br />
            feature.
          </h1>

          <p className={styles.heroSub}>
            A bento calendar for developers.<br />
            Your data. Your server. Your week.
          </p>

          <div className={styles.heroCta}>
            <button className={styles.btnPrimary} onClick={handleOpen}>
              Start for free
            </button>
            {installed ? (
              <span className={styles.installedChip}><CheckIcon /> Installed</span>
            ) : canPrompt ? (
              <button className={styles.btnGhost} onClick={triggerInstall}>
                <DownloadIcon /> Install app
              </button>
            ) : null}
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}><span className={styles.heroStatNum}>∞</span> Free plan</div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}><span className={styles.heroStatNum}>3 min</span> Setup</div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}><span className={styles.heroStatNum}>REST</span> AI API</div>
          </div>
        </div>

        {/* Right: interactive preview */}
        <div className={styles.heroRight}>
          <div className={styles.preview}>

            {/* Title bar */}
            <div className={styles.previewBar}>
              <span className={styles.dot} style={{ background: '#ff5f57' }} />
              <span className={styles.dot} style={{ background: '#febc2e' }} />
              <span className={styles.dot} style={{ background: '#28c840' }} />
              <span className={styles.previewLabel}>kugi — week of may 5</span>
              {/* View toggle */}
              <div className={styles.previewToggle}>
                <button
                  className={`${styles.previewToggleBtn} ${previewMode === 'desktop' ? styles.previewToggleActive : ''}`}
                  onClick={() => { setPreviewMode('desktop'); setSelectedBlock(null); }}
                  title="Desktop view"
                >
                  <DesktopIcon />
                </button>
                <button
                  className={`${styles.previewToggleBtn} ${previewMode === 'mobile' ? styles.previewToggleActive : ''}`}
                  onClick={() => { setPreviewMode('mobile'); setSelectedBlock(null); }}
                  title="Mobile view"
                >
                  <MobileIcon />
                </button>
              </div>
              <div className={styles.previewBadge}><span className={styles.previewBadgeDot} />live</div>
            </div>

            {previewMode === 'desktop' ? (
              /* ── Desktop view ── */
              <div className={styles.previewBody}>
                <div className={styles.previewDayRow}>
                  {DAYS.map((d, i) => (
                    <div key={i} className={`${styles.previewDayCell} ${i === 2 ? styles.previewDayToday : ''}`}>
                      <span className={styles.previewDayName}>{d}</span>
                      <span className={`${styles.previewDayNum} ${i === 2 ? styles.previewDayNumToday : ''}`}>{DATES[i]}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.previewGrid}>
                  {DAYS.map((_, dayIdx) => (
                    <div key={dayIdx} className={styles.previewCol}>
                      {WEEK_BLOCKS.filter(b => b.day === dayIdx).map((b) => (
                        <button
                          key={b.id}
                          className={`${styles.previewBlock} ${selectedBlock?.id === b.id ? styles.previewBlockSelected : ''}`}
                          style={{ borderLeftColor: b.color, background: selectedBlock?.id === b.id ? `${b.color}30` : `${b.color}18` }}
                          onClick={() => handleBlockClick(b)}
                        >
                          <div className={styles.previewBlockEmoji}>{b.emoji}</div>
                          <div>
                            <div className={styles.previewBlockTitle}>{b.title}</div>
                            <div className={styles.previewBlockTime}>{b.time}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Mobile view ── */
              <div className={styles.previewMobileBody}>
                <div className={styles.previewMobileNav}>
                  <button
                    className={styles.previewNavBtn}
                    onClick={() => { setPreviewDay(d => Math.max(0, d - 1)); setSelectedBlock(null); }}
                    disabled={previewDay === 0}
                  >‹</button>
                  <div className={styles.previewMobileDay}>
                    <span className={styles.previewMobileDayName}>{DAYS[previewDay]}</span>
                    <span className={`${styles.previewMobileDayNum} ${previewDay === 2 ? styles.previewDayNumToday : ''}`}>{DATES[previewDay]}</span>
                  </div>
                  <button
                    className={styles.previewNavBtn}
                    onClick={() => { setPreviewDay(d => Math.min(4, d + 1)); setSelectedBlock(null); }}
                    disabled={previewDay === 4}
                  >›</button>
                </div>
                <div className={styles.previewMobileCol}>
                  {WEEK_BLOCKS.filter(b => b.day === previewDay).length === 0 ? (
                    <div className={styles.previewEmpty}>No blocks today</div>
                  ) : (
                    WEEK_BLOCKS.filter(b => b.day === previewDay).map((b) => (
                      <button
                        key={b.id}
                        className={`${styles.previewMobileBlock} ${selectedBlock?.id === b.id ? styles.previewBlockSelected : ''}`}
                        style={{ borderLeftColor: b.color, background: selectedBlock?.id === b.id ? `${b.color}30` : `${b.color}18` }}
                        onClick={() => handleBlockClick(b)}
                      >
                        <span className={styles.previewMobileBlockEmoji}>{b.emoji}</span>
                        <div className={styles.previewMobileBlockInfo}>
                          <div className={styles.previewBlockTitle}>{b.title}</div>
                          <div className={styles.previewBlockTime}>{b.time}</div>
                        </div>
                        {selectedBlock?.id === b.id && <span className={styles.previewBlockCheck}>✓</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Block detail panel */}
            {selectedBlock && (
              <div className={styles.previewDetail}>
                <div className={styles.previewDetailBar}>
                  <span className={styles.previewDetailEmoji}>{selectedBlock.emoji}</span>
                  <div className={styles.previewDetailInfo}>
                    <div className={styles.previewDetailTitle}>{selectedBlock.title}</div>
                    <div className={styles.previewDetailTime}>{selectedBlock.time}</div>
                  </div>
                  <button className={styles.previewDetailClose} onClick={() => setSelectedBlock(null)}>×</button>
                </div>
                {selectedBlock.notes && (
                  <div className={styles.previewDetailNotes}>{selectedBlock.notes}</div>
                )}
              </div>
            )}

          </div>
        </div>
      </section>

      {/* ── BENTO FEATURES ── */}
      <section
        id="features"
        className={`${styles.bentoSection} ${bentoInView ? styles.inView : ''}`}
        ref={bentoRef}
      >
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>Built different</div>
            <h2 className={styles.sectionH2}>Every block. Yours.</h2>
          </div>

          <div className={styles.bento}>

            {/* AI Agent — wide */}
            <div className={`${styles.bentoCard} ${styles.bentoAi}`}>
              <div className={styles.bentoEyebrow}>AI-Native</div>
              <div className={styles.bentoTitle}>Your agents already<br />speak its language.</div>
              <p className={styles.bentoDesc}>
                One Bearer token. Full REST API. Any LLM can read, write,
                and reorganize your schedule — no plugin required.
              </p>
              <div className={styles.aiPromptCard}>
                <div className={styles.aiPromptHeader}>
                  <span className={styles.aiPromptLabel}>starter prompt</span>
                  <button className={`${styles.copyBtn} ${copied ? styles.copyDone : ''}`} onClick={copyPrompt}>
                    {copied ? <><CheckIcon size={11} /> copied</> : <><CopyIcon /> copy</>}
                  </button>
                </div>
                <pre className={styles.aiPromptPre}>{AI_PROMPT}</pre>
              </div>
            </div>

            {/* PWA — narrow tall */}
            <div className={`${styles.bentoCard} ${styles.bentoPwa}`}>
              <div className={styles.bentoEyebrow}>Universal</div>
              <div className={styles.bentoTitle}>Installs<br />everywhere.</div>
              <p className={styles.bentoDesc}>Mac, iOS, Android, Windows. No App Store. No waiting.</p>
              <div className={styles.osChips}>
                {['🍎 Mac', '📱 iOS', '🤖 Android', '🪟 Windows'].map(l => (
                  <span key={l} className={styles.osChip}>{l}</span>
                ))}
              </div>
              {canPrompt ? (
                <button className={styles.btnPrimary} style={{ marginTop: 'auto', width: '100%' }} onClick={triggerInstall}>
                  <DownloadIcon /> Install now
                </button>
              ) : (
                <button className={styles.btnOutline} style={{ marginTop: 'auto', width: '100%' }} onClick={handleOpen}>
                  Open App →
                </button>
              )}
            </div>

            {/* Real-time sync — small */}
            <div className={`${styles.bentoCard} ${styles.bentoSync}`}>
              <div className={styles.bentoEyebrow}>Infrastructure</div>
              <div className={styles.bentoTitle}>Real-time,<br />always.</div>
              <p className={styles.bentoDesc}>Convex keeps every device in sync. No polling. No stale state.</p>
              <div className={styles.syncDots}>
                {[...Array(3)].map((_, i) => (
                  <span key={i} className={styles.syncDot} style={{ animationDelay: `${i * 0.3}s` }} />
                ))}
              </div>
            </div>

            {/* Reminders — wide */}
            <div className={`${styles.bentoCard} ${styles.bentoReminders}`}>
              <div className={styles.bentoEyebrow}>Notifications</div>
              <div className={styles.bentoTitle}>Remind me the way I want to be reminded.</div>
              <p className={styles.bentoDesc}>
                Per-block custom messages. Push notifications. Telegram.
                Write exactly what gets sent, for every event.
              </p>
              <div className={styles.reminderPreview}>
                <div className={styles.reminderMsg}>
                  <span className={styles.reminderIcon}>🔔</span>
                  <div>
                    <div className={styles.reminderTitle}>Deploy to prod in 15 min</div>
                    <div className={styles.reminderSub}>Custom message · Push + Telegram</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Data ownership */}
            <div className={`${styles.bentoCard} ${styles.bentoData}`}>
              <div className={styles.bentoEyebrow}>Ownership</div>
              <div className={styles.bentoTitle}>Zero central servers. Ever.</div>
              <p className={styles.bentoDesc}>
                Bring your own Convex deployment. Your data lives where you put it.
                We never touch it.
              </p>
              <div className={styles.dataTag}>
                <LockIcon />
                <span>Your Convex · Your rules</span>
              </div>
            </div>

            {/* API */}
            <div className={`${styles.bentoCard} ${styles.bentoApi}`}>
              <div className={styles.bentoEyebrow}>Developer</div>
              <div className={styles.bentoTitle}>A REST API<br />worth using.</div>
              <div className={styles.apiSnippet}>
                <div className={styles.apiLine}>
                  <span className={styles.apiMethod}>GET</span>
                  <span className={styles.apiPath}>/api/tasks?date=today</span>
                </div>
                <div className={styles.apiLine}>
                  <span className={styles.apiMethod}>POST</span>
                  <span className={styles.apiPath}>/api/tasks</span>
                </div>
                <div className={styles.apiLine}>
                  <span className={styles.apiMethod}>PATCH</span>
                  <span className={styles.apiPath}>/api/tasks/:id</span>
                </div>
                <div className={styles.apiLine}>
                  <span className={styles.apiMethod}>GET</span>
                  <span className={styles.apiPath}>/api/docs</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── DEVELOPER SECTION ── */}
      <section
        id="developer"
        className={`${styles.devSection} ${devInView ? styles.inView : ''}`}
        ref={devRef}
      >
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>For developers</div>
            <h2 className={styles.sectionH2}>Up in 3 minutes.</h2>
            <p className={styles.sectionSub}>Deploy a backend, paste a URL, start blocking time.</p>
          </div>

          <div className={styles.steps}>
            {[
              {
                n: '01',
                title: 'Deploy Convex',
                desc: 'Run one command. Free tier covers everything — no credit card.',
                code: 'npx convex dev',
              },
              {
                n: '02',
                title: 'Connect Kugi',
                desc: 'Paste your deployment URL at /setup. Your calendar is ready instantly.',
                code: 'https://[name].convex.cloud',
              },
              {
                n: '03',
                title: 'Plug in your agent',
                desc: 'Copy your Bearer token from Settings → Developer. Point your LLM at the API.',
                code: 'GET /api/docs',
              },
            ].map((s, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepBody}>
                  <div className={styles.stepTitle}>{s.title}</div>
                  <div className={styles.stepDesc}>{s.desc}</div>
                  <div className={styles.stepCode}>{s.code}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTALL ── */}
      <section id="install" className={`${styles.installSection} ${devInView ? styles.inView : ''}`}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>Install</div>
            <h2 className={styles.sectionH2}>Any device. Any platform.</h2>
          </div>
          <div className={styles.osGrid}>
            <OSCard os="mac"     icon="🍎" label="Mac"          current={os === 'mac'}     steps={['Open in Chrome or Edge', 'Click Install in address bar', 'Kugi runs as a native window']} installAction={canPrompt ? () => triggerInstall() : null} installed={installed} />
            <OSCard os="ios"     icon="📱" label="iPhone / iPad" current={os === 'ios'}     steps={['Open in Safari', 'Tap Share → Add to Home Screen', 'Kugi appears on your home screen']} iosHint={showIOSHint} onIosHint={() => setShowIOSHint(true)} installed={installed && os === 'ios'} />
            <OSCard os="android" icon="🤖" label="Android"      current={os === 'android'} steps={['Open in Chrome', 'Tap Install in the address bar', 'Kugi lands on your home screen']} installAction={canPrompt && os === 'android' ? () => triggerInstall() : null} installed={installed && os === 'android'} />
            <OSCard os="win"     icon="🪟" label="Windows"      current={os === 'windows'} steps={['Open in Chrome or Edge', 'Click Install in address bar', 'Kugi opens as a standalone window']} installAction={canPrompt && os === 'windows' ? () => triggerInstall() : null} installed={installed && os === 'windows'} />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className={`${styles.ctaSection} ${ctaInView ? styles.inView : ''}`}
        ref={ctaRef}
      >
        <div className={styles.ctaInner}>
          <div className={styles.ctaEyebrow}>Ready?</div>
          <h2 className={styles.ctaH2}>Start building your week.</h2>
          <p className={styles.ctaSub}>Free forever. No account. Deploy your own backend in minutes.</p>
          <button className={styles.btnPrimary} onClick={handleOpen} style={{ fontSize: 15, padding: '10px 28px', height: 42 }}>
            Get started →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.brand}>
            <div className={styles.brandMark}><KugiLogo size={12} /></div>
            <span className={styles.brandName}>kugi</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
            <a href="https://github.com/emmi-dev12/Kugi/releases" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Releases</a>
            <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Convex</a>
          </div>
          <span className={styles.footerMeta}>MIT · Made in Switzerland</span>
        </div>
      </footer>

    </div>
  );
}

/* ─── sub-components ─── */

function OSCard({ icon, label, current, installed, steps, installAction, iosHint, onIosHint }) {
  return (
    <div className={`${styles.osCard} ${current ? styles.osCardCurrent : ''} ${installed ? styles.osCardDone : ''}`}>
      <div className={styles.osCardTop}>
        <span className={styles.osIcon}>{icon}</span>
        <div>
          <div className={styles.osLabel}>{label}</div>
          {current && <div className={styles.osCurrentTag}>Your device</div>}
        </div>
      </div>
      <ol className={styles.osSteps}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <div className={styles.osAction}>
        {installed ? (
          <span className={styles.installedChip}><CheckIcon /> Installed</span>
        ) : installAction ? (
          <button className={styles.btnOutline} style={{ width: '100%' }} onClick={installAction}>
            <DownloadIcon /> Install
          </button>
        ) : onIosHint ? (
          iosHint ? (
            <div className={styles.iosHintBox}>
              <div className={styles.iosHintStep}><span>1</span> Open in <strong>Safari</strong></div>
              <div className={styles.iosHintStep}><span>2</span> Tap <strong>Share</strong> → Add to Home Screen</div>
            </div>
          ) : (
            <button className={styles.btnOutline} style={{ width: '100%' }} onClick={onIosHint}>How to install</button>
          )
        ) : (
          <span className={styles.osHint}>Open in Chrome to install</span>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
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

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M3 8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2.5" y="5.5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="1.5" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 10.5h4M6 8.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="3" y="0.75" width="6" height="10.5" rx="1.3" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="6" cy="9.5" r="0.65" fill="currentColor"/>
    </svg>
  );
}
