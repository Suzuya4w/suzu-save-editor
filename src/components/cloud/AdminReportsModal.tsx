import { Show, For } from 'solid-js';
import { ShieldAlert, Loader2, Copy } from 'lucide-solid';
import { Modal } from '../Modal';
import { Tooltip } from './CloudDatabaseBrowser';
import { addToast } from '../../store/toastStore';

interface AdminReportsModalProps {
  adminReportsModal: { saveId: string; title: string; reports: any[] } | null;
  setAdminReportsModal: (val: any) => void;
  isLoadingReports: boolean;
  handleAdminClearReports: (saveId: string) => void;
}

export function AdminReportsModal(props: AdminReportsModalProps) {
  return (
    <Modal
     isOpen={!!props.adminReportsModal}
     onClose={() => props.setAdminReportsModal(null)}
     title={`REPORTS: ${props.adminReportsModal?.title || ''}`}
     icon={<ShieldAlert size={18} />}
     width="max-w-2xl"
    >
     <div class="-m-6 flex flex-col max-h-[80vh]">
      <div class="p-6 overflow-y-auto bg-[#0a0a0a] flex-1">
        <Show when={props.isLoadingReports}>
         <div class="text-center text-zinc-500 font-bold uppercase tracking-widest p-8 flex items-center justify-center gap-2"><Loader2 class="animate-spin" size={18}/> FETCHING REPORTS...</div>
        </Show>
        <Show when={!props.isLoadingReports && props.adminReportsModal?.reports?.length === 0}>
         <div class="text-center text-zinc-500 font-bold uppercase tracking-widest p-8">No reports found.</div>
        </Show>
        <Show when={!props.isLoadingReports && (props.adminReportsModal?.reports?.length || 0) > 0}>
         <div class="flex flex-col gap-4">
          <For each={props.adminReportsModal?.reports}>
           {(report: any) => (
            <div class="bg-black border border-zinc-800 p-4 rounded-sm flex flex-col gap-2 relative">
             <div class="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span class="text-xs font-black text-[#FF7A00] tracking-widest uppercase">{report.reason}</span>
              <span class="text-[10px] font-mono text-zinc-500">{new Date(report.created_at).toLocaleString()}</span>
             </div>
             <p class="text-sm text-zinc-300 mt-2 font-desc whitespace-pre-wrap">{report.description || 'No description provided.'}</p>
             <div class="text-[10px] text-zinc-600 uppercase mt-2 flex items-center gap-2">
              <span>Reporter ID: <span class="font-bold text-zinc-400">{report.user_id}</span></span>
              <Tooltip text="Copy Reporter ID" position="top">
              <button onClick={() => { navigator.clipboard.writeText(report.user_id); addToast('Copied to clipboard!', 'success'); }} class="p-1 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer rounded-sm">
               <Copy size={12} />
              </button>
              </Tooltip>
             </div>
            </div>
           )}
          </For>
         </div>
        </Show>
       </div>
       <div class="p-4 bg-black border-t-2 border-zinc-800 flex justify-end gap-4">
        <button onClick={() => props.setAdminReportsModal(null)} class="px-6 py-2 border-2 border-zinc-700 text-zinc-400 hover:text-white transition-colors uppercase font-bold tracking-widest text-xs cursor-pointer">CLOSE</button>
        <button onClick={() => props.handleAdminClearReports(props.adminReportsModal!.saveId)} class="px-6 py-2 bg-red-950 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-black hover:border-red-500 transition-colors uppercase font-black tracking-widest text-xs shadow-[4px_4px_0px_white] cursor-pointer">
         CLEAR ALL REPORTS
        </button>
       </div>
     </div>
    </Modal>
  );
}
