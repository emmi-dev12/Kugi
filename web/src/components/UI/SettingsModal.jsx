import { useState } from 'react';
import { useIntegrations, useTelegram, usePushEnabled, useSendblue, useTelegramChannelEnabled } from '../../hooks/useDB';
import { allTimezones } from '../../utils/timezone';
import styles from './SettingsModal.module.css';

export default function SettingsModal({
  open,
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
  const [sendblueInput, setSendblueInput] = useState({ apiKey: '', apiSecret: '', recipient: '' });
  const [sendblueReminderOffsets, setSendblueReminderOffsets] = useState(null); // null = use server value
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
                            } catch (e) { alert('Fetch failed: ' + e.message); }
                            setFetching(false);
                          }}
                        >
                          {fetching ? 'Checking…' : '↓ Fetch'}
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
                            } catch (e) { alert('Push failed: ' + e.message); }
                            setPushing(false);
                          }}
                        >
                          {pushing ? 'Checking…' : '↑ Push'}
                        </button>
                      </div>
                    )}

                    {/* Sync diff confirmation dialog */}
                    {syncDiff && (
                      <div className={styles.syncDiffBox}>
                        <div className={styles.syncDiffTitle}>Review before syncing</div>

                        {syncDiff.orphanedOnKugi.length > 0 && (
                          <div className={styles.syncDiffSection}>
                            <div className={styles.syncDiffSectionHeader}>
                              <span>These blocks exist in Kugi but their Google Calendar event was deleted. Remove from Kugi?</span>
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
                              <span>These Google Calendar events have no matching block in Kugi. Remove from Google Calendar?</span>
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
                          <button className={styles.syncDiffCancel} onClick={() => setSyncDiff(null)}>Cancel</button>
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
                              } catch (e) { alert('Sync failed: ' + e.message); }
                              if (mode === 'fetch') setFetching(false); else setPushing(false);
                            }}
                          >
                            Confirm &amp; Sync
                          </button>
                        </div>
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
                      {telegramConfig?.botToken && telegramConfig?.chatId && (
                        <button
                          className={`${styles.toggle} ${telegramChannelEnabled ? styles.toggleOn : ''}`}
                          onClick={() => setTelegramChannelEnabled(!telegramChannelEnabled)}
                          title={telegramChannelEnabled ? 'Disable Telegram reminders' : 'Enable Telegram reminders'}
                        >
                          <span className={styles.toggleThumb} />
                        </button>
                      )}
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
                            onClick={() => { if (confirm('Disconnect Telegram?')) setTelegramConfig({ botToken: '', chatId: '', offsetMinutes: 15, reminderOffsets: [], webhookUrl: '' }); }}
                          >
                            Disconnect
                          </button>
                        </div>
                        {/* Multi-reminder offsets */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            Remind me (up to 4 times per event)
                          </span>
                          {(() => {
                            const active = reminderOffsets ?? telegramConfig.reminderOffsets ?? [telegramConfig.offsetMinutes ?? 15];
                            const OPTS = [[5,'5 min'],[10,'10 min'],[15,'15 min'],[20,'20 min'],[30,'30 min'],[45,'45 min'],[60,'1 hr'],[90,'1.5 hr'],[120,'2 hr'],[180,'3 hr']];
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
                                      {OPTS.map(([v, label]) => <option key={v} value={v}>{label} before</option>)}
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
                                  >+ Add reminder</button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {/* Webhook URL */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                            Webhook URL <span style={{ opacity: 0.6 }}>(optional — POSTed when reminder fires)</span>
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className={styles.keyInput}
                              style={{ flex: 1 }}
                              type="url"
                              placeholder="https://your-agent.example.com/webhook"
                              value={webhookUrlInput || telegramConfig.webhookUrl || ''}
                              onChange={e => setWebhookUrlInput(e.target.value)}
                              onBlur={e => {
                                const url = e.target.value.trim();
                                setTelegramConfig({ botToken: telegramConfig.botToken, chatId: telegramConfig.chatId, offsetMinutes: telegramConfig.offsetMinutes ?? 15, reminderOffsets: reminderOffsets ?? telegramConfig.reminderOffsets ?? undefined, webhookUrl: url });
                              }}
                            />
                          </div>
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
                          <span className={styles.rowLabel} style={{ fontSize: 12 }}>First reminder</span>
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

                  {/* iMessage (SendBlue) card */}
                  <div className={styles.integrationCard}>
                    <div className={styles.integrationCardHeader}>
                      <div className={styles.rowLabel}>
                        <span className={styles.rowTitle}>iMessage</span>
                        <span className={styles.rowHint}>
                          Send reminders via iMessage using{' '}
                          <a href="https://sendblue.co" target="_blank" rel="noreferrer" className={styles.link}>SendBlue</a>.
                          Sign up for a SendBlue account to get your API credentials.
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
                          title={sendblueConfig.channelEnabled ? 'Disable iMessage reminders' : 'Enable iMessage reminders'}
                        >
                          <span className={styles.toggleThumb} />
                        </button>
                      )}
                    </div>
                    {sendblueConfig?.apiKey && sendblueConfig?.recipient ? (
                      <>
                        <div className={styles.connectedRow}>
                          <span className={styles.connectedDot} />
                          <span className={styles.connectedLabel}>Connected</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                            {sendblueConfig.recipient}
                          </span>
                          <button
                            className={styles.disconnectBtn}
                            onClick={() => { if (confirm('Disconnect iMessage (SendBlue)?')) setSendblueConfig({ apiKey: '', apiSecret: '', recipient: '' }); }}
                          >
                            Disconnect
                          </button>
                        </div>
                        {/* Multi-reminder offsets */}
                        <div style={{ marginTop: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                            Remind me (up to 4 times per event)
                          </span>
                          {(() => {
                            const active = sendblueReminderOffsets ?? sendblueConfig.reminderOffsets ?? [15];
                            const OPTS = [[5,'5 min'],[10,'10 min'],[15,'15 min'],[20,'20 min'],[30,'30 min'],[45,'45 min'],[60,'1 hr'],[90,'1.5 hr'],[120,'2 hr'],[180,'3 hr']];
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
                                      {OPTS.map(([v, label]) => <option key={v} value={v}>{label} before</option>)}
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
                                  >+ Add reminder</button>
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
                          } catch (err) { alert('Failed to save: ' + err.message); }
                        }}
                      >
                        <div className={styles.telegramInputGroup}>
                          <input
                            className={styles.keyInput}
                            type="password"
                            placeholder="SendBlue API key (sb-api-key-id)"
                            value={sendblueInput.apiKey}
                            onChange={e => setSendblueInput(p => ({ ...p, apiKey: e.target.value }))}
                          />
                          <input
                            className={styles.keyInput}
                            type="password"
                            placeholder="SendBlue API secret (sb-api-secret-key)"
                            value={sendblueInput.apiSecret}
                            onChange={e => setSendblueInput(p => ({ ...p, apiSecret: e.target.value }))}
                          />
                          <input
                            className={styles.keyInput}
                            type="tel"
                            placeholder="Your phone number (+12345678900)"
                            value={sendblueInput.recipient}
                            onChange={e => setSendblueInput(p => ({ ...p, recipient: e.target.value }))}
                          />
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
