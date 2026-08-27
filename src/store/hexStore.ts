import { createStore } from 'solid-js/store';
import { DiffResult } from '../services/ipc';

interface HexState {
  rawPayload: Uint8Array | null;
  decryptionKey: string;
  startingOffset: number;
  diffFileB: string | null;
  diffs: DiffResult[];
}

const [hexState, setHexState] = createStore<HexState>({
  rawPayload: null,
  decryptionKey: '',
  startingOffset: 0,
  diffFileB: null,
  diffs: [],
});

export const useHexStore = () => hexState;

export const setRawPayload = (payload: Uint8Array) => setHexState('rawPayload', payload);
export const setDecryptionKey = (key: string) => setHexState('decryptionKey', key);
export const setStartingOffset = (offset: number) => setHexState('startingOffset', offset);
export const setDiffFileB = (file: string | null) => setHexState('diffFileB', file);
export const setDiffs = (diffs: DiffResult[]) => setHexState('diffs', diffs);
export const clearDiffs = () => setHexState({ diffFileB: null, diffs: [] });
export const clearPayload = () => setHexState({ rawPayload: null, decryptionKey: '', startingOffset: 0, diffFileB: null, diffs: [] });
