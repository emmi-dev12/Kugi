import { useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { anyApi } from 'convex/server';

const fn = {
  blocks: {
    list:           anyApi.blocks.list,
    listByDate:     anyApi.blocks.listByDate,
    create:         anyApi.blocks.create,
    update:         anyApi.blocks.update,
    remove:         anyApi.blocks.remove,
    toggleComplete: anyApi.blocks.toggleComplete,
    bulkCreate:     anyApi.blocks.bulkCreate,
  },
  settings: {
    getApiKey:    anyApi.settings.getApiKey,
    ensureApiKey: anyApi.settings.ensureApiKey,
    rotateApiKey: anyApi.settings.rotateApiKey,
  },
};

export function useBlocks() {
  const blocks = useQuery(fn.blocks.list) ?? [];
  const createMutation   = useMutation(fn.blocks.create);
  const updateMutation   = useMutation(fn.blocks.update);
  const removeMutation   = useMutation(fn.blocks.remove);
  const toggleMutation   = useMutation(fn.blocks.toggleComplete);
  const bulkMutation     = useMutation(fn.blocks.bulkCreate);

  const createBlock  = (data) => createMutation({ completed: false, ...data });
  const updateBlock  = (id, fields) => updateMutation({ id, ...fields });
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
