import { createSignal, Show, createEffect, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from '../Modal';
import { Folder, Loader2, CheckSquare, Info } from 'lucide-solid';
import { addToast } from '../../store/toastStore';
import { Tooltip } from '../Tooltip';

export function SafExportModal(props: { isOpen: boolean; onClose: () => void; sourcePath: string; onExportComplete: () => void; onShizukuEnabled?: () => void; }) {
  const [isExporting, setIsExporting] = createSignal(false);
  const [autoDelete, setAutoDelete] = createSignal(true);
  const [isPollingShizuku, setIsPollingShizuku] = createSignal(false);

  let pollInterval: any;

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  createEffect(() => {
    if (!props.isOpen && pollInterval) {
      clearInterval(pollInterval);
      setIsPollingShizuku(false);
    }
  });

  const startExport = async () => {
    try {
      setIsExporting(true);
      
      // Step 1: Open the Android Folder Picker via Rust JNI
      const destUri: string | null = await invoke('pick_folder_for_export');
      
      if (!destUri) {
        addToast('Folder selection cancelled.', 'info');
        setIsExporting(false);
        return;
      }
      
      // Step 2: Copy the folder using the SafAPI
      addToast('Copying files... this may take a moment.', 'info');
      await invoke('copy_folder_to_tree', {
        sourcePath: props.sourcePath,
        destTreeUri: destUri
      });
      
      // Step 3: Auto-delete internal copy if checked
      if (autoDelete()) {
         try {
            const { remove } = await import('@tauri-apps/plugin-fs');
            await remove(props.sourcePath, { recursive: true });
         } catch(fsErr) {
            try { 
               const hasShizuku: boolean = await invoke('shizuku_check_permission');
               if (hasShizuku) {
                 const cmd = `rm -rf "${props.sourcePath}"`;
                 await invoke('shizuku_execute_command', { command: cmd });
               }
            } catch(e) {
               console.error("Failed to delete temp files", e);
            }
         }
      }
      
      addToast('Export successful!', 'success');
      props.onExportComplete();
      props.onClose();
    } catch (e: any) {
      addToast(e.message || 'Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const openShizuku = async () => {
     try {
       await invoke('shizuku_open_manager');
       setIsPollingShizuku(true);
       pollInterval = setInterval(async () => {
         try {
           const hasShizuku = await invoke<boolean>('shizuku_check_permission');
           if (hasShizuku) {
             clearInterval(pollInterval);
             setIsPollingShizuku(false);
             props.onShizukuEnabled?.();
           }
         } catch(e) {}
       }, 2000);
     } catch(e) {
       addToast('Failed to open Shizuku. Please install it from the Play Store.', 'error');
     }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="EXPORT SAVE DATA">
      <div class="flex flex-col gap-5 text-white p-2">
        <p class="text-sm text-zinc-300 leading-relaxed">
          Android blocks direct access to game folders. Please select a public folder (like 'Downloads') to export your files manually.
        </p>
        
        {/* Checkbox with Tooltip */}
        <label class="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-zinc-300 select-none">
          <button 
            type="button" 
            onClick={() => setAutoDelete(!autoDelete())}
            class={`w-5 h-5 flex items-center justify-center border transition-colors ${autoDelete() ? 'bg-[#FF7A00] border-[#FF7A00] text-black' : 'border-zinc-600 hover:border-zinc-400'}`}
          >
             <Show when={autoDelete()}><CheckSquare size={14}/></Show>
          </button>
          <span>Auto-delete temporary files</span>
          
          <Tooltip content="Suzu Editor stores a temporary copy in your hidden app storage. Keep this checked to delete it after exporting, preventing your storage from filling up." position="top">
            <Info size={14} class="text-zinc-500 hover:text-white transition-colors" />
          </Tooltip>
        </label>

        <button 
          onClick={startExport} 
          disabled={isExporting()}
          class="mt-2 w-full bg-[#FF7A00] hover:bg-white text-black font-black uppercase py-4 flex justify-center items-center gap-3 transition-colors disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(255,122,0,0.4)] hover:shadow-[0_0_20px_rgba(255,255,255,0.6)]"
        >
          <Show when={isExporting()} fallback={<><Folder size={20} strokeWidth={3}/> SELECT PUBLIC FOLDER</>}>
             <Loader2 size={20} class="animate-spin" /> EXPORTING...
          </Show>
        </button>

        <div class="w-full flex items-center gap-3 my-2">
           <div class="h-px bg-zinc-800 flex-1"></div>
           <span class="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Or for advanced users</span>
           <div class="h-px bg-zinc-800 flex-1"></div>
        </div>

        <button 
          onClick={openShizuku} 
          disabled={isExporting() || isPollingShizuku()}
          class="w-full border border-yellow-600/50 hover:bg-yellow-600/10 text-yellow-500 font-bold uppercase py-3 flex justify-center items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Show when={isPollingShizuku()} fallback={<>⚡ ENABLE DIRECT EXPORT (OPEN SHIZUKU)</>}>
            <Loader2 size={18} class="animate-spin" /> WAITING FOR SHIZUKU...
          </Show>
        </button>

      </div>
    </Modal>
  );
}
