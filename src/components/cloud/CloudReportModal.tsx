import { ShieldAlert, Flag } from 'lucide-solid';
import { Modal } from '../Modal';

interface CloudReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTarget: { id: string; title: string } | null;
  reportForm: { reason: string; description: string };
  setReportForm: (form: { reason: string; description: string }) => void;
  submitReport: () => void;
}

export function CloudReportModal(props: CloudReportModalProps) {
  return (
    <Modal
     isOpen={props.isOpen}
     onClose={props.onClose}
     title="REPORT_SAVE"
     width="max-w-md"
    >
     <div class="flex flex-col items-center">
        <div class="w-16 h-16 bg-black border-2 border-red-500 flex items-center justify-center mb-6 shadow-[4px_4px_0px_#ef4444]">
         <ShieldAlert size={32} class="text-red-500" />
        </div>
        <h3 class="text-lg font-black text-white tracking-widest uppercase mb-4 text-center">{props.reportTarget?.title}</h3>
       
         <div class="w-full flex flex-col gap-4">
          <div class="flex flex-col gap-1">
           <label class="text-xs font-bold text-zinc-400 tracking-widest uppercase">Reason</label>
           <select 
             value={props.reportForm.reason} 
             onChange={(e) => props.setReportForm({...props.reportForm, reason: e.currentTarget.value})} 
             class="w-full bg-black border-2 border-zinc-700 p-2 text-white outline-none focus:border-red-500 font-bold uppercase tracking-widest text-xs cursor-pointer"
           >
            <option value="Outdated Version">Outdated Version</option>
            <option value="Wrong Game File">Wrong Game File</option>
            <option value="Corrupted File">Corrupted File</option>
            <option value="NSFW / Inappropriate Cover">NSFW / Inappropriate Cover</option>
            <option value="Spam">Spam</option>
            <option value="Other">Other</option>
           </select>
          </div>
        
         <div class="flex flex-col gap-1">
          <label class="text-xs font-bold text-zinc-400 tracking-widest uppercase">Description (Optional)</label>
          <textarea 
           rows={3} 
           maxLength={300} 
           value={props.reportForm.description} 
           onInput={(e) => props.setReportForm({...props.reportForm, description: e.currentTarget.value})} 
           class="w-full bg-black border-2 border-zinc-700 p-2 text-white outline-none focus:border-red-500 resize-none placeholder-zinc-700 font-mono text-sm" 
           placeholder="Additional details..."
          ></textarea>
         </div>
        
         <button onClick={props.submitReport} class="mt-2 w-full py-4 bg-red-950 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest">
          <Flag size={18} /> SUBMIT REPORT
         </button>
        </div>
     </div>
    </Modal>
  );
}
