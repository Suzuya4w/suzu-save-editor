import { createStore } from 'solid-js/store';

interface SettingsState {
  isSettingsOpen: boolean;
  enableEffects: boolean;
}

const [settingsState, setSettingsState] = createStore<SettingsState>({
  isSettingsOpen: false,
  enableEffects: true,
});

export const useSettingsStore = () => settingsState;

export const setIsSettingsOpen = (val: boolean) => {
  setSettingsState('isSettingsOpen', val);
};

export const toggleEffects = () => setSettingsState('enableEffects', (prev) => !prev);
