import { createSignal, onMount, onCleanup } from 'solid-js';
import { loadSaveData, setShizukuRemotePath } from '../store/editorStore';
import { addToast } from '../store/toastStore';
import { FileUp, Loader2 } from 'lucide-solid';
import { open } from '@tauri-apps/plugin-dialog';
import { openSaveFile } from '../services/ipc';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { ImportMethodModal, ShizukuImportBrowser } from './ShizukuImportModals';

export function Dropzone() {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [showImportMethodModal, setShowImportMethodModal] = createSignal(false);
  const [showShizukuBrowser, setShowShizukuBrowser] = createSignal(false);

  let unlistenDragDrop: () => void;

  onMount(async () => {
    const appWindow = getCurrentWebviewWindow();
    
    unlistenDragDrop = await appWindow.onDragDropEvent((event) => {
      const payload = event.payload;

      if (payload.type === 'enter' || payload.type === 'over') {
        setIsDragging(true);
      } else if (payload.type === 'leave') {
        setIsDragging(false);
      } else if (payload.type === 'drop') {
        setIsDragging(false);
        const paths = payload.paths;
        
        if (paths && paths.length > 0) {
          processFile(paths[0]);
        }
      }
    });
  });

  onCleanup(() => {
    if (unlistenDragDrop) unlistenDragDrop();
  });

  const processFile = async (filePath: string, remotePath?: string) => {
    try {
      setIsLoading(true);
      addToast('Parsing save file...', 'info');
      const data = await openSaveFile(filePath);
      loadSaveData(data, filePath, null);
      if (remotePath) {
        setShizukuRemotePath(remotePath);
      }
      addToast('File loaded successfully', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to open file', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [isPasting, setIsPasting] = createSignal(false);
  const [pasteData, setPasteData] = createSignal('');

  const handleDragOver = (e: any) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: any) => {
    e.preventDefault();
  };

  const handleDrop = (e: any) => {
    e.preventDefault(); 
  };

  const handleSelect = async () => {
    if (isLoading() || isPasting()) return;
    try {
      const { platform } = await import('@tauri-apps/plugin-os');
      const os = await platform();
      if (os === 'android') {
          setShowImportMethodModal(true);
          return;
      }
      
      let selected: any = await open({
        multiple: false,
      });
      
      if (selected && typeof selected === 'string') {
        await processFile(selected);
      }
    } catch (err) {
      console.error(err);
      addToast('File selection cancelled or failed', 'error');
    }
  };

  const handleDefaultAndroidSelect = async () => {
    setShowImportMethodModal(false);
    try {
      let selected: any = await invoke('pick_file_for_write');
      if (selected && typeof selected === 'string') {
        await processFile(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasteSubmit = async (e: any) => {
    e.stopPropagation();
    if (!pasteData().trim()) {
      addToast('Paste string is empty', 'error');
      return;
    }
    
    try {
      setIsLoading(true);
      addToast('Processing pasted string...', 'info');
      
      const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const { appDataDir } = await import('@tauri-apps/api/path');
      const tempPath = await appDataDir() + '\\temp_pasted_save.txt';
      
      await writeTextFile('temp_pasted_save.txt', pasteData(), { baseDir: BaseDirectory.AppData });
      
      const data = await openSaveFile(tempPath);
      loadSaveData(data, tempPath, null);
      addToast('String loaded successfully', 'success');
      setIsPasting(false);
      setPasteData('');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to parse string', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleSelect}
      class={`w-full max-w-3xl min-h-[200px] md:min-h-[300px] bg-black border-4 border-zinc-200 flex flex-col items-center justify-center transition-all duration-150 group z-10 shadow-[8px_8px_0px_#FF7A00] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0px_#FF7A00] hover:bg-zinc-100 hover:text-black relative overflow-hidden ${
        isDragging() ? 'bg-zinc-100 text-black translate-x-[2px] translate-y-[2px] shadow-[6px_6px_0px_#FF7A00] cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      <div class="absolute top-0 right-0 bg-[repeating-linear-gradient(45deg,#FF7A00,#FF7A00_10px,black_10px,black_20px)] w-40 h-4 border-b-4 border-l-4 border-zinc-200"></div>

      {isLoading() ? (
        <>
          <Loader2 class="size-12 md:size-20 mb-2 md:mb-4 animate-spin text-[#FF7A00]" />
          <h2 class="text-lg md:text-2xl font-bold uppercase font-desc tracking-wide group-hover:text-black transition-none px-4 text-center">Decrypting File...</h2>
          <p class="text-xs md:text-sm text-zinc-500 mt-2 font-serif group-hover:text-black transition-colors px-4 text-center">Parsing variables and schema</p>
        </>
      ) : isPasting() ? (
        <div class="flex flex-col items-center justify-center w-full h-full p-4 md:p-8" onClick={(e) => e.stopPropagation()}>
          <h2 class="text-lg md:text-xl font-bold uppercase tracking-wide group-hover:text-black mb-4">Paste Save Data</h2>
          <textarea 
            class="w-full flex-grow min-h-[100px] bg-zinc-900 border-2 border-zinc-700 text-white p-2 font-mono text-sm resize-none focus:outline-none focus:border-[#FF7A00] transition-colors"
            placeholder="Paste your raw JSON or Base64 string here..."
            value={pasteData()}
            onInput={(e) => setPasteData(e.currentTarget.value)}
          />
          <div class="flex flex-row gap-4 mt-4 w-full justify-end">
            <button 
              class="px-4 py-2 cursor-pointer border-2 border-zinc-500 text-zinc-400 font-bold uppercase hover:bg-zinc-200 hover:text-black transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsPasting(false); setPasteData(''); }}
            >
              Cancel
            </button>
            <button 
              class="px-4 py-2 cursor-pointer bg-[#FF7A00] border-2 border-[#FF7A00] text-black font-bold uppercase hover:bg-white hover:border-black transition-colors"
              onClick={handlePasteSubmit}
            >
              Load Data
            </button>
          </div>
        </div>
      ) : (
        <>
          <FileUp class="size-12 md:size-20 mb-2 md:mb-4 group-hover:text-[#FF7A00] transition-colors" />
          <h2 class="text-lg md:text-2xl font-bold uppercase tracking-wide group-hover:text-black transition-none px-4 text-center">Drop your Save File here</h2>
          <p class="text-xs md:text-sm text-zinc-500 mt-2 group-hover:text-black font-desc transition-colors px-4 text-center">Or click to browse your computer</p>
          <div class="mt-6 z-20">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPasting(true); }}
              class="px-4 py-2 cursor-pointer bg-transparent border-2 border-zinc-600 text-zinc-400 group-hover:border-zinc-800 group-hover:text-zinc-800 font-bold uppercase hover:!bg-zinc-800 hover:!text-white transition-colors text-xs md:text-sm"
            >
              Or Paste Text Directly
            </button>
          </div>
        </>
      )}
    </div>

    <ImportMethodModal 
      isOpen={showImportMethodModal()} 
      onClose={() => setShowImportMethodModal(false)}
      onSelectDefault={handleDefaultAndroidSelect}
      onShizukuReady={() => {
        setShowImportMethodModal(false);
        setShowShizukuBrowser(true);
      }}
    />

    <ShizukuImportBrowser 
      isOpen={showShizukuBrowser()} 
      onClose={() => setShowShizukuBrowser(false)}
      onFileSelected={(localPath, remotePath) => {
        processFile(localPath, remotePath);
      }}
    />
  </>
);
}