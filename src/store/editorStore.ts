import { createStore, produce } from 'solid-js/store';
import { invoke } from '@tauri-apps/api/core';
import { StandardJson, GameMetadata, fetchGameMetadata } from '../services/ipc';
import { flattenJson, FlattenedNode } from '../utils/flattenJson';
import { addToast } from './toastStore';

export type CommandAction = 'update' | 'delete' | 'add' | 'duplicate' | 'rename' | 'full';

export interface Command {
  id: string;
  action: CommandAction;
  actionDescription: string;
  timestamp: number;
  path: string;
  previousValue?: any;
  newValue?: any;
  key?: string | number;
  oldKey?: string;
  newKey?: string;
}

interface EditorState {
  saveData: StandardJson | null;
  filePath: string | null;
  activeProfileRules: any[] | null;
  activeProfileChecksums: any[] | null;
  gameMetadata: GameMetadata | null;
  editorMode: 'easy' | 'advanced' | 'hex' | 'diff' | 'raw';
  previousEditorMode: 'easy' | 'advanced' | 'hex' | 'raw' | null;
  activeTab: 'party' | 'items' | 'weapons' | 'armors' | 'switches' | 'variables' | 'diff';
  expandedPaths: Set<string>;
  searchQuery: string;
  collapsedSearchPaths: Set<string>;
  flattenedNodes: FlattenedNode[];
  gameDatabase: Record<string, Record<number, string>>;
  originalGameDatabase: Record<string, Record<number, string>>;
  translatedGameDatabase: Record<string, Record<number, string>>;
  isDatabaseTranslated: boolean;
  past: Command[];
  future: Command[];
  isHelpModalOpen: boolean;
  helpModalSection: string;
  isHistoryModalOpen: boolean;
  adbDeviceId: string | null;
  adbRemotePath: string | null;
  shizukuRemotePath: string | null;
  mcpPulse: boolean;
  isMcpEnabled: boolean;
  pendingAiMutation: Record<string, any> | null;
  isAiDiffModalOpen: boolean;
  hasUsedRawMode: boolean;
  stardewActiveTab: string;
  isBackupManagerOpen: boolean;
  isShareModalOpen: boolean;
  pinnedPaths: Set<string>;
  isModified: boolean;
}

const setNestedValue = (obj: any, path: string, value: any) => {
  if (path === '') return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
};

const getNestedValue = (obj: any, path: string) => {
  if (path === '') return obj;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[parts[i]];
  }
  return current;
};

const sanitizeMetadataQuery = (pathStr: string): { query: string; cacheKey: string } => {
  const parts = pathStr.split(/[/\\]/).filter(p => p.trim() !== '');
  const cacheKey = parts[parts.length - 1] || pathStr;
  
  const ignoreFolders = /^(saves?|savedata|userdata|save_data|data|datasu|extra|system|global|config|sys|info|common|www|game|local|env)$/i;
  const ignoreReleaseCodes = /^(r|rj)\d+$/i;

  let bestTitle = cacheKey.replace(/\.[^/.]+$/, "");

  for (let i = parts.length - 1; i >= 0; i--) {
    let part = parts[i];
    
    if (i === parts.length - 1) {
      part = part.replace(/\.[^/.]+$/, "");
      if (ignoreFolders.test(part)) continue;
      part = part.replace(/([Gg]ame[Ss]ave|[Ss]ave|[Dd]ata)\s*\d*/g, "").trim();
    }
    
    if (!part || part.length < 2) continue;
    if (ignoreFolders.test(part)) continue;
    if (ignoreReleaseCodes.test(part)) continue;
    
    bestTitle = part;
    break;
  }

  return { query: bestTitle.trim(), cacheKey };
};

const collectPaths = (obj: any, currentPath: string, currentDepth: number, maxDepth: number, paths: Set<string>) => {
  if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') return;
  const keys = Array.isArray(obj) ? obj.map((_, i) => String(i)) : Object.keys(obj);
  for (const k of keys) {
    const nextPath = currentPath ? `${currentPath}.${k}` : k;
    paths.add(nextPath);
    collectPaths(obj[k], nextPath, currentDepth + 1, maxDepth, paths);
  }
};


export const [editorState, setEditorState] = createStore<EditorState>({
  saveData: null,
  filePath: null,
  activeProfileRules: null,
  activeProfileChecksums: null,
  gameMetadata: null,
  editorMode: 'easy',
  previousEditorMode: null,
  activeTab: 'party',
  expandedPaths: new Set<string>(),
  searchQuery: '',
  collapsedSearchPaths: new Set<string>(),
  flattenedNodes: [],
  gameDatabase: {},
  originalGameDatabase: {},
  translatedGameDatabase: {},
  isDatabaseTranslated: false,
  past: [],
  future: [],
  isHelpModalOpen: false,
  helpModalSection: 'how_to_use',
  isHistoryModalOpen: false,
  isBackupManagerOpen: false,
  adbDeviceId: null,
  adbRemotePath: null,
  shizukuRemotePath: null,
  mcpPulse: false,
  isMcpEnabled: false,
  pendingAiMutation: null,
  isAiDiffModalOpen: false,
  hasUsedRawMode: false,
  stardewActiveTab: 'identity',
  isShareModalOpen: false,
  pinnedPaths: new Set<string>(),
  isModified: false,
});

export const useEditorStore = () => editorState;

export const setGameMetadata = (meta: GameMetadata | null) => setEditorState('gameMetadata', meta);
export const setIsAiDiffModalOpen = (isOpen: boolean) => {
  setEditorState('isAiDiffModalOpen', isOpen);
};

export const setIsBackupManagerOpen = (isOpen: boolean) => {
  setEditorState('isBackupManagerOpen', isOpen);
};

export const setIsShareModalOpen = (isOpen: boolean) => {
  setEditorState('isShareModalOpen', isOpen);
};

export const setHasUsedRawMode = (hasUsed: boolean) => setEditorState('hasUsedRawMode', hasUsed);
export const setIsHelpModalOpen = (isOpen: boolean) => setEditorState('isHelpModalOpen', isOpen);
export const setHelpModalSection = (section: string) => setEditorState('helpModalSection', section);
export const setIsHistoryModalOpen = (isOpen: boolean) => setEditorState('isHistoryModalOpen', isOpen);
export const setStardewActiveTab = (tab: string) => setEditorState('stardewActiveTab', tab);
export const setIsModified = (val: boolean) => setEditorState('isModified', val);

const pushCommand = (state: any, cmd: Omit<Command, 'id' | 'timestamp'>) => {
  state.past.push({
    ...cmd,
    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    timestamp: Date.now()
  });
  if (state.past.length > 100) state.past.shift();
  state.future = [];
  state.isModified = true;
};

export const loadSaveData = (data: StandardJson, path: string, profileRules: any[] | null = null) => {
  setEditorState(produce((state) => {
    state.saveData = data;
    state.filePath = path;
    state.activeProfileRules = profileRules;
    state.activeProfileChecksums = null;
    state.gameMetadata = null;
    state.previousEditorMode = null;
    state.expandedPaths = new Set<string>();
    state.searchQuery = '';
    state.collapsedSearchPaths = new Set<string>();
    state.past = [];
    state.future = [];
    state.stardewActiveTab = 'identity';
    state.pinnedPaths = new Set<string>();
    state.isModified = false;
    state.shizukuRemotePath = null;
    
    if (data.parsed_variables?._is_binary_format === true || data.parsed_variables?.is_encrypted_binary === true) {
      state.editorMode = 'hex';
    } else if (data.engine_type === 'RpgMakerMv' || data.engine_type === 'RpgMakerMz' || data.engine_type === 'CSharpXml' || data.engine_type === 'StardewValley') {
      state.editorMode = 'easy';
    } else {
      state.editorMode = 'advanced';
    }

    if (state.editorMode === 'advanced') {
      state.flattenedNodes = flattenJson(data.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
    }
  }));

  const { query, cacheKey } = sanitizeMetadataQuery(path);
  const finalQuery = query || data.engine_type;
  
  fetchGameMetadata(finalQuery, cacheKey).then((meta) => {
    setEditorState('gameMetadata', meta);
  });
};

export const closeFile = async () => {
  const needsNuclearReload = editorState.hasUsedRawMode;
  setEditorState({
    saveData: null,
    filePath: null,
    activeProfileRules: null,
    activeProfileChecksums: null,
    gameMetadata: null,
    past: [],
    future: [],
    flattenedNodes: [],
    expandedPaths: new Set<string>(),
    searchQuery: '',
    collapsedSearchPaths: new Set<string>(),
    gameDatabase: {},
    originalGameDatabase: {},
    translatedGameDatabase: {},
    isDatabaseTranslated: false,
    adbDeviceId: null,
    adbRemotePath: null,
    shizukuRemotePath: null,
    hasUsedRawMode: false,
    isModified: false,
  });

  try {
    await invoke('close_save_file');
  } catch (e) {
    console.error("Failed to purge Rust backend memory", e);
  }

  if (needsNuclearReload) {
    setTimeout(() => {
      window.location.reload();
    }, 50);
  }
};

export const setAdbInfo = (deviceId: string | null, remotePath: string | null) => setEditorState(produce((state) => {
  state.adbDeviceId = deviceId;
  state.adbRemotePath = remotePath;
}));

export const setShizukuRemotePath = (remotePath: string | null) => setEditorState(produce((state) => {
  state.shizukuRemotePath = remotePath;
}));

export const updateValue = (path: string, value: any) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  const oldValue = getNestedValue(state.saveData.parsed_variables, path);
  
  pushCommand(state, {
    action: 'update',
    actionDescription: `Modified value at ${path.split('.').pop()}`,
    path,
    previousValue: oldValue !== undefined ? JSON.parse(JSON.stringify(oldValue)) : undefined,
    newValue: value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined
  });

  setNestedValue(state.saveData.parsed_variables, path, value);
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const updateRawPayload = (base64: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  pushCommand(state, {
    action: 'full',
    actionDescription: `Updated Raw Payload (Hex Injection)`,
    path: '',
    previousValue: JSON.parse(JSON.stringify(state.saveData)),
  });
  state.saveData.raw_payload = base64;
}));

export const updateParsedVariables = (newVariables: any) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  pushCommand(state, {
    action: 'full',
    actionDescription: `Full variables replacement`,
    path: '',
    previousValue: JSON.parse(JSON.stringify(state.saveData)),
  });
  state.saveData.parsed_variables = newVariables;
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const deleteValue = (path: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;

  const parts = path.split('.');
  const keyToDelete = parts.pop();
  const parentPath = parts.join('.');
  let current = getNestedValue(state.saveData.parsed_variables, parentPath);

  if (current && keyToDelete !== undefined) {
    const deletedValue = current[keyToDelete];
    pushCommand(state, {
      action: 'delete',
      actionDescription: `Deleted node ${keyToDelete}`,
      path: parentPath,
      key: keyToDelete,
      previousValue: deletedValue !== undefined ? JSON.parse(JSON.stringify(deletedValue)) : undefined
    });

    if (Array.isArray(current)) {
      current.splice(parseInt(keyToDelete, 10), 1);
    } else {
      delete current[keyToDelete];
    }
  }

  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const duplicateValue = (path: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;

  const parts = path.split('.');
  const keyToDuplicate = parts.pop();
  const parentPath = parts.join('.');
  let current = getNestedValue(state.saveData.parsed_variables, parentPath);

  if (current && keyToDuplicate !== undefined) {
    const originalValue = current[keyToDuplicate];
    const clonedValue = originalValue !== undefined ? JSON.parse(JSON.stringify(originalValue)) : undefined;
    let finalNewKey: string | number;
    
    if (Array.isArray(current)) {
      const index = parseInt(keyToDuplicate, 10);
      current.splice(index + 1, 0, clonedValue);
      finalNewKey = index + 1;
    } else {
      let newKey = `${keyToDuplicate}_copy`;
      let counter = 1;
      while (current[newKey] !== undefined) {
        newKey = `${keyToDuplicate}_copy${counter}`;
        counter++;
      }
      current[newKey] = clonedValue;
      finalNewKey = newKey;
    }

    pushCommand(state, {
      action: 'duplicate',
      actionDescription: `Duplicated node ${keyToDuplicate}`,
      path: parentPath,
      key: finalNewKey,
      newValue: clonedValue
    });
  }

  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const addValue = (
  path: string, 
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null',
  customKey?: string,
  customValue?: any
) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  
  let current = getNestedValue(state.saveData.parsed_variables, path);

  if (current !== null && typeof current === 'object') {
    let defaultValue: any = "";
    if (type === 'number') defaultValue = 0;
    if (type === 'boolean') defaultValue = false;
    if (type === 'object') defaultValue = {};
    if (type === 'array') defaultValue = [];
    if (type === 'null') defaultValue = null;

    if (customValue !== undefined && type !== 'object' && type !== 'array' && type !== 'null') {
      if (type === 'number') {
        const parsed = Number(customValue);
        defaultValue = isNaN(parsed) ? 0 : parsed;
      }
      else if (type === 'boolean') defaultValue = customValue === 'true' || customValue === true;
      else if (type === 'string') defaultValue = String(customValue);
    }

    let finalNewKey: string | number;

    if (Array.isArray(current)) {
      current.push(defaultValue);
      finalNewKey = current.length - 1;
    } else {
      let newKey = (customKey && customKey.trim()) ? customKey.trim() : "new_key";
      if (current[newKey] !== undefined) {
        let baseKey = newKey;
        let counter = 1;
        while (current[newKey] !== undefined) {
          newKey = `${baseKey}_${counter}`;
          counter++;
        }
      }
      current[newKey] = defaultValue;
      finalNewKey = newKey;
    }
    
    pushCommand(state, {
      action: 'add',
      actionDescription: `Added new item to ${path.split('.').pop() || 'root'}`,
      path: path,
      key: finalNewKey,
      newValue: defaultValue
    });

    if (path !== '') {
      state.expandedPaths.add(path);
    }
  }

  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const renameKey = (path: string, newKey: string) => setEditorState(produce((state) => {
  if (!state.saveData || !newKey.trim()) return;
  
  const parts = path.split('.');
  const oldKey = parts.pop();
  const parentPath = parts.join('.');
  if (!oldKey || oldKey === newKey) return;
  
  let current = getNestedValue(state.saveData.parsed_variables, parentPath);

  if (current && typeof current === 'object' && !Array.isArray(current)) {
    if (current[newKey] !== undefined) return; 
    
    pushCommand(state, {
      action: 'rename',
      actionDescription: `Renamed key ${oldKey} to ${newKey}`,
      path: parentPath,
      oldKey: oldKey,
      newKey: newKey
    });

    current[newKey] = current[oldKey];
    delete current[oldKey];
    
    const oldPrefix = path + '.';
    const basePath = parts.length > 0 ? parts.join('.') + '.' : '';
    const newPath = basePath + newKey;
    const newPrefix = newPath + '.';
    
    const newExpandedPaths = new Set<string>();
    for (const p of state.expandedPaths) {
      if (p === path) {
        newExpandedPaths.add(newPath);
      } else if (p.startsWith(oldPrefix)) {
        newExpandedPaths.add(p.replace(oldPrefix, newPrefix));
      } else {
        newExpandedPaths.add(p);
      }
    }
    state.expandedPaths = newExpandedPaths;
  }
  
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const toggleExpand = (path: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  if (state.searchQuery !== '') {
    // During search, toggle between expandedPaths and collapsedSearchPaths
    const isCurrentlyExpanded = state.expandedPaths.has(path) || !state.collapsedSearchPaths.has(path);
    if (isCurrentlyExpanded) {
      state.expandedPaths.delete(path);
      state.collapsedSearchPaths.add(path);
    } else {
      state.collapsedSearchPaths.delete(path);
      state.expandedPaths.add(path);
    }
  } else {
    // Normal behavior
    if (state.expandedPaths.has(path)) {
      state.expandedPaths.delete(path);
    } else {
      state.expandedPaths.add(path);
    }
  }
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const togglePinPath = (path: string) => setEditorState(produce((state) => {
  if (state.pinnedPaths.has(path)) {
    state.pinnedPaths.delete(path);
  } else {
    state.pinnedPaths.add(path);
  }
  if (state.saveData) {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const expandAll = (maxDepth: number = 3) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  const newPaths = new Set<string>();
  collectPaths(state.saveData.parsed_variables, '', 0, maxDepth, newPaths);
  state.expandedPaths = newPaths;
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const collapseAll = () => setEditorState(produce((state) => {
  if (!state.saveData) return;
  state.expandedPaths.clear();
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const setSearchQuery = (query: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  state.searchQuery = query;
  state.collapsedSearchPaths.clear();
  if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const setEditorMode = (mode: 'easy' | 'advanced' | 'hex' | 'diff' | 'raw') => setEditorState(produce((state) => {
  if (mode === 'diff' && state.editorMode !== 'diff') {
    state.previousEditorMode = state.editorMode;
  }
  state.editorMode = mode;

  if (mode === 'raw') {
    state.hasUsedRawMode = true; 
  }

  if ((mode === 'advanced' || mode === 'diff') && state.saveData?.parsed_variables) {
    state.flattenedNodes = flattenJson(state.saveData.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
  }
}));

export const setActiveTab = (tab: 'party' | 'items' | 'weapons' | 'armors' | 'switches' | 'variables' | 'diff') => setEditorState('activeTab', tab);

export const setGameDatabase = (tab: string, data: Record<number, string>) => setEditorState('gameDatabase', tab, data);

export const setOriginalGameDatabase = (tab: string, data: Record<number, string>) => setEditorState('originalGameDatabase', tab, data);

export const setTranslatedGameDatabase = (tab: string, data: Record<number, string>) => setEditorState('translatedGameDatabase', tab, data);

export const setDatabaseTranslated = (isTranslated: boolean) => setEditorState(produce((state) => {
  if (Object.keys(state.originalGameDatabase).length === 0) return;
  state.isDatabaseTranslated = isTranslated;
  if (!isTranslated) {
    state.gameDatabase = JSON.parse(JSON.stringify(state.originalGameDatabase));
  } else {
    state.gameDatabase = JSON.parse(JSON.stringify(state.translatedGameDatabase));
  }
}));

const executeInverseCommand = (state: any, cmd: Command) => {
  let parent = getNestedValue(state.saveData.parsed_variables, cmd.path);
  
  switch (cmd.action) {
    case 'update':
      setNestedValue(state.saveData.parsed_variables, cmd.path, cmd.previousValue !== undefined ? JSON.parse(JSON.stringify(cmd.previousValue)) : undefined);
      break;
    case 'delete':
      if (parent && cmd.key !== undefined) {
        if (Array.isArray(parent)) parent.splice(cmd.key as number, 0, cmd.previousValue !== undefined ? JSON.parse(JSON.stringify(cmd.previousValue)) : undefined);
        else parent[cmd.key] = cmd.previousValue !== undefined ? JSON.parse(JSON.stringify(cmd.previousValue)) : undefined;
      }
      break;
    case 'add':
    case 'duplicate':
      if (parent && cmd.key !== undefined) {
        if (Array.isArray(parent)) parent.splice(cmd.key as number, 1);
        else delete parent[cmd.key];
      }
      break;
    case 'rename':
      if (parent && cmd.oldKey && cmd.newKey) {
        parent[cmd.oldKey] = parent[cmd.newKey];
        delete parent[cmd.newKey];
      }
      break;
    case 'full':
      state.saveData = JSON.parse(JSON.stringify(cmd.previousValue));
      break;
  }
};

const executeForwardCommand = (state: any, cmd: Command) => {
  let parent = getNestedValue(state.saveData.parsed_variables, cmd.path);
  
  switch (cmd.action) {
    case 'update':
      setNestedValue(state.saveData.parsed_variables, cmd.path, cmd.newValue !== undefined ? JSON.parse(JSON.stringify(cmd.newValue)) : undefined);
      break;
    case 'delete':
      if (parent && cmd.key !== undefined) {
        if (Array.isArray(parent)) parent.splice(cmd.key as number, 1);
        else delete parent[cmd.key];
      }
      break;
    case 'add':
    case 'duplicate':
      if (parent && cmd.key !== undefined) {
        if (Array.isArray(parent)) parent.splice(cmd.key as number, 0, cmd.newValue !== undefined ? JSON.parse(JSON.stringify(cmd.newValue)) : undefined);
        else parent[cmd.key] = cmd.newValue !== undefined ? JSON.parse(JSON.stringify(cmd.newValue)) : undefined;
      }
      break;
    case 'rename':
      if (parent && cmd.oldKey && cmd.newKey) {
        parent[cmd.newKey] = parent[cmd.oldKey];
        delete parent[cmd.oldKey];
      }
      break;
    case 'full':
      // Actually we'd need to store forward state for full. For now full replace usually drops future history, 
      // but if a user redoes a full replace, we would need nextValue. To avoid bugs, full clears future.
      break;
  }
};

export const undo = () => setEditorState(produce((state) => {
  if (state.past.length === 0 || !state.saveData) return;
  const command = state.past.pop();
  if (command) {
    if (command.action === 'full') {
      // Create forward command dynamically
      command.newValue = JSON.parse(JSON.stringify(state.saveData));
    }
    state.future.push(command);
    executeInverseCommand(state, command);
    if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
      state.flattenedNodes = flattenJson(state.saveData!.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
    }
  }
}));

export const redo = () => setEditorState(produce((state) => {
  if (state.future.length === 0 || !state.saveData) return;
  const command = state.future.pop();
  if (command) {
    state.past.push(command);
    if (command.action === 'full' && command.newValue) {
      state.saveData = JSON.parse(JSON.stringify(command.newValue));
    } else {
      executeForwardCommand(state, command);
    }
    if (state.editorMode === 'advanced' || state.editorMode === 'diff') {
      state.flattenedNodes = flattenJson(state.saveData!.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
    }
  }
}));

export const undoToId = (id: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  const index = state.past.findIndex((c: Command) => c.id === id);
  if (index === -1) return;
  const steps = state.past.length - index;
  for (let i = 0; i < steps; i++) {
    const cmd = state.past.pop()!;
    if (cmd.action === 'full') cmd.newValue = JSON.parse(JSON.stringify(state.saveData));
    state.future.push(cmd);
    executeInverseCommand(state, cmd);
  }
  state.flattenedNodes = flattenJson(state.saveData!.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
}));

export const redoToId = (id: string) => setEditorState(produce((state) => {
  if (!state.saveData) return;
  const index = state.future.findIndex((c: Command) => c.id === id);
  if (index === -1) return;
  const steps = state.future.length - index;
  for (let i = 0; i < steps; i++) {
    const cmd = state.future.pop()!;
    state.past.push(cmd);
    if (cmd.action === 'full' && cmd.newValue) {
      state.saveData = JSON.parse(JSON.stringify(cmd.newValue));
    } else {
      executeForwardCommand(state, cmd);
    }
  }
  state.flattenedNodes = flattenJson(state.saveData!.parsed_variables, state.expandedPaths, state.searchQuery, state.collapsedSearchPaths, state.pinnedPaths);
}));

export const setPendingAiMutation = (payload: any) => setEditorState(produce((state) => {
  state.pendingAiMutation = payload;
  state.isAiDiffModalOpen = true;
}));

export const rejectAiMutation = () => {
  setEditorState({ isAiDiffModalOpen: false });
  setTimeout(() => setEditorState({ pendingAiMutation: null }), 300);
};

export const acceptAiMutation = async () => {
  const payload = editorState.pendingAiMutation;
  if (!payload) return;

  try {
    const injectedKeys = Object.keys(payload).length;
    const newState = await invoke('apply_ai_mutation', { payload });
    updateParsedVariables(newState);
    setEditorState({ isAiDiffModalOpen: false });
    setTimeout(() => setEditorState({ pendingAiMutation: null }), 300);

    setEditorState('mcpPulse', true);
    setTimeout(() => setEditorState('mcpPulse', false), 2000);
    
    addToast(`AI injected ${injectedKeys} variable(s) successfully!`, 'success');
  } catch (e) {
    console.error("Failed to apply AI mutation", e);
  }
};
