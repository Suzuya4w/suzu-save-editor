import { createSignal, Show, For } from 'solid-js';
import { Upload, Loader2 } from 'lucide-solid';
import { addToast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import JSZip from 'jszip';
import { Modal } from './Modal';

export const isSafeFile = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return true;
  const isWindowsExe = bytes[0] === 0x4D && bytes[1] === 0x5A;
  const isLinuxElf = bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46;
  const isMacMachO = (
    (bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA && bytes[3] === 0xCE) ||
    (bytes[0] === 0xCE && bytes[1] === 0xFA && bytes[2] === 0xED && bytes[3] === 0xFE) ||
    (bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA && bytes[3] === 0xCF) ||
    (bytes[0] === 0xCF && bytes[1] === 0xFA && bytes[2] === 0xED && bytes[3] === 0xFE)
  );
  return !(isWindowsExe || isLinuxElf || isMacMachO);
};

export const fetchGameSuggestions = async (val: string) => {
  const results: any[] = [];

  try {
    const vndbRes = await tauriFetch('https://api.vndb.org/kana/vn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ["search", "=", val],
        fields: "title, titles.title, titles.lang, image.url, image.sexual, image.violence",
        results: 4
      })
    });
    if (vndbRes.ok) {
      const vndbData = await vndbRes.json();
      vndbData.results?.forEach((r: any) => {
        let displayTitle = r.title;
        const enTitle = r.titles?.find((t: any) => t.lang === 'en');
        if (enTitle && enTitle.title.toLowerCase() !== r.title.toLowerCase()) {
          displayTitle = `${r.title} / ${enTitle.title}`;
        }
        results.push({
          title: displayTitle,
          source: 'VNDB',
          cover_url: r.image?.url || '',
          is_nsfw: r.image && (r.image.sexual >= 1 || r.image.violence >= 1)
        });
      });
    }
  } catch (err) {}

  try {
    const bgmRes = await tauriFetch(`https://api.bgm.tv/search/subject/${encodeURIComponent(val)}?type=4&responseGroup=small`);
    if (bgmRes.ok) {
      const bgmData = await bgmRes.json();
      bgmData.list?.slice(0, 4).forEach((r: any) => {
        let displayTitle = r.name;
        if (r.name_cn && r.name_cn.toLowerCase() !== r.name.toLowerCase()) {
          displayTitle = `${r.name} / ${r.name_cn}`;
        }
        results.push({
          title: displayTitle,
          source: 'Bangumi',
          cover_url: r.images?.common || '',
          is_nsfw: false
        });
      });
    }
  } catch (err) {}

  try {
    const steamRes = await tauriFetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(val)}&l=english&cc=US`);
    if (steamRes.ok) {
      const steamData = await steamRes.json();
      steamData.items?.slice(0, 4).forEach((r: any) => {
        results.push({
          title: r.name,
          source: 'Steam',
          cover_url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${r.id}/header.jpg`,
          is_nsfw: false
        });
      });
    }
  } catch (err) {}

  return results.filter((v, i, a) => a.findIndex(t => (t.title === v.title)) === i);
};

export function UploadSaveModal(props: { isOpen: boolean; onClose: () => void; onUploadComplete: () => void; showNSFW: boolean; }) {
  const authState = useAuthStore();
  const [uploadForm, setUploadForm] = createSignal({ title: '', game_engine: '', game_version: '', description: '', file_paths: [] as string[], cover_url: '', is_nsfw: false });
  const [isUploading, setIsUploading] = createSignal(false);
  const [titleSuggestions, setTitleSuggestions] = createSignal<any[]>([]);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [isSearchingGames, setIsSearchingGames] = createSignal(false);
  const [isNsfwLocked, setIsNsfwLocked] = createSignal(false);
  let searchTimeout: any;

  const handleTitleInput = (e: any) => {
    const val = e.currentTarget.value;
    setUploadForm({ ...uploadForm(), title: val });
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (val.length < 3) {
      setTitleSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      setIsSearchingGames(true);
      setShowSuggestions(true);

      const uniqueResults = await fetchGameSuggestions(val);
      setTitleSuggestions(uniqueResults);
      setIsSearchingGames(false);
    }, 600);
  };

  const handleFileSelect = async () => {
    const selected = await openDialog({ multiple: true });
    if (selected) {
      let paths = Array.isArray(selected) ? selected.map(p => typeof p === 'string' ? p : (p as any).path) : [typeof selected === 'string' ? selected : (selected as any).path];
      setUploadForm({ ...uploadForm(), file_paths: paths });
    }
  };

  const submitUpload = async () => {
    if (!uploadForm().title || uploadForm().file_paths.length === 0) {
      addToast('Title and File are required', 'error');
      return;
    }
    try {
      setIsUploading(true);
      let finalFileBytes: Uint8Array;
      let finalFileName: string;

      const jszip = new JSZip();
      for (const path of uploadForm().file_paths) {
        const bytes = await readFile(path);
        
        // SECURITY FIX: Re-implement isSafeFile check!
        // We must ensure that malicious executables don't get smuggled inside the ZIP payload.
        if (!isSafeFile(bytes)) {
          throw new Error(`Upload Rejected: File "${path.split(/[\\/]/).pop()}" is an executable or malicious format.`);
        }
        
        jszip.file(path.split(/[\\/]/).pop() || 'unknown', bytes);
      }
      finalFileBytes = await jszip.generateAsync({ type: 'uint8array' });
      const safeTitle = uploadForm().title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'SaveData';
      finalFileName = `${Date.now()}_${safeTitle}.zip`;

      if (finalFileBytes.length > 50 * 1024 * 1024) throw new Error('File exceeds 50MB limit');

      const { error: storageError } = await supabase.storage.from('saves').upload(finalFileName, finalFileBytes);
      if (storageError) throw storageError;
      
      const { data: { publicUrl } } = supabase.storage.from('saves').getPublicUrl(finalFileName);

      const { error: dbError } = await supabase.from('save_files').insert({
        title: uploadForm().title,
        description: uploadForm().description,
        game_engine: uploadForm().game_engine,
        game_version: uploadForm().game_version,
        file_size_bytes: finalFileBytes.length,
        file_url: publicUrl,
        uploader: authState.user?.user_metadata?.full_name || authState.user?.email || 'Anonymous',
        uploader_avatar_url: authState.user?.user_metadata?.avatar_url || null,
        uploader_id: authState.user?.id || null,
        game_cover_url: uploadForm().cover_url || null,
        is_nsfw: uploadForm().is_nsfw || false,
        is_visible: true,
        is_verified: false
      });
      
      if (dbError) throw dbError;
      
      addToast('Upload successful!', 'success');
      props.onClose();
      setUploadForm({ title: '', game_engine: '', game_version: '', description: '', file_paths: [], cover_url: '', is_nsfw: false });
      props.onUploadComplete();
    } catch (e: any) {
      addToast(e.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
     isOpen={props.isOpen}
     onClose={props.onClose}
     title="UPLOAD_NEW_SAVE"
     icon={<Upload size={18} />}
     width="max-w-xl"
    >
     <div class="flex flex-col gap-4">
       <div class="flex flex-col gap-1">
        <label class="text-xs font-bold text-white tracking-widest uppercase">Title (Required)</label>
        <div class="relative">
         <input
          type="text"
          maxLength={100}
          value={uploadForm().title}
          onInput={handleTitleInput}
          onFocus={() => { if (uploadForm().title.length >= 3) setShowSuggestions(true); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          class="w-full bg-black border-2 border-zinc-700 p-2 text-white focus:border-[#FF7A00] outline-none uppercase font-bold"
         />
         <Show when={showSuggestions()}>
          <div class="absolute top-full left-0 w-full bg-zinc-900 border-2 border-[#FF7A00] mt-1 z-[60] shadow-[4px_4px_0px_#FF7A00] max-h-200 overflow-y-auto [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:bg-black [&::-webkit-scrollbar-thumb]:bg-white [&::-webkit-scrollbar-thumb]:hover:bg-zinc-300 [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-black">
           <Show when={isSearchingGames()}>
            <div class="p-3 text-zinc-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
             <Loader2 class="animate-spin" size={14}/> SEARCHING DATABASES...
            </div>
           </Show>
           <Show when={!isSearchingGames() && titleSuggestions().length === 0}>
            <div class="p-3 text-zinc-500 font-bold uppercase tracking-widest text-xs">NO RESULTS - USE CUSTOM TITLE</div>
           </Show>
           <For each={titleSuggestions()}>
            {(suggestion) => (
             <div
              class="py-10 px-4 border-b border-zinc-800 hover:bg-[#FF7A00] hover:text-black text-white cursor-pointer flex gap-3 items-center transition-colors font-bold uppercase tracking-widest text-xs group"
              onClick={() => {
               const isCoverNsfw = suggestion.is_nsfw || false;
               setUploadForm({
                ...uploadForm(),
                title: suggestion.title,
                cover_url: suggestion.cover_url || '',
                is_nsfw: isCoverNsfw
               });
               setIsNsfwLocked(isCoverNsfw);
               setShowSuggestions(false);
              }}
             >
              <Show when={suggestion.cover_url}>
               <div class="w-44 h-34 bg-black shrink-0 relative overflow-hidden border border-zinc-700 group-hover:border-black">
                <img src={suggestion.cover_url} class={`w-full h-full object-cover ${suggestion.is_nsfw && !props.showNSFW ? 'blur-sm scale-110' : ''}`} />
               </div>
              </Show>
              <span class="truncate flex-1">{suggestion.title}</span>
              <span class="px-2 py-1 bg-black text-zinc-400 group-hover:bg-white group-hover:text-black border border-zinc-700 group-hover:border-black shrink-0">{suggestion.source}</span>
             </div>
            )}
           </For>
          </div>
         </Show>
        </div>
       </div>

       <div class="flex items-center gap-4 bg-zinc-900 border-2 border-zinc-800 p-2 relative mt-2 mb-2">
        <Show when={uploadForm().cover_url}>
         <img src={uploadForm().cover_url} class={`h-16 w-24 object-cover border border-zinc-700 ${uploadForm().is_nsfw ? 'blur-md' : ''}`} />
        </Show>
        <div class="flex flex-col gap-1 flex-1">
         <label class="text-[10px] font-bold text-white tracking-widest uppercase">Game Cover Contains NSFW Content?</label>
         <button onClick={() => !isNsfwLocked() && setUploadForm({...uploadForm(), is_nsfw: !uploadForm().is_nsfw})} disabled={isNsfwLocked()}
         class={`w-fit px-4 py-2 font-black text-xs uppercase tracking-widest transition-colors border-2 ${isNsfwLocked() ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${uploadForm().is_nsfw ? 'bg-red-500 text-white border-red-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
         >
        {uploadForm().is_nsfw ? (isNsfwLocked() ? 'LOCKED (18+)' : 'YES (18+)') : 'NO (SAFE FOR WORK)'}
        </button>
         <Show when={uploadForm().is_nsfw}>
        <span class="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-1">
         * Auto-flagged by database. Click 'NO' if the cover image is safe.
        </span>
       </Show>
        </div>
       </div>

       <div class="flex gap-4">
        <div class="flex flex-col gap-1 flex-1">
         <label class="text-xs font-bold text-white tracking-widest uppercase">Game Engine / Format (Optional)</label>
         <input type="text" maxLength={50} value={uploadForm().game_engine} onInput={(e) => setUploadForm({...uploadForm(), game_engine: e.currentTarget.value})} class="w-full bg-black border-2 border-zinc-700 p-2 text-white focus:border-[#FF7A00] outline-none uppercase font-bold placeholder:text-zinc-700" placeholder="e.g. Ren'Py, RPG Maker, Unity" />
        </div>
        <div class="flex flex-col gap-1 flex-1">
         <label class="text-xs font-bold text-white tracking-widest uppercase">Version (Optional)</label>
         <input type="text" maxLength={50} value={uploadForm().game_version} onInput={(e) => setUploadForm({...uploadForm(), game_version: e.currentTarget.value})} class="w-full bg-black border-2 border-zinc-700 p-2 text-white focus:border-[#FF7A00] outline-none uppercase font-bold placeholder:text-zinc-700" placeholder="e.g. 1.0, v2, DLSite" />
        </div>
       </div>
      
       <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
         <label class="text-xs font-bold text-white tracking-widest uppercase">Description</label>
         <span class="text-[10px] font-bold text-zinc-400">{uploadForm().description.length}/300</span>
        </div>
        <textarea rows={3} maxLength={300} value={uploadForm().description} onInput={(e) => setUploadForm({...uploadForm(), description: e.currentTarget.value})} class="w-full bg-black border-2 border-zinc-700 p-2 text-white focus:border-[#FF7A00] outline-none resize-none placeholder:text-zinc-700" placeholder="Explain your save progress, unlockables, or any specific details..."></textarea>
       </div>

       <div class="flex flex-col gap-1">
        <label class="text-xs font-bold text-white tracking-widest uppercase">Save File (Required - You can Multi Select)</label>
        <div class="flex gap-2">
         <button onClick={handleFileSelect} class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold border-2 border-zinc-600 transition-colors uppercase tracking-widest cursor-pointer">Browse...</button>
         <input type="text" readOnly value={uploadForm().file_paths.length > 1 ? `${uploadForm().file_paths.length} files selected (Will be ZIP'd)` : uploadForm().file_paths[0] || ''} placeholder="No file selected" class="flex-1 bg-black border-2 border-zinc-700 p-2 text-zinc-400 outline-none truncate" />
        </div>
       </div>

       <button onClick={submitUpload} disabled={isUploading()} class="mt-4 w-full py-4 bg-[#FF7A00] hover:bg-white text-black font-black uppercase tracking-widest text-lg flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
        <Show when={isUploading()} fallback={<><Upload size={20} strokeWidth={3}/> INITIATE UPLOAD</>}>
         <Loader2 class="animate-spin" size={20} /> UPLOADING...
        </Show>
       </button>
     </div>
    </Modal>
  );
}
