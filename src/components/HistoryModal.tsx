import { For, Show } from 'solid-js';
import { useEditorStore, setIsHistoryModalOpen, undoToId, redoToId } from '../store/editorStore';
import { Modal } from './Modal';
import { History, Clock } from 'lucide-solid';

export function HistoryModal() {
  const store = useEditorStore();

  return (
    <Modal
      isOpen={store.isHistoryModalOpen}
      onClose={() => setIsHistoryModalOpen(false)}
      title="TIME MACHINE"
      icon={<History size={18} class="text-[#FF7A00]" />}
      width="max-w-md"
    >
      <div class="flex flex-col gap-4 p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
        
        {/* Past History (Undoable) */}
        <div class="flex flex-col">
          <div class="text-[10px] text-emerald-500 font-brains font-bold uppercase tracking-widest mb-2 px-2">Past (Undoable)</div>
          <Show when={store.past.length === 0}>
             <div class="text-xs font-desc text-zinc-500 italic px-2">No history recorded yet...</div>
          </Show>
          <div class="flex flex-col gap-1">
            <For each={[...store.past].reverse()}>{(cmd) => (
              <div 
                class="group flex items-center justify-between bg-zinc-900/50 hover:bg-zinc-800 border-l-2 border-emerald-500/30 hover:border-emerald-500 p-2 cursor-pointer transition-colors"
                onClick={() => undoToId(cmd.id)}
              >
                <div class="flex items-start gap-3 overflow-hidden">
                  <Clock size={12} class="text-zinc-500 shrink-0 mt-[1px]" />
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs text-zinc-300 font-desc font-bold truncate">{cmd.actionDescription}</span>
                    <span class="text-[10px] text-zinc-600 font-desc truncate">{cmd.path || 'Root'}</span>
                  </div>
                </div>
                <div class="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-500 font-brains uppercase tracking-widest px-2 shrink-0 transition-opacity">
                  Undo Here
                </div>
              </div>
            )}</For>
          </div>
        </div>

        <div class="h-px bg-zinc-800 my-2"></div>

        {/* Present State */}
        <div class="flex flex-col">
          <div class="text-[10px] text-[#00F0FF] font-brains font-bold uppercase tracking-widest mb-2 px-2 flex items-center gap-2">
            <div class="w-1.5 h-1.5 bg-[#00F0FF] animate-pulse"></div> Present State
          </div>
          <div class="bg-[#00F0FF]/10 border border-[#00F0FF]/30 p-2 text-center text-xs text-[#00F0FF] font-bold tracking-widest uppercase">
            Current Timeline
          </div>
        </div>

        <div class="h-px bg-zinc-800 my-2"></div>

        {/* Future History (Redoable) */}
        <div class="flex flex-col">
          <div class="text-[10px] text-purple-500 font-brains font-bold uppercase tracking-widest mb-2 px-2">Future (Redoable)</div>
          <Show when={store.future.length === 0}>
             <div class="text-xs font-desc text-zinc-500 italic px-2">Timeline is clear...</div>
          </Show>
          <div class="flex flex-col gap-1">
            <For each={[...store.future].reverse()}>{(cmd) => (
              <div 
                class="group flex items-center justify-between bg-zinc-900/50 hover:bg-zinc-800 border-l-2 border-purple-500/30 hover:border-purple-500 p-2 cursor-pointer transition-colors"
                onClick={() => redoToId(cmd.id)}
              >
                <div class="flex items-center gap-3 overflow-hidden">
                  <Clock size={12} class="text-zinc-500 shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs text-zinc-300 font-bold truncate">{cmd.actionDescription}</span>
                    <span class="text-[10px] text-zinc-600 font-desc truncate">{cmd.path || 'Root'}</span>
                  </div>
                </div>
                <div class="opacity-0 group-hover:opacity-100 text-[10px] text-purple-500 font-brains uppercase tracking-widest px-2 shrink-0 transition-opacity">
                  Redo Here
                </div>
              </div>
            )}</For>
          </div>
        </div>

      </div>
    </Modal>
  );
}
