import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntegrations, useTelegram, usePushEnabled, useSendblue, useTelegramChannelEnabled } from '../../hooks/useDB';
import { allTimezones } from '../../utils/timezone';
import { SUPPORTED_LANGUAGES } from '../../utils/language';
import styles from './SettingsModal.module.css';

const REMINDER_OFFSETS = [5, 10, 15, 20, 30, 45, 60, 120, 180, 360, 720, 1440, 2880, 4320];
const SHORT_OFFSETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

export default function SettingsModal({ open, ...props }) {
  if (!open) return null;
  return <SettingsModalContent {...props} />;
}

function SettingsModalContent({
  onClose,
  // Notifications
  permission,
  pushActive,
  reminders,
  onRequestPermission,
  onDisablePush,
  onAddReminder,
  onUpdateReminder,
  onRemoveReminder,
  // Timezone
  timezone,
  onTimezoneChange,
  // Language
  language,
  onLanguageChange,
  // API key
  apiKey,
  apiKeyVisible,
  onToggleApiKeyVisible,
  onCopyApiKey,
  onRotateApiKey,
  onChangeConvexUrl,
  // Categories
  categories,
  customCategories,
  CategoryManager,
  onAddCategory,
  onRemoveCategory,
  onEditCategory,
}) {
  const { t } = useTranslation();
  const {
    composioKey,
    setComposioApiKey,
    gcalEnabled,
    setGcalEnabled,
    triggerGcalSync,
    fetchFromGoogle,
    pushToGoogle,
    getSyncDiff,
    deleteGcalEvents,
  } = useIntegrations();
  const { config: telegramConfig, setConfig: setTelegramConfig } = useTelegram();
  const { telegramChannelEnabled, setTelegramChannelEnabled } = useTelegramChannelEnabled();
  const { config: sendblueConfig, setConfig: setSendblueConfig } = useSendblue();
  const { pushEnabled, setPushEnabled } = usePushEnabled();
  const [composioInput, setComposioInput] = useState('');
  const [composioSaving, setComposioSaving] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pushing, setPushing] = useState(false);
  // Sync diff confirmation state
  const [syncDiff, setSyncDiff] = useState(null); // { orphanedOnKugi, orphanedOnGcal, newOnKugi, mode }
  const [selectedKugiDeletes, setSelectedKugiDeletes] = useState(new Set());
  const [selectedGcalDeletes, setSelectedGcalDeletes] = useState(new Set());
  const [telegramInput, setTelegramInput] = useState({ botToken: '', chatId: '' });
  const [telegramOffset, setTelegramOffset] = useState('15');
  const [reminderOffsets, setReminderOffsets] = useState(null); // null = use server value
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [tgWebhookStatus, setTgWebhookStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [tgWebhookMsg, setTgWebhookMsg] = useState('');
  const [sendblueInput, setSendblueInput] = useState({ apiKey: '', apiSecret: '', recipient: '' });
  const [sendblueReminderOffsets, setSendblueReminderOffsets] = useState(null); // null = use server value
  const [tab, setTab] = useState('general');

  const TABS = [
    { id: 'general', label: t('settings.tabs.general') },
    { id: 'notifications', label: t('settings.tabs.notifications') },
    { id: 'categories', label: t('settings.tabs.categories') },
    { id: 'integrations', label: t('settings.tabs.integrations') },
    { id: 'developer', label: t('settings.tabs.developer') },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('settings.title')}</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.tabs}>
          {TABS.map(tabItem => (
            <button
              key={tabItem.id}
              className={`${styles.tab} ${tab === tabItem.id ? styles.tabActive : ''}`}
              onClick={() => setTab(tabItem.id)}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>

          {/* ── General ── */}
          {tab === 'general' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>{t('settings.general.timezoneTitle')}</span>
                  <span className={styles.rowHint}>{t('settings.general.timezoneHint')}</span>
                </div>
                <select
                  className={styles.select}
                  value={timezone}
                  onChange={e => onTimezoneChange(e.target.value)}
                >
                  {allTimezones().map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>{t('settings.general.languageTitle')}</span>
                  <span className={styles.rowHint}>{t('settings.general.languageHint')}</span>
                </div>
                <select
                  className={styles.select}
                  value={language ?? 'auto'}
                  onChange={e => onLanguageChange(e.target.value === 'auto' ? null : e.target.value)}
                >
                  <option value="auto">{t('settings.general.languageAuto')}</option>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{t(`settings.general.language${lang === 'en' ? 'En' : 'De'}`)}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 'notifications' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>{t('settings.notifications.pushTitle')}</span>
                  <span className={styles.rowHint}>{t('settings.notifications.pushHint')}</span>
                </div>
                <button
                  className={`${styles.toggle} ${pushEnabled ? styles.toggleOn : ''}`}
                  onClick={() => setPushEnabled({ enabled: !pushEnabled })}
                  title={pushEnabled ? t('settings.notifications.pushDisableTitle') : t('settings.notifications.pushEnableTitle')}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>

              {pushEnabled && <>
              {permission === 'unsupported' && (
                <p className={styles.hint}>{t('settings.notifications.unsupported')}</p>
              )}
              {permission === 'denied' && (
                <p className={styles.hint}>{t('settings.notifications.blocked')}</p>
              )}
              {permission !== 'unsupported' && permission !== 'denied' && permission !== 'granted' && (
                <button className={styles.enableBtn} onClick={onRequestPermission}>
                  {t('settings.notifications.enableBtn')}
                </button>
              )}
              {permission === 'granted' && (
                <>
                  <div className={pushActive ? styles.pushOn : styles.pushOff}>
                    <span>{pushActive ? '🔔' : '🔕'}</span>
                    <span>{pushActive ? t('settings.notifications.serverActive') : t('settings.notifications.serverInactive')}</span>
                    {!pushActive && (
                      <button className={styles.textBtn} onClick={onRequestPermission}>{t('settings.notifications.reEnable')}</button>
                    )}
                    {pushActive && (
                      <button className={styles.pushDisable} onClick={onDisablePush} title={t('settings.notifications.disablePushTitle')}>✕</button>
                    )}
                  </div>

                  <div className={styles.reminderList}>
                    {reminders.map(r => {
                      const isDayScale = r.offsetMinutes >= 1440;
                      return (
                        <div key={r.id} className={styles.reminderCard}>
                          <div className={styles.reminderRow}>
                            <select
                              className={styles.reminderSelect}
                              value={r.offsetMinutes}
                              onChange={e => onUpdateReminder(r.id, { offsetMinutes: Number(e.target.value) })}
                            >
                              {REMINDER_OFFSETS.map(v => (
                                <option key={v} value={v}>{t(`settings.offsetLabels.${v}`)}</option>
                              ))}
                            </select>
                            <button className={styles.reminderDelete} onClick={() => onRemoveReminder(r.id)}>✕</button>
                          </div>
                          {isDayScale && (
                            <div className={styles.reminderRow}>
                              <span className={styles.atLabel}>{t('settings.notifications.at')}</span>
                              <input
                                type="time"
                                className={styles.timeInput}
                                value={r.atTime || '09:00'}
                                onChange={e => onUpdateReminder(r.id, { atTime: e.target.value })}
                              />
                            </div>
                          )}
                          <input
                            className={styles.msgInput}
                            placeholder={t('settings.notifications.messagePlaceholder')}
                            value={r.message || ''}
                            onChange={e => onUpdateReminder(r.id, { message: e.target.value })}
                          />
                        </div>
                      );
                    })}
                    {reminders.length < 3 && (
                      <button className={styles.addBtn} onClick={onAddReminder}>{t('settings.notifications.addReminder')}</button>
                    )}
                  </div>
                </>
              )}
              </>}
            </div>
          )}

          {/* ── Categories ── */}
          {tab === 'categories' && (
            <div className={styles.section}>
              <CategoryManager
                categories={categories}
                customCategories={customCategories}
                onAdd={onAddCategory}
                onRemove={onRemoveCategory}
                onEdit={onEditCategory}
              />
            </div>
          )}

          {/* ── Integrations ── */}
          {tab === 'integrations' && (
            <div className={styles.section}>

              {/* Composio API key — shared for all integrations */}
              <div className={styles.composioSection}>
                <div className={styles.rowLabel} style={{ marginBottom: 8 }}>
                  <span className={styles.rowTitle}>{t('settings.integrations.composio.title')}</span>
                  <span className={styles.rowHint}>
                    {t('settings.integrations.composio.hintPrefix')}{' '}
                    <a href="https://composio.dev" target="_blank" rel="noreferrer" className={styles.link}>
                      Composio
                    </a>
                    . {t('settings.integrations.composio.hintSuffix')}
                  </span>
                </div>
                {composioKey ? (
                  <div className={styles.connectedRow}>
                    <span className={styles.connectedDot} />
                    <span className={styles.connectedLabel}>{t('settings.integrations.composio.connected')}</span>
                    <button
                      className={styles.disconnectBtn}
                      onClick={() => { if (confirm(t('settings.integrations.composio.disconnectConfirm'))) setComposioApiKey({ value: '' }); }}
                    >
                      {t('common.disconnect')}
                    </button>
                  </div>
                ) : (
                  <form
                    className={styles.keyForm}
                    onSubmit={async e => {
                      e.preventDefault();
                      if (!composioInput.trim()) return;
                      setComposioSaving(true);
                      try { await setComposioApiKey({ value: composioInput.trim() }); setComposioInput(''); }
                      catch (err) { alert(t('settings.integrations.composio.saveFailed', { error: err.message })); }
                      setComposioSaving(false);
                    }}
                  >
                    <input
                      className={styles.keyInput}
                      type="password"
                      placeholder={t('settings.integrations.composio.keyPlaceholder')}
                      value={composioInput}
                      onChange={e => setComposioInput(e.target.value)}
                    />
                    <button type="submit" className={styles.saveBtn} disabled={composioSaving}>
                      {composioSaving ? t('common.saving') : t('common.connect')}
                    </button>
                  </form>
                )}
              </div>

              {/* Integration cards — only shown when Composio is connected */}
              {composioKey && (
                <div className={styles.integrationsList}>

                  {/* Google Calendar card */}
                  <div className={styles.integrationCard}>
                    <div className={styles.integrationCardHeader}>
                      <div className={styles.rowLabel}>
                        <span className={styles.rowTitle}>{t('settings.integrations.gcal.title')}</span>
                        <span className={styles.rowHint}>{t('settings.integrations.gcal.hint')}</span>
                      </div>
                      <button
                        className={`${styles.toggle} ${gcalEnabled ? styles.toggleOn : ''}`}
                        onClick={() => setGcalEnabled(!gcalEnabled)}
                        title={gcalEnabled ? t('settings.integrations.gcal.disable') : t('settings.integrations.gcal.enable')}
                      >
                        <span className={styles.toggleThumb} />
                      </button>
                    </div>
                    {gcalEnabled && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className={styles.syncBtn}
                          disabled={fetching || pushing}
                          onClick={async () => {
                            setFetching(true);
                            try {
                              const diff = await getSyncDiff();
                              const hasOrphans = diff.orphanedOnKugi.length > 0 || diff.orphanedOnGcal.length > 0;
                              if (hasOrphans) {
                                setSyncDiff({ ...diff, mode: 'fetch' });
                                setSelectedKugiDeletes(new Set(diff.orphanedOnKugi.map(b => b.kugiId)));
                                setSelectedGcalDeletes(new Set());
                              } else {
                                await fetchFromGoogle();
                              }
                            } catch (e) { alert(t('settings.integrations.gcal.fetchFailed', { error: e.message })); }
                            setFetching(false);
                          }}
                        >
                          {fetching ? t('settings.integrations.gcal.checking') : t('settings.integrations.gcal.fetch')}
                        </button>
                        <button
                          className={styles.syncBtn}
                          disabled={pushing || fetching}
                          onClick={async () => {
                            setPushing(true);
                            try {
                              const diff = await getSyncDiff();
                              const hasOrphans = diff.orphanedOnKugi.length > 0 || diff.orphanedOnGcal.length > 0;
                              if (hasOrphans) {
                                setSyncDiff({ ...diff, mode: 'push' });
                                setSelectedKugiDeletes(new Set());
                                setSelectedGcalDeletes(new Set(diff.orphanedOnGcal.map(e => e.gcalId)));
                              } else {
                                await pushToGoogle();
                              }
                            } catch (e) { alert(t('settings.integrations.gcal.pushFailed', { error: e.message })); }
                            setPushing(false);
                          }}
                        >
                          {pushing ? t('settings.integrations.gcal.checking') : t('settings.integrations.gcal.push')}
                        </button>
                      </div>
                    )}

                    {/* Sync diff confirmation dialog */}
                    {syncDiff && (
                      <div className={styles.syncDiffBox}>
                        <div className={styles.syncDiffTitle}>{t('settings.integrations.gcal.reviewTitle')}</div>

                        {syncDiff.orphanedOnKugi.length > 0 && (
                          <div className={styles.syncDiffSection}>
                            <div className={styles.syncDiffSectionHeader}>
                              <span>{t('settings.integrations.gcal.orphanedKugiPrompt')}</span>
                            </div>
                            {syncDiff.orphanedOnKugi.map(b => (
                              <label key={b.kugiId} className={styles.syncDiffRow}>
                                <input
                                  type="checkbox"
                                  checked={selectedKugiDeletes.has(b.kugiId)}
                                  onChange={e => {
                                    setSelectedKugiDeletes(prev => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(b.kugiId); else next.delete(b.kugiId);
                                      return next;
                                    });
                                  }}
                                />
                                <span>{b.emoji || '📦'} {b.title}</span>
                                <span className={styles.syncDiffDate}>{b.date}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {syncDiff.orphanedOnGcal.length > 0 && (
                          <div className={styles.syncDiffSection}>
                            <div className={styles.syncDiffSectionHeader}>
                              <span>{t('settings.integrations.gcal.orphanedGcalPrompt')}</span>
                            </div>
                            {syncDiff.orphanedOnGcal.map(e => (
                              <label key={e.gcalId} className={styles.syncDiffRow}>
                                <input
                                  type="checkbox"
                                  checked={selectedGcalDeletes.has(e.gcalId)}
                                  onChange={ev => {
                                    setSelectedGcalDeletes(prev => {
                                      const next = new Set(prev);
                                      if (ev.target.checked) next.add(e.gcalId); else next.delete(e.gcalId);
                                      return next;
                                    });
                                  }}
                                />
                                <span>📅 {e.title}</span>
                                <span className={styles.syncDiffDate}>{e.date}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        <div className={styles.syncDiffActions}>
                          <button className={styles.syncDiffCancel} onClick={() => setSyncDiff(null)}>{t('common.cancel')}</button>
                          <button
                            className={styles.syncDiffConfirm}
                            onClick={async () => {
                              const mode = syncDiff.mode;
                              setSyncDiff(null);
                              if (mode === 'fetch') setFetching(true); else setPushing(true);
                              try {
                                // Fetch new GCal events into Kugi, deleting only user-confirmed Kugi orphans
                                await fetchFromGoogle({ deleteKugiIds: [...selectedKugiDeletes] });
                                // Delete user-confirmed GCal orphans
                                if (selectedGcalDeletes.size > 0) {
                                  await deleteGcalEvents({ gcalIds: [...selectedGcalDeletes] });
                                }
                                // If this was a Push, also push new Kugi blocks to GCal
                                if (mode === 'push') await pushToGoogle();
                              } catch (e) { alert(t('settings.integrations.gcal.syncFailed', { error: e.message })); }
                              if (mode === 'fetch') setFetching(false); else setPushing(false);
                            }}
                          >
                            {t('settings.integrations.gcal.confirmSync')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Telegram card */}
                  <div className={styles.integrationCard}>
                    <div className={styles.integrationCardHeader}>
                      <div className={styles.rowLabel}>
                        <span className={styles.rowTitle}>{t('settings.integrations.telegram.title')}</span>
                        <span className={styles.rowHint}>{t('settings.integrations.telegram.hint')}</span>
                      </div>
                      {telegramConfig?.botToken && telegramConfig?.chatId && (
                        <button
                          className={`${styles.toggle} ${telegramChannelEnabled ? styles.toggleOn : ''}`}
                          onClick={() => setTelegramChannelEnabled(!telegramChannelEnabled)}
                          title={telegramChannelEnabled ? t('settings.integrations.telegram.disableTitle') : t('settings.integrations.telegram.enableTitle')}
                        >
                          <span className={styles.toggleThumb} />
                        </button>
                      )}
                    </div>
                    {telegramConfig?.botToken && telegramConfig?.chatId ? (
                      <>
                        <div className={styles.connectedRow}>
                          <span className={styles.connectedDot} />
                          <span className={styles.connectedLabel}>{t('settings.integrations.telegram.connected')}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                            {telegramConfig.botToken.slice(0, 8)}…
                          </span>
                          <button
                            className={styles.disconnectBtn}
                            onClick={() => { if (confirm(t('settings.integrations.telegram.disconnectConfirm'))) setTelegramConfig({ botToken: '', chatId: '', offsetMinutes: 15, reminderOffsets: [], webhookUrl: '' }); }}
                          >
                            {t('common.disconnect')}
                          </button>
                        </div>
                        {/* Multi-reminder offsets */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            {t('settings.integrations.telegram.remindMe')}
                          </span>
                          {(() => {
                            const active = reminderOffsets ?? telegramConfig.reminderOffsets ?? [telegramConfig.offsetMinutes ?? 15];
                            const save = (next) => {
                              setReminderOffsets(next);
                              setTelegramConfig({ botToken: telegramConfig.botToken, chatId: telegramConfig.chatId, offsetMinutes: next[0] ?? 15, reminderOffsets: next, webhookUrl: telegramConfig.webhookUrl ?? '' });
                            };
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {active.map((val, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <select
                                      className={styles.select}
                                      style={{ flex: 1 }}
                                      value={val}
                                      onChange={e => {
                                        const next = [...active];
                                        next[i] = Number(e.target.value);
                                        save(next);
                                      }}
                                    >
                                      {SHORT_OFFSETS.map(v => <option key={v} value={v}>{t('settings.before', { label: t(`settings.offsetShort.${v}`) })}</option>)}
                                    </select>
                                    <button
                                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                                      onClick={() => save(active.filter((_, j) => j !== i))}
                                    >×</button>
                                  </div>
                                ))}
                                {active.length < 4 && (
                                  <button
                                    className={styles.disconnectBtn}
                                    style={{ alignSelf: 'flex-start', marginTop: 2 }}
                                    onClick={() => save([...active, 15])}
                                  >{t('settings.integrations.telegram.addReminder')}</button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {/* Webhook URL */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            {t('settings.integrations.telegram.webhookUrlLabel')} <span style={{ opacity: 0.6 }}>{t('settings.integrations.telegram.webhookUrlHint')}</span>
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className={styles.keyInput}
                              style={{ flex: 1 }}
                              type="url"
                              placeholder={t('settings.integrations.telegram.webhookUrlPlaceholder')}
                              value={webhookUrlInput || telegramConfig.webhookUrl || ''}
                              onChange={e => setWebhookUrlInput(e.target.value)}
                              onBlur={e => {
                                const url = e.target.value.trim();
                                setTelegramConfig({ botToken: telegramConfig.botToken, chatId: telegramConfig.chatId, offsetMinutes: telegramConfig.offsetMinutes ?? 15, reminderOffsets: reminderOffsets ?? telegramConfig.reminderOffsets ?? undefined, webhookUrl: url });
                              }}
                            />
                          </div>
                        </div>
                        {/* Interactive buttons — register Telegram bot webhook */}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            {t('settings.integrations.telegram.interactiveButtonsLabel')} <span style={{ opacity: 0.6 }}>{t('settings.integrations.telegram.interactiveButtonsHint')}</span>
                          </span>
                          <button
                            className={styles.saveBtn}
                            style={{ fontSize: 12, padding: '6px 14px' }}
                            disabled={tgWebhookStatus === 'loading'}
                            onClick={async () => {
                              setTgWebhookStatus('loading');
                              setTgWebhookMsg('');
                              try {
                                const convexUrl = localStorage.getItem('kugiConvexUrl') || '';
                                const siteUrl = convexUrl.replace('.convex.cloud', '.convex.site');
                                const res = await fetch(`${siteUrl}/telegram/register-webhook`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${apiKey}` },
                                });
                                const data = await res.json();
                                if (data.ok) {
                                  setTgWebhookStatus('ok');
                                  setTgWebhookMsg(t('settings.integrations.telegram.webhookRegistered'));
                                } else {
                                  setTgWebhookStatus('error');
                                  setTgWebhookMsg(data.error || t('settings.integrations.telegram.registrationFailed'));
                                }
                              } catch (e) {
                                setTgWebhookStatus('error');
                                setTgWebhookMsg(t('settings.integrations.telegram.networkError'));
                              }
                            }}
                          >
                            {tgWebhookStatus === 'loading' ? t('settings.integrations.telegram.registering') : t('settings.integrations.telegram.enableButtons')}
                          </button>
                          {tgWebhookMsg && (
                            <span style={{ fontSize: 11, marginLeft: 8, color: tgWebhookStatus === 'ok' ? '#10b981' : '#ef4444' }}>
                              {tgWebhookMsg}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <form
                        className={styles.telegramForm}
                        onSubmit={async e => {
                          e.preventDefault();
                          if (!telegramInput.botToken.trim() || !telegramInput.chatId.trim()) return;
                          try {
                            await setTelegramConfig({ botToken: telegramInput.botToken.trim(), chatId: telegramInput.chatId.trim(), offsetMinutes: Number(telegramOffset) });
                            setTelegramInput({ botToken: '', chatId: '' });
                          } catch (err) { alert(t('settings.integrations.telegram.saveFailed', { error: err.message })); }
                        }}
                      >
                        <div className={styles.telegramInputGroup}>
                          <input
                            className={styles.keyInput}
                            type="password"
                            placeholder={t('settings.integrations.telegram.botTokenPlaceholder')}
                            value={telegramInput.botToken}
                            onChange={e => setTelegramInput(p => ({ ...p, botToken: e.target.value }))}
                          />
                          <input
                            className={styles.keyInput}
                            type="text"
                            placeholder={t('settings.integrations.telegram.chatIdPlaceholder')}
                            value={telegramInput.chatId}
                            onChange={e => setTelegramInput(p => ({ ...p, chatId: e.target.value }))}
                          />
                        </div>
                        <div className={styles.row} style={{ marginBottom: 8 }}>
                          <span className={styles.rowLabel} style={{ fontSize: 12 }}>{t('settings.integrations.telegram.firstReminder')}</span>
                          <select
                            className={styles.select}
                            value={telegramOffset}
                            onChange={e => setTelegramOffset(e.target.value)}
                          >
                            {[5, 10, 15, 20, 30, 45, 60, 120].map(v => (
                              <option key={v} value={v}>{t(`settings.offsetLabels.${v}`)}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className={styles.saveBtn}>{t('common.connect')}</button>
                      </form>
                    )}
                  </div>

                  {/* iMessage (SendBlue) card */}
                  <div className={styles.integrationCard}>
                    <div className={styles.integrationCardHeader}>
                      <div className={styles.rowLabel}>
                        <span className={styles.rowTitle}>{t('settings.integrations.imessage.title')}</span>
                        <span className={styles.rowHint}>
                          {t('settings.integrations.imessage.hintPrefix')}{' '}
                          <a href="https://sendblue.co" target="_blank" rel="noreferrer" className={styles.link}>SendBlue</a>.
                          {' '}{t('settings.integrations.imessage.hintSuffix')}
                        </span>
                      </div>
                      {sendblueConfig?.apiKey && sendblueConfig?.recipient && (
                        <button
                          className={`${styles.toggle} ${sendblueConfig.channelEnabled ? styles.toggleOn : ''}`}
                          onClick={() => setSendblueConfig({
                            apiKey: sendblueConfig.apiKey,
                            apiSecret: sendblueConfig.apiSecret,
                            recipient: sendblueConfig.recipient,
                            channelEnabled: !sendblueConfig.channelEnabled,
                          })}
                          title={sendblueConfig.channelEnabled ? t('settings.integrations.imessage.disableTitle') : t('settings.integrations.imessage.enableTitle')}
                        >
                          <span className={styles.toggleThumb} />
                        </button>
                      )}
                    </div>
                    {sendblueConfig?.apiKey && sendblueConfig?.recipient ? (
                      <>
                        <div className={styles.connectedRow}>
                          <span className={styles.connectedDot} />
                          <span className={styles.connectedLabel}>{t('settings.integrations.imessage.connected')}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                            {sendblueConfig.recipient}
                          </span>
                          <button
                            className={styles.disconnectBtn}
                            onClick={() => { if (confirm(t('settings.integrations.imessage.disconnectConfirm'))) setSendblueConfig({ apiKey: '', apiSecret: '', recipient: '' }); }}
                          >
                            {t('common.disconnect')}
                          </button>
                        </div>
                        {/* Multi-reminder offsets */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            {t('settings.integrations.imessage.remindMe')}
                          </span>
                          {(() => {
                            const active = sendblueReminderOffsets ?? sendblueConfig.reminderOffsets ?? [15];
                            const save = (next) => {
                              setSendblueReminderOffsets(next);
                              setSendblueConfig({
                                apiKey: sendblueConfig.apiKey,
                                apiSecret: sendblueConfig.apiSecret,
                                recipient: sendblueConfig.recipient,
                                reminderOffsets: next,
                              });
                            };
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {active.map((val, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <select
                                      className={styles.select}
                                      style={{ flex: 1 }}
                                      value={val}
                                      onChange={e => {
                                        const next = [...active];
                                        next[i] = Number(e.target.value);
                                        save(next);
                                      }}
                                    >
                                      {SHORT_OFFSETS.map(v => <option key={v} value={v}>{t('settings.before', { label: t(`settings.offsetShort.${v}`) })}</option>)}
                                    </select>
                                    <button
                                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                                      onClick={() => save(active.filter((_, j) => j !== i))}
                                    >×</button>
                                  </div>
                                ))}
                                {active.length < 4 && (
                                  <button
                                    className={styles.disconnectBtn}
                                    style={{ alignSelf: 'flex-start', marginTop: 2 }}
                                    onClick={() => save([...active, 15])}
                                  >{t('settings.integrations.imessage.addReminder')}</button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </>
                    ) : (
                      <form
                        className={styles.telegramForm}
                        onSubmit={async e => {
                          e.preventDefault();
                          const { apiKey, apiSecret, recipient } = sendblueInput;
                          if (!apiKey.trim() || !apiSecret.trim() || !recipient.trim()) return;
                          try {
                            await setSendblueConfig({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), recipient: recipient.trim(), channelEnabled: true });
                            setSendblueInput({ apiKey: '', apiSecret: '', recipient: '' });
                          } catch (err) { alert(t('settings.integrations.imessage.saveFailed', { error: err.message })); }
                        }}
                      >
                        <div className={styles.telegramInputGroup}>
                          <input
                            className={styles.keyInput}
                            type="password"
                            placeholder={t('settings.integrations.imessage.apiKeyPlaceholder')}
                            value={sendblueInput.apiKey}
                            onChange={e => setSendblueInput(p => ({ ...p, apiKey: e.target.value }))}
                          />
                          <input
                            className={styles.keyInput}
                            type="password"
                            placeholder={t('settings.integrations.imessage.apiSecretPlaceholder')}
                            value={sendblueInput.apiSecret}
                            onChange={e => setSendblueInput(p => ({ ...p, apiSecret: e.target.value }))}
                          />
                          <input
                            className={styles.keyInput}
                            type="tel"
                            placeholder={t('settings.integrations.imessage.recipientPlaceholder')}
                            value={sendblueInput.recipient}
                            onChange={e => setSendblueInput(p => ({ ...p, recipient: e.target.value }))}
                          />
                        </div>
                        <button type="submit" className={styles.saveBtn}>{t('common.connect')}</button>
                      </form>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ── Developer ── */}
          {tab === 'developer' && (
            <div className={styles.section}>
              <div className={styles.rowLabel} style={{ marginBottom: 10 }}>
                <span className={styles.rowTitle}>{t('settings.developer.apiKeyTitle')}</span>
                <span className={styles.rowHint}>{t('settings.developer.apiKeyHint')} <code>Authorization: Bearer &lt;key&gt;</code></span>
              </div>
              <div className={styles.apiBox}>
                <code className={styles.apiKey}>
                  {apiKey === undefined ? t('common.loading')
                    : apiKey === null ? t('settings.developer.generating')
                    : apiKeyVisible ? apiKey : '••••••••••••••••'}
                </code>
                {apiKey && (
                  <>
                    <button className={styles.iconBtn} title={apiKeyVisible ? t('settings.developer.hideKey') : t('settings.developer.showKey')} onClick={onToggleApiKeyVisible}>
                      {apiKeyVisible ? '🙈' : '👁'}
                    </button>
                    <button className={styles.iconBtn} title={t('settings.developer.copyKey')} onClick={onCopyApiKey}>⎘</button>
                    <button className={styles.iconBtn} title={t('settings.developer.rotateKey')} onClick={onRotateApiKey}>↺</button>
                  </>
                )}
              </div>
              <button className={styles.changeUrlBtn} onClick={onChangeConvexUrl}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6a5 5 0 0 1 9.5-2M11 6a5 5 0 0 1-9.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M9 1.5l1.5 2.5-2.5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('settings.developer.changeUrl')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
