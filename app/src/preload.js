const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kugiDB', {
  // Blocks
  listBlocks: () => ipcRenderer.invoke('db:listBlocks'),
  createBlock: (block) => ipcRenderer.invoke('db:createBlock', block),
  updateBlock: (id, fields) => ipcRenderer.invoke('db:updateBlock', id, fields),
  deleteBlock: (id) => ipcRenderer.invoke('db:deleteBlock', id),
  toggleComplete: (id) => ipcRenderer.invoke('db:toggleComplete', id),
  bulkCreate: (blocks) => ipcRenderer.invoke('db:bulkCreate', blocks),

  // Real-time subscription: callback fired whenever data changes
  onBlocksChanged: (callback) => {
    ipcRenderer.on('db:blocksChanged', (_, blocks) => callback(blocks));
  },
});
