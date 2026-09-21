import { createSignal, Show, createEffect, onCleanup, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from './Modal';
import { Folder, Loader2, Info, ArrowLeft, File as FileIcon } from 'lucide-solid';
import { addToast } from '../store/toastStore';

export function ImportMethodModal(props: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSelectDefault: () => void; 
  onShizukuReady: () => void;
}) {
  const [isChecking, setIsChecking] = createSignal(false);
  const [needsSetup, setNeedsSetup] = createSignal(false);
  const [isPolling, setIsPolling] = createSignal(false);
  const [notInstalled, setNotInstalled] = createSignal(false);

  let pollInterval: any;

  const stopPolling = () => {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = null;
    setIsPolling(false);
  };

  onCleanup(() => {
    stopPolling();
  });

  createEffect(() => {
    if (!props.isOpen) {
      stopPolling();
      setNeedsSetup(false);
      setNotInstalled(false);
      setIsChecking(false);
    }
  });

  const handleShizukuClick = async () => {
    setIsChecking(true);
    try {
      const hasShizuku = await invoke<boolean>('shizuku_check_permission');
      if (hasShizuku) {
        props.onShizukuReady();
      } else {
        const isInst = await invoke<boolean>('shizuku_is_installed').catch(() => true);
        setNotInstalled(!isInst);
        setNeedsSetup(true);
      }
    } catch(e) {
      setNeedsSetup(true);
    } finally {
      setIsChecking(false);
    }
  };

  const openShizuku = async () => {
    try {
      const res: string = await invoke('shizuku_open_manager');
      if (res === 'NOT_INSTALLED_OPENED_STORE' || res === 'NOT_INSTALLED') {
        setNotInstalled(true);
        addToast('Shizuku is not installed. Opening store page...', 'info');
        return;
      }

      setNotInstalled(false);
      setIsPolling(true);
      let attempts = 0;
      const MAX_ATTEMPTS = 15; // 30 seconds

      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        attempts++;
        try {
          const isAvail = await invoke<boolean>('shizuku_is_available').catch(() => false);
          if (isAvail) {
            await invoke('shizuku_request_permission').catch(() => {});
          }

          const hasShizuku = await invoke<boolean>('shizuku_check_permission');
          if (hasShizuku) {
            stopPolling();
            props.onShizukuReady();
            return;
          }
        } catch(e) {}

        if (attempts >= MAX_ATTEMPTS) {
          stopPolling();
          addToast('Timed out waiting for Shizuku. Please ensure the Shizuku service is running.', 'warning');
        }
      }, 2000);
    } catch(e) {
      addToast('Failed to open Shizuku.', 'error');
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="SELECT IMPORT METHOD">
      <div class="flex flex-col gap-4 text-white p-2">
        <Show when={!needsSetup()}>
          <p class="text-sm text-zinc-300 leading-relaxed mb-2">
            Android blocks direct access to game folders in <code class="bg-zinc-800 px-1">Android/data</code>. How would you like to select your save file?
          </p>
          
          <button 
            onClick={props.onSelectDefault}
            class="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 flex flex-col items-center justify-center transition-colors cursor-pointer border border-zinc-700"
          >
            <span class="uppercase tracking-widest text-sm">Standard File Picker</span>
            <span class="text-[10px] text-zinc-400 font-serif mt-1">For files in Downloads or internal storage</span>
          </button>

          <div class="w-full flex items-center gap-3 my-2">
             <div class="h-px bg-zinc-800 flex-1"></div>
             <span class="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Or</span>
             <div class="h-px bg-zinc-800 flex-1"></div>
          </div>

          <button 
            onClick={handleShizukuClick}
            disabled={isChecking()}
            class="w-full bg-[#FF7A00] hover:bg-white text-black font-black uppercase py-4 flex flex-col justify-center items-center transition-colors disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(255,122,0,0.4)]"
          >
            <Show when={isChecking()} fallback={
              <>
                <span class="tracking-widest flex items-center gap-2">⚡ SHIZUKU / ROOT</span>
                <span class="text-[10px] font-serif mt-1 opacity-80 normal-case">Directly pick from game folders</span>
              </>
            }>
              <span class="tracking-widest flex items-center gap-2"><Loader2 size={16} class="animate-spin"/> CHECKING...</span>
            </Show>
          </button>

          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onClose();
            }}
            class="w-full mt-1 py-3 text-xs text-zinc-400 hover:text-white uppercase font-bold tracking-wider cursor-pointer border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
        </Show>

        <Show when={needsSetup()}>
          <Show when={notInstalled()} fallback={
            <div class="text-center bg-zinc-900 border border-zinc-700 p-4 flex flex-col items-center gap-3">
              <Info size={24} class="text-yellow-500" />
              <h3 class="font-bold text-yellow-500 uppercase tracking-widest">Shizuku Not Ready</h3>
              <p class="text-xs text-zinc-400 font-serif mb-2">
                We couldn't detect Shizuku access. Please make sure Shizuku is running and permission is granted to Suzu Editor.
              </p>
              
              <Show when={isPolling()} fallback={
                <button 
                  onClick={openShizuku} 
                  class="w-full border border-yellow-600/50 hover:bg-yellow-600/10 text-yellow-500 font-bold uppercase py-3 flex justify-center items-center gap-2 transition-colors cursor-pointer"
                >
                  OPEN SHIZUKU MANAGER
                </button>
              }>
                <div class="flex flex-col gap-2 w-full">
                  <div class="w-full border border-yellow-600/50 bg-yellow-600/10 text-yellow-500 font-bold uppercase py-3 flex justify-center items-center gap-2 text-xs">
                    <Loader2 size={16} class="animate-spin" /> WAITING FOR SHIZUKU (MAX 30S)...
                  </div>
                  <button 
                    onClick={stopPolling}
                    class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider cursor-pointer border border-zinc-700"
                  >
                    Cancel Waiting
                  </button>
                </div>
              </Show>

              <button onClick={() => { stopPolling(); setNeedsSetup(false); }} class="text-xs text-zinc-500 hover:text-white underline mt-2 cursor-pointer">
                Back to choices
              </button>
            </div>
          }>
            <div class="text-center bg-zinc-900 border border-zinc-700 p-4 flex flex-col items-center gap-3">
              <Info size={24} class="text-yellow-500" />
              <h3 class="font-bold text-yellow-500 uppercase tracking-widest">Shizuku Not Installed</h3>
              <p class="text-xs text-zinc-400 font-serif mb-2">
                Shizuku is not installed on your device. Please install Shizuku, start the service, and grant permission to Suzu Editor.
              </p>
              <button 
                onClick={openShizuku} 
                class="w-full bg-[#FF7A00] hover:bg-white text-black font-bold uppercase py-3 flex justify-center items-center gap-2 transition-colors cursor-pointer"
              >
                Install / Open Store
              </button>
              <button 
                onClick={handleShizukuClick}
                disabled={isChecking()}
                class="w-full border border-zinc-600 hover:bg-zinc-800 text-white font-bold uppercase py-2.5 flex justify-center items-center gap-2 transition-colors cursor-pointer text-xs"
              >
                <Show when={isChecking()} fallback={<>Check Again</>}>
                  <Loader2 size={14} class="animate-spin" /> Checking...
                </Show>
              </button>
              <button onClick={() => { setNeedsSetup(false); setNotInstalled(false); }} class="text-xs text-zinc-500 hover:text-white underline mt-1 cursor-pointer">
                Back to choices
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </Modal>
  );
}

export function ShizukuImportBrowser(props: { isOpen: boolean; onClose: () => void; onFileSelected: (localPath: string, remotePath: string) => void; }) {
  const [currentPath, setCurrentPath] = createSignal('/sdcard/Android/data');
  const [items, setItems] = createSignal<{name: string, isDir: boolean}[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  const fetchItems = async (path: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const cmdDir = `find "${path}/" -mindepth 1 -maxdepth 1 -type d | sort`;
      const resultDir: string = await invoke('shizuku_execute_command', { command: cmdDir });
      
      const cmdFile = `find "${path}/" -mindepth 1 -maxdepth 1 -type f | sort`;
      const resultFile: string = await invoke('shizuku_execute_command', { command: cmdFile });
      
      const dirLines = resultDir.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const fileLines = resultFile.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      const dirItems = dirLines.map(l => ({ name: l.substring(l.lastIndexOf('/') + 1), isDir: true }));
      const fileItems = fileLines.map(l => ({ name: l.substring(l.lastIndexOf('/') + 1), isDir: false }));
      
      setItems([...dirItems, ...fileItems]);
      setCurrentPath(path);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to read directory');
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      fetchItems('/sdcard/Android/data');
    }
  });

  const goUp = () => {
    if (currentPath() === '/sdcard') return;
    const parts = currentPath().split('/').filter(Boolean);
    parts.pop();
    fetchItems('/' + parts.join('/'));
  };

  const handleItemClick = async (item: {name: string, isDir: boolean}) => {
    const fullPath = `${currentPath()}/${item.name}`;
    if (item.isDir) {
      fetchItems(fullPath);
    } else {
      try {
        setIsLoading(true);
        const { appDataDir } = await import('@tauri-apps/api/path');
        const { mkdir } = await import('@tauri-apps/plugin-fs');
        const baseDir = await appDataDir();
        await mkdir(baseDir, { recursive: true }).catch(() => {});
        
        // Preserve original extension and name
        const safeName = item.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const tempFile = baseDir + '/shizuku_' + Date.now() + '_' + safeName;
        
        await invoke('shizuku_pull_file', { remotePath: fullPath, localPath: tempFile });
        
        props.onFileSelected(tempFile, fullPath);
        props.onClose();
      } catch (err: any) {
         addToast(err.message || 'Failed to copy file via Shizuku', 'error');
      } finally {
         setIsLoading(false);
      }
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="SELECT SAVE FILE">
      <div class="flex flex-col gap-4 text-white">
        <p class="text-xs text-zinc-400">Navigate to your game's save folder and select the save file to edit.</p>
        
        <div class="flex items-center gap-2 bg-zinc-900 p-2 border border-zinc-800">
           <button onClick={goUp} class="p-3 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-50 cursor-pointer flex-shrink-0" disabled={currentPath() === '/sdcard'}>
             <ArrowLeft size={20} />
           </button>
           <div class="font-mono text-xs truncate flex-1 tracking-wider text-green-400 pl-2">{currentPath()}</div>
        </div>

        <div class="h-[60vh] overflow-y-auto border border-zinc-800 bg-black flex flex-col">
          <Show when={isLoading()}>
            <div class="flex justify-center items-center h-full"><Loader2 class="animate-spin text-zinc-500" size={24}/></div>
          </Show>
          <Show when={errorMsg()}>
             <div class="text-red-500 text-xs p-4 text-center">{errorMsg()}</div>
          </Show>
          <Show when={!isLoading() && !errorMsg()}>
             <For each={items()}>
               {(item) => (
                  <div 
                    class="flex items-center gap-3 p-3 hover:bg-zinc-900 cursor-pointer border-b border-zinc-900/50"
                    onClick={() => handleItemClick(item)}
                  >
                    <Show when={item.isDir} fallback={<FileIcon size={18} class="text-zinc-400" />}>
                      <Folder size={18} class="text-[#FF7A00]" />
                    </Show>
                    <span class={`text-sm font-mono truncate ${!item.isDir ? 'text-zinc-300' : 'text-white'}`}>{item.name}</span>
                  </div>
               )}
             </For>
             <Show when={items().length === 0}>
                <div class="text-zinc-600 text-xs text-center mt-8">Empty Directory</div>
             </Show>
          </Show>
        </div>
      </div>
    </Modal>
  );
}
