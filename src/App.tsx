// @ts-nocheck
import { createSignal, onMount, Show, Switch, Match, For, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Dropzone } from "./components/Dropzone";
import { TreeView } from "./components/TreeView";
import { EasyMode } from "./components/EasyMode";
import { Header } from "./components/Header";
import { DedSecBackground } from "./components/DedSecBackground";
import { ToastContainer } from "./components/Toast";
import { HexViewer } from "./components/HexViewer";
import { Modal } from "./components/Modal";
import { RawJsonViewer } from "./components/RawJsonViewer";
import { Info, Settings, Database, Gamepad2, Monitor, MessageSquare, Heart, Loader2, Smartphone, Zap, Lock, RefreshCw } from 'lucide-solid';
import "./App.css";
import { CloudDatabaseBrowser } from './components/CloudDatabaseBrowser';
import { AndroidBrowserModal } from './components/AndroidBrowserModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from "./components/HelpModal";
import { AiDiffModal } from "./components/AiDiffModal";
import { PlatformConverterModal } from "./components/PlatformConverterModal";
import { SupportModal } from "./components/SupportModal";
import { BackupManagerModal } from "./components/BackupManagerModal";
import { useEditorStore, loadSaveData, setIsHelpModalOpen } from "./store/editorStore";
import { setIsSettingsOpen } from "./store/settingsStore";
import { McpBridge } from "./components/McpBridge";
import { addToast } from "./store/toastStore";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch, exit } from '@tauri-apps/plugin-process';
import { type } from '@tauri-apps/plugin-os';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';

export function Tooltip(props: { text: string, position?: 'top' | 'bottom', align?: 'center' | 'left' | 'right', class?: string, children: any }) {
  const [show, setShow] = createSignal(false);
  
  let alignmentClass = 'left-1/2 -translate-x-1/2';
  if (props.align === 'left') alignmentClass = 'left-0';
  if (props.align === 'right') alignmentClass = 'right-0';

  return (
    <div
      class={`relative inline-flex items-center justify-center ${props.class || ''}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <div class={`absolute z-[100] w-max max-w-[280px] text-wrap text-center px-4 py-2 bg-black text-white text-[12px] font-serif leading-relaxed border-2 border-white pointer-events-none shadow-[4px_4px_0px_white] ${alignmentClass} ${props.position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {props.text}
        </div>
      </Show>
    </div>
  );
}

export const SUPPORTED_ENGINES = [
 { id: 'rpgmv', name: 'RPG Maker MV/MZ', ext: '.rpgsave' },
 { id: 'rpgxp', name: 'RPG Maker XP/VX/Ace', ext: '.rxdata, .rvdata2' },
 { id: 'renpy', name: 'Ren\'Py', ext: '.save' },
 { id: 'kirikiri', name: 'KiriKiri', ext: '.dat, .sav' },
 { id: 'unity', name: 'Unity PlayerPrefs', ext: 'Registry, .xml, .json' },
 { id: 'unity_es3', name: 'Unity EasySave 3', ext: '.es3, .save' },
 { id: 'tyrano', name: 'TyranoBuilder', ext: '.sav, .ks' },
 { id: 'naninovel', name: 'Naninovel', ext: '.nson, .dat' },
 { id: 'godot', name: 'Godot Engine', ext: '.save, .cfg, .json' },
 { id: 'gamemaker', name: 'GameMaker Studio', ext: '.sav, .ini' },
 { id: 'stardew', name: 'C# XML (Stardew)', ext: '.xml' },
 { id: 'flash', name: 'Flash Legacy', ext: '.sol' },
 { id: 'standard_json', name: 'Standard JSON / HTML5', ext: '.json' }
];

 function App() {
  const store = useEditorStore();
 
 const [showAbout, setShowAbout] = createSignal(false);
 const [isCloudBrowserOpen, setIsCloudBrowserOpen] = createSignal(false);
 const [isAndroidBrowserOpen, setIsAndroidBrowserOpen] = createSignal(false);
 const [isConverterOpen, setIsConverterOpen] = createSignal(false);
 const [installedGames, setInstalledGames] = createSignal<any[] | null>(null);
 const [showInstalledGames, setShowInstalledGames] = createSignal(false);
 const [appVersion, setAppVersion] = createSignal('');
 const [isRooted, setIsRooted] = createSignal(false);
 const [hasShizuku, setHasShizuku] = createSignal(false);
 const [osType, setOsType] = createSignal('');
 const [isSupportModalOpen, setIsSupportModalOpen] = createSignal(false);

 const isAnyModalOpen = () => showAbout() || isCloudBrowserOpen() || isAndroidBrowserOpen() || isConverterOpen() || showInstalledGames() || store.isHelpModalOpen || store.isAiDiffModalOpen || store.isBackupManagerOpen || isSupportModalOpen();

  const checkForUpdates = async () => {
   try {
    // Check if we are running in browser (npm run dev without Tauri)
    if (!('__TAURI_INTERNALS__' in window)) {
      addToast("Update checks are only available in the native application.", "info");
      return;
    }
    
    const osType = await type();
    if (osType === 'android' || osType === 'ios') {
      addToast("System updates are handled automatically by your device's App Store.", "info");
      return;
    }
    
    addToast("CHECKING FOR SYSTEM UPDATES...", "info");
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Connection timed out. The update server took too long to respond.")), 10000)
    );
    const update = await Promise.race([check(), timeoutPromise]) as any;
    
    if (update) {
     addToast(`DOWNLOADING UPDATE [v${update.version}]... DO NOT CLOSE APP!`, "warning");
     await update.downloadAndInstall();
     addToast("UPDATE SUCCESSFUL! RESTARTING SYSTEM...", "success");
     await relaunch();
    } else {
     addToast(`SYSTEM IS UP TO DATE [v${appVersion() || '1.0.0'}]`, "success");
    }
   } catch (err: any) {
    console.error("Update failed:", err);
    addToast(`UPDATE CHECK FAILED: ${err.message || String(err)}`, "error");
   }
  };

  const handleShizukuClick = async () => {
    if (!hasShizuku() && !isRooted()) {
      try {
        const available = await invoke<boolean>("shizuku_is_available");
        if (available) {
          await invoke("shizuku_request_permission");
        } else {
          let statusStr = "Unknown";
          try {
            statusStr = await invoke<string>("shizuku_get_status");
          } catch(e) {}
          const response = await ask(
            `Shizuku Manager is not running or not installed.\nStatus: ${statusStr}\n\n` +
            "Would you like to open Shizuku Manager (if installed) or see instructions?", 
            { title: 'Shizuku Required', kind: 'warning' }
          );
          if (response) {
            await invoke("shizuku_open_manager");
          }
        }
      } catch (e) {
        addToast("Failed to interact with Shizuku", "error");
      }
    }
  };

  let unlistenClose: (() => void) | undefined;
  let statusInterval: any;

  onCleanup(() => {
    if (unlistenClose) {
      unlistenClose();
    }
    if (statusInterval) {
      clearInterval(statusInterval);
    }
  });

  onMount(() => {
    // Expose debug function for testing UI in regular browser
    (window as any).__DEBUG_LOAD_DEMO__ = () => {
       loadSaveData({
         "game_info": { "name": "Demo RPG Game", "playtime": "120:45:00", "version": "1.0.4" },
         "player": { "name": "Suzuya", "level": 99, "hp": 9999, "mp": 999 },
         "inventory": { "gold": 9999999, "items": ["Excalibur", "Potion x99"] },
         "flags": { "boss_defeated": true, "tutorial_done": true },
         "party": [
           { "name": "Hero", "class": "Warrior" },
           { "name": "Mage", "class": "Wizard" }
         ]
       }, "C:\\Mock\\demo_save.json", null);
       addToast('Demo save loaded!', 'success');
    };

    const initialize = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        setAppVersion(await getVersion());
      } catch(e) {
        console.warn("Could not load version");
      }

      try {
        const t = await type();
        setOsType(t);
      } catch(e) {}

      const checkStatus = async () => {
        try {
          if (osType() === 'android') {
            const shizukuAvailable = await invoke<boolean>("shizuku_is_available");
            if (shizukuAvailable) {
              const shizukuPerm = await invoke<boolean>("shizuku_check_permission");
              setHasShizuku(shizukuPerm);
            }
          }
          const rootStatus = await invoke<boolean>("check_device_rooted");
          setIsRooted(rootStatus);
        } catch (e) {
          console.error("Failed to check status:", e);
        }
      };

      await checkStatus();
      
      if (statusInterval) clearInterval(statusInterval);
      statusInterval = setInterval(checkStatus, 3000);

      try {
        const res = await invoke<any>('detect_installed_games');
        setInstalledGames(res);
      } catch(err) {
        console.error("Failed to detect games:", err);
        setInstalledGames([]);
      }

      const setupCloseConfirm = async () => {
        try {
          const osTypeStr = await type();
          if (osTypeStr === 'windows') {
            unlistenClose = await getCurrentWindow().onCloseRequested(async (event) => {
              event.preventDefault();
              if (store.saveData !== null) {
                const confirmed = await ask('Are you sure you want to exit? Any unsaved changes will be lost.', {
                  title: 'Confirm Exit',
                  kind: 'warning',
                });
                
                if (confirmed) {
                  await exit(0);
                }
              } else {
                await exit(0);
              }
            });
          }
        } catch (err) {
          console.error("Failed to setup close confirm:", err);
        }
      };
      
      setupCloseConfirm();
    };

    initialize();
  });

 return (
  <main class={`h-screen w-full bg-black font-mono text-zinc-200 relative overflow-x-hidden flex flex-col pt-safe pb-safe pl-safe pr-safe ${store.saveData ? 'overflow-hidden' : 'overflow-y-auto'}`}>
   <McpBridge activeTab={store.editorMode === 'hex' ? 'hex' : 'stardew'} />
  <style>{`
    @keyframes itemFadeInUp {
      0% { opacity: 0; transform: translateY(40px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .stagger-1 { animation: itemFadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards; will-change: transform, opacity; }
    .stagger-2 { animation: itemFadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards; will-change: transform, opacity; }
    .stagger-3 { animation: itemFadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards; will-change: transform, opacity; }
    .stagger-4 { animation: itemFadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.45s forwards; will-change: transform, opacity; }
    .stagger-5 { animation: itemFadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards; will-change: transform, opacity; }
  `}</style>

<Show when={!store.saveData}>
   <DedSecBackground isModalOpen={isAnyModalOpen()} />

    <div class="z-10 relative flex flex-col justify-center md:justify-start flex-1 w-full max-w-5xl mx-auto px-4 overflow-y-clip">

     <div class="mt-4 md:mt-[10vh] flex flex-col items-center w-full shrink-0">
      
      <div class="flex flex-col items-center text-center mb-4 md:mb-6 z-10 relative opacity-0 stagger-1 -translate-y-24">
       <h1 class="text-4xl sm:text-5xl md:text-7xl tracking-widest text-zinc-100 drop-shadow-[4px_4px_0px_#FF7A00] font-[Hacked] px-2 text-center">Suzu Save Editor</h1>
       <p class="bg-zinc-100 text-black px-3 py-1 mt-4 md:mt-8 text-[10px] md:text-sm font-bold tracking-widest uppercase border-2 border-black">Ultimate Save Game Editor</p>
      </div>

      <div class="opacity-0 stagger-2 w-full flex justify-center">
       <Dropzone />
      </div>

      <div class="mt-[20px] md:mt-[40px] flex flex-col items-center z-10 w-full max-w-2xl gap-4 md:gap-8 opacity-0 stagger-3">
       <button 
        onClick={() => setShowInstalledGames(true)}
        disabled={installedGames() === null}
        class="px-4 md:px-6 py-2 bg-zinc-900 border-2 border-zinc-700 text-zinc-300 font-bold uppercase tracking-widest hover:border-[#FF7A00] hover:text-[#FF7A00] transition-all cursor-pointer shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] hover:-translate-y-0.5 hover:-translate-x-0.5 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto text-[10px] md:text-base"
       >
        <Show 
         when={installedGames() !== null} 
         fallback={
          <div class="flex items-center justify-center gap-2 md:gap-3">
           <Loader2 size={16} class="animate-spin" /> 
           <span>SCANNING REGISTRY...</span>
          </div>
         }
        >
         <div class="flex items-center justify-center gap-2 md:gap-6">
          <span class="hidden md:inline">{">>"}</span>
          <Gamepad2 size={18} />
          <span>
           {installedGames()?.length || 0}<span class="ml-1 md:ml-2">INSTALLED GAME</span>{(installedGames()?.length === 1) ? '' : 'S'} DETECTED_
          </span>
         </div>
        </Show>
       </button>

       <div class="w-full flex items-center gap-4 opacity-70">
        <div class="flex-1 h-[2px] bg-zinc-700"></div>
        <span class="text-zinc-500 font-bold tracking-widest uppercase text-xs md:text-sm">OR</span>
        <div class="flex-1 h-[2px] bg-zinc-700"></div>
       </div>

       <button 
        onClick={() => setIsCloudBrowserOpen(true)}
        class="w-full flex flex-col items-center py-3 md:py-4 bg-transparent border-4 border-zinc-800 text-zinc-400 font-bold uppercase tracking-widest hover:border-white hover:text-[#FF7A00] transition-all cursor-pointer shadow-[4px_4px_0px_rgba(255,122,0,0)] md:shadow-[8px_8px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] md:hover:shadow-[8px_8px_0px_#FF7A00] hover:-translate-y-1 hover:-translate-x-1"
       >
        <div class="flex items-center gap-2 md:gap-4 text-[10px] md:text-base text-center">
         <span class="hidden md:inline">{">>"}</span><Database size={16} class="md:size-[18px]" />ACCESS CLOUD DATABASE_
        </div>
        <p class=" text-[9px] md:text-xs text-zinc-600 mt-1 md:mt-2">Download 100% Save File</p>
       </button>

       <button 
        onClick={() => setIsAndroidBrowserOpen(true)}
        class="w-full flex flex-col items-center py-3 md:py-4 bg-transparent border-4 border-zinc-800 text-[#00F0FF] font-bold uppercase tracking-widest hover:border-white hover:bg-[#00F0FF]/5 transition-all cursor-pointer shadow-[4px_4px_0px_rgba(0,240,255,0)] md:shadow-[8px_8px_0px_rgba(0,240,255,0)] hover:shadow-[4px_4px_0px_#00F0FF] md:hover:shadow-[8px_8px_0px_#00F0FF] hover:-translate-y-1 hover:-translate-x-1"
       >
        <div class="flex items-center gap-2 md:gap-4 text-[10px] md:text-base text-center">
         <span class="hidden md:inline">{">>"}</span><Smartphone size={16} class="md:size-[18px]" />BROWSE ANDROID DEVICE_
        </div>
        <p class=" text-[9px] md:text-xs text-zinc-500 mt-1 md:mt-2">Pull & Push saves via ADB</p>
       </button>

       <Show when={typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)}>
        <div class="w-full flex flex-col gap-2 mt-4 p-4 border-2 border-purple-500 bg-purple-900/10">
         <p class="text-[9px] md:text-xs text-purple-400 font-bold uppercase tracking-widest text-center mb-2">DEV MODE: UI TESTING (NO TAURI)</p>
         
         <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* ADVANCED MODE DUMMY */}
          <button 
           onClick={() => {
            loadSaveData({
             parsed_variables: { player: { name: "Test Hero" } },
             raw_content: "",
             engine_type: "Unknown",
             format: "json",
             encryption_type: "none"
            }, "C:\\dummy\\advanced.json", null);
           }}
           class="flex-1 py-2 bg-zinc-900 border border-zinc-700 text-purple-300 font-bold uppercase text-[9px] hover:bg-zinc-800 transition-all cursor-pointer"
          >
           ADVANCED MODE
          </button>

          {/* RPG MAKER DUMMY */}
          <button 
           onClick={() => {
            loadSaveData({
             parsed_variables: {
              party: { members: [{ name: "Eric", level: 99, hp: 9999 }] },
              actors: { "1": { name: "Eric", level: 99, hp: 9999 } },
              system: { gold: 50000 },
              variables: { "1": 100 },
              switches: { "1": true }
             },
             raw_content: "",
             engine_type: "RpgMakerMv",
             format: "json",
             encryption_type: "none"
            }, "C:\\dummy\\rpgmaker.rmmzsave", null);
           }}
           class="flex-1 py-2 bg-zinc-900 border border-zinc-700 text-purple-300 font-bold uppercase text-[9px] hover:bg-zinc-800 transition-all cursor-pointer"
          >
           RPG MAKER
          </button>

          {/* STARDEW VALLEY DUMMY */}
          <button 
           onClick={() => {
            loadSaveData({
             parsed_variables: {
              player: {
               name: "Farmer John",
               farmName: "Test Farm",
               money: 500000,
               clubCoins: 1000,
               qiGems: 50,
               maxStamina: 508,
               stamina: 508,
               health: 200,
               maxHealth: 200,
               items: [{ Name: "Wood", Stack: 999 }],
               friendships: { "Abigail": { Points: 2500 } }
              },
              locations: { "Farm": { buildings: [] } }
             },
             raw_content: "",
             engine_type: "StardewValley",
             format: "xml",
             encryption_type: "none"
            }, "C:\\dummy\\Stardew_Save", null);
           }}
           class="flex-1 py-2 bg-zinc-900 border border-zinc-700 text-purple-300 font-bold uppercase text-[9px] hover:bg-zinc-800 transition-all cursor-pointer"
          >
           STARDEW VALLEY
          </button>
         </div>
        </div>
       </Show>

       <button 
        onClick={() => setIsConverterOpen(true)}
        class="w-full flex flex-col items-center py-3 md:py-4 bg-transparent border-4 border-zinc-800 text-yellow-500 font-bold uppercase tracking-widest hover:border-white hover:bg-yellow-500/5 transition-all cursor-pointer shadow-[4px_4px_0px_rgba(234,179,8,0)] md:shadow-[8px_8px_0px_rgba(234,179,8,0)] hover:shadow-[4px_4px_0px_#EAB308] md:hover:shadow-[8px_8px_0px_#EAB308] hover:-translate-y-1 hover:-translate-x-1"
       >
        <div class="flex items-center gap-2 md:gap-4 text-[10px] md:text-base text-center">
         <span class="hidden md:inline">{">>"}</span><RefreshCw size={16} class="md:size-[18px]" />CROSS-PLATFORM CONVERTER_
        </div>
        <p class=" text-[9px] md:text-xs text-zinc-500 mt-1 md:mt-2">Strip Headers & Swap Endianness</p>
       </button>

       <button 
        onClick={async () => {
         const { setIsBackupManagerOpen } = await import('./store/editorStore');
         setIsBackupManagerOpen(true);
        }}
        class="w-full flex flex-col items-center py-3 md:py-4 bg-transparent border-4 border-zinc-800 text-blue-500 font-bold uppercase tracking-widest hover:border-white hover:bg-blue-500/5 transition-all cursor-pointer shadow-[4px_4px_0px_rgba(59,130,246,0)] md:shadow-[8px_8px_0px_rgba(59,130,246,0)] hover:shadow-[4px_4px_0px_#3b82f6] md:hover:shadow-[8px_8px_0px_#3b82f6] hover:-translate-y-1 hover:-translate-x-1"
       >
        <div class="flex items-center gap-2 md:gap-4 text-[10px] md:text-base text-center">
         <span class="hidden md:inline">{">>"}</span><Database size={16} class="md:size-[18px]" />MANAGE INTERNAL BACKUPS_
        </div>
        <p class=" text-[9px] md:text-xs text-zinc-500 mt-1 md:mt-2">Restore saved files and milestones</p>
       </button>
      </div>
     </div>

      <div class="mt-8 md:mt-auto flex flex-col items-center justify-end w-full pb-4 md:pb-8 pt-4 md:pt-12 shrink-0">
       
       <div class="flex flex-col items-center opacity-0 stagger-4 w-full mb-[40px] md:mb-[60px]">
        <h3 class="text-[10px] md:text-sm font-bold text-white bg-[#FF7A00] px-3 py-1 uppercase tracking-widest mb-4 md:mb-6">Supported Engines</h3>
        <div class="flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl">
         <For each={SUPPORTED_ENGINES}>
          {(engine) => (
           <span class="px-2.5 md:px-3 py-1.5 md:py-1 bg-black border-2 border-zinc-300 text-zinc-300 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-none hover:bg-zinc-300 hover:text-black cursor-default rounded-none">
            {engine.name}
           </span>
          )}
         </For>
        </div>
       </div>

       <div class="w-full flex flex-wrap justify-center items-center gap-x-4 gap-y-3 md:gap-8 text-xs md:text-sm font-bold uppercase tracking-widest text-zinc-400 opacity-0 stagger-5 px-4">
        <a href="https://github.com/Suzuya4w" target="_blank" rel="noopener noreferrer" class="hover:text-[#FF7A00] hover:underline decoration-2 underline-offset-4 p-1 cursor-pointer">GITHUB</a>
        <span class="text-zinc-800">|</span>
        <button onClick={() => setIsSupportModalOpen(true)} class="hover:text-[#FF7A00] hover:underline decoration-2 underline-offset-4 p-1 cursor-pointer uppercase">SUPPORT ME</button>
        <span class="text-zinc-800">|</span>
        <button onClick={() => setIsHelpModalOpen(true, 'data')} class="hover:text-[#FF7A00] hover:underline decoration-2 underline-offset-4 p-1 cursor-pointer uppercase">HELP & INFO</button>
        <span class="text-zinc-800">|</span>
        <button onClick={() => setIsSettingsOpen(true)} class="hover:text-[#FF7A00] hover:underline decoration-2 underline-offset-4 p-1 cursor-pointer uppercase">SETTINGS</button>
       </div>
       
        <div class="flex md:hidden items-center justify-center gap-6 mt-6 text-xs font-bold uppercase tracking-widest text-zinc-500 opacity-0 stagger-5">
          <button onClick={checkForUpdates} class="hover:text-[#00F0FF] cursor-pointer p-2 -m-2">
            [ v{appVersion() || '1.0.0'} ]
          </button>
          
          <Show when={osType() === 'android'}>
            <div class={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded transition-colors ${hasShizuku() ? 'text-[#00ffff] bg-[#00ffff]/10' : isRooted() ? 'text-[#00FF66] bg-[#00FF66]/10' : 'text-[#FF5252] bg-[#FF5252]/10'}`}
                 onClick={handleShizukuClick}>
              {hasShizuku() ? <Zap size={14} strokeWidth={3} /> : isRooted() ? <Zap size={14} strokeWidth={3} /> : <Lock size={14} strokeWidth={3} />}
              <span>{hasShizuku() ? 'SHIZUKU' : isRooted() ? 'DAEMON' : 'SANDBOXED'}</span>
            </div>
          </Show>
        </div>
       
      </div>

    </div>
   </Show>

   <Show when={store.saveData}>
    <div class="flex-1 flex flex-col w-full min-h-0 overflow-hidden gap-4 p-4 z-10 animate-[itemFadeInUp_1.2s_cubic-bezier(0.22,1,0.36,1)_forwards]">
     <Header />
     <div class="flex-1 flex overflow-hidden min-h-0 bg-zinc-950 border border-white/5 rounded-none relative">
      <Switch fallback={<TreeView />}>
       <Match when={store.editorMode === 'diff'}><DiffViewer /></Match>
       <Match when={store.editorMode === 'hex'}><HexViewer /></Match>
       <Match when={store.editorMode === 'easy'}><EasyMode /></Match>
       <Match when={store.editorMode === 'raw'}><div></div></Match>
      </Switch>
      <div 
        style={{ display: store.editorMode === 'raw' ? 'block' : 'none' }} 
        class="absolute inset-0 z-10"
       >
        <RawJsonViewer />
       </div>
     </div>
    </div>
   </Show>

   <CloudDatabaseBrowser isOpen={isCloudBrowserOpen()} onClose={() => setIsCloudBrowserOpen(false)} />
   <AndroidBrowserModal isOpen={isAndroidBrowserOpen()} onClose={() => setIsAndroidBrowserOpen(false)} />
   <SettingsModal />

    <Modal
     isOpen={showInstalledGames()}
     onClose={() => setShowInstalledGames(false)}
     title="DETECTED GAMES"
     icon={<Monitor size={18} />}
    >
     <div class="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 font-mono">
      <Show when={installedGames()!.length > 0} fallback={
       <div class="text-zinc-500 font-brains text-center py-8">
        No supported games detected in registry.
       </div>
      }>
       <For each={installedGames()}>
        {(game: any) => (
         <div class="bg-black border-2 border-zinc-800 p-4 hover:border-[#FF7A00] transition-colors flex items-center justify-between group">
          <div class="flex flex-col cursor-pointer overflow-hidden">
           <span class="font-bold text-zinc-200 font-desc tracking-widest uppercase truncate">{game.name}</span>
           <span class="text-[10px] text-zinc-500 font-serif truncate max-w-[350px]">{game.path}</span>
          </div>
           <button 
            onClick={async (e) => {
             e.stopPropagation();
             try {
              const { platform } = await import('@tauri-apps/plugin-os');
              const os = await platform();
              let selectedPath: any = null;
              
              if (os === 'android') {
                  selectedPath = await invoke('pick_file_for_write');
              } else {
                  const { open } = await import('@tauri-apps/plugin-dialog');
                  selectedPath = await open({
                   title: `Select Save File for ${game.name}`,
                   defaultPath: game.path,
                   multiple: false,
                  });
              }

              if (selectedPath) {
               const saveResult = await invoke('open_save_file', { 
                path: selectedPath,
                activeProfileRules: null
               });
               
               loadSaveData(saveResult, selectedPath, null);
               
               setShowInstalledGames(false);
               
               console.log("Save file loaded successfully:", selectedPath);
              }
             } catch (err: any) {
              console.error("Failed to load save file:", err);
              alert("Failed to load save file: " + (err.message || String(err)));
             }
            }}
            class="px-4 py-2 cursor-pointer shrink-0 bg-zinc-900 border border-zinc-700 text-[#FF7A00] hover:bg-[#FF7A00] hover:text-black font-black uppercase tracking-widest text-xs transition-colors opacity-0 group-hover:opacity-100"
           >
            SELECT SAVE
           </button>
         </div>
        )}
       </For>
      </Show>
     </div>
    </Modal>
   
   <HelpModal isOpen={store.isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
   <AiDiffModal />
   <PlatformConverterModal isOpen={isConverterOpen()} onClose={() => setIsConverterOpen(false)} />
   <SupportModal isOpen={isSupportModalOpen()} onClose={() => setIsSupportModalOpen(false)} />
   <BackupManagerModal isOpen={store.isBackupManagerOpen} onClose={() => {
     import('./store/editorStore').then(m => m.setIsBackupManagerOpen(false));
   }} />
   
   <ToastContainer />

    <Show when={!store.saveData}>
     <div class="hidden md:flex fixed bottom-6 right-8 items-center gap-6 text-sm font-bold uppercase tracking-widest text-zinc-500 z-50">
       <svg class="absolute bottom-[60px] right-[130px] rotate-180 w-48 h-48 text-zinc-800 opacity-20 pointer-events-none -z-10" viewBox="0 0 100 86.6" fill="currentColor">
         <polygon points="50,0 100,86.6 0,86.6" />
       </svg>

       <Tooltip text="Check for system updates" position="top" align="right">
         <button 
           onClick={checkForUpdates}
           class="hover:text-[#00F0FF] hover:underline decoration-2 underline-offset-4 cursor-pointer transition-all"
         >
           [ v{appVersion() || '1.0.0'} ]
         </button>
       </Tooltip>
       <span class="text-zinc-700">|</span>
       <Tooltip text={hasShizuku() ? "Shizuku authorization active" : (isRooted() ? "Full system access active" : "Wireless debugging or root required for Android access")} position="top" align="right">
        { osType() === 'android' && (
          <div class={`flex items-center gap-1.5 px-3 py-1 rounded border-2 border-white/20 font-bold tracking-widest text-[10px] ${
            hasShizuku() ? 'text-[#00ffff] border-[#00ffff]/40 bg-[#00ffff]/10' :
            isRooted() ? 'text-[#00ff00] border-[#00ff00]/40 bg-[#00ff00]/10' : 
            'text-[#ff0000] border-[#ff0000]/40 bg-[#ff0000]/10 cursor-pointer'
          }`}
          onClick={handleShizukuClick}>
            <Show when={hasShizuku()} fallback={
              <Show when={isRooted()} fallback={<><Lock class="w-3.5 h-3.5" /> SANDBOXED</>}>
                <Zap class="w-3.5 h-3.5" /> DAEMON (ROOT)
              </Show>
            }>
              <Zap class="w-3.5 h-3.5" /> SHIZUKU (AUTH)
            </Show>
          </div>
        )}
       </Tooltip>
     </div>
    </Show>
  </main>
 );
}

export default App;