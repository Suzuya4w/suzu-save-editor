import { createStore, produce } from 'solid-js/store';

interface SettingsState {
  isSettingsOpen: boolean;
  enableEffects: boolean;
  pinnedCloudSaves: string[];
}

const loadPinnedSaves = (): string[] => {
  try {
    const data = localStorage.getItem('suzu_pinned_cloud_saves');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const [settingsState, setSettingsState] = createStore<SettingsState>({
  isSettingsOpen: false,
  enableEffects: true,
  pinnedCloudSaves: loadPinnedSaves(),
});

export const useSettingsStore = () => settingsState;

export const setIsSettingsOpen = (val: boolean) => {
  setSettingsState('isSettingsOpen', val);
};

export const toggleEffects = () => setSettingsState('enableEffects', (prev) => !prev);

export const togglePinnedCloudSave = (saveId: string) => {
  setSettingsState(produce((state) => {
    if (state.pinnedCloudSaves.includes(saveId)) {
      state.pinnedCloudSaves = state.pinnedCloudSaves.filter(id => id !== saveId);
    } else {
      state.pinnedCloudSaves.push(saveId);
    }
    localStorage.setItem('suzu_pinned_cloud_saves', JSON.stringify(state.pinnedCloudSaves));
  }));
};
