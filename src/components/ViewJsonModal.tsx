import { createSignal, Show } from 'solid-js';
import { Modal } from './Modal';
import { Code, Copy, Check } from 'lucide-solid';
import { addToast } from '../store/toastStore';

interface ViewJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: string;
  json: any;
}

export function ViewJsonModal(props: ViewJsonModalProps) {
  const [copied, setCopied] = createSignal(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(props.json, null, 2));
    setCopied(true);
    addToast("JSON copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={`RAW JSON / ${props.path || 'ROOT'}`}
      icon={<Code size={18} class="text-purple-500" />}
      width="max-w-4xl"
    >
      <div class="flex flex-col gap-4 h-[60vh]">
        <div class="flex justify-between items-center shrink-0">
          <span class="text-xs text-zinc-500 font-mono">Read-only JSON viewer</span>
          <button 
            onClick={handleCopy}
            class={`flex items-center cursor-pointer gap-2 px-4 py-2 border text-xs font-bold uppercase tracking-widest transition-all ${copied() ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-zinc-700 bg-black hover:border-white text-white'}`}
          >
            <Show when={copied()} fallback={<Copy size={14} />}>
              <Check size={14} />
            </Show>
            {copied() ? 'COPIED!' : 'COPY JSON'}
          </button>
        </div>
        <div class="flex-1 bg-[#050505] border border-zinc-800 p-4 overflow-auto custom-scrollbar shadow-inner relative group">
          <pre class="font-brains text-xs text-[#00F0FF] leading-relaxed">
            {JSON.stringify(props.json, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
