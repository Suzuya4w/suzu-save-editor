import { Modal } from './Modal';
import { Heart } from 'lucide-solid';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal(props: SupportModalProps) {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="SUPPORT ME"
      icon={<Heart size={18} />}
      width="max-w-md"
    >
      <div class="flex flex-col gap-4 text-center mt-2">
        <p class="text-xs text-zinc-400 font-desc mb-2 leading-relaxed">
          If you find this tool useful, consider buying me a coffee!
        </p>
        
        <div class="flex flex-col gap-3 mt-2">
          <a 
            href="https://saweria.co/sulthanmarzuq" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="w-full flex items-center justify-center p-4 bg-zinc-900 border-2 border-zinc-700 hover:border-yellow-500 hover:text-yellow-500 text-white font-bold uppercase tracking-widest transition-all shadow-[4px_4px_0px_rgba(234,179,8,0)] hover:shadow-[4px_4px_0px_#EAB308] hover:-translate-y-1 hover:-translate-x-1"
          >
            DONATE VIA SAWERIA (IDR)
          </a>

          <a 
            href="https://paypal.me/sulthanmarzuq" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="w-full flex items-center justify-center p-4 bg-zinc-900 border-2 border-zinc-700 hover:border-blue-500 hover:text-blue-500 text-white font-bold uppercase tracking-widest transition-all shadow-[4px_4px_0px_rgba(59,130,246,0)] hover:shadow-[4px_4px_0px_#3B82F6] hover:-translate-y-1 hover:-translate-x-1"
          >
            DONATE VIA PAYPAL (USD)
          </a>
        </div>
      </div>
    </Modal>
  );
}
