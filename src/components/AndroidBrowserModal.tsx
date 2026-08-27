import { createSignal, Show, For } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from './Modal';
import { Smartphone, RefreshCcw, Folder, File, HardDrive, AlertCircle, CornerLeftUp } from 'lucide-solid';
import { loadSaveData } from '../store/editorStore';
import { addToast } from '../store/toastStore';


interface AdbFileMeta {
  name: string;
  is_dir: boolean;
  size: number;
  date: string;
}

interface AdbDevice {
  id: string;
  model: string;
}

export function AndroidBrowserModal(props: { isOpen: boolean; onClose: () => void }) {
  const [devices, setDevices] = createSignal<AdbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = createSignal<string | null>(null);
  const [currentPath, setCurrentPath] = createSignal<string>('/sdcard/');
  const [files, setFiles] = createSignal<AdbFileMeta[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const scanDevices = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result: AdbDevice[] = await invoke('adb_list_devices');
      setDevices(result);
      if (result.length > 0) {
        setSelectedDevice(result[0].id);
        loadDirectory(result[0].id, '/sdcard/');
      } else {
        setSelectedDevice(null);
        setFiles([]);
      }
    } catch (e: any) {
      setErrorMsg(e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const loadDirectory = async (deviceId: string, path: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Ensure path ends with /
      let targetPath = path;
      if (!targetPath.endsWith('/')) targetPath += '/';
      
      const result: AdbFileMeta[] = await invoke('adb_list_files', {
        deviceId,
        path: targetPath
      });
      setFiles(result);
      setCurrentPath(targetPath);
    } catch (e: any) {
      setErrorMsg(e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const navigateUp = () => {
    const dev = selectedDevice();
    if (!dev) return;
    
    // Remove trailing slash if present
    let path = currentPath();
    if (path.endsWith('/')) path = path.slice(0, -1);
    
    // Find last slash
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) {
      loadDirectory(dev, '/');
    } else if (lastSlash === 0) {
      loadDirectory(dev, '/');
    } else {
      loadDirectory(dev, path.substring(0, lastSlash + 1));
    }
  };

  const handleFileClick = async (file: AdbFileMeta) => {
    const dev = selectedDevice();
    if (!dev) return;

    const fullPath = currentPath() + file.name;

    if (file.is_dir) {
      loadDirectory(dev, fullPath);
    } else {
      // Pull and open!
      setIsLoading(true);
      setErrorMsg(null);
      try {
        addToast(`Pulling ${file.name} from device...`, 'info');
        const localPath: string = await invoke('adb_pull_file', {
          deviceId: dev,
          remotePath: fullPath
        });

        // Use the standard openSaveFile but point to temp
        const saveResult = await invoke('open_save_file', { 
          path: localPath,
          activeProfileRules: null
        });
        
        loadSaveData(saveResult as any, localPath, null);
        
        // IMPORTANT: Set ADB info so Header knows how to save it
        setTimeout(() => {
          import('../store/editorStore').then(({ setAdbInfo }) => {
            setAdbInfo(dev, fullPath);
          });
        }, 100);

        props.onClose();
        addToast(`Successfully pulled and loaded ${file.name}`, 'success');
      } catch (e: any) {
        setErrorMsg(`Failed to pull file: ${e.message || String(e)}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="ANDROID DEVICE BROWSER"
      icon={<Smartphone size={18} class="text-[#00F0FF]" />}
      width="max-w-4xl"
    >
      <div class="flex flex-col gap-4 h-[60vh]">
        {/* Toolbar */}
        <div class="flex gap-4 items-center p-3 bg-[#0a0a0a] border border-zinc-800 shrink-0">
          <button 
            onClick={scanDevices}
            disabled={isLoading()}
            class="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-[#00F0FF] hover:text-[#00F0FF] text-zinc-300 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCcw size={14} class={isLoading() && !selectedDevice() ? "animate-spin" : ""} />
            Scan Devices
          </button>
          
          <Show when={devices().length > 0} fallback={<span class="text-zinc-600 text-xs uppercase font-bold tracking-widest">No devices detected</span>}>
            <div class="flex items-center gap-2 border border-zinc-700 bg-zinc-950 px-3 py-1">
              <HardDrive size={14} class="text-zinc-400" />
              <select 
                class="bg-transparent text-[#00F0FF] font-bold text-xs uppercase tracking-widest outline-none border-none cursor-pointer"
                value={selectedDevice() || ''}
                onChange={(e) => {
                  setSelectedDevice(e.target.value);
                  loadDirectory(e.target.value, '/sdcard/');
                }}
              >
                <For each={devices()}>
                  {(dev) => <option value={dev.id}>{dev.model}</option>}
                </For>
              </select>
            </div>
          </Show>
        </div>

        {/* Error Bar */}
        <Show when={errorMsg()}>
          <div class="p-3 bg-red-500/10 border border-red-500 text-red-400 text-xs font-bold font-desc break-all flex items-start gap-2">
            <AlertCircle size={16} class="shrink-0 mt-0.5" />
            <div class="flex-1 overflow-hidden">
              <span class="block mb-1 text-red-500 uppercase tracking-widest font-mono">ADB ERROR</span>
              {errorMsg()}
            </div>
          </div>
        </Show>

        <Show when={selectedDevice()}>
          {/* Path Bar */}
          <div class="flex items-center gap-2 bg-zinc-950 border-b border-zinc-800 p-2 text-xs font-desc shrink-0">
            <button 
              onClick={navigateUp}
              disabled={currentPath() === '/'}
              class="px-2 py-1 bg-zinc-900 border border-zinc-700 hover:border-[#00F0FF] hover:text-[#00F0FF] text-zinc-400 font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-30 flex items-center gap-2"
              title="Go Up a Directory"
            >
              <CornerLeftUp size={14} /> UP
            </button>
            <span class="text-[#00F0FF] truncate ml-2">{currentPath()}</span>
          </div>

          {/* File List */}
          <div class="flex-1 overflow-y-auto bg-[#050505] custom-scrollbar border border-zinc-800 relative">
            <Show when={isLoading() && files().length > 0}>
              <div class="absolute inset-0 z-10 flex items-center justify-center bg-black/95">
                <RefreshCcw size={24} class="animate-spin text-[#00F0FF]" />
              </div>
            </Show>
            
            <table class="w-full table-auto text-left text-xs font-desc">
              <thead class="sticky top-0 bg-zinc-950 border-b border-zinc-800 z-10 text-zinc-500 uppercase tracking-widest shadow-md font-mono">
                <tr>
                  <th class="py-3 px-4 font-normal">Name</th>
                  <th class="py-3 px-4 font-normal w-52">Date</th>
                  <th class="py-3 px-4 font-normal w-32 text-right">Size</th>
                </tr>
              </thead>
              <tbody class="font-serif">
                <For each={files()}>
                  {(file) => (
                    <tr 
                      onClick={() => handleFileClick(file)}
                      class="border-b border-zinc-800/50 hover:bg-zinc-900 cursor-pointer group"
                    >
                    <td class="py-2 px-4">
                      <div class="flex items-center gap-3">
                        <Show when={file.is_dir} fallback={<File size={14} class="text-zinc-500 group-hover:text-orange-400" />}>
                          <Folder size={14} class="text-yellow-500 group-hover:text-yellow-400" />
                        </Show>
                        <span class={`truncate font-bold ${file.is_dir ? 'text-zinc-300' : 'text-zinc-400'}`}>
                          {file.name}
                        </span>
                      </div>
                    </td>
                      <td class="py-2 px-4 text-zinc-600 whitespace-nowrap">{file.date}</td>
                      <td class="py-2 px-4 text-zinc-600 text-right whitespace-nowrap">{formatSize(file.size)}</td>
                    </tr>
                  )}
                </For>
                <Show when={files().length === 0 && !isLoading()}>
                  <tr>
                    <td colSpan={3} class="py-8 text-center text-zinc-600 font-bold uppercase tracking-widest">
                      Directory is empty
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </Modal>
  );
}
