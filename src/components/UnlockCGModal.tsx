import { createSignal, Show, For, onMount } from 'solid-js';
import { X, Search, Database, FolderPlus, Code, Upload, RefreshCw, AlertTriangle, FileCode, Download, LayoutList, CheckSquare, Square, HelpCircle, Copy, Eye, Check } from 'lucide-solid';
import { useEditorStore, loadSaveData, updateParsedVariables, setHelpModalSection } from '../store/editorStore';
import { addToast } from '../store/toastStore';
import { loadLocalProfiles, syncProfilesFromGithub, openSaveFile, saveLocalProfile } from '../services/ipc';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, readDir, writeTextFile } from '@tauri-apps/plugin-fs';
import { Modal } from './Modal'; 
import { HelpModal } from './HelpModal';

function Tooltip(props: { text: string, position?: 'top' | 'bottom', align?: 'center' | 'left' | 'right', class?: string, children: any }) {
  const [show, setShow] = createSignal(false);
 
  let alignmentClass = 'left-1/2 -translate-x-1/2';
  if (props.align === 'left') alignmentClass = 'left-0';
  if (props.align === 'right') alignmentClass = 'right-0';

  return (
    <div
      class="relative inline-flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <div class={`absolute z-[100] whitespace-nowrap px-2 py-1 bg-black text-white text-[10px] font-black tracking-widest uppercase border-2 border-white pointer-events-none shadow-[4px_4px_0px_white] ${alignmentClass} ${props.position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${props.class || ''}`}>
          {props.text}
        </div>
      </Show>
    </div>
  );
}

export function UnlockCGModal(props: {
 isOpen: boolean;
 onClose: () => void;
}) {
 const [activeTab, setActiveTab] = createSignal<'database' | 'folder' | 'builder' | 'raw'>('database');
 const [extractedKeys, setExtractedKeys] = createSignal<string[]>([]);
 const [selectedKeys, setSelectedKeys] = createSignal<Set<string>>(new Set());
 const [prefix, setPrefix] = createSignal('');
 const [suffix, setSuffix] = createSignal('');
 const [useUppercase, setUseUppercase] = createSignal(false);
 const [useLowercase, setUseLowercase] = createSignal(false);
 const [targetValue, setTargetValue] = createSignal('1');
 const [customValue, setCustomValue] = createSignal('');
 const [filterText, setFilterText] = createSignal('');
 const [profileTitle, setProfileTitle] = createSignal('');
 const [profileDeveloper, setProfileDeveloper] = createSignal('');
 const [profileEngine, setProfileEngine] = createSignal('');
 const [profileAuthor, setProfileAuthor] = createSignal('');
 const [profileVersion, setProfileVersion] = createSignal('');
 const [profileNotes, setProfileNotes] = createSignal('');

 const [confirmState, setConfirmState] = createSignal<{
  isOpen: boolean;
  message: string;
  resolve?: (value: boolean) => void;
 }>({ isOpen: false, message: '' });

 const customConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
   setConfirmState({ isOpen: true, message, resolve });
  });
 };

 const sharedProps = {
  extractedKeys, setExtractedKeys,
  selectedKeys, setSelectedKeys,
  prefix, setPrefix,
  suffix, setSuffix,
  useUppercase, setUseUppercase,
  useLowercase, setUseLowercase,
  targetValue, setTargetValue,
  customValue, setCustomValue,
  filterText, setFilterText,
  profileTitle, setProfileTitle,
  profileDeveloper, setProfileDeveloper,
  profileEngine, setProfileEngine,
  profileAuthor, setProfileAuthor,
  profileVersion, setProfileVersion,
  profileNotes, setProfileNotes,
  customConfirm
 };

 return (
  <Modal
   isOpen={props.isOpen}
   onClose={props.onClose}
   title="Unlock All CG & Items"
   icon={<UnlockIcon />}
   width="max-w-5xl"
  >
   <div class="flex flex-col h-[75vh] min-h-[500px] -m-6 p-6">

    {/* Content */}
    <div class="p-6 flex flex-col flex-1 min-h-0 overflow-hidden">
     
     {/* Tabs */}
     <div class="flex gap-2 mb-6 shrink-0">
      <TabButton 
       active={activeTab() === 'database'} 
       onClick={() => setActiveTab('database')}
       icon={<Database size={16} />}
       label="Database"
      />
      <TabButton 
       active={activeTab() === 'folder'} 
       onClick={() => setActiveTab('folder')}
       icon={<FolderPlus size={16} />}
       label="Folder Inject"
      />
      <TabButton 
       active={activeTab() === 'builder'} 
       onClick={() => setActiveTab('builder')}
       icon={<Code size={16} />}
       label="Builder"
      />
      <TabButton 
       active={activeTab() === 'raw'} 
       onClick={() => setActiveTab('raw')}
       icon={<FileCode size={16} />}
       label="Raw JSON"
      />
     </div>

     {/* Tab Contents */}
     <div class="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
      <Show when={activeTab() === 'database'}>
       <DatabaseTab onClose={props.onClose} customConfirm={customConfirm} />
      </Show>
      <Show when={activeTab() === 'folder'}>
       <FolderInjectTab onClose={props.onClose} {...sharedProps} />
      </Show>
      <Show when={activeTab() === 'builder'}>
       <BuilderTab onClose={props.onClose} {...sharedProps} />
      </Show>
      <Show when={activeTab() === 'raw'}>
       <RawJsonTab />
      </Show>
     </div>

    </div>
   </div>

   {/* Custom Confirm Modal */}
   <Show when={confirmState().isOpen}>
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4">
     <div class="bg-[#050505] border border-red-500/50 p-6 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)]">
      <h3 class="text-red-500 font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
       <AlertTriangle size={18} /> ACTION REQUIRED
      </h3>
      <p class="text-zinc-300 font-mono text-sm mb-6 leading-relaxed">
       {confirmState().message}
      </p>
      <div class="flex gap-4">
       <button 
        onClick={() => { confirmState().resolve?.(false); setConfirmState({ isOpen: false, message: '' }); }}
        class="flex-1 bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 py-3 font-bold tracking-widest uppercase text-sm transition-colors cursor-pointer"
       >
        Cancel
       </button>
       <button 
        onClick={() => { confirmState().resolve?.(true); setConfirmState({ isOpen: false, message: '' }); }}
        class="flex-1 bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black py-3 font-bold tracking-widest uppercase text-sm transition-colors cursor-pointer"
       >
        Confirm
       </button>
      </div>
     </div>
    </div>
   </Show>
  </Modal>
 );
}

function UnlockIcon() {
 return (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
   <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
   <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
 );
}

function TabButton(props: { active: boolean; onClick: () => void; icon: any; label: string }) {
 return (
  <button
   onClick={props.onClick}
   class={`flex items-center justify-center gap-4 flex-1 py-4 font-bold tracking-widest uppercase text-sm border transition-colors cursor-pointer ${
    props.active 
     ? 'bg-red-500/10 border-red-500/50 text-red-500' 
     : 'bg-[#0a0a0a] border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
   }`}
  >
   {props.icon}
   {props.label}
  </button>
 );
}

function DatabaseTab(props: { onClose: () => void; customConfirm: (msg: string) => Promise<boolean> }) {
 const [profiles, setProfiles] = createSignal<any[]>([]);
 const [isLoading, setIsLoading] = createSignal(false);
 const [isHelpModalOpen, setIsHelpModalOpen] = createSignal(false);
 const [activeFilter, setActiveFilter] = createSignal<'all' | 'community' | 'local'>('all');
 const [searchQuery, setSearchQuery] = createSignal('');
 const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
 const [selectedProfiles, setSelectedProfiles] = createSignal<string[]>([]);
 const editorState = useEditorStore();

 const fetchProfiles = async () => {
  try {
   const data = await loadLocalProfiles();
   setProfiles(data);
  } catch(e: any) {
   addToast("Failed to load profiles: " + e.message, "error");
  }
 };

 onMount(() => {
  fetchProfiles();
 });

 const handleUpdateProfiles = async () => {
  setIsLoading(true);
  addToast("Updating profiles from GitHub...", "info");
  try {
   const count = await syncProfilesFromGithub();
   addToast(`Successfully synced ${count} profiles!`, "success");
   await fetchProfiles();
  } catch (e: any) {
   addToast("Failed to sync profiles: " + e.message, "error");
  } finally {
   setIsLoading(false);
  }
 };

 const handleApplyProfile = async (profile: any) => {
  try {
   const { filePath } = editorState;
   if (!filePath) {
    addToast("No file opened to inject into!", "error");
    return;
   }

   const isConfirmed = await props.customConfirm(`Are you sure you want to apply the profile "${profile.title || 'Imported Profile'}"?`);
   if (!isConfirmed) return;

   addToast(`Applying profile "${profile.title}"...`, "info");
   const result = await openSaveFile(filePath, profile.rules);
   loadSaveData(result, filePath, profile.rules);
   addToast(`Profile applied successfully!`, "success");
   props.onClose();
  } catch (e: any) {
   addToast(`Failed to apply profile: ${e}`, "error");
  }
 };

 const handleInjectJson = async () => {
  try {
   const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }]
   });
   if (selected && typeof selected === 'string') {
    const content = await readTextFile(selected);
    const parsed = JSON.parse(content);
    
    let rulesToApply = null;
    if (parsed.rules && Array.isArray(parsed.rules)) rulesToApply = parsed.rules;
    else if (Array.isArray(parsed)) rulesToApply = parsed;
    else if (parsed.type && parsed.keys) rulesToApply = [parsed];

    if (rulesToApply) {
     handleApplyProfile({ title: parsed.title || "Local Imported Profile", rules: rulesToApply });
    } else {
     addToast("Invalid profile JSON format", "error");
    }
   }
  } catch (e: any) {
   addToast("Failed to inject JSON: " + e.message, "error");
  }
 };

 const handleSaveJsonToDb = async () => {
  try {
   const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }]
   });
   if (selected && typeof selected === 'string') {
    const content = await readTextFile(selected);
    const parsed = JSON.parse(content);
    
    let rulesToApply = null;
    if (parsed.rules && Array.isArray(parsed.rules)) rulesToApply = parsed.rules;
    else if (Array.isArray(parsed)) rulesToApply = parsed;
    else if (parsed.type && parsed.keys) rulesToApply = [parsed];

    if (rulesToApply) {
     const profileToSave = {
      id: parsed.id || `custom_${Date.now()}`,
      title: parsed.title || "Local Imported Profile",
      developer: parsed.developer || "Unknown",
      engine: parsed.engine || "Unknown",
      author: parsed.author,
      version: parsed.version,
      notes: parsed.notes,
      rules: rulesToApply
     };

     await saveLocalProfile(profileToSave);
     await fetchProfiles();
     addToast("Profile saved to database successfully!", "success");
    } else {
     addToast("Invalid profile JSON format", "error");
    }
   }
  } catch (e: any) {
   addToast("Failed to save JSON to DB: " + e.message, "error");
  }
 };

 const handleDownloadProfile = async (e: Event, profile: any) => {
  e.stopPropagation();
  try {
   const defaultName = profile.title ? `${profile.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json` : 'profile.json';
   const savePath = await saveDialog({
    filters: [{ name: 'JSON Profile', extensions: ['json'] }],
    defaultPath: defaultName
   });
   if (savePath) {
    const jsonStr = JSON.stringify(profile, null, 2);
    await writeTextFile(savePath, jsonStr);
    addToast(`Profile exported successfully!`, "success");
   }
  } catch (error: any) {
   addToast(`Failed to export profile: ${error.message || error}`, "error");
  }
 };

 const toggleProfileSelection = (id: string) => {
  setSelectedProfiles(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
 };

 const handleBulkDownloadProfiles = async () => {
  if (selectedProfiles().length === 0) return;
  try {
   const { open } = await import('@tauri-apps/plugin-dialog');
   const { writeTextFile } = await import('@tauri-apps/plugin-fs');
   const { join } = await import('@tauri-apps/api/path');
   
   const folderPath = await open({ directory: true, title: 'Select folder to save exported profiles' });
   if (!folderPath || typeof folderPath !== 'string') return;

   addToast(`Exporting ${selectedProfiles().length} profiles...`, 'info');
   let successCount = 0;
   
   for (const id of selectedProfiles()) {
    const profile = profiles().find(p => p.id === id);
    if (!profile) continue;
    
    const fileName = profile.title ? `${profile.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json` : `profile_${id}.json`;
    const savePath = await join(folderPath, fileName);
    
    const jsonStr = JSON.stringify(profile, null, 2);
    await writeTextFile(savePath, jsonStr);
    successCount++;
   }
   
   addToast(`Successfully exported ${successCount} profiles!`, 'success');
   setSelectedProfiles([]);
   setIsBulkSelectMode(false);
  } catch (error: any) {
   addToast(`Failed to export bulk profiles: ${error.message || error}`, 'error');
  }
 };

 const filteredProfiles = () => profiles().filter(p => {
  const matchesSearch = p.title.toLowerCase().includes(searchQuery().toLowerCase()) || 
   (p.developer && p.developer.toLowerCase().includes(searchQuery().toLowerCase()));
  
  let matchesFilter = true;
  const isLocal = !p.id || 
                  p.id.startsWith('custom_') || 
                  p.id.startsWith('local_') || 
                  /\d{10,}/.test(p.id) || 
                  /^[0-9a-f]{8}-/i.test(p.id);
  
  if (activeFilter() === 'community') {
   matchesFilter = !isLocal;
  } else if (activeFilter() === 'local') {
   matchesFilter = isLocal;
  }

  return matchesSearch && matchesFilter;
 });

 return (
  <div class="flex flex-col gap-4 h-full">
   <div class="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-4 font-desc text-[13px] flex items-start gap-3">
    <AlertTriangle size={16} class="shrink-0 mt-0.5" />
    <p><strong>Database Injection:</strong> Inject pre-configured unlock profiles curated by the community. Ideal for quickly unlocking all CGs.</p>
   </div>

   <div class="flex gap-4">
    <div class="flex-1 relative">
     <Search size={16} class="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
     <input 
      type="text" 
      value={searchQuery()}
      onInput={(e) => setSearchQuery(e.currentTarget.value)}
      placeholder="Search for a game title..." 
      class="w-full bg-[#0a0a0a] border border-zinc-800 pl-[30px] pr-4 py-3 text-zinc-300 font-share focus:outline-none focus:border-red-500"
     />
    </div>
    <button 
     onClick={handleUpdateProfiles}
     disabled={isLoading()}
     class="bg-[#0a0a0a] border border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-black px-6 font-bold tracking-widest uppercase flex items-center gap-4 transition-colors cursor-pointer disabled:opacity-50"
    >
     <RefreshCw size={16} class={isLoading() ? 'animate-spin' : ''} /> Update Profiles
    </button>
    <button 
     onClick={() => { setHelpModalSection('database_tab'); setIsHelpModalOpen(true); }}
     class="bg-[#0a0a0a] border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-black px-6 font-bold tracking-widest uppercase flex items-center gap-4 transition-colors cursor-pointer"
    >
     <HelpCircle size={16} /> Help
    </button>
   </div>

   <div class="flex justify-between items-center border-b border-zinc-800/50 pb-2">
    <div class="flex gap-4">
    <button 
      onClick={() => setActiveFilter('all')} 
      class={`px-4 py-2 text-xs font-bold uppercase cursor-pointer tracking-widest transition-colors ${activeFilter() === 'all' ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      All Profiles
    </button>
    <button 
      onClick={() => setActiveFilter('community')} 
      class={`px-4 py-2 text-xs font-bold uppercase cursor-pointer tracking-widest transition-colors ${activeFilter() === 'community' ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      Community Profiles
    </button>
    <button 
      onClick={() => setActiveFilter('local')} 
      class={`px-4 py-2 text-xs font-bold uppercase cursor-pointer tracking-widest transition-colors ${activeFilter() === 'local' ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      Local / Custom
    </button>
    </div>
    <div class="flex gap-2">
     <button
      onClick={() => { setIsBulkSelectMode(!isBulkSelectMode()); setSelectedProfiles([]); }}
      class={`px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer ${isBulkSelectMode() ? 'bg-blue-500 text-black' : 'text-blue-500 hover:text-blue-400'}`}
     >
      <LayoutList size={14} /> Bulk Export
     </button>
     <button 
      onClick={handleInjectJson}
      class="px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer text-purple-500 hover:text-purple-400"
     >
      <Upload size={14} /> Inject JSON
     </button>
     <button 
      onClick={handleSaveJsonToDb}
      class="px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer text-green-500 hover:text-green-400"
     >
      <Database size={14} /> Save JSON to Local DB
     </button>
    </div>
   </div>

   <div class="flex flex-col gap-2 mt-4">
    <Show when={profiles().length === 0 && !isLoading()}>
     <div class="p-8 text-center text-zinc-500 font-spaceMono text-sm border border-zinc-800 border-dashed">
      No profiles found. Click "Update Profiles" to fetch from the community database.
     </div>
    </Show>
    <For each={filteredProfiles()}>
     {(profile) => (
      <div 
       onClick={() => isBulkSelectMode() ? toggleProfileSelection(profile.id) : handleApplyProfile(profile)}
       class="bg-[#0a0a0a] border border-zinc-800 p-4 hover:border-red-500/50 transition-colors group cursor-pointer flex justify-between items-center"
      >
       <div class="flex items-center gap-4">
        <Show when={isBulkSelectMode()}>
         <div class="z-20 p-1">
          {selectedProfiles().includes(profile.id) ? <CheckSquare size={20} class="text-blue-500" /> : <Square size={20} class="text-zinc-500" />}
         </div>
        </Show>
        <div>
         <h3 class="text-white font-bold font-brains text-lg mb-1 group-hover:text-red-500 transition-colors">{profile.title}</h3>
         <p class="text-zinc-600 text-[11px] font-brains">
          {profile.developer && profile.developer !== "Unknown" ? profile.developer : "Community Profile"}
          {profile.engine && profile.engine !== "Unknown" ? ` • Engine: ${profile.engine}` : ""}
          {profile.author ? ` • By: ${profile.author}` : ""}
          {profile.version ? ` • v${profile.version}` : ""}
         </p>
         <Show when={profile.notes}>
          <p class="text-zinc-500 text-[10px] font-brains mt-1 italic line-clamp-1">{profile.notes}</p>
         </Show>
        </div>
       </div>
       <Show when={!isBulkSelectMode()}>
        <Tooltip text="Export as File" align="right" position="top">
        <button
         onClick={(e) => handleDownloadProfile(e, profile)}
         class="p-2 text-zinc-500 hover:text-white cursor-pointer hover:bg-zinc-800 transition-colors"
        >
         <Download size={18} />
        </button>
        </Tooltip>
       </Show>
      </div>
     )}
    </For>
   </div>

   <Show when={isBulkSelectMode() && selectedProfiles().length > 0}>
    <div class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 border-2 border-blue-500 p-4 flex items-center gap-6 shadow-[8px_8px_0px_#3b82f6] z-[100] animate-in slide-in-from-bottom-10">
     <div class="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
      <CheckSquare size={18} class="text-blue-500" />
      {selectedProfiles().length} SELECTED
     </div>
     <div class="h-6 w-0.5 bg-zinc-800"></div>
     <button onClick={handleBulkDownloadProfiles} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-blue-400 border-2 border-blue-900 hover:bg-blue-500 hover:text-black hover:border-blue-500 transition-all uppercase font-black tracking-widest text-xs cursor-pointer">
      <Download size={14} /> EXPORT SELECTED
     </button>
     <button onClick={() => { setSelectedProfiles([]); setIsBulkSelectMode(false); }} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-zinc-400 border-2 border-zinc-800 hover:bg-zinc-200 hover:text-black hover:border-zinc-200 transition-all uppercase font-black tracking-widest text-xs cursor-pointer">
      <X size={14} /> CANCEL
     </button>
    </div>
   </Show>

   <HelpModal isOpen={isHelpModalOpen()} onClose={() => setIsHelpModalOpen(false)} />
  </div>
 );
}

function FolderInjectTab(props: any) {
 const editorState = useEditorStore();
 const [isHelpModalOpen, setIsHelpModalOpen] = createSignal(false);

 const handleScanFolder = async () => {
  try {
   const selected = await openDialog({ directory: true });
   if (selected && typeof selected === 'string') {
    const entries = await readDir(selected);
    const keys = entries.filter(e => e.isFile).map(e => e.name?.split('.')[0] || '').filter(k => k !== '');
    
    const newExtracted = Array.from(new Set([...props.extractedKeys(), ...keys]));
    props.setExtractedKeys(newExtracted);
    props.setSelectedKeys(new Set(newExtracted));
    addToast(`Scanned ${keys.length} files successfully!`, 'success');
   }
  } catch (e: any) {
   addToast("Failed to scan folder: " + e.message, 'error');
  }
 };

 const handleImportCsv = async () => {
  try {
   const selected = await openDialog({
    multiple: true,
    filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }]
   });
   if (selected) {
    const paths = Array.isArray(selected) ? selected : [selected];
    let allKeys: string[] = [];
    for (const p of paths) {
     const content = await readTextFile(p);
     const lines = content.split(/\r?\n/).map(l => l.split(',')[0].trim()).filter(l => l);
     allKeys = allKeys.concat(lines);
    }
    const newExtracted = Array.from(new Set([...props.extractedKeys(), ...allKeys]));
    props.setExtractedKeys(newExtracted);
    props.setSelectedKeys(new Set(newExtracted));
    addToast(`Imported ${allKeys.length} keys from CSV!`, 'success');
   }
  } catch (e: any) {
   addToast("Failed to import CSV: " + e.message, 'error');
  }
 };

 const toggleKey = (key: string) => {
  const newSet = new Set(props.selectedKeys());
  if (newSet.has(key)) newSet.delete(key);
  else newSet.add(key);
  props.setSelectedKeys(newSet);
 };

 const filteredKeys = () => props.extractedKeys().filter((k: string) => k.toLowerCase().includes(props.filterText().toLowerCase()));

 const applyModifiers = (key: string) => {
  let finalKey = `${props.prefix()}${key}${props.suffix()}`;
  if (props.useUppercase()) finalKey = finalKey.toUpperCase();
  else if (props.useLowercase()) finalKey = finalKey.toLowerCase();
  return finalKey;
 };

 const handleInject = async () => {
  if (!editorState.saveData || !editorState.saveData.parsed_variables) {
   addToast("No save file loaded to inject into!", "error");
   return;
  }

  const isConfirmed = await props.customConfirm(`Are you sure you want to inject ${props.selectedKeys().size} keys directly into the save file?`);
  if (!isConfirmed) return;

  let parsedVal: any;
  const valToParse = props.targetValue() === 'custom' ? props.customValue() : props.targetValue();

  if (valToParse === 'true') parsedVal = true;
  else if (valToParse === 'false') parsedVal = false;
  else if (!isNaN(Number(valToParse)) && valToParse.trim() !== '') parsedVal = Number(valToParse);
  else parsedVal = valToParse;

  const newVars = JSON.parse(JSON.stringify(editorState.saveData.parsed_variables));
  let count = 0;
  for (const key of props.selectedKeys()) {
   newVars[applyModifiers(key)] = parsedVal;
   count++;
  }
  
  updateParsedVariables(newVars);
  addToast(`Successfully injected ${count} keys into save payload!`, "success");
  props.onClose();
 };

 const handleImportJsonKeys = async () => {
  try {
   const selected = await openDialog({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
   if (selected && typeof selected === 'string') {
    const content = await readTextFile(selected);
    const parsed = JSON.parse(content);
    let importedKeys: string[] = [];

    if (parsed.rules && Array.isArray(parsed.rules)) {
     parsed.rules.forEach((r: any) => { if (r.keys) importedKeys.push(...r.keys) });
    } else if (Array.isArray(parsed)) {
     parsed.forEach((r: any) => { if (r.keys) importedKeys.push(...r.keys) });
    } else if (parsed.keys) {
     importedKeys.push(...parsed.keys);
    }

    if (importedKeys.length > 0) {
     const newExtracted = Array.from(new Set([...props.extractedKeys(), ...importedKeys]));
     props.setExtractedKeys(newExtracted);
     props.setSelectedKeys(new Set(newExtracted));
     addToast(`Imported ${importedKeys.length} keys from JSON!`, "success");
    } else {
     addToast("No valid keys found in JSON", "error");
    }
   }
  } catch (e: any) {
   addToast("Failed to import JSON: " + e.message, "error");
  }
 };

 return (
  <div class="flex flex-col gap-4 h-full">
   <div class="flex items-center justify-between">
    <h3 class="text-zinc-300 font-bold tracking-widest uppercase text-sm flex items-center gap-2">
     Scanned Files Staging Area 
    </h3>
     <div class="flex gap-2">
      <Show when={props.extractedKeys().length > 0}>
       <button onClick={() => { 
        const sel = props.selectedKeys();
        const newExtracted = props.extractedKeys().filter((k: string) => sel.has(k));
        props.setExtractedKeys(newExtracted);
        addToast(`Cleared ${props.extractedKeys().length - newExtracted.length} unselected keys.`, "info");
       }} class="bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black px-4 py-2 font-bold tracking-widest uppercase text-xs flex items-center gap-2 transition-colors cursor-pointer" title="Clear Non-Selected Keys">
        <X size={14} /> Clear Non Selected
       </button>
       <button onClick={() => { props.setExtractedKeys([]); props.setSelectedKeys(new Set()); addToast("Staging area cleared.", "info"); }} class="bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black px-4 py-2 font-bold tracking-widest uppercase text-xs flex items-center gap-2 transition-colors cursor-pointer" title="Clear All Staging Area">
        <X size={14} /> Clear All
       </button>
      </Show>
      
      <button onClick={handleImportJsonKeys} class="bg-[#0a0a0a] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-500 px-4 py-2 font-bold tracking-widest uppercase text-xs flex items-center gap-2 transition-colors cursor-pointer">
       <Upload size={14} /> Import JSON
      </button>
      <button onClick={handleImportCsv} class="bg-[#0a0a0a] border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-500 px-4 py-2 font-bold tracking-widest uppercase text-xs flex items-center gap-2 transition-colors cursor-pointer">
       <FileCode size={14} /> Import CSV
      </button>
      <button onClick={handleScanFolder} class="bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-black px-4 py-2 font-bold tracking-widest uppercase text-xs flex items-center gap-2 transition-colors cursor-pointer">
       <FolderPlus size={14} /> Scan Folder
      </button>
      <button 
       onClick={() => { setHelpModalSection('folder_inject_tab'); setIsHelpModalOpen(true); }}
       class="bg-[#0a0a0a] border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-black px-4 py-2 font-bold tracking-widest uppercase text-xs flex items-center gap-2 transition-colors cursor-pointer"
      >
       <HelpCircle size={14} /> Help
      </button>
     </div>
   </div>

   <div class="border border-zinc-800 bg-[#0a0a0a] flex-1 min-h-[300px] flex flex-col">
    <div class="p-2 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
     <input 
      type="text" 
      value={props.filterText()}
      onInput={(e) => props.setFilterText(e.currentTarget.value)}
      placeholder="Filter file names (e.g. bgm, system)..." 
      class="bg-transparent text-zinc-400 font-brains text-xs focus:outline-none w-1/2 px-2" 
     />
     <span class="text-zinc-500 font-mono text-xs pr-2">{props.selectedKeys().size} / {props.extractedKeys().length} selected</span>
    </div>
    <Show when={props.extractedKeys().length === 0}>
     <div class="flex-1 flex flex-col items-center justify-center text-zinc-600 font-mono text-sm p-8 text-center">
      <FolderPlus size={48} class="mb-4 opacity-20" />
      <p>No files scanned.</p>
      <p>Click "Scan Folder" to extract flags from game directory.</p>
     </div>
    </Show>
    <Show when={props.extractedKeys().length > 0}>
     <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
       <For each={filteredKeys()}>
        {(key: string) => (
         <label class={`flex items-center gap-2 p-2 border cursor-pointer hover:bg-zinc-900 transition-colors ${props.selectedKeys().has(key) ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800 bg-zinc-950'}`}>
          <input type="checkbox" class="accent-red-500" checked={props.selectedKeys().has(key)} onChange={() => toggleKey(key)} />
          <span class="font-fira text-xs text-zinc-300 truncate">{applyModifiers(key)}</span>
         </label>
        )}
       </For>
      </div>
     </div>
    </Show>
   </div>

<div class="flex flex-col gap-5 mt-4">
   <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-xs font-bold tracking-widest uppercase">Prefix (Optional)</label>
     <input type="text" value={props.prefix()} onInput={(e) => props.setPrefix(e.currentTarget.value)} placeholder="e.g. cg_" class="bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-zinc-300 font-pixel focus:outline-none focus:border-red-500" />
    </div>
    
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-xs font-bold tracking-widest uppercase">Suffix (Optional)</label>
     <input type="text" value={props.suffix()} onInput={(e) => props.setSuffix(e.currentTarget.value)} placeholder="e.g. _h" class="w-full bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-zinc-300 font-pixel focus:outline-none focus:border-red-500" />
    </div>

    <label class="flex items-center gap-4 cursor-pointer group mb-1">
     <input type="checkbox" checked={props.useUppercase()} onChange={(e) => { props.setUseUppercase(e.target.checked); if (e.target.checked) props.setUseLowercase(false); }} class="hidden" />
     <div class={`w-14 h-7 border flex items-center p-0.5 transition-colors shrink-0 ${props.useUppercase() ? 'bg-red-500 border-red-500' : 'bg-[#050505] border-zinc-700 group-hover:border-zinc-500'}`}>
      <div class={`w-5 h-5 bg-white transition-transform ${props.useUppercase() ? 'translate-x-7' : 'translate-x-0'}`}></div>
     </div>
     <div class="flex flex-col">
      <span class="text-zinc-300 font-bold tracking-widest uppercase text-sm">UPPERCASE</span>
      <span class="text-zinc-600 text-[11px] font-mono leading-none mt-1 uppercase">CONVERT KEYS TO ALL CAPS</span>
     </div>
    </label>

    <label class="flex items-center gap-4 cursor-pointer group mb-1">
     <input type="checkbox" checked={props.useLowercase()} onChange={(e) => { props.setUseLowercase(e.target.checked); if (e.target.checked) props.setUseUppercase(false); }} class="hidden" />
     <div class={`w-14 h-7 border flex items-center p-0.5 transition-colors shrink-0 ${props.useLowercase() ? 'bg-red-500 border-red-500' : 'bg-[#050505] border-zinc-700 group-hover:border-zinc-500'}`}>
      <div class={`w-5 h-5 bg-white transition-transform ${props.useLowercase() ? 'translate-x-7' : 'translate-x-0'}`}></div>
     </div>
     <div class="flex flex-col">
      <span class="text-zinc-300 font-bold tracking-widest uppercase text-sm">LOWERCASE</span>
      <span class="text-zinc-600 text-[11px] font-mono leading-none mt-1 uppercase">convert keys to lowercase</span>
     </div>
    </label>
   </div>

   <div class="flex flex-col gap-2 mt-2">
    <label class="text-red-500 text-xs font-bold tracking-widest uppercase">Target Value</label>
    <div class="flex gap-2 w-full">
     <select 
      value={props.targetValue()}
      onChange={(e) => props.setTargetValue(e.currentTarget.value)}
      class="flex-1 bg-red-500/10 border border-red-500/50 px-4 py-3 text-red-500 font-brains text-sm focus:outline-none focus:border-red-400 cursor-pointer appearance-none outline-none transition-colors hover:bg-red-500/20"
     >
      <option value="1" class="bg-[#0a0a0a] text-zinc-300">1 (Standard VN / KiriKiri)</option>
      <option value="true" class="bg-[#0a0a0a] text-zinc-300">true (Ren'Py / RPG Maker)</option>
      <option value="999" class="bg-[#0a0a0a] text-zinc-300">999 (Max Stats / Items)</option>
      <option value="custom" class="bg-[#0a0a0a] text-zinc-300">Custom...</option>
     </select>
     
     <Show when={props.targetValue() === 'custom'}>
      <input 
       type="text" 
       value={props.customValue()} 
       onInput={(e) => props.setCustomValue(e.currentTarget.value)} 
       placeholder="e.g. false, 9999, unlock_all" 
       class="flex-1 bg-red-950/40 border border-red-500/35 px-4 py-3 text-red-400 font-pixel text-[14px] font-bold tracking-wide antialiased placeholder:text-red-900/60 focus:outline-none focus:border-red-400 focus:bg-red-950/40 focus:shadow-[0_0_12px_rgba(239,68,68,0.25)] transition-all"
      />
     </Show>
    </div>
   </div>
  </div>

   <div class="flex items-center justify-between mt-4">
    <p class="text-zinc-600 text-xs font-desc w-2/3">Uncheck non-gameplay files before injecting. Prefix/Suffix will be added to the selected keys.</p>
    <button 
     onClick={handleInject}
     disabled={props.selectedKeys().size === 0}
     class="bg-red-500 hover:bg-red-400 text-black px-8 py-3 font-bold tracking-widest uppercase transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
     Inject Selected ({props.selectedKeys().size})
    </button>
   </div>
   <HelpModal isOpen={isHelpModalOpen()} onClose={() => setIsHelpModalOpen(false)} />
  </div>
 );
}

function BuilderTab(props: any) {
 const [isHelpModalOpen, setIsHelpModalOpen] = createSignal(false);
 const [isCopied, setIsCopied] = createSignal(false);
 const [previewJsonContent, setPreviewJsonContent] = createSignal<string | null>(null);

 const generateJsonProfile = () => {
    let parsedVal: any;
    const valToParse = props.targetValue() === 'custom' ? props.customValue() : props.targetValue();

    if (valToParse === 'true') parsedVal = true;
    else if (valToParse === 'false') parsedVal = false;
    else if (!isNaN(Number(valToParse)) && valToParse.trim() !== '') parsedVal = Number(valToParse);
    else parsedVal = valToParse;

    const keys = Array.from(props.selectedKeys()).map((key: unknown) => {
     let finalKey = `${props.prefix()}${key as string}${props.suffix()}`;
     if (props.useUppercase()) finalKey = finalKey.toUpperCase();
     else if (props.useLowercase()) finalKey = finalKey.toLowerCase();
     return finalKey;
    });

    const profile: any = {
     id: `custom_${Date.now()}`,
     title: props.profileTitle().trim() || "Custom Generated Profile",
     developer: props.profileDeveloper().trim() || "Unknown",
     engine: props.profileEngine().trim() || "Unknown",
     author: props.profileAuthor().trim() || undefined,
     version: props.profileVersion().trim() || undefined,
     notes: props.profileNotes().trim() || undefined,
     rules: [
      {
       type: "exact_match",
       keys: keys,
       value: parsedVal
      }
     ]
    };
    Object.keys(profile).forEach(key => profile[key] === undefined && delete profile[key]);
    return JSON.stringify(profile, null, 2);
 };

 const handleExportCsv = async () => {
  if (props.selectedKeys().size === 0) {
   addToast("No keys selected to export!", "error");
   return;
  }
  try {
   const savePath = await saveDialog({
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    defaultPath: 'profile_export.csv'
   });
   if (savePath) {
    let content = '';
    for (const key of props.selectedKeys()) {
     let finalKey = `${props.prefix()}${key}${props.suffix()}`;
     if (props.useUppercase()) finalKey = finalKey.toUpperCase();
     else if (props.useLowercase()) finalKey = finalKey.toLowerCase();
     content += finalKey + '\n';
    }
    await writeTextFile(savePath, content);
    addToast("Successfully exported to CSV!", "success");
   }
  } catch (e: any) {
   addToast("Failed to export CSV: " + e.message, "error");
  }
 };

 const handleSaveToDb = async () => {
  if (props.selectedKeys().size === 0) {
   addToast("No keys selected to save!", "error");
   return;
  }
  try {
   let parsedVal: any;
   const valToParse = props.targetValue() === 'custom' ? props.customValue() : props.targetValue();

   if (valToParse === 'true') parsedVal = true;
   else if (valToParse === 'false') parsedVal = false;
   else if (!isNaN(Number(valToParse)) && valToParse.trim() !== '') parsedVal = Number(valToParse);
   else parsedVal = valToParse;

   const keys = Array.from(props.selectedKeys()).map((key: unknown) => {
    let finalKey = `${props.prefix()}${key as string}${props.suffix()}`;
    if (props.useUppercase()) finalKey = finalKey.toUpperCase();
    else if (props.useLowercase()) finalKey = finalKey.toLowerCase();
    return finalKey;
   });

   const profile: any = {
    id: `custom_${Date.now()}`,
    title: props.profileTitle().trim() || "Custom Generated Profile",
    developer: props.profileDeveloper().trim() || "Unknown",
    engine: props.profileEngine().trim() || "Unknown",
    author: props.profileAuthor().trim() || undefined,
    version: props.profileVersion().trim() || undefined,
    notes: props.profileNotes().trim() || undefined,
    rules: [
     {
      type: "exact_match",
      keys: keys,
      value: parsedVal
     }
    ]
   };
   Object.keys(profile).forEach(key => profile[key] === undefined && delete profile[key]);
   
   await saveLocalProfile(profile);
   addToast("Successfully saved to Local Database!", "success");
  } catch (e: any) {
   addToast("Failed to save to database: " + e.message, "error");
  }
 };

 const handleCopyJson = async () => {
  if (props.selectedKeys().size === 0) return;
  try {
   const jsonString = generateJsonProfile();
   await navigator.clipboard.writeText(jsonString);
   setIsCopied(true);
   addToast("Profile JSON copied to clipboard!", "success");
   setTimeout(() => setIsCopied(false), 2000);
  } catch (e: any) {
   addToast("Failed to copy JSON: " + e.message, "error");
  }
 };

 const handlePreviewJson = () => {
  if (props.selectedKeys().size === 0) return;
  const jsonString = generateJsonProfile();
  setPreviewJsonContent(jsonString);
 };

 const handleExportJson = async () => {
  if (props.selectedKeys().size === 0) {
   addToast("No keys selected to generate profile!", "error");
   return;
  }
  try {
   const savePath = await saveDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: 'custom_profile.json'
   });
   if (savePath) {
    const jsonString = generateJsonProfile();
    await writeTextFile(savePath, jsonString);
    addToast("Successfully exported JSON Profile!", "success");
   }
  } catch (e: any) {
   addToast("Failed to export JSON: " + e.message, "error");
  }
 };

 return (
  <div class="flex flex-col gap-4 h-full overflow-y-auto pr-2 pb-4 custom-scrollbar">
   <div class="bg-zinc-800/20 border border-zinc-700 text-zinc-400 p-4 font-fira text-xs flex items-start gap-3">
    <Code size={16} class="shrink-0 mt-0.5" />
    <p><strong>Profile Builder:</strong> Create your own JSON profiles to share with the community. Scan a folder in the "Folder Inject" tab, select your keys, modify prefixes, and generate the structured JSON here.</p>
   </div>
   
   <div class="border border-zinc-800 bg-[#0a0a0a] flex-1 min-h-[300px] flex flex-col">
    <div class="p-2 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
     <span class="text-zinc-600 font-brains text-xs pl-2">Keys Staged for Generation: {props.selectedKeys().size}</span>
     <button 
      onClick={() => { setHelpModalSection('builder_tab'); setIsHelpModalOpen(true); }}
      class="bg-[#0a0a0a] border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-black px-3 py-1 font-bold tracking-widest uppercase text-[10px] flex items-center gap-2 transition-colors cursor-pointer"
     >
      <HelpCircle size={12} /> Help
     </button>
    </div>
    <Show when={props.selectedKeys().size === 0}>
     <div class="flex-1 flex flex-col items-center justify-center text-zinc-600 font-mono text-sm p-8 text-center">
      <Code size={48} class="mb-4 opacity-20" />
      <p>Builder workspace empty.</p>
      <p>Go to the "Folder Inject" tab to stage files for generation.</p>
     </div>
    </Show>
    <Show when={props.selectedKeys().size > 0}>
     <div class="flex-1 overflow-y-auto p-4 custom-scrollbar text-zinc-400 font-mono text-xs">
      <For each={Array.from(props.selectedKeys()).slice(0, 50)}>
       {(key: unknown) => {
        let finalKey = `${props.prefix()}${key as string}${props.suffix()}`;
        if (props.useUppercase()) finalKey = finalKey.toUpperCase();
        return <div class="truncate opacity-50">- {finalKey}</div>;
       }}
      </For>
      <Show when={props.selectedKeys().size > 50}>
       <div class="mt-2 text-zinc-600 italic">...and {props.selectedKeys().size - 50} more keys.</div>
      </Show>
     </div>
    </Show>
   </div>

   <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Profile Title</label>
     <input type="text" value={props.profileTitle()} onInput={(e) => props.setProfileTitle(e.currentTarget.value)} placeholder="e.g. Nekopara Vol 1 - Max" class="bg-[#0a0a0a] border border-zinc-800 px-4 py-2 text-zinc-300 text-sm font-brains focus:outline-none focus:border-red-500" />
    </div>
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Developer (Optional)</label>
     <input type="text" value={props.profileDeveloper()} onInput={(e) => props.setProfileDeveloper(e.currentTarget.value)} placeholder="e.g. NEKO WORKs" class="bg-[#0a0a0a] border border-zinc-800 px-4 py-2 text-zinc-300 text-sm font-brains focus:outline-none focus:border-red-500" />
    </div>
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Engine (Optional)</label>
     <input type="text" value={props.profileEngine()} onInput={(e) => props.setProfileEngine(e.currentTarget.value)} placeholder="e.g. KiriKiri" class="bg-[#0a0a0a] border border-zinc-800 px-4 py-2 text-zinc-300 text-sm font-brains focus:outline-none focus:border-red-500" />
    </div>
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Author (Optional)</label>
     <input type="text" value={props.profileAuthor()} onInput={(e) => props.setProfileAuthor(e.currentTarget.value)} placeholder="e.g. Suzuya" class="bg-[#0a0a0a] border border-zinc-800 px-4 py-2 text-zinc-300 text-sm font-brains focus:outline-none focus:border-red-500" />
    </div>
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Game Version (Optional)</label>
     <input type="text" value={props.profileVersion()} onInput={(e) => props.setProfileVersion(e.currentTarget.value)} placeholder="e.g. 1.0.4" class="bg-[#0a0a0a] border border-zinc-800 px-4 py-2 text-zinc-300 text-sm font-brains focus:outline-none focus:border-red-500" />
    </div>
    <div class="flex flex-col gap-2">
     <label class="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">Notes / Desc (Optional)</label>
     <input type="text" value={props.profileNotes()} onInput={(e) => props.setProfileNotes(e.currentTarget.value)} placeholder="e.g. Unlocks all CGs and gallery." class="bg-[#0a0a0a] border border-zinc-800 px-4 py-2 text-zinc-300 text-sm font-brains focus:outline-none focus:border-red-500" />
    </div>
   </div>

   <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 shrink-0">
    <button 
     onClick={handleExportCsv}
     disabled={props.selectedKeys().size === 0}
     class="bg-transparent border border-blue-500/50 text-blue-500 hover:bg-blue-500 hover:text-black py-4 font-bold tracking-widest uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     <FileCode size={16} /> Export CSV
    </button>
    <button 
     onClick={handleSaveToDb}
     disabled={props.selectedKeys().size === 0}
     class="bg-transparent border border-green-500/50 text-green-500 hover:bg-green-500 hover:text-black py-4 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     <Database size={16} /> Save to Local DB
    </button>
    <button 
     onClick={handleCopyJson}
     disabled={props.selectedKeys().size === 0}
     class="bg-transparent border border-purple-500/50 text-purple-500 hover:bg-purple-500 hover:text-black py-4 font-bold tracking-widest uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     <Show when={isCopied()} fallback={<Copy size={16} />}>
      <Check size={16} />
     </Show>
     {isCopied() ? 'Copied!' : 'Copy JSON'}
    </button>
    <button 
     onClick={handlePreviewJson}
     disabled={props.selectedKeys().size === 0}
     class="bg-transparent border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-black py-4 font-bold tracking-widest uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     <Eye size={16} /> View JSON
    </button>
    <button 
     onClick={handleExportJson}
     disabled={props.selectedKeys().size === 0}
     class="bg-transparent border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-black py-4 font-bold tracking-widest uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     <Code size={16} /> Export JSON
    </button>
   </div>
   <HelpModal isOpen={isHelpModalOpen()} onClose={() => setIsHelpModalOpen(false)} />
   
   <Modal
    isOpen={previewJsonContent() !== null}
    onClose={() => setPreviewJsonContent(null)}
    title="JSON Profile Preview"
   >
    <div class="p-6">
     <div class="bg-zinc-950 border border-zinc-800 p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
      <pre class="text-zinc-300 font-brains text-xs whitespace-pre-wrap">{previewJsonContent()}</pre>
     </div>
     <div class="mt-6 flex justify-end">
      <button 
       onClick={() => setPreviewJsonContent(null)}
       class="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 font-bold tracking-widest uppercase transition-colors cursor-pointer"
      >
       Close
      </button>
     </div>
    </div>
   </Modal>
  </div>
 );
}

function RawJsonTab() {
 const [jsonContent, setJsonContent] = createSignal('');

 const handlePaste = async () => {
  try {
   const text = await navigator.clipboard.readText();
   setJsonContent(text);
   addToast("Pasted from clipboard!", "info");
  } catch (e: any) {
   addToast("Failed to read clipboard", "error");
  }
 };

 const handleSave = async () => {
  try {
   const text = jsonContent().trim();
   if (!text) {
    addToast("JSON content is empty!", "error");
    return;
   }
   
   const parsed = JSON.parse(text);
   let rulesToApply = null;
   if (parsed.rules && Array.isArray(parsed.rules)) rulesToApply = parsed.rules;
   else if (Array.isArray(parsed)) rulesToApply = parsed;
   else if (parsed.type && (parsed.keys || parsed.prefixes)) rulesToApply = [parsed];

   if (rulesToApply) {
    const profileToSave = {
     id: parsed.id || `custom_${Date.now()}`,
     title: parsed.title || "Custom Raw Profile",
     developer: parsed.developer || "Unknown",
     engine: parsed.engine || "Unknown",
     author: parsed.author,
     version: parsed.version,
     notes: parsed.notes,
     rules: rulesToApply
    };
    await saveLocalProfile(profileToSave);
    addToast("Raw JSON Profile saved to local DB successfully!", "success");
    setJsonContent('');
   } else {
    addToast("Invalid profile JSON structure", "error");
   }
  } catch (e: any) {
   addToast("Invalid JSON syntax: " + e.message, "error");
  }
 };

 return (
  <div class="flex flex-col gap-4 h-full">
   <div class="bg-purple-500/10 border border-purple-500/30 text-purple-400 p-4 font-desc text-[13px] flex items-start gap-3">
    <FileCode size={16} class="shrink-0 mt-0.5" />
    <p><strong>Raw JSON Editor:</strong> Paste and edit JSON profiles manually before saving them to your local database.</p>
   </div>

   <div class="flex-1 flex flex-col border border-zinc-800 bg-[#0a0a0a] min-h-[300px]">
    <div class="p-2 border-b border-zinc-800 flex items-center justify-between bg-[#050505]">
     <span class="text-zinc-500 font-brains text-xs pl-2">JSON Editor</span>
     <button 
      onClick={handlePaste}
      class="bg-[#0a0a0a] border border-zinc-700 text-zinc-400 hover:text-white px-3 py-1 font-bold tracking-widest uppercase text-[10px] flex items-center gap-2 transition-colors cursor-pointer"
     >
      <Upload size={12} /> Paste from Clipboard
     </button>
    </div>
    <textarea
     value={jsonContent()}
     onInput={(e) => setJsonContent(e.currentTarget.value)}
     placeholder="{\n  'title': 'My Profile',\n  'rules': [...]\n}"
     class="flex-1 w-full bg-transparent p-4 text-zinc-300 font-brains text-xs leading-relaxed resize-none focus:outline-none custom-scrollbar"
     spellcheck={false}
    />
   </div>

   <div class="shrink-0 pt-2 flex justify-end">
    <button 
     onClick={handleSave}
     disabled={!jsonContent().trim()}
     class="bg-transparent border border-emerald-500/50 text-emerald-500 hover:bg-emerald-500 hover:text-black px-8 py-3 font-bold tracking-widest uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
     <Database size={16} /> Save to Database
    </button>
   </div>
  </div>
 );
}