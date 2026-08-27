import { Modal } from './Modal';
import { useEditorStore, acceptAiMutation, rejectAiMutation } from '../store/editorStore';

export function AiDiffModal() {
  const store = useEditorStore();

  return (
    <Modal 
      isOpen={store.isAiDiffModalOpen} 
      onClose={rejectAiMutation}
      title="AI Mutation Proposed"
      icon={<span class="text-xl">🤖</span>}
      width="max-w-4xl w-full"
    >
      <div class="flex flex-col font-desc text-zinc-300 max-h-[70vh]">
        <div class="mb-4 text-sm opacity-80">
          The AI Assistant wants to inject the following changes into your save file. Please review them before applying.
        </div>

        <div class="flex-1 overflow-auto bg-black p-4 border-2 border-zinc-800">
          <pre class="text-xs text-teal-400 whitespace-pre-wrap break-all font-brains">
            {store.pendingAiMutation 
              ? JSON.stringify(store.pendingAiMutation, null, 2) 
              : 'No pending mutations.'}
          </pre>
        </div>

        <div class="mt-6 flex justify-end gap-4 shrink-0">
          <button 
            onClick={rejectAiMutation}
            class="px-6 py-2 bg-zinc-800 hover:bg-red-900/50 text-zinc-300 hover:text-red-400 border-2 border-zinc-700 hover:border-red-500 transition-colors uppercase tracking-widest font-black text-sm cursor-pointer"
          >
            Reject All
          </button>
          <button 
            onClick={acceptAiMutation}
            class="px-6 py-2 bg-black hover:bg-white text-white hover:text-black border-2 border-white shadow-[4px_4px_0px_#FF7A00] hover:shadow-[4px_4px_0px_#FF7A00] transition-all uppercase tracking-widest font-black text-sm cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </Modal>
  );
}
