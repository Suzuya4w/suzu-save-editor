import { invoke } from '@tauri-apps/api/core';
import { useEditorStore, closeFile, setIsHelpModalOpen, undo, redo, setIsHistoryModalOpen, setEditorMode } from '../store/editorStore';
import { createSignal, onMount, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Save, X, Unlock, HelpCircle, Image as ImageIcon, AlertTriangle, Eye, EyeOff, Undo2, Redo2, History, Layout, Terminal, Bot, Settings, DatabaseBackup } from 'lucide-solid';
import { CoverMetadataModal } from './CoverMetadataModal';
import { UnlockCGModal } from './UnlockCGModal';
import { HistoryModal } from './HistoryModal';
import { fetchGameMetadata, writeSaveFile } from '../services/ipc';
import { save } from '@tauri-apps/plugin-dialog';
import { addToast } from '../store/toastStore';
import { Modal } from './Modal';
import { CyberHoldButton } from './CyberHoldButton';
import { McpInfoModal } from './McpInfoModal';
import { setEditorState } from '../store/editorStore';
import { SplitSquareHorizontal } from 'lucide-solid';

interface DiffResult {
    path: string;
    oldVal: any;
    newVal: any;
}

function getJsonDiff(obj1: any, obj2: any, path = ""): DiffResult[] {
    let diffs: DiffResult[] = [];
    if (obj1 === obj2) return diffs;

    if (typeof obj1 !== "object" || obj1 === null || typeof obj2 !== "object" || obj2 === null) {
        diffs.push({ path, oldVal: obj1, newVal: obj2 });
        return diffs;
    }

    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of keys) {
        const val1 = obj1[key];
        const val2 = obj2[key];
        const newPath = path ? `${path}.${key}` : key;
        
        if (typeof val1 === "object" && val1 !== null && typeof val2 === "object" && val2 !== null) {
            diffs = diffs.concat(getJsonDiff(val1, val2, newPath));
        } else if (val1 !== val2) {
            diffs.push({ path: newPath, oldVal: val1, newVal: val2 });
        }
    }
    return diffs;
}

export function Tooltip(props: { text: string, position?: 'top' | 'bottom', align?: 'center' | 'left' | 'right', class?: string, children: any }) {
  const [show, setShow] = createSignal(false);
  const [coords, setCoords] = createSignal({ top: 0, left: 0 });
  let containerRef: HTMLDivElement | undefined;
 
  let alignmentClass = '-translate-x-1/2';
  if (props.align === 'left') alignmentClass = '';
  if (props.align === 'right') alignmentClass = '-translate-x-full';

  const updatePosition = () => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = rect.left + (rect.width / 2);
      
      if (props.position === 'top') {
        top = rect.top - 8; // Tooltip height will be handled by -translate-y-full
      }
      
      if (props.align === 'left') left = rect.left;
      if (props.align === 'right') left = rect.right;
      
      setCoords({ top, left });
    }
  };

  const onEnter = () => {
    updatePosition();
    setShow(true);
  };

  return (
    <div
      ref={containerRef}
      class={`relative inline-flex items-center justify-center ${props.class || ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <Portal>
          <div 
            style={{ 
              top: `${coords().top}px`, 
              left: `${coords().left}px`,
              position: 'fixed'
            }}
            class={`z-[9999] w-max max-w-[280px] text-wrap text-center px-4 py-2 bg-black text-white text-[12px] font-serif leading-relaxed border-2 border-white pointer-events-none shadow-[4px_4px_0px_white] ${alignmentClass} ${props.position === 'top' ? '-translate-y-full' : ''}`}
          >
            {props.text}
          </div>
        </Portal>
      </Show>
    </div>
  );
}

export function Header() {
 const editorState = useEditorStore();

 const [coverUrl, setCoverUrl] = createSignal<string | null>(null);
 const [gameTitle, setGameTitle] = createSignal<string>('Unknown Game');
 const [gameDesc, setGameDesc] = createSignal<string>('');
 const [gameDeveloper, setGameDeveloper] = createSignal<string | null>(null);
 const [isCoverModalOpen, setIsCoverModalOpen] = createSignal(false);
 const [isUnlockModalOpen, setIsUnlockModalOpen] = createSignal(false);
 const [isCloseModalOpen, setIsCloseModalOpen] = createSignal(false);
 const [isSaveModalOpen, setIsSaveModalOpen] = createSignal(false);
 const [isConfirmOverwriteModalOpen, setIsConfirmOverwriteModalOpen] = createSignal(false);
 const [showCover, setShowCover] = createSignal(true);
 const [isSaving, setIsSaving] = createSignal(false);
 const [holdProgress, setHoldProgress] = createSignal<number | undefined>(undefined);
 const [isMcpModalOpen, setIsMcpModalOpen] = createSignal(false);

 const [diffModalOpen, setDiffModalOpen] = createSignal(false);
 const [diffResults, setDiffResults] = createSignal<DiffResult[]>([]);
 const [diffTargetName, setDiffTargetName] = createSignal('');
 const [isDiffing, setIsDiffing] = createSignal(false);

 const handleHeaderCompare = async () => {
    if (!editorState.saveData || !editorState.filePath) {
        addToast("No active save file to compare.", "warning");
        return;
    }

    const isBinary = Object.keys(editorState.saveData.parsed_variables || {}).length === 0 && editorState.saveData.raw_payload;
    if (isBinary) {
        addToast("This is a binary/raw file. Please use the Hex Diff tool inside the Hex Viewer instead.", "warning");
        return;
    }

    try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
            multiple: false,
            title: "Select File to Compare With"
        });
        
        if (selected && typeof selected === 'string') {
            setIsDiffing(true);
            addToast("Analyzing differences...", "info");
            
            const targetData = await invoke<any>('open_save_file', { 
                path: selected,
                activeProfileRules: null
            });

            const targetVars = targetData?.parsed_variables || {};
            const currentVars = editorState.saveData.parsed_variables || {};

            const diffs = getJsonDiff(targetVars, currentVars);
            
            setDiffResults(diffs);
            setDiffTargetName(selected.split(/[/\\]/).pop() || 'Selected File');
            setDiffModalOpen(true);
            
            if (diffs.length === 0) {
                addToast("No differences found between the selected file and current file.", "info");
            }
        }
    } catch (err: any) {
        console.error(err);
        addToast(`Failed to compare file: ${err.message || String(err)}`, "error");
    } finally {
        setIsDiffing(false);
    }
 };

 const toggleMcp = async () => {
   try {
     const newState = !editorState.isMcpEnabled;
     await invoke('toggle_mcp', { enabled: newState });
     setEditorState('isMcpEnabled', newState);
     addToast(`MCP Bridge ${newState ? 'Activated' : 'Deactivated'}`, newState ? 'success' : 'info');
   } catch (e: any) {
     addToast(`Failed to toggle MCP: ${e}`, 'error');
   }
 };

 const fetchMetadata = async (query: string, cacheKey?: string) => {
  try {
   const metadata = await fetchGameMetadata(query, cacheKey);
   if (metadata) {
    setGameTitle(metadata.title);
    setCoverUrl(metadata.image_url);
    setGameDesc(metadata.description || '');
    setGameDeveloper(metadata.developer || metadata.publisher || null);
   }
  } catch (e) {
   console.error("Failed to fetch metadata from Rust backend", e);
  }
 };

 onMount(() => {
  if (editorState.filePath) {
   const filename = editorState.filePath.split(/[/\\]/).pop() || '';
   const query = filename.split('.')[0].replace(/[-_]/g, ' ');
   if (query && query.length > 2) {
    fetchMetadata(query, filename);
   }
  }
 });

 return (
  <>
  <div class="flex flex-col md:flex-row items-center justify-between py-3 md:py-4 px-4 md:px-10 bg-[#050505] border border-zinc-800 shrink-0 gap-4 md:gap-0 relative">
   <div class="flex items-center gap-4 md:gap-8 w-full md:w-auto justify-start">
    <Show when={showCover()}>
     <button
      onClick={() => setIsCoverModalOpen(true)}
      class="bg-orange-500/10 w-30 h-30 rounded-md border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 hover:border-orange-500 hover:bg-orange-500/20 transition-all cursor-pointer overflow-hidden p-0"
     >
      <Show when={coverUrl()} fallback={<ImageIcon size={20} />}>
       <img src={coverUrl()!} alt="Cover" class="w-full h-full object-cover [image-rendering:pixelated] [image-rendering:crisp-edges] select-none pointer-events-none" />
      </Show>
     </button>
    </Show>
    <div class="flex flex-col justify-center">
     <div class="flex items-center gap-3">
      <span class="text-zinc-200 font-bold tracking-widest uppercase text-sm">
       Suzu Save Editor.
      </span>
      <Tooltip text={showCover() ? "Hide Game Cover" : "Show Game Cover"} >
       <button
        onClick={() => setShowCover(!showCover())}
        class="text-yellow-400 hover:text-orange-500 transition-colors cursor-pointer flex items-center justify-center"
       >
        <Show when={showCover()} fallback={<EyeOff class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />}>
         <Eye size={15} />
        </Show>
       </button>
      </Tooltip>
     </div>
     <span class="text-zinc-500 text-xs font-mono tracking-widest mt-0.5 flex items-center gap-1">
      {editorState.editorMode.toUpperCase()} MODE /
      <span class="hover:text-orange-500 hover:bg-orange-500/10 px-1 py-0.5 text-zinc-400 rounded transition-colors cursor-pointer inline-flex items-center font-desc">
       <Tooltip text={editorState.filePath || ''}>{editorState.filePath ? editorState.filePath.split(/[/\\]/).pop() : 'UNKNOWN_FILE.DAT'}</Tooltip>
      </span>
     </span>
    </div>
   </div>

    <Show when={editorState.saveData}>
      {(() => {
        const pv = editorState.saveData?.parsed_variables;
        const isStrictBinary = pv?._is_binary_format === true || pv?.is_encrypted_binary === true;
        
        const engine = editorState.saveData?.engine_type;
        const hasEasyMode = engine === 'StardewValley' || engine === 'CSharpXml' || engine === 'RpgMakerMv' || engine === 'RpgMakerMz';

        if (isStrictBinary) {
          return (
            <div class="flex md:absolute md:left-1/2 md:-translate-x-1/2 z-50 items-center bg-[#0a0a0a] border border-zinc-800 p-1 shadow-[inset_0px_0px_10px_rgba(0,0,0,0.5)] w-full md:w-auto justify-center">
              <button class="px-6 py-3 md:py-2 text-sm md:text-xs font-bold tracking-widest uppercase flex items-center gap-2 rounded-none bg-[#FF0055]/10 text-[#FF0055] border border-[#FF0055] shadow-[2px_2px_0px_rgba(255,0,85,0.5)] cursor-not-allowed">
                <Terminal class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" /> Hex Only
              </button>
            </div>
          );
        }

        if (hasEasyMode) {
          return (
            <div class="flex md:absolute md:left-1/2 md:-translate-x-1/2 z-50 items-center bg-[#0a0a0a] border border-zinc-800 p-1 shadow-[inset_0px_0px_10px_rgba(0,0,0,0.5)] w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-center">
              <button
                onClick={() => setEditorMode('easy')}
                class={`px-6 py-3 md:py-2 cursor-pointer text-sm md:text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 rounded-none ${
                  editorState.editorMode === 'easy'
                    ? 'bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00] shadow-[2px_2px_0px_rgba(255,122,0,0.5)]'
                    : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <Layout class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" /> Simple
              </button>
              <button
                onClick={() => setEditorMode('advanced')}
                class={`px-6 py-3 md:py-2 cursor-pointer text-sm md:text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 rounded-none ${
                  editorState.editorMode === 'advanced'
                    ? 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF] shadow-[2px_2px_0px_rgba(0,240,255,0.5)]'
                    : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <Terminal class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" /> Advanced
              </button>
              <Tooltip text="Going into this mode will increase your RAM usage. Use wisely.">
              <button
                onClick={() => setEditorMode('raw')}
                class={`px-6 py-3 md:py-2 cursor-pointer text-sm md:text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 rounded-none ${
                  editorState.editorMode === 'raw'
                    ? 'bg-[#FF00FF]/10 text-[#FF00FF] border border-[#FF00FF] shadow-[2px_2px_0px_rgba(255,0,255,0.5)]'
                    : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <Terminal class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" /> Raw JSON
              </button>
              </Tooltip>
            </div>
          );
        }

        return (
          <div class="flex md:absolute md:left-1/2 md:-translate-x-1/2 z-50 items-center bg-[#0a0a0a] border border-zinc-800 p-1 shadow-[inset_0px_0px_10px_rgba(0,0,0,0.5)] w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-center">
            <button 
              onClick={() => setEditorMode('advanced')}
              class={`px-6 py-3 md:py-2 text-sm md:text-xs font-bold tracking-widest uppercase flex items-center gap-2 rounded-none cursor-pointer ${
                editorState.editorMode === 'advanced'
                  ? 'bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF] shadow-[2px_2px_0px_rgba(0,240,255,0.5)]'
                  : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-zinc-900'
              }`}>
              <Terminal class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" /> Advanced
            </button>
            <Tooltip text="Going into this mode will increase your RAM usage. Use wisely.">
            <button 
              onClick={() => setEditorMode('raw')}
              class={`px-6 py-3 md:py-2 text-sm md:text-xs font-bold tracking-widest uppercase flex items-center gap-2 rounded-none cursor-pointer ${
                editorState.editorMode === 'raw'
                  ? 'bg-[#FF00FF]/10 text-[#FF00FF] border border-[#FF00FF] shadow-[2px_2px_0px_rgba(255,0,255,0.5)]'
                  : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-zinc-900'
              }`}>
              <Terminal class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" /> Raw JSON
            </button>
            </Tooltip>
          </div>
        );
      })()}
    </Show>


    <div class="w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0 shrink-0">
      <div class="flex items-center gap-2 md:gap-3 w-max ml-auto md:mx-0">
        <Tooltip text="Settings & Plugins">
    <button
     onClick={async () => {
        const { setIsSettingsOpen } = await import('../store/settingsStore');
        setIsSettingsOpen(true);
     }}
     class="flex items-center gap-2 px-4 xl:px-4 py-3 md:py-2 bg-transparent border border-zinc-500/50 hover:bg-zinc-200 hover:text-black text-zinc-400 transition-colors text-sm md:text-xs font-bold tracking-widest uppercase font-mono cursor-pointer"
    >
     <Settings class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
     <span class="hidden xl:inline">Settings</span>
    </button>
  </Tooltip>
  <Tooltip text="Unlock CG Feature for Visual Novel Game">
    <button
     onClick={() => setIsUnlockModalOpen(true)}
     class="flex items-center gap-2 px-4 xl:px-4 py-3 md:py-2 bg-transparent border border-red-500/50 hover:bg-red-500 hover:text-black text-red-500 transition-colors text-sm md:text-xs font-bold tracking-widest uppercase font-mono cursor-pointer"
    >
     <Unlock class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
     <span class="hidden xl:inline">Unlock CG</span>
    </button>
  </Tooltip>
    <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>
    <Tooltip text="Undo (Ctrl+Z)">
      <button
       onClick={() => undo()}
       disabled={editorState.past.length === 0}
       class="p-3 md:p-2 bg-transparent border border-zinc-400 text-zinc-400 hover:text-[#00F0FF] hover:border-[#00F0FF] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
       <Undo2 class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
      </button>
    </Tooltip>
    <Tooltip text="Redo (Ctrl+Y)">
      <button
       onClick={() => redo()}
       disabled={editorState.future.length === 0}
       class="p-3 md:p-2 bg-transparent border border-zinc-400 text-zinc-400 hover:text-[#00F0FF] hover:border-[#00F0FF] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
       <Redo2 class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
      </button>
    </Tooltip>
    <Tooltip text="Time Machine (History)">
      <button
       onClick={() => setIsHistoryModalOpen(true)}
       class="p-3 md:p-2 bg-transparent border border-purple-500/50 text-purple-400 hover:text-purple-500 hover:border-purple-500 transition-colors cursor-pointer"
      >
       <History class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
      </button>
    </Tooltip>
    
    <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>
    
    <Tooltip text="Compare With Other File (Semantic Diff)">
      <button
       onClick={handleHeaderCompare}
       disabled={isDiffing()}
       class={`p-3 md:p-2 bg-transparent border border-cyan-500/50 text-cyan-400 hover:text-cyan-500 hover:border-cyan-500 transition-colors cursor-pointer ${isDiffing() ? 'opacity-50' : ''}`}
      >
       <SplitSquareHorizontal class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
      </button>
    </Tooltip>
    
    <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>
    
    <Tooltip text="Backup Manager (Restore & Milestones)">
      <button
       onClick={async () => {
         const { setIsBackupManagerOpen } = await import('../store/editorStore');
         setIsBackupManagerOpen(true);
       }}
       class="p-3 md:p-2 bg-transparent border border-blue-500/50 text-blue-400 hover:text-blue-500 hover:border-blue-500 transition-colors cursor-pointer"
      >
       <DatabaseBackup class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
      </button>
    </Tooltip>

    <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>

    <div class="flex items-center gap-1">
      <Tooltip text={editorState.isMcpEnabled ? "MCP Bridge is ON. Click to disable." : "MCP Bridge is OFF. Click to enable."}>
        <button
          onClick={toggleMcp}
          class={`flex items-center gap-2 justify-center px-3 py-1.5 border transition-all duration-300 cursor-pointer ${
            editorState.isMcpEnabled 
              ? editorState.mcpPulse 
                ? 'bg-emerald-500 text-black border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] font-black scale-105' 
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-500/30'
              : 'bg-transparent text-zinc-600 border-zinc-500 hover:text-zinc-400 hover:border-zinc-600'
          }`}
        >
          <Bot class={`w-[18px] h-[18px] md:w-[14px] md:h-[14px] ${editorState.isMcpEnabled && !editorState.mcpPulse ? 'animate-pulse' : ''}`} />
          <span class="hidden xl:inline text-sm md:text-xs font-bold tracking-widest uppercase font-mono">
            {!editorState.isMcpEnabled ? 'MCP OFF' : editorState.mcpPulse ? 'AI INJECTED!' : 'MCP ACTIVE'}
          </span>
        </button>
      </Tooltip>
      <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>
      <Tooltip text="What is MCP? (AI Bridge Info)">
        <button
          onClick={() => setIsMcpModalOpen(true)}
          class="p-3 md:p-2 bg-transparent border border-emerald-400 text-emerald-400 hover:text-emerald-500 hover:border-emerald-500 transition-colors cursor-pointer"
        >
          <HelpCircle class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
        </button>
      </Tooltip>
    </div>

    <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>
    <Tooltip text="Help & Info">
    <button
     onClick={() => setIsHelpModalOpen(true)}
     class="p-3 md:p-2 bg-transparent border border-yellow-400 text-yellow-400 hover:text-yellow-500 hover:border-yellow-500 transition-colors cursor-pointer"
    >
     <HelpCircle class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
    </button>
    </Tooltip>
    <div class="w-[1px] h-6 bg-zinc-800 mx-2"></div>
    <Tooltip text="Save modifications" align="right">
      <button
       onClick={() => setIsSaveModalOpen(true)}
       class="flex items-center gap-2 xl:gap-4 px-4 xl:px-6 py-3 md:py-2 bg-[#0a0a0a] border border-orange-500/50 hover:bg-orange-500 hover:text-black text-orange-500 transition-colors text-sm md:text-xs font-bold tracking-widest uppercase font-mono cursor-pointer"
      >
       <Save class="w-[18px] h-[18px] md:w-[14px] md:h-[14px]" />
       <span class="hidden xl:inline">Save</span>
      </button>
    </Tooltip>
    <Tooltip text="Close current file" align="right">
      <button
       onClick={() => setIsCloseModalOpen(true)}
       class="p-3 md:p-2 bg-[#0a0a0a] border border-white text-red-400 hover:text-red-500 hover:border-red-500 transition-colors cursor-pointer"
      >
       <X class="w-[20px] h-[20px] md:w-[16px] md:h-[16px]" />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
 
  <CoverMetadataModal
   isOpen={isCoverModalOpen()}
   onClose={() => setIsCoverModalOpen(false)}
   coverUrl={coverUrl()}
   gameTitle={gameTitle()}
   gameDesc={gameDesc()}
   gameDeveloper={gameDeveloper()}
   fileName={editorState.filePath ? editorState.filePath.split(/[/\\]/).pop() || '' : ''}
   onUpdateMetadata={(newTitle, newCover, newDesc, newDev) => {
    setGameTitle(newTitle);
    setCoverUrl(newCover);
    setGameDesc(newDesc);
    setGameDeveloper(newDev || null);
   }}
  />
 
  <UnlockCGModal
   isOpen={isUnlockModalOpen()}
   onClose={() => setIsUnlockModalOpen(false)}
  />

  <HistoryModal />
 
  <McpInfoModal
    isOpen={isMcpModalOpen()}
    onClose={() => setIsMcpModalOpen(false)}
  />

  {/* Close File Modal */}
  <Modal
   isOpen={isCloseModalOpen()}
   onClose={() => setIsCloseModalOpen(false)}
   title="Close File"
   icon={<HelpCircle size={18} class="text-red-500" />}
   width="max-w-md"
  >
   <div class="flex flex-col gap-6">
    <div class="text-zinc-300 text-sm font-desc leading-relaxed">
     Are you sure you want to close this file? Any unsaved changes will be lost permanently.
    </div>
        <Show when={editorState.hasUsedRawMode}>
        <div class="bg-purple-500/10 border border-[#FF00FF]/40 p-3 rounded text-xs text-purple-200 font-mono leading-relaxed flex items-start gap-2.5 shadow-[inset_0_0_12px_rgba(255,0,255,0.15)]">
          <span class="text-[#FF00FF] font-bold mt-0.5">⚡</span>
          <div class="font-desc">
            <span class="font-bold text-[#FF00FF] tracking-wider">RAM CLEANUP:</span> Since you used the Raw JSON tab, the screen will blink for a split second when closing this file. This instantly frees up your PC's memory (it takes about 5-8 seconds to drop back to normal ram usage).
          </div>
        </div>
      </Show>
    <div class="flex gap-4">
     <button onClick={() => setIsCloseModalOpen(false)} class="flex-1 py-3 bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer">
      Cancel
     </button>
     <button onClick={() => { setIsCloseModalOpen(false); closeFile(); }} class="flex-1 py-3 bg-red-500/10 border border-red-500 hover:bg-red-500 hover:text-black text-red-500 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer">
      Close File
     </button>
    </div>
   </div>
  </Modal>

  {/* Save Changes Modal */}
  <Modal
   isOpen={isSaveModalOpen()}
   onClose={() => setIsSaveModalOpen(false)}
   title="Save Changes"
   icon={<Save size={18} class="text-emerald-500" />}
   width="max-w-lg"
  >
   <div class="flex flex-col gap-6">
    <p class="text-zinc-400 text-xs font-bold uppercase tracking-widest">How would you like to save your modifications?</p>
   
    <div class="flex flex-col gap-3">
     <button
      onClick={() => { setIsSaveModalOpen(false); setIsConfirmOverwriteModalOpen(true); }}
      class="flex flex-col text-left w-full p-4 bg-[#0a0a0a] border border-zinc-800 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer group"
     >
      <span class="font-bold text-zinc-200 group-hover:text-emerald-400 mb-1 tracking-wider uppercase">OVERWRITE CURRENT FILE</span>
      <span class="text-xs font-desc text-zinc-500 break-words">{editorState.filePath || 'Unknown File'}</span>
     </button>

     <button
      onClick={async () => {
       setIsSaveModalOpen(false);
       if (!editorState.saveData || !editorState.filePath) return;
       try {
         const newPath = await save({
           defaultPath: editorState.filePath,
           title: "Save Copy As"
         });
         
         if (newPath) {
           setIsSaving(true);
           try {
             await writeSaveFile(
               editorState.saveData, 
               newPath, 
               editorState.activeProfileRules || undefined, 
               editorState.activeProfileChecksums || undefined
             );
             addToast(`Saved as ${newPath.split(/[/\\]/).pop()}`, "success");
           } finally {
             setIsSaving(false);
           }
         }
       } catch (err: any) {
         addToast(`Failed to save: ${err.message || String(err)}`, "error");
       }
      }}
      class="flex flex-col text-left w-full p-4 bg-[#0a0a0a] border border-zinc-800 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer group"
     >
      <span class="font-bold text-zinc-200 group-hover:text-emerald-400 mb-1 tracking-wider uppercase">
       {editorState.adbDeviceId ? "EXPORT TO PC (SAVE AS...)" : "SAVE AS..."}
      </span>
      <span class="text-xs font-desc text-zinc-500">Create a new save file copy</span>
     </button>
    </div>
   
    <button onClick={() => setIsSaveModalOpen(false)} class="w-full py-3 bg-transparent hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer border border-zinc-700 hover:border-zinc-500">
     Cancel
    </button>
   </div>
  </Modal>

  {/* Confirm Overwrite Modal */}
  <Modal
   isOpen={isConfirmOverwriteModalOpen()}
   onClose={() => { setIsConfirmOverwriteModalOpen(false); setHoldProgress(undefined); }}
   title="Confirm Overwrite"
   icon={<AlertTriangle size={18} class="text-yellow-500" />}
   width="max-w-md"
   borderProgress={holdProgress()}
  >
   <div class="flex flex-col gap-6">
    <div>
     <p class="text-zinc-300 text-sm font-serif leading-relaxed mb-4">
      Are you absolutely sure you want to overwrite the original save file?
     </p>
     <p class="text-xs font-desc text-zinc-400 bg-zinc-900/50 p-2 border border-zinc-800 break-words">
      {editorState.filePath || 'Unknown File'}
     </p>
    </div>
    <div class="flex gap-4">
      <button onClick={() => { setIsConfirmOverwriteModalOpen(false); setHoldProgress(undefined); }} class="flex-1 py-3 bg-transparent border border-zinc-700 hover:text-white hover:bg-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer">
       Cancel
      </button>
      <CyberHoldButton
       holdTime={600}
       onProgress={(p) => setHoldProgress(p > 0 ? p : undefined)}
        onComplete={async () => {
          if (!editorState.saveData || !editorState.filePath) return;
          setIsSaving(true);
          try {
            await writeSaveFile(
              editorState.saveData, 
              editorState.filePath, 
              editorState.activeProfileRules || undefined, 
              editorState.activeProfileChecksums || undefined
            );
            
            if (editorState.adbDeviceId && editorState.adbRemotePath) {
              
              // Always auto backup when pushing to device
              addToast("Creating backup on Android Device...", "info");
              try {
                await invoke('adb_backup_file', {
                  deviceId: editorState.adbDeviceId,
                  remotePath: editorState.adbRemotePath
                });
              } catch(e) {
                addToast("Warning: Failed to create Android backup.", "warning");
              }

              addToast("Pushing to Android Device via ADB...", "info");
              
              await invoke('adb_push_file', {
                deviceId: editorState.adbDeviceId,
                localPath: editorState.filePath,
                remotePath: editorState.adbRemotePath
              });
              addToast("File saved and pushed to Android successfully!", "success");
            } else {
              addToast("File saved successfully! Backend backup created.", "success");
            }
            
            setIsConfirmOverwriteModalOpen(false);
          } catch (err: any) {
            addToast(`Failed to save: ${err.message || String(err)}`, "error");
          } finally {
            setIsSaving(false);
            setHoldProgress(undefined);
          }
        }} 
       class={`flex-1 py-3 bg-yellow-500/10 border border-[#FF7A00] hover:bg-[#FF7A00]/20 text-[#FF7A00] font-bold text-xs tracking-widest uppercase transition-colors disabled:opacity-50 ${isSaving() ? 'pointer-events-none opacity-50' : ''}`}
      >
       {isSaving() ? 'SAVING...' : 'HOLD TO OVERWRITE'}
      </CyberHoldButton>
     </div>
    </div>
  </Modal>
   {/* Diff Modal */}
   <Modal isOpen={diffModalOpen()} onClose={() => setDiffModalOpen(false)} title="SEMANTIC VISUAL DIFF" icon={<SplitSquareHorizontal size={18} />}>
        <div class="flex flex-col gap-4 font-mono max-h-[70vh] overflow-hidden">
            <div class="p-3 bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-300">
                <div class="flex items-center gap-4 mb-2">
                    <div class="flex-1">
                        <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Target File (Before)</div>
                        <div class="font-bold text-red-400">{diffTargetName()}</div>
                    </div>
                    <div class="text-zinc-600"><SplitSquareHorizontal size={16} /></div>
                    <div class="flex-1 text-right">
                        <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Current (After)</div>
                        <div class="font-bold text-green-400">Active Editor</div>
                    </div>
                </div>
                <div class="text-center pt-2 border-t border-zinc-800/50 text-[10px] uppercase font-bold tracking-widest">
                    Found {diffResults().length} difference(s)
                </div>
            </div>

            <div class="flex-1 overflow-y-auto custom-scrollbar border border-zinc-800 bg-black">
                <For each={diffResults()}>
                    {(diff) => (
                        <div class="flex flex-col font-brains p-2 border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                            <div class="text-[10px] text-zinc-500 mb-1 truncate" title={diff.path}>{diff.path}</div>
                            <div class="flex items-center gap-2 text-xs">
                                <div class="flex-1 bg-red-500/10 text-red-400 p-1 rounded-sm border border-red-500/20 truncate" title={String(diff.oldVal)}>
                                    <del>{String(diff.oldVal)}</del>
                                </div>
                                <div class="text-zinc-600">➔</div>
                                <div class="flex-1 bg-green-500/10 text-green-400 p-1 rounded-sm border border-green-500/20 truncate" title={String(diff.newVal)}>
                                    {String(diff.newVal)}
                                </div>
                            </div>
                        </div>
                    )}
                </For>
                <Show when={diffResults().length === 0}>
                    <div class="p-8 text-center text-zinc-500 font-desc text-sm">
                        No semantic differences found.
                    </div>
                </Show>
            </div>
        </div>
    </Modal>
  </>
 );
}