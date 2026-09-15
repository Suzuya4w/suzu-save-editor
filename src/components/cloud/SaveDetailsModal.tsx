import { Show, createSignal, createEffect } from 'solid-js';
import { BadgeCheck, FileCheck2, ShieldCheck, Loader2, ShieldAlert, Flag, Clock, HardDrive, Download, Gamepad2, Edit3 } from 'lucide-solid';
import { Modal } from '../Modal';
import { Tooltip, formatBytes } from './CloudDatabaseBrowser';

export function SaveDetailsModal(props: {
  save: any | null;
  onClose: () => void;
  showNSFW: boolean;
  isAdminMode: boolean;
  isOwner: boolean;
  onReport: (id: string, title: string) => void;
  onEdit: (save: any) => void;
  onDownload: (save: any) => void;
}) {
  // Memoize the save object to preserve it during the exit animation
  const [localSave, setLocalSave] = createSignal<any | null>(props.save);

  createEffect(() => {
    if (props.save) {
      setLocalSave(props.save);
    }
  });

  return (
    <Modal
     isOpen={!!props.save}
     onClose={props.onClose}
     title="SAVE DETAILS"
     width="max-w-4xl"
    >
     <div class="-m-6 flex flex-col h-full bg-[#0a0a0a]">
      <div class="flex items-center gap-4 p-4 border-b-4 border-zinc-800 bg-black">
       <span class="flex items-center gap-2 text-xs text-[#FF7A00] font-bold tracking-widest uppercase bg-[#FF7A00]/10 px-2 py-1 border border-[#FF7A00]/30 rounded-sm">
        {(localSave()?.game_engine === 'Unknown' && localSave()?.detected_engine) ? `Unknown (System Guess: ${localSave()?.detected_engine})` : (localSave()?.game_engine || 'UNKNOWN ENGINE')}
        <Show when={localSave()?.game_engine && localSave()?.game_engine !== 'Unknown' && localSave()?.detected_engine && localSave()?.game_engine !== localSave()?.detected_engine}>
         <Tooltip text={`User typed ${localSave()?.game_engine}, but system detected ${localSave()?.detected_engine}`} position="bottom">
          <ShieldAlert size={14} class="text-yellow-500" />
         </Tooltip>
        </Show>
       </span>
       <Show when={localSave()?.game_version}>
        <span class="text-xs text-zinc-400 font-bold tracking-widest uppercase border-l border-zinc-700 pl-4">
         V: {localSave()?.game_version}
        </span>
       </Show>
      </div>
      <div class="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row bg-[#0a0a0a]">
        <div class="w-full md:w-2/5 border-r border-zinc-800 bg-black flex flex-col overflow-hidden shrink-0">
         <Show when={localSave()?.game_cover_url}>
          <div class="w-full h-[400px] md:h-full relative shrink-0">
           <img src={localSave()?.game_cover_url} class={`w-full h-full object-cover ${localSave()?.is_nsfw && !props.showNSFW ? 'blur-xl scale-110' : ''}`} />
           <Show when={localSave()?.is_nsfw && !props.showNSFW}>
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-red-500 font-black uppercase tracking-widest text-sm text-center p-4">
             <ShieldAlert size={32} class="mb-2" />
             NSFW BLURRED
            </div>
           </Show>
          </div>
         </Show>
         <Show when={!localSave()?.game_cover_url}>
          <div class="w-full h-[400px] md:h-full bg-zinc-900 flex items-center justify-center">
            <Gamepad2 size={64} class="text-zinc-800" />
          </div>
         </Show>
        </div>
        <div class="w-full md:w-3/5 p-6 flex flex-col">
         
         <div class="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
           <div class="flex items-center gap-3 bg-zinc-900 p-2 pr-4 border border-zinc-700 rounded-sm w-fit">
            <Show when={localSave()?.uploader_avatar_url}>
             <img src={localSave()?.uploader_avatar_url} class="w-8 h-8 object-cover border border-zinc-600 rounded-full" referrerpolicy="no-referrer"/>
            </Show>
            <div class="flex flex-col">
             <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-widest leading-none">Uploader</span>
             <span class="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 leading-none mt-1">
              {localSave()?.uploader}
              <Show when={localSave()?.is_verified}>
               <Tooltip text="Verified Save by Admin">
                <BadgeCheck size={14} class="text-blue-500" />
               </Tooltip>
              </Show>
             </span>
            </div>
           </div>
           <div class="flex flex-col items-end text-right">
            <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Format</span>
            <span class="text-sm font-black text-white tracking-widest uppercase flex items-center gap-1"><FileCheck2 size={14}/> {localSave()?.extension || 'ZIP ARCHIVE'}</span>
           </div>
         </div>

         <div class="flex-1 mb-6">
          <h4 class="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 border-b border-zinc-800 pb-1">Description</h4>
          <p class="text-sm text-zinc-300 font-desc whitespace-pre-wrap">{localSave()?.description || 'No description provided.'}</p>
         </div>
         
         <div class="flex items-center gap-2 flex-wrap mb-6">
          <Show when={localSave()?.scan_status === 'safe'}>
           <Tooltip text="Scanned by VirusTotal API and found clean" position="top">
            <div class="px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2 rounded-sm shadow-[0_0_12px_rgba(16,185,129,0.3)]">
             <ShieldCheck size={14} /> VIRUSTOTAL: SAFE
            </div>
           </Tooltip>
          </Show>
          <Show when={localSave()?.scan_status === 'scanning' || localSave()?.scan_status === 'pending'}>
           <Tooltip text="Currently scanning on VirusTotal" position="top">
            <div class="px-3 py-1.5 bg-yellow-950/40 border border-yellow-500/50 text-yellow-400 text-xs font-black uppercase tracking-widest flex items-center gap-2 rounded-sm shadow-[0_0_12px_rgba(234,179,8,0.3)]">
             <Loader2 size={14} class="animate-spin" /> VIRUSTOTAL: SCANNING
            </div>
           </Tooltip>
          </Show>
          <Show when={localSave()?.scan_status === 'malicious'}>
           <Tooltip text="Malware detected by VirusTotal!" position="top">
            <div class="px-3 py-1.5 bg-red-950/40 border border-red-500/50 text-red-400 text-xs font-black uppercase tracking-widest flex items-center gap-2 rounded-sm shadow-[0_0_12px_rgba(239,68,68,0.3)]">
             <ShieldAlert size={14} /> VIRUSTOTAL: MALWARE
            </div>
           </Tooltip>
          </Show>
          <Show when={props.isAdminMode}>
           <div class={`px-3 py-1.5 border flex items-center gap-2 rounded-sm text-xs font-black uppercase tracking-widest ${(localSave()?.report_count || 0) > 0 ? 'bg-red-950/30 border-red-900 text-red-500' : 'bg-green-950/30 border-green-900 text-green-500'}`}>
            {(localSave()?.report_count || 0) > 0 ? <Flag size={14}/> : <ShieldCheck size={14}/>}
            {(localSave()?.report_count || 0)} Reports
           </div>
          </Show>
         </div>

         <div class="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800 pt-4 font-bold tracking-widest uppercase">
           <div class="flex items-center gap-2">
            <Clock size={14} />
            {localSave() ? new Date(localSave()?.created_at).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
           </div>
           <div class="flex items-center gap-2">
            <HardDrive size={14} />
            {formatBytes(localSave()?.file_size_bytes || 0)}
           </div>
         </div>
        </div>
       </div>
      
       <div class="p-4 bg-black border-t-4 border-zinc-800 flex justify-between gap-4">
        <Show when={!props.isAdminMode && !props.isOwner}>
         <button onClick={() => { props.onReport(localSave()!.id, localSave()!.title); }} class="px-4 py-3 bg-zinc-950 text-zinc-500 border-2 border-zinc-800 hover:text-white hover:border-red-500 transition-colors flex items-center gap-2 uppercase font-black tracking-widest text-xs cursor-pointer rounded-sm">
          <Flag size={14} /> REPORT
         </button>
        </Show>
        <Show when={props.isOwner && !props.isAdminMode}>
         <button onClick={() => { props.onEdit(localSave()!); props.onClose(); }} class="px-4 py-3 bg-zinc-950 text-zinc-500 border-2 border-zinc-800 hover:text-white hover:border-blue-500 transition-colors flex items-center gap-2 uppercase font-black tracking-widest text-xs cursor-pointer rounded-sm">
          <Edit3 size={14} /> EDIT
         </button>
        </Show>
        <div class="flex-1" />
        <button onClick={() => { props.onDownload(localSave()!); }} class="px-8 py-3 bg-[#FF7A00] text-black border-2 border-black hover:bg-white hover:border-black transition-colors uppercase font-black tracking-widest text-xs shadow-[4px_4px_0px_#ffffff] flex items-center gap-2 cursor-pointer">
         <Download size={16} /> DOWNLOAD
        </button>
       </div>
     </div>
    </Modal>
  );
}
