import { useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { makeFunctionReference } from 'convex/server';

// Remove empty strings so Convex v.optional() fields stay absent, not ""
function stripEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));
}

const fn = {
  blocks: {
    list:           makeFunctionReference('blocks:list'),
    listByDate:     makeFunctionReference('blocks:listByDate'),
    create:         makeFunctionReference('blocks:create'),
    update:         makeFunctionReference('blocks:update'),
    remove:         makeFunctionReference('blocks:remove'),
    toggleComplete: makeFunctionReference('blocks:toggleComplete'),
    bulkCreate:     makeFunctionReference('blocks:bulkCreate'),
  },
  settings: {
    getApiKey:    makeFunctionReference('settings:getApiKey'),
    ensureApiKey: makeFunctionReference('settings:ensureApiKey'),
    rotateApiKey: makeFunctionReference('settings:rotateApiKey'),
  },
};

export function useBlocks() {
  const blocks = useQuery(fn.blocks.list) ?? [];
  const createMutation   = useMutation(fn.blocks.create);
  const updateMutation   = useMutation(fn.blocks.update);
  const removeMutation   = useMutation(fn.blocks.remove);
  const toggleMutation   = useMutation(fn.blocks.toggleComplete);
  const bulkMutation     = useMutation(fn.blocks.bulkCreate);

  const createBlock = async (data) => {
    try {
      return await createMutation({ completed: false, ...stripEmpty(data) });
    } catch (e) {
      alert('Create failed: ' + e.message);
      throw e;
    }
  };
  const updateBlock  = (id, fields) => updateMutation({ id, ...stripEmpty(fields) });
  const deleteBlock  = (id) => removeMutation({ id });
  const toggleComplete = (id) => toggleMutation({ id });
  const bulkCreate   = (blockList) => bulkMutation({ blocks: blockList });

  return { blocks, createBlock, updateBlock, deleteBlock, toggleComplete, bulkCreate };
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
