import { createSignal, createEffect, untrack, Show } from 'solid-js';
import { MonacoEditor } from 'solid-monaco';
import { useEditorStore, updateParsedVariables } from '../store/editorStore';
import { addToast } from '../store/toastStore';
import { Save, Zap } from 'lucide-solid'; // Tambah icon Zap (Petir)
import { Tooltip } from './Header'; // Pastikan import Tooltip Anda

import loader from '@monaco-editor/loader';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    return new editorWorker();
  }
};

loader.config({ monaco });

export function RawJsonViewer() {
  const store = useEditorStore();
  const [code, setCode] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(true);
  
  // FITUR BARU: State untuk menahan Lite Mode
  const [isLiteMode, setIsLiteMode] = createSignal(false);

  createEffect(() => {
    if (store.editorMode === 'raw' && store.saveData?.parsed_variables) {
      setIsLoading(true);
      const dataToParse = store.saveData.parsed_variables;
      
      requestAnimationFrame(() => {
        setTimeout(() => {
          const incomingJson = JSON.stringify(dataToParse, null, 2);
          
          // AUTO-DETECT: Jika teks > 2 Juta Karakter (~2MB), paksa nyalakan Lite Mode!
          if (incomingJson.length > 2000000) {
            setIsLiteMode(true);
          } else {
            setIsLiteMode(false);
          }

          if (untrack(code) !== incomingJson) {
            setCode(incomingJson);
          }
          setIsLoading(false);
        }, 50);
      });
    }
  });

  // Efek Ruqyah RAM saat file ditutup
  createEffect(() => {
    if (!store.saveData) {
      setCode('');
      if (monaco) {
        monaco.editor.getModels().forEach(model => model.dispose());
      }
    }
  });

  const handleApply = () => {
    try {
      const parsed = JSON.parse(code());
      updateParsedVariables(parsed);
      addToast('Raw JSON applied successfully!', 'success');
    } catch (e: any) {
      addToast(`Invalid JSON: ${e.message}`, 'error');
    }
  };

  return (
    <div class="flex flex-col w-full h-full bg-[#1e1e1e] border-l border-zinc-800 relative">
      <div class="flex items-center justify-between p-2 bg-[#0a0a0a] border-b-2 border-zinc-800">
        <div class="flex items-center gap-3 px-2">
          <span class="text-xs text-[#FF00FF] font-bold tracking-widest uppercase flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[#FF00FF] animate-pulse"></span>
            RAW JSON EDITOR
          </span>

          {/* IDE ANDA DIWUJUDKAN DISINI: Tombol Lite Switch + Tooltip Peringatan */}
          <Tooltip text="Lite Mode disables Minimap & Folding to save RAM. Toggle OFF if your PC has 8GB RAM or more.">
            <button
              onClick={() => {
                setIsLiteMode(!isLiteMode());
                addToast(`Lite Mode ${isLiteMode() ? 'Activated (Low RAM)' : 'Deactivated (Full Engine)'}`, 'info');
              }}
              class={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono tracking-wider transition-all cursor-pointer ${
                isLiteMode()
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
              }`}
            >
              <Zap size={13} class={isLiteMode() ? 'fill-amber-400 animate-bounce' : ''} />
              <span>LITE MODE: <strong>{isLiteMode() ? 'ON' : 'OFF'}</strong></span>
            </button>
          </Tooltip>

        </div>
        <button
          onClick={handleApply}
          class="flex items-center gap-2 px-6 py-1.5 bg-transparent hover:bg-[#FF00FF] text-[#FF00FF] hover:text-white border border-[#FF00FF] transition-all cursor-pointer font-bold uppercase tracking-widest text-xs"
        >
          <Save size={14} />
          Apply JSON
        </button>
      </div>
      <div class="flex-1 overflow-hidden relative">
        <Show when={isLoading()}>
          <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#1e1e1e] backdrop-blur-sm">
            <div class="w-12 h-12 border-4 border-zinc-800 border-t-[#FF00FF] rounded-full animate-spin mb-4"></div>
            <span class="text-[#FF00FF] font-brains text-sm tracking-widest uppercase animate-pulse">
              Parsing Massive JSON...
            </span>
          </div>
        </Show>
        <MonacoEditor
          language={isLiteMode() ? "plaintext" : "json"}
          theme="vs-dark"
          value={code()}
          onChange={(value) => setCode(value)}
          onMount={(monaco, editor) => {
            monaco.editor.setTheme('vs-dark');
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleApply());
          }}
          options={{
            theme: 'vs-dark',
            // OPSI TERHUBUNG LANGSUNG KE LITE SWITCH:
            minimap: { enabled: !isLiteMode(), scale: 0.75 },
            folding: !isLiteMode(),
            matchBrackets: !isLiteMode() ? 'always' : 'never', // Matikan pencari kurung pasangan kalau Lite
            fontSize: 14,
            wordWrap: 'off',
            scrollBeyondLastLine: false,
            formatOnPaste: true,
            fontFamily: 'Consolas, "Courier New", monospace',
            padding: { top: 16 }
          }}
        />
      </div>
    </div>
  );
}