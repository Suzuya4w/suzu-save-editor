import { Show } from 'solid-js';
import { Gamepad2, BadgeCheck, Eye, EyeOff, Flag, Trash2, Download, ShieldCheck, Loader2, ShieldAlert, CheckSquare, Square, HardDrive, Clock, Edit3 } from 'lucide-solid';
import { formatBytes, Tooltip } from './cloud/CloudDatabaseBrowser';
import { SaveFile } from '../types/database';
import { useAuthStore } from '../store/authStore';

interface SaveCardProps {
  save: SaveFile;
  isAdminMode: boolean;
  isBulkSelectMode: boolean;
  selectedSaves: string[];
  showNSFW: boolean;
  
  onToggleSelection: (id: string) => void;
  onClick: (save: SaveFile) => void;
  onAdminVerify: (id: string, status: boolean) => void;
  onAdminToggleVisibility: (id: string, status: boolean) => void;
  onViewReports: (id: string, title: string) => void;
  onAdminDelete: (id: string, fileUrl: string) => void;
  onReport: (id: string, title: string) => void;
  onEdit: (save: SaveFile) => void;
  onDownload: (fileUrl: string, title: string) => void;
}

export function SaveCard(props: SaveCardProps) {
  const save = () => props.save;
  const authState = useAuthStore();
  const isOwner = () => authState.user?.id === save().uploader_id;

  return (
    <div class={`group bg-zinc-950 border-2 ${save().report_count > 0 && props.isAdminMode ? 'border-red-500 shadow-[4px_4px_0px_rgba(239,68,68,0.5)]' : 'border-zinc-800 hover:border-[#FF7A00] shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] hover:-translate-y-1 hover:-translate-x-1'} transition-all cursor-pointer flex flex-col relative hover:z-50 ${!save().is_visible ? 'opacity-50 grayscale' : ''}`} onClick={() => props.isBulkSelectMode ? props.onToggleSelection(save().id) : props.onClick(save())}>
      <Show when={props.isBulkSelectMode}>
        <div class="absolute top-2 left-2 z-20 bg-black/80 p-1 rounded-sm border border-zinc-700">
        {props.selectedSaves.includes(save().id) ? <CheckSquare size={20} class="text-[#FF7A00] fill-orange-950" /> : <Square size={20} class="text-zinc-400" />}
        </div>
      </Show>
      <Show when={save().game_cover_url}>
        <div class="w-full h-32 border-b-2 border-zinc-800 relative overflow-hidden bg-black shrink-0 flex items-center justify-center isolate">
        <Show when={save().is_nsfw && !props.showNSFW} fallback={<img src={save().game_cover_url} class="w-full h-full object-cover transition-all duration-500 group-hover:scale-105" />}>
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-red-500 font-black uppercase tracking-widest text-xs z-20 pointer-events-none">
          <ShieldAlert size={24} class="mb-2" />
          NSFW CONTENT
          </div>
        </Show>
        </div>
      </Show>
      <div class="p-5 flex flex-col flex-1">
        <div class="flex items-start justify-between mb-4">
        <div>
          <h3 class="text-lg font-black text-white group-hover:text-[#FF7A00] transition-colors line-clamp-1 uppercase tracking-wider">{save().title}</h3>
          <div class="flex items-center gap-3 mt-2">
          <p class="text-xs text-[#FF7A00] font-bold tracking-widest flex items-center gap-1">
            <Gamepad2 size={14} /> 
            {(save().game_engine === 'Unknown' && save().detected_engine) 
              ? `Unknown (System Guess: ${save().detected_engine})` 
              : (save().game_engine || 'UNKNOWN ENGINE')}
          </p>
          <Show when={save().game_version}>
            <p class="text-xs text-zinc-400 font-bold tracking-widest flex items-center gap-1 border-l-2 border-zinc-700 pl-3">
            V: {save().game_version}
            </p>
          </Show>
          </div>
        </div>
        <div class="flex gap-4">
        <Show when={props.isAdminMode && !props.isBulkSelectMode}>
          <Tooltip text={save().is_verified ? "Unverify" : "Verify Save"}>
          <button onClick={(e) => { e.stopPropagation(); props.onAdminVerify(save().id, save().is_verified); }} class={`p-2 transition-colors border-2 cursor-pointer inline-flex ${save().is_verified ? 'bg-green-900 text-green-400 border-green-700' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-green-500 hover:text-white hover:border-green-400'}`}>
            <BadgeCheck size={18} strokeWidth={2.5} />
          </button>
          </Tooltip>
          <Tooltip text={save().is_visible ? "Hide Save" : "Unhide Save"}>
          <button onClick={(e) => { e.stopPropagation(); props.onAdminToggleVisibility(save().id, save().is_visible); }} class={`p-2 transition-colors border-2 cursor-pointer inline-flex ${!save().is_visible ? 'bg-purple-900 text-purple-400 border-purple-700' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-purple-500 hover:text-white hover:border-purple-400'}`}>
            {save().is_visible ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
          </button>
          </Tooltip>
          <Show when={save().report_count > 0}>
          <Tooltip text={`Clear ${save().report_count} Reports`}>
            <button onClick={(e) => { e.stopPropagation(); props.onViewReports(save().id, save().title); }} class="p-2 bg-zinc-900 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-white hover:border-red-400 transition-colors cursor-pointer inline-flex relative">
            <Flag size={18} strokeWidth={2.5} />
            <span class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-red-900 font-bold">{save().report_count}</span>
            </button>
          </Tooltip>
          </Show>
        </Show>
        <Show when={(props.isAdminMode || isOwner()) && !props.isBulkSelectMode}>
          <Tooltip text={props.isAdminMode ? "Hard Delete" : "Delete My Upload"}>
          <button onClick={(e) => { e.stopPropagation(); props.onAdminDelete(save().id, save().file_url); }} class="p-2 bg-zinc-900 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-white hover:border-red-400 transition-colors cursor-pointer inline-flex">
            <Trash2 size={18} strokeWidth={2.5} />
          </button>
          </Tooltip>
        </Show>
        <Show when={!props.isAdminMode && !isOwner() && !props.isBulkSelectMode}>
          <Tooltip text="Report">
          <button onClick={(e) => { e.stopPropagation(); props.onReport(save().id, save().title); }} class="opacity-0 group-hover:opacity-100 p-2 bg-zinc-900 text-zinc-500 hover:bg-red-500 hover:text-white transition-all duration-200 border-2 border-zinc-800 hover:border-red-600 cursor-pointer">
            <Flag size={18} strokeWidth={2.5} />
          </button>
          </Tooltip>
        </Show>
        <Show when={isOwner() && !props.isAdminMode && !props.isBulkSelectMode}>
          <Tooltip text="Edit Save">
          <button onClick={(e) => { e.stopPropagation(); props.onEdit(save()); }} class="p-2 bg-zinc-900 text-zinc-500 border-2 border-zinc-800 hover:bg-blue-500 hover:text-white hover:border-blue-400 transition-colors cursor-pointer inline-flex">
            <Edit3 size={18} strokeWidth={2.5} />
          </button>
          </Tooltip>
        </Show>
        <Show when={!props.isBulkSelectMode}>
          <Tooltip text="Download">
          <button onClick={(e) => { e.stopPropagation(); props.onDownload(save().file_url, save().title); }} class="p-2 bg-zinc-900 text-zinc-500 group-hover:bg-[#FF7A00] group-hover:text-black transition-colors border-2 border-zinc-800 group-hover:border-black cursor-pointer inline-flex">
            <Download size={20} strokeWidth={2.5} />
          </button>
          </Tooltip>
        </Show>
        </div>
        </div>
        
        <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3 bg-black/40 p-1.5 pr-4 border-l-2 border-[#FF7A00] rounded-r-sm w-fit">
          <Show when={save().uploader_avatar_url}>
          <img src={save().uploader_avatar_url} class="w-26 h-26 object-cover border border-zinc-700 rounded-full" />
          </Show>
          <span class="text-[10px] font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
          BY {save().uploader}
          <Show when={save().is_verified}>
            <Tooltip text="Verified Save by Admin">
            <BadgeCheck size={14} class="text-white fill-blue-500" />
            </Tooltip>
          </Show>
          </span>
        </div>
        
        <div class="flex items-center gap-2">
          <Show when={save().scan_status === 'safe'}>
          <Tooltip text="Scanned by VirusTotal API and found clean" position="top" align="right">
            <div class="px-2 py-1 bg-emerald-950/40 border border-emerald-500/50 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 rounded-sm shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            <ShieldCheck size={12} /> VT SAFE
            </div>
          </Tooltip>
          </Show>
          <Show when={save().scan_status === 'scanning' || save().scan_status === 'pending'}>
          <Tooltip text="Currently scanning on VirusTotal" position="top" align="right">
            <div class="px-2 py-1 bg-yellow-950/40 border border-yellow-500/50 text-yellow-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 rounded-sm shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.3)]">
            <Loader2 size={12} class="animate-spin" /> SCANNING
            </div>
          </Tooltip>
          </Show>
          <Show when={save().scan_status === 'malicious'}>
          <Tooltip text="Malware detected by VirusTotal!" position="top" align="right">
            <div class="px-2 py-1 bg-red-950/40 border border-red-500/50 text-red-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 rounded-sm shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.3)]">
            <ShieldAlert size={12} /> MALWARE
            </div>
          </Tooltip>
          </Show>
          <Show when={props.isAdminMode}>
          <div class={`px-2 py-1 border text-[10px] font-black uppercase tracking-widest flex items-center gap-1 rounded-sm shrink-0 ${save().report_count > 0 ? 'bg-red-950/30 border-red-900 text-red-500' : 'bg-green-950/30 border-green-900 text-green-500'}`}>
            {save().report_count > 0 ? <Flag size={12}/> : <ShieldCheck size={12}/>} {save().report_count} Reports
          </div>
          </Show>
        </div>
        </div>

        <div class="bg-[#0a0a0a] p-3 border border-zinc-800/50 border-l-2 border-l-zinc-700 rounded-sm mb-4 flex-1 shadow-inner relative overflow-hidden group/desc">
        <p class="text-sm font-desc text-zinc-400 line-clamp-2 relative z-10">
          {save().description || 'No description provided.'}
        </p>
        </div>
        
        <div class="flex items-center justify-between text-xs text-zinc-500 border-t-2 border-zinc-800 pt-4 font-bold font-desc tracking-widest uppercase">
        <div class="flex items-center gap-2">
          <HardDrive size={14} /> {formatBytes(save().file_size_bytes)}
        </div>
        <div class="flex items-center gap-2">
          <Clock size={14} /> {new Date(save().created_at).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        </div>
      </div>
    </div>
  );
}
