import { createSignal, Show, For, createEffect } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from '../Modal';
import { Folder, ArrowLeft, Loader2, Download } from 'lucide-solid';
import { addToast } from '../../store/toastStore';

export function ShizukuExportModal(props: { isOpen: boolean; onClose: () => void; sourcePath: string; onExportComplete: () => void; }) {
  const [currentPath, setCurrentPath] = createSignal('/sdcard/Android/data');
  const [folders, setFolders] = createSignal<string[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  const fetchFolders = async (path: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Menambahkan / di akhir path agar find menembus symlink (seperti /sdcard)
      const cmd = `find "${path}/" -mindepth 1 -maxdepth 1 -type d | sort`;
      const result: string = await invoke('shizuku_execute_command', { command: cmd });
      
      const lines = result.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      setFolders(lines.map(l => l.substring(l.lastIndexOf('/') + 1)));
      setCurrentPath(path);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to read directory');
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      fetchFolders('/sdcard/Android/data');
    }
  });

  const goUp = () => {
    if (currentPath() === '/sdcard') return;
    const parts = currentPath().split('/').filter(Boolean);
    parts.pop();
    fetchFolders('/' + parts.join('/'));
  };

  const navigateTo = (folderName: string) => {
    fetchFolders(`${currentPath()}/${folderName}`);
  };

  const confirmExport = async () => {
    try {
      setIsExporting(true);
      const destPath = currentPath();
      
      // Use cp -r first to ensure safe copy, then remove source.
      // Safer than mv across different partitions/mounts in some Android devices.
      const cmd = `cp -r "${props.sourcePath}"/* "${destPath}/" && rm -rf "${props.sourcePath}"`;
      await invoke('shizuku_execute_command', { command: cmd });
      
      addToast('Export successful!', 'success');
      props.onExportComplete();
      props.onClose();
    } catch (e: any) {
      addToast(e.message || 'Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="SELECT DESTINATION">
      <div class="flex flex-col gap-4 text-white">
        <p class="text-xs text-zinc-400">Navigate to the game's save folder. Shizuku will inject the files directly here.</p>
        
        {/* Breadcrumb / Path */}
        <div class="flex items-center gap-2 bg-zinc-900 p-2 border border-zinc-800">
           <button onClick={goUp} class="p-3 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-50 cursor-pointer flex-shrink-0" disabled={currentPath() === '/sdcard'}>
             <ArrowLeft size={20} />
           </button>
           <div class="font-mono text-xs truncate flex-1 tracking-wider text-green-400 pl-2">{currentPath()}</div>
        </div>

        {/* Folder List */}
        <div class="h-[40vh] overflow-y-auto border border-zinc-800 bg-black flex flex-col">
          <Show when={isLoading()}>
            <div class="flex justify-center items-center h-full"><Loader2 class="animate-spin text-zinc-500" size={24}/></div>
          </Show>
          <Show when={errorMsg()}>
             <div class="text-red-500 text-xs p-4 text-center">{errorMsg()}</div>
          </Show>
          <Show when={!isLoading() && !errorMsg()}>
             <For each={folders()}>
               {(folder) => (
                  <div 
                    class="flex items-center gap-3 p-3 hover:bg-zinc-900 cursor-pointer border-b border-zinc-900/50"
                    onClick={() => navigateTo(folder)}
                  >
                    <Folder size={18} class="text-[#FF7A00]" />
                    <span class="text-sm font-mono truncate">{folder}</span>
                  </div>
               )}
             </For>
             <Show when={folders().length === 0}>
                <div class="text-zinc-600 text-xs text-center mt-8">Empty Directory</div>
             </Show>
          </Show>
        </div>

        <button 
          onClick={confirmExport} 
          disabled={isExporting() || isLoading()}
          class="w-full bg-[#FF7A00] hover:bg-white text-black font-black uppercase py-4 flex justify-center items-center gap-3 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Show when={isExporting()} fallback={<><Download size={20} strokeWidth={3}/> EXPORT TO THIS FOLDER</>}>
             <Loader2 size={20} class="animate-spin" /> EXPORTING...
          </Show>
        </button>
      </div>
    </Modal>
  );
}
