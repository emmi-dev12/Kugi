import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KugiMark from '../components/UI/KugiMark';
import { getLocale } from '../utils/language';
import styles from './Landing.module.css';

/* ─── constants ─── */

function getWeekBlocks(t) {
  return [
    { id: 1, day: 0, title: t('landing.demo.deepWork'),   time: '09–11', color: '#5d8a6a', emoji: '💻', notes: t('landing.demo.deepWorkNotes') },
    { id: 2, day: 0, title: t('landing.demo.standup'),     time: '11–12', color: '#7a8a5d', emoji: '🗣️', notes: t('landing.demo.standupNotes') },
    { id: 3, day: 0, title: t('landing.demo.lunch'),       time: '12–13', color: '#6b8a7a', emoji: '🥗', notes: null },
    { id: 4, day: 1, title: t('landing.demo.planning'),    time: '10–11', color: '#7a8a5d', emoji: '🗂️', notes: t('landing.demo.planningNotes') },
    { id: 5, day: 1, title: t('landing.demo.clientCall'),  time: '14–15', color: '#a05a5a', emoji: '📞', notes: t('landing.demo.clientCallNotes') },
    { id: 6, day: 2, title: t('landing.demo.research'),    time: '09–12', color: '#5d7a8a', emoji: '🔬', notes: t('landing.demo.researchNotes') },
    { id: 7, day: 2, title: t('landing.demo.codeReview'),  time: '14–15', color: '#5d8a6a', emoji: '👁️', notes: t('landing.demo.codeReviewNotes') },
    { id: 8, day: 3, title: t('landing.demo.writing'),     time: '10–12', color: '#a08a5d', emoji: '✍️', notes: t('landing.demo.writingNotes') },
    { id: 9, day: 3, title: t('landing.demo.walk'),        time: '17–18', color: '#6b8a7a', emoji: '🚶', notes: null },
    { id: 10, day: 4, title: t('landing.demo.review'),     time: '11–12', color: '#7a6a8a', emoji: '👁️', notes: t('landing.demo.reviewNotes') },
    { id: 11, day: 4, title: t('landing.demo.deploy'),     time: '15–16', color: '#5d8a6a', emoji: '🚀', notes: t('landing.demo.deployNotes') },
  ];
}

// Jan 1 2024 was a Monday — used as a stable reference for locale weekday abbreviations.
function getDays(locale) {
  return Array.from({ length: 5 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))
  );
}
const DATES = ['5', '6', '7', '8', '9'];

function getApiGroups(t) {
  return [
    {
      label: t('landing.api.groups.tasks'),
      icon: '📋',
      endpoints: [
        { method: 'GET',    path: '/api/tasks',              desc: t('landing.api.endpoints.listTasks') },
        { method: 'POST',   path: '/api/tasks',              desc: t('landing.api.endpoints.createTask') },
        { method: 'GET',    path: '/api/tasks/:id',          desc: t('landing.api.endpoints.getTask') },
        { method: 'PATCH',  path: '/api/tasks/:id',          desc: t('landing.api.endpoints.updateTask') },
        { method: 'DELETE', path: '/api/tasks/:id',          desc: t('landing.api.endpoints.deleteTask') },
        { method: 'POST',   path: '/api/tasks/:id/complete', desc: t('landing.api.endpoints.toggleComplete') },
      ],
    },
    {
      label: t('landing.api.groups.bulk'),
      icon: '⚡',
      endpoints: [
        { method: 'POST', path: '/api/tasks/bulk',          desc: t('landing.api.endpoints.bulkCreate') },
        { method: 'POST', path: '/api/tasks/bulk-complete', desc: t('landing.api.endpoints.bulkComplete') },
        { method: 'POST', path: '/api/tasks/bulk-delete',   desc: t('landing.api.endpoints.bulkDelete') },
        { method: 'POST', path: '/api/tasks/bulk-update',   desc: t('landing.api.endpoints.bulkUpdate') },
      ],
    },
    {
      label: t('landing.api.groups.categories'),
      icon: '🏷️',
      endpoints: [
        { method: 'GET',    path: '/api/categories',       desc: t('landing.api.endpoints.listCategories') },
        { method: 'POST',   path: '/api/categories',       desc: t('landing.api.endpoints.createCategory') },
        { method: 'DELETE', path: '/api/categories/:name', desc: t('landing.api.endpoints.deleteCategory') },
      ],
    },
    {
      label: t('landing.api.groups.settings'),
      icon: '⚙️',
      endpoints: [
        { method: 'GET',   path: '/api/settings', desc: t('landing.api.endpoints.readSettings') },
        { method: 'PATCH', path: '/api/settings', desc: t('landing.api.endpoints.updateSettings') },
      ],
    },
    {
      label: t('landing.api.groups.meta'),
      icon: '📖',
      endpoints: [
        { method: 'GET', path: '/api/docs',  desc: t('landing.api.endpoints.docs') },
        { method: 'GET', path: '/api/stats', desc: t('landing.api.endpoints.stats') },
      ],
    },
  ];
}

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const WEEK_BLOCKS = getWeekBlocks(t);
  const DAYS = getDays(getLocale(i18n.language));
  const API_GROUPS = getApiGroups(t);
  const AI_PROMPT = t('landing.aiPrompt');
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
  const [apiRef, apiInView] = useInView(0.05);
  const [ctaRef, ctaInView] = useInView();

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <KugiMark size="sm" />
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>{t('landing.nav.features')}</a>
            <a href="#api" className={styles.navLink}>{t('landing.nav.api')}</a>
            <a href="#developer" className={styles.navLink}>{t('landing.nav.developer')}</a>
            <a href="#install" className={styles.navLink}>{t('landing.nav.install')}</a>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
          </div>
          <button className={styles.navCta} onClick={handleOpen}>{t('landing.nav.openApp')}</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroStripe} aria-hidden />

        {/* Left: copy */}
        <div className={styles.heroLeft}>
          <div className={styles.heroPill}>
            <span className={styles.heroPillDot} />
            {t('landing.hero.pill')}
          </div>

          <h1 className={styles.heroH1}>
            {t('landing.hero.h1Line1')}<br />
            <em>{t('landing.hero.h1Line2')}</em><br />
            {t('landing.hero.h1Line3')}
          </h1>

          <p className={styles.heroSub}>
            {t('landing.hero.subLine1')}<br />
            {t('landing.hero.subLine2')}
          </p>

          <div className={styles.heroCta}>
            <button className={styles.btnPrimary} onClick={handleOpen}>
              {t('landing.hero.startFree')}
            </button>
            {installed ? (
              <span className={styles.installedChip}><CheckIcon /> {t('landing.installed')}</span>
            ) : canPrompt ? (
              <button className={styles.btnGhost} onClick={triggerInstall}>
                <DownloadIcon /> {t('landing.hero.installApp')}
              </button>
            ) : null}
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}><span className={styles.heroStatNum}>∞</span> {t('landing.hero.statFreePlan')}</div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}><span className={styles.heroStatNum}>3 min</span> {t('landing.hero.statSetup')}</div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}><span className={styles.heroStatNum}>REST</span> {t('landing.hero.statAiApi')}</div>
          </div>
        </div>

        {/* Right: interactive preview */}
        <div className={styles.heroRight}>
          <div className={styles.previewGlowWrap}>
            <div className={styles.preview}>

              {/* Title bar */}
              <div className={styles.previewBar}>
                <span className={styles.dot} style={{ background: '#ff5f57' }} />
                <span className={styles.dot} style={{ background: '#febc2e' }} />
                <span className={styles.dot} style={{ background: '#28c840' }} />
                <span className={styles.previewLabel}>{t('landing.preview.label')}</span>
                <div className={styles.previewToggle}>
                  <button
                    className={`${styles.previewToggleBtn} ${previewMode === 'desktop' ? styles.previewToggleActive : ''}`}
                    onClick={() => { setPreviewMode('desktop'); setSelectedBlock(null); }}
                    title={t('landing.preview.desktopView')}
                  >
                    <DesktopIcon />
                  </button>
                  <button
                    className={`${styles.previewToggleBtn} ${previewMode === 'mobile' ? styles.previewToggleActive : ''}`}
                    onClick={() => { setPreviewMode('mobile'); setSelectedBlock(null); }}
                    title={t('landing.preview.mobileView')}
                  >
                    <MobileIcon />
                  </button>
                </div>
                <div className={styles.previewBadge}><span className={styles.previewBadgeDot} />{t('landing.preview.live')}</div>
              </div>

              {previewMode === 'desktop' ? (
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
                      <div className={styles.previewEmpty}>{t('landing.preview.noBlocksToday')}</div>
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
            <div className={styles.eyebrow}>{t('landing.bento.eyebrow')}</div>
            <h2 className={styles.sectionH2}>{t('landing.bento.h2')}</h2>
          </div>

          <div className={styles.bento}>

            <div className={`${styles.bentoCard} ${styles.bentoAi}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.ai.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.ai.titleLine1')}<br />{t('landing.bento.ai.titleLine2')}</div>
              <p className={styles.bentoDesc}>{t('landing.bento.ai.desc')}</p>
              <div className={styles.aiPromptCard}>
                <div className={styles.aiPromptHeader}>
                  <span className={styles.aiPromptLabel}>{t('landing.bento.ai.starterPrompt')}</span>
                  <button className={`${styles.copyBtn} ${copied ? styles.copyDone : ''}`} onClick={copyPrompt}>
                    {copied ? <><CheckIcon size={11} /> {t('landing.bento.ai.copied')}</> : <><CopyIcon /> {t('landing.bento.ai.copy')}</>}
                  </button>
                </div>
                <pre className={styles.aiPromptPre}>{AI_PROMPT}</pre>
              </div>
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoPwa}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.pwa.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.pwa.titleLine1')}<br />{t('landing.bento.pwa.titleLine2')}</div>
              <p className={styles.bentoDesc}>{t('landing.bento.pwa.desc')}</p>
              <div className={styles.osChips}>
                {['🍎 Mac', '📱 iOS', '🤖 Android', '🪟 Windows'].map(l => (
                  <span key={l} className={styles.osChip}>{l}</span>
                ))}
              </div>
              {canPrompt ? (
                <button className={styles.btnPrimary} style={{ marginTop: 'auto', width: '100%' }} onClick={triggerInstall}>
                  <DownloadIcon /> {t('landing.bento.pwa.installNow')}
                </button>
              ) : (
                <button className={styles.btnOutline} style={{ marginTop: 'auto', width: '100%' }} onClick={handleOpen}>
                  {t('landing.bento.pwa.openApp')}
                </button>
              )}
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoSync}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.sync.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.sync.titleLine1')}<br />{t('landing.bento.sync.titleLine2')}</div>
              <p className={styles.bentoDesc}>{t('landing.bento.sync.desc')}</p>
              <div className={styles.syncDots}>
                {[...Array(3)].map((_, i) => (
                  <span key={i} className={styles.syncDot} style={{ animationDelay: `${i * 0.3}s` }} />
                ))}
              </div>
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoReminders}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.reminders.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.reminders.title')}</div>
              <p className={styles.bentoDesc}>{t('landing.bento.reminders.desc')}</p>
              <div className={styles.reminderPreview}>
                <div className={styles.reminderMsg}>
                  <span className={styles.reminderIcon}>🔔</span>
                  <div>
                    <div className={styles.reminderTitle}>{t('landing.bento.reminders.exampleTitle')}</div>
                    <div className={styles.reminderSub}>{t('landing.bento.reminders.exampleSub')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoData}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.data.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.data.title')}</div>
              <p className={styles.bentoDesc}>{t('landing.bento.data.desc')}</p>
              <div className={styles.dataTag}>
                <LockIcon />
                <span>{t('landing.bento.data.tag')}</span>
              </div>
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoApi}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.apiCard.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.apiCard.titleLine1')}<br />{t('landing.bento.apiCard.titleLine2')}</div>
              <div className={styles.apiSnippet}>
                {[
                  { m: 'GET',    p: '/api/tasks?date=today' },
                  { m: 'POST',   p: '/api/tasks' },
                  { m: 'PATCH',  p: '/api/tasks/:id' },
                  { m: 'GET',    p: '/api/docs' },
                ].map(({ m, p }) => (
                  <div key={p} className={styles.apiLine}>
                    <span className={`${styles.apiMethod} ${styles['apiMethod' + m]}`}>{m}</span>
                    <span className={styles.apiPath}>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoFlow}`}>
              <div className={styles.bentoEyebrow}>{t('landing.bento.flow.eyebrow')}</div>
              <div className={styles.bentoTitle}>{t('landing.bento.flow.title')}</div>
              <p className={styles.bentoDesc}>{t('landing.bento.flow.desc')}</p>
              <div className={styles.flowGrid}>
                {[
                  { icon: '🗓️', name: t('landing.bento.flow.dragName'), sub: t('landing.bento.flow.dragSub') },
                  { icon: '🌅', name: t('landing.bento.flow.planName'), sub: t('landing.bento.flow.planSub') },
                  { icon: '⌘',  name: t('landing.bento.flow.paletteName'), sub: t('landing.bento.flow.paletteSub') },
                  { icon: '✨', name: t('landing.bento.flow.winsName'), sub: t('landing.bento.flow.winsSub') },
                ].map(f => (
                  <div key={f.name} className={styles.flowItem}>
                    <span className={styles.flowIcon}>{f.icon}</span>
                    <div>
                      <div className={styles.flowName}>{f.name}</div>
                      <div className={styles.flowSub}>{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── API REFERENCE ── */}
      <section
        id="api"
        className={`${styles.apiSection} ${apiInView ? styles.inView : ''}`}
        ref={apiRef}
      >
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>{t('landing.api.eyebrow')}</div>
            <h2 className={styles.sectionH2}>{t('landing.api.h2')}</h2>
            <p className={styles.sectionSub}>
              {t('landing.api.subPrefix')}{' '}
              <code className={styles.inlineCode}>.convex.site</code>.
              {' '}{t('landing.api.subMiddle')} <code className={styles.inlineCode}>/api/docs</code> {t('landing.api.subSuffix')}
            </p>
          </div>

          <div className={styles.apiAuthBar}>
            <div className={styles.apiAuthLeft}>
              <span className={styles.apiAuthLabel}>{t('landing.api.baseUrl')}</span>
              <code className={styles.apiAuthCode}>https://[deployment].convex.site</code>
            </div>
            <div className={styles.apiAuthDivider} />
            <div className={styles.apiAuthLeft}>
              <span className={styles.apiAuthLabel}>{t('landing.api.auth')}</span>
              <code className={styles.apiAuthCode}>Authorization: Bearer &lt;your-api-key&gt;</code>
            </div>
            <a href="#developer" className={styles.apiAuthLink}>{t('landing.api.getKey')}</a>
          </div>

          <div className={styles.apiGroups}>
            {API_GROUPS.map((group) => (
              <div key={group.label} className={styles.apiGroup}>
                <div className={styles.apiGroupHeader}>
                  <span className={styles.apiGroupIcon}>{group.icon}</span>
                  <span className={styles.apiGroupLabel}>{group.label}</span>
                  <span className={styles.apiGroupCount}>{group.endpoints.length}</span>
                </div>
                <div className={styles.apiEndpoints}>
                  {group.endpoints.map((ep) => (
                    <div key={ep.method + ep.path} className={styles.apiEndpoint}>
                      <span className={`${styles.apiMethodBadge} ${styles['badge' + ep.method]}`}>{ep.method}</span>
                      <code className={styles.apiEndpointPath}>{ep.path}</code>
                      <span className={styles.apiEndpointDesc}>{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.apiFootnote}>
            <InfoIcon />
            <span>
              {t('landing.api.footnotePrefix')}
              {' '}<code className={styles.inlineCode}>YYYY-MM-DD</code>{t('landing.api.footnoteTimes')}{' '}
              <code className={styles.inlineCode}>HH:MM</code>.
              {' '}{t('landing.api.footnoteMiddle')} <code className={styles.inlineCode}>DELETE /api/tasks/:id</code> {t('landing.api.footnoteSupports')}{' '}
              <code className={styles.inlineCode}>?mode=this|future|all</code> {t('landing.api.footnoteRecurring')}
            </span>
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
            <div className={styles.eyebrow}>{t('landing.dev.eyebrow')}</div>
            <h2 className={styles.sectionH2}>{t('landing.dev.h2')}</h2>
            <p className={styles.sectionSub}>{t('landing.dev.sub')}</p>
          </div>

          <div className={styles.steps}>
            {[
              {
                n: '01',
                title: t('landing.dev.step1Title'),
                desc: t('landing.dev.step1Desc'),
                code: 'npx convex dev',
              },
              {
                n: '02',
                title: t('landing.dev.step2Title'),
                desc: t('landing.dev.step2Desc'),
                code: 'https://[name].convex.cloud',
              },
              {
                n: '03',
                title: t('landing.dev.step3Title'),
                desc: t('landing.dev.step3Desc'),
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
            <div className={styles.eyebrow}>{t('landing.install.eyebrow')}</div>
            <h2 className={styles.sectionH2}>{t('landing.install.h2')}</h2>
          </div>
          <div className={styles.osGrid}>
            <OSCard t={t} os="mac"     icon="🍎" label="Mac"          current={os === 'mac'}     steps={[t('landing.install.macStep1'), t('landing.install.macStep2'), t('landing.install.macStep3')]} installAction={canPrompt ? () => triggerInstall() : null} installed={installed} />
            <OSCard t={t} os="ios"     icon="📱" label={t('landing.install.iosLabel')} current={os === 'ios'}     steps={[t('landing.install.iosStep1'), t('landing.install.iosStep2'), t('landing.install.iosStep3')]} iosHint={showIOSHint} onIosHint={() => setShowIOSHint(true)} installed={installed && os === 'ios'} />
            <OSCard t={t} os="android" icon="🤖" label="Android"      current={os === 'android'} steps={[t('landing.install.androidStep1'), t('landing.install.androidStep2'), t('landing.install.androidStep3')]} installAction={canPrompt && os === 'android' ? () => triggerInstall() : null} installed={installed && os === 'android'} />
            <OSCard t={t} os="win"     icon="🪟" label="Windows"      current={os === 'windows'} steps={[t('landing.install.winStep1'), t('landing.install.winStep2'), t('landing.install.winStep3')]} installAction={canPrompt && os === 'windows' ? () => triggerInstall() : null} installed={installed && os === 'windows'} />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className={`${styles.ctaSection} ${ctaInView ? styles.inView : ''}`}
        ref={ctaRef}
      >
        <div className={styles.ctaInner}>
          <div className={styles.ctaEyebrow}>{t('landing.cta.eyebrow')}</div>
          <h2 className={styles.ctaH2}>{t('landing.cta.h2')}</h2>
          <p className={styles.ctaSub}>{t('landing.cta.sub')}</p>
          <button className={styles.btnPrimary} onClick={handleOpen} style={{ fontSize: 15, padding: '10px 28px', height: 42 }}>
            {t('landing.cta.button')}
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.brand}>
            <KugiMark size="sm" />
          </div>
          <div className={styles.footerLinks}>
            <a href="https://github.com/emmi-dev12/Kugi" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
            <a href="https://github.com/emmi-dev12/Kugi/releases" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{t('landing.footer.releases')}</a>
            <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Convex</a>
          </div>
          <span className={styles.footerMeta}>{t('landing.footer.meta')}</span>
        </div>
      </footer>

    </div>
  );
}

/* ─── sub-components ─── */

function OSCard({ t, icon, label, current, installed, steps, installAction, iosHint, onIosHint }) {
  return (
    <div className={`${styles.osCard} ${current ? styles.osCardCurrent : ''} ${installed ? styles.osCardDone : ''}`}>
      <div className={styles.osCardTop}>
        <span className={styles.osIcon}>{icon}</span>
        <div>
          <div className={styles.osLabel}>{label}</div>
          {current && <div className={styles.osCurrentTag}>{t('landing.install.yourDevice')}</div>}
        </div>
      </div>
      <ol className={styles.osSteps}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <div className={styles.osAction}>
        {installed ? (
          <span className={styles.installedChip}><CheckIcon /> {t('landing.installed')}</span>
        ) : installAction ? (
          <button className={styles.btnOutline} style={{ width: '100%' }} onClick={installAction}>
            <DownloadIcon /> {t('landing.install.install')}
          </button>
        ) : onIosHint ? (
          iosHint ? (
            <div className={styles.iosHintBox}>
              <div className={styles.iosHintStep}><span>1</span> {t('landing.install.iosHint1Prefix')} <strong>Safari</strong></div>
              <div className={styles.iosHintStep}><span>2</span> {t('landing.install.iosHint2Prefix')} <strong>{t('landing.install.share')}</strong> {t('landing.install.iosHint2Suffix')}</div>
            </div>
          ) : (
            <button className={styles.btnOutline} style={{ width: '100%' }} onClick={onIosHint}>{t('landing.install.howToInstall')}</button>
          )
        ) : (
          <span className={styles.osHint}>{t('landing.install.openInChrome')}</span>
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

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 6.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="7" cy="4.5" r="0.7" fill="currentColor"/>
    </svg>
  );
}
