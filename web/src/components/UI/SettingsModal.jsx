import { useState } from 'react';
import { useIntegrations, useTelegram, usePushEnabled } from '../../hooks/useDB';
import { allTimezones } from '../../utils/timezone';
import styles from './SettingsModal.module.css';

export default function SettingsModal({
  open,
  onClose,
  // Appearance
  theme,
  onToggleTheme,
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
  const {
    composioKey,
    setComposioApiKey,
    gcalEnabled,
    setGcalEnabled,
    triggerGcalSync,
    fetchFromGoogle,
    pushToGoogle,
  } = useIntegrations();
  const { config: telegramConfig, setConfig: setTelegramConfig } = useTelegram();
  const { pushEnabled, setPushEnabled } = usePushEnabled();
  const [composioInput, setComposioInput] = useState('');
  const [composioSaving, setComposioSaving] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [telegramInput, setTelegramInput] = useState({ botToken: '', chatId: '' });
  const [telegramOffset, setTelegramOffset] = useState('15');
  const [tab, setTab] = useState('general');

  if (!open) return null;

  const TABS = [
    { id: 'general', label: 'General' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'categories', label: 'Categories' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'developer', label: 'Developer' },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>

          {/* ── General ── */}
          {tab === 'general' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>Appearance</span>
                  <span className={styles.rowHint}>Switch between dark and light mode</span>
                </div>
                <button className={styles.pill} onClick={onToggleTheme}>
                  {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>

              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>Timezone</span>
                  <span className={styles.rowHint}>Used for reminders and display</span>
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
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 'notifications' && (
            <div className={styles.section}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>
                  <span className={styles.rowTitle}>Push notifications</span>
                  <span className={styles.rowHint}>Enable or disable all push notifications</span>
                </div>
                <button
                  className={`${styles.toggle} ${pushEnabled ? styles.toggleOn : ''}`}
                  onClick={() => setPushEnabled({ enabled: !pushEnabled })}
                  title={pushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </div>

              {pushEnabled && <>
              {permission === 'unsupported' && (
                <p className={styles.hint}>Push notifications aren't supported in this browser.</p>
              )}
              {permission === 'denied' && (
                <p className={styles.hint}>Notifications are blocked — enable them in your browser settings, then reload.</p>
              )}
              {permission !== 'unsupported' && permission !== 'denied' && permission !== 'granted' && (
                <button className={styles.enableBtn} onClick={onRequestPermission}>
                  Enable push notifications
                </button>
              )}
              {permission === 'granted' && (
                <>
                  <div className={pushActive ? styles.pushOn : styles.pushOff}>
                    <span>{pushActive ? '🔔' : '🔕'}</span>
                    <span>{pushActive ? 'Push server active' : 'Push server inactive'}</span>
                    {!pushActive && (
                      <button className={styles.textBtn} onClick={onRequestPermission}>re-enable</button>
                    )}
                    {pushActive && (
                      <button className={styles.pushDisable} onClick={onDisablePush} title="Disable push">✕</button>
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
                              {[
                                [5, '5 min before'], [10, '10 min before'], [15, '15 min before'],
                                [20, '20 min before'], [30, '30 min before'], [45, '45 min before'],
                                [60, '1 hour before'], [120, '2 hours before'], [180, '3 hours before'],
                                [360, '6 hours before'], [720, '12 hours before'],
                                [1440, '1 day before'], [2880, '2 days before'], [4320, '3 days before'],
                              ].map(([v, label]) => (
                                <option key={v} value={v}>{label}</option>
                              ))}
                            </select>
                            <button className={styles.reminderDelete} onClick={() => onRemoveReminder(r.id)}>✕</button>
                          </div>
                          {isDayScale && (
                            <div className={styles.reminderRow}>
                              <span className={styles.atLabel}>at</span>
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
                            placeholder="Custom message (optional)"
                            value={r.message || ''}
                            onChange={e => onUpdateReminder(r.id, { message: e.target.value })}
                          />
                        </div>
                      );
                    })}
                    {reminders.length < 3 && (
                      <button className={styles.addBtn} onClick={onAddReminder}>+ Add reminder</button>
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
                  <span className={styles.rowTitle}>Composio</span>
                  <span className={styles.rowHint}>
                    Powered by{' '}
                    <a href="https://composio.dev" target="_blank" rel="noreferrer" className={styles.link}>
                      Composio
                    </a>
                    . Create a free account, then paste your API key to enable integrations.
                  </span>
                </div>
                {composioKey ? (
                  <div className={styles.connectedRow}>
                    <span className={styles.connectedDot} />
                    <span className={styles.connectedLabel}>Connected to Composio</span>
                    <button
                      className={styles.disconnectBtn}
                      onClick={() => { if (confirm('Disconnect Composio? This will disable all integrations.')) setComposioApiKey({ value: '' }); }}
                    >
                      Disconnect
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
                      catch (err) { alert('Failed to save: ' + err.message); }
                      setComposioSaving(false);
                    }}
                  >
                    <input
                      className={styles.keyInput}
                      type="password"
                      placeholder="Paste your Composio API key…"
                      value={composioInput}
                      onChange={e => setComposioInput(e.target.value)}
                    />
                    <button type="submit" className={styles.saveBtn} disabled={composioSaving}>
                      {composioSaving ? 'Saving…' : 'Connect'}
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
                        <span className={styles.rowTitle}>Google Calendar</span>
                        <span className={styles.rowHint}>Sync blocks with your Google Calendar.</span>
                      </div>
                      <button
                        className={`${styles.toggle} ${gcalEnabled ? styles.toggleOn : ''}`}
                        onClick={() => setGcalEnabled(!gcalEnabled)}
                        title={gcalEnabled ? 'Disable' : 'Enable'}
                      >
                        <span className={styles.toggleThumb} />
                      </button>
                    </div>
                    {gcalEnabled && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className={styles.syncBtn}
                          disabled={fetching}
                          onClick={async () => {
                            setFetching(true);
                            try { await fetchFromGoogle(); } catch (e) { alert('Fetch failed: ' + e.message); }
                            setFetching(false);
                          }}
                        >
                          {fetching ? 'Fetching…' : '↓ Fetch'}
                        </button>
                        <button
                          className={styles.syncBtn}
                          disabled={pushing}
                          onClick={async () => {
                            setPushing(true);
                            try { await pushToGoogle(); } catch (e) { alert('Push failed: ' + e.message); }
                            setPushing(false);
                          }}
                        >
                          {pushing ? 'Pushing…' : '↑ Push'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Telegram card */}
                  <div className={styles.integrationCard}>
                    <div className={styles.integrationCardHeader}>
                      <div className={styles.rowLabel}>
                        <span className={styles.rowTitle}>Telegram</span>
                        <span className={styles.rowHint}>Send block reminders via Telegram bot before start time.</span>
                      </div>
                    </div>
                    {telegramConfig?.botToken && telegramConfig?.chatId ? (
                      <>
                        <div className={styles.connectedRow}>
                          <span className={styles.connectedDot} />
                          <span className={styles.connectedLabel}>Connected</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                            {telegramConfig.botToken.slice(0, 8)}…
                          </span>
                          <button
                            className={styles.disconnectBtn}
                            onClick={() => { if (confirm('Disconnect Telegram?')) setTelegramConfig({ botToken: '', chatId: '', offsetMinutes: 15 }); }}
                          >
                            Disconnect
                          </button>
                        </div>
                        <div className={styles.row} style={{ marginTop: 8 }}>
                          <span className={styles.rowLabel} style={{ fontSize: 12 }}>Remind me</span>
                          <select
                            className={styles.select}
                            value={telegramConfig.offsetMinutes ?? 15}
                            onChange={e => setTelegramConfig({ botToken: telegramConfig.botToken, chatId: telegramConfig.chatId, offsetMinutes: Number(e.target.value) })}
                          >
                            {[[5,'5 min before'],[10,'10 min before'],[15,'15 min before'],[20,'20 min before'],[30,'30 min before'],[45,'45 min before'],[60,'1 hour before'],[120,'2 hours before']].map(([v, label]) => (
                              <option key={v} value={v}>{label}</option>
                            ))}
                          </select>
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
                          } catch (err) { alert('Failed to save: ' + err.message); }
                        }}
                      >
                        <div className={styles.telegramInputGroup}>
                          <input
                            className={styles.keyInput}
                            type="password"
                            placeholder="Bot token from @BotFather"
                            value={telegramInput.botToken}
                            onChange={e => setTelegramInput(p => ({ ...p, botToken: e.target.value }))}
                          />
                          <input
                            className={styles.keyInput}
                            type="text"
                            placeholder="Chat ID from @userinfobot"
                            value={telegramInput.chatId}
                            onChange={e => setTelegramInput(p => ({ ...p, chatId: e.target.value }))}
                          />
                        </div>
                        <div className={styles.row} style={{ marginBottom: 8 }}>
                          <span className={styles.rowLabel} style={{ fontSize: 12 }}>Remind me</span>
                          <select
                            className={styles.select}
                            value={telegramOffset}
                            onChange={e => setTelegramOffset(e.target.value)}
                          >
                            {[[5,'5 min before'],[10,'10 min before'],[15,'15 min before'],[20,'20 min before'],[30,'30 min before'],[45,'45 min before'],[60,'1 hour before'],[120,'2 hours before']].map(([v, label]) => (
                              <option key={v} value={v}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className={styles.saveBtn}>Connect</button>
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
                <span className={styles.rowTitle}>API Key</span>
                <span className={styles.rowHint}>Use with <code>Authorization: Bearer &lt;key&gt;</code></span>
              </div>
              <div className={styles.apiBox}>
                <code className={styles.apiKey}>
                  {apiKey === undefined ? 'loading…'
                    : apiKey === null ? 'generating…'
                    : apiKeyVisible ? apiKey : '••••••••••••••••'}
                </code>
                {apiKey && (
                  <>
                    <button className={styles.iconBtn} title={apiKeyVisible ? 'Hide' : 'Show'} onClick={onToggleApiKeyVisible}>
                      {apiKeyVisible ? '🙈' : '👁'}
                    </button>
                    <button className={styles.iconBtn} title="Copy" onClick={onCopyApiKey}>⎘</button>
                    <button className={styles.iconBtn} title="Rotate" onClick={onRotateApiKey}>↺</button>
                  </>
                )}
              </div>
              <button className={styles.changeUrlBtn} onClick={onChangeConvexUrl}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6a5 5 0 0 1 9.5-2M11 6a5 5 0 0 1-9.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M9 1.5l1.5 2.5-2.5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Change Convex URL
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
