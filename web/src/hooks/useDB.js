import { useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

// Remove empty strings (optional string fields must be absent, not "")
// Keep null/number/boolean — only drop ""
function stripEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined)
  );
}

const fn = {
  blocks: {
    list:             makeFunctionReference('blocks:list'),
    listByDate:       makeFunctionReference('blocks:listByDate'),
    create:           makeFunctionReference('blocks:create'),
    update:           makeFunctionReference('blocks:update'),
    remove:           makeFunctionReference('blocks:remove'),
    toggleComplete:   makeFunctionReference('blocks:toggleComplete'),
    bulkCreate:       makeFunctionReference('blocks:bulkCreate'),
    bulkDelete:       makeFunctionReference('blocks:bulkDelete'),
    bulkComplete:     makeFunctionReference('blocks:bulkComplete'),
    createRecurring:  makeFunctionReference('blocks:createRecurring'),
    deleteRecurring:  makeFunctionReference('blocks:deleteRecurring'),
  },
  settings: {
    getApiKey:                  makeFunctionReference('settings:getApiKey'),
    ensureApiKey:               makeFunctionReference('settings:ensureApiKey'),
    rotateApiKey:               makeFunctionReference('settings:rotateApiKey'),
    getComposioApiKey:          makeFunctionReference('settings:getComposioApiKey'),
    setComposioApiKey:          makeFunctionReference('settings:setComposioApiKey'),
    getIntegrationEnabled:      makeFunctionReference('settings:getIntegrationEnabled'),
    setIntegrationEnabled:      makeFunctionReference('settings:setIntegrationEnabled'),
    getTelegramConfig:          makeFunctionReference('settings:getTelegramConfig'),
    setTelegramConfig:          makeFunctionReference('settings:setTelegramConfig'),
    getPushEnabled:             makeFunctionReference('settings:getPushEnabled'),
    setPushEnabled:             makeFunctionReference('settings:setPushEnabled'),
    getSendblueConfig:          makeFunctionReference('settings:getSendblueConfig'),
    setSendblueConfig:          makeFunctionReference('settings:setSendblueConfig'),
    getTelegramChannelEnabled:  makeFunctionReference('settings:getTelegramChannelEnabled'),
    setChannelEnabled:          makeFunctionReference('settings:setChannelEnabled'),
  },
  calendar: {
    triggerSync:       makeFunctionReference('calendarSyncActions:triggerSync'),
    fetchFromGoogle:   makeFunctionReference('calendarSyncActions:fetchFromGoogle'),
    pushToGoogle:      makeFunctionReference('calendarSyncActions:pushToGoogle'),
    getSyncDiff:       makeFunctionReference('calendarSyncActions:getSyncDiff'),
    deleteGcalEvents:  makeFunctionReference('calendarSyncActions:deleteGcalEvents'),
  },
};

export function useBlocks() {
  const raw = useQuery(fn.blocks.list) ?? [];
  // Convex documents use _id; normalise to .id so the rest of the UI is consistent
  const blocks = raw.map(b => ({ ...b, id: b._id }));
  const createMutation          = useMutation(fn.blocks.create);
  const updateMutation          = useMutation(fn.blocks.update);
  const removeMutation          = useMutation(fn.blocks.remove);
  const toggleMutation          = useMutation(fn.blocks.toggleComplete);
  const bulkMutation            = useMutation(fn.blocks.bulkCreate);
  const bulkDeleteMutation      = useMutation(fn.blocks.bulkDelete);
  const bulkCompleteMutation    = useMutation(fn.blocks.bulkComplete);
  const createRecurringMutation = useMutation(fn.blocks.createRecurring);
  const deleteRecurringMutation = useMutation(fn.blocks.deleteRecurring);

  const createBlock = async (data) => {
    try {
      return await createMutation({ completed: false, ...stripEmpty(data) });
    } catch (e) {
      // Show validation messages (user-facing) but not raw server internals.
      const msg = e.message?.length < 200 ? e.message : 'An unexpected error occurred. Please try again.';
      alert('Could not create block: ' + msg);
      throw e;
    }
  };
  const updateBlock  = (id, fields) => updateMutation({ id, ...stripEmpty(fields) });
  const deleteBlock  = (id) => removeMutation({ id });
  const toggleComplete = (id) => toggleMutation({ id });
  const bulkCreate   = (blockList) => bulkMutation({ blocks: blockList });
  const bulkDelete   = (ids) => bulkDeleteMutation({ ids });
  const bulkComplete = (ids, completed = true) => bulkCompleteMutation({ ids, completed });
  const createRecurring = async (data) => {
    try {
      return await createRecurringMutation({ completed: false, ...stripEmpty(data) });
    } catch (e) {
      const msg = e.message?.length < 200 ? e.message : 'An unexpected error occurred. Please try again.';
      alert('Could not create recurring block: ' + msg);
      throw e;
    }
  };
  const deleteRecurring = (args) => deleteRecurringMutation(args);

  return { blocks, createBlock, updateBlock, deleteBlock, toggleComplete, bulkCreate, bulkDelete, bulkComplete, createRecurring, deleteRecurring };
}

export function useComposio() {
  const composioKey = useQuery(fn.settings.getComposioApiKey);
  const setKey = useMutation(fn.settings.setComposioApiKey);
  const sync = useAction(fn.calendar.triggerSync);
  return { composioKey, setComposioApiKey: setKey, triggerSync: sync };
}

export function useIntegrations() {
  const composioKey = useQuery(fn.settings.getComposioApiKey);
  const setComposioApiKey = useMutation(fn.settings.setComposioApiKey);
  const gcalEnabled = useQuery(fn.settings.getIntegrationEnabled, { integration: 'googleCalendar' }) ?? true;
  const setIntegrationEnabledMutation = useMutation(fn.settings.setIntegrationEnabled);
  const triggerGcalSync  = useAction(fn.calendar.triggerSync);
  const fetchFromGoogle  = useAction(fn.calendar.fetchFromGoogle);
  const pushToGoogle     = useAction(fn.calendar.pushToGoogle);
  const getSyncDiff      = useAction(fn.calendar.getSyncDiff);
  const deleteGcalEvents = useAction(fn.calendar.deleteGcalEvents);

  const setGcalEnabled = (val) => setIntegrationEnabledMutation({ integration: 'googleCalendar', enabled: val });

  return {
    composioKey,
    setComposioApiKey,
    gcalEnabled,
    setGcalEnabled,
    triggerGcalSync,
    fetchFromGoogle,
    pushToGoogle,
    getSyncDiff,
    deleteGcalEvents,
  };
}

export function useTelegram() {
  const config = useQuery(fn.settings.getTelegramConfig);
  const setConfig = useMutation(fn.settings.setTelegramConfig);
  return { config, setConfig };
}

export function usePushEnabled() {
  const pushEnabled = useQuery(fn.settings.getPushEnabled);
  const setPushEnabled = useMutation(fn.settings.setPushEnabled);
  return { pushEnabled: pushEnabled ?? true, setPushEnabled };
}

export function useSendblue() {
  const config = useQuery(fn.settings.getSendblueConfig);
  const setConfig = useMutation(fn.settings.setSendblueConfig);
  return { config, setConfig };
}

export function useTelegramChannelEnabled() {
  const enabled = useQuery(fn.settings.getTelegramChannelEnabled);
  const setEnabled = useMutation(fn.settings.setChannelEnabled);
  const setTelegramEnabled = (val) => setEnabled({ channel: 'telegram', enabled: val });
  return { telegramChannelEnabled: enabled ?? true, setTelegramChannelEnabled: setTelegramEnabled };
}

export function useApiKey() {
  const apiKey = useQuery(fn.settings.getApiKey);
  const ensure = useMutation(fn.settings.ensureApiKey);
  const rotate = useMutation(fn.settings.rotateApiKey);

  // Always ensure a key exists on mount — idempotent, safe to call every time.
  useEffect(() => { ensure(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // undefined = loading, null = no key yet, string = ready
  return { apiKey, rotateApiKey: rotate };
}
