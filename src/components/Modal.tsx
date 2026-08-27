import { JSX, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X } from 'lucide-solid';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
  icon?: JSX.Element;
  width?: string;
  borderProgress?: number; // 0 to 100
}

export function Modal(props: ModalProps) {

  const [shouldRender, setShouldRender] = createSignal(props.isOpen);
  const [isVisible, setIsVisible] = createSignal(props.isOpen);

  createEffect(() => {
    if (props.isOpen) {

      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      onCleanup(() => clearTimeout(timer));
    }
  });

  return (
    <Show when={shouldRender()}>
      <Portal>
        <div 

          class={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVisible() ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Backdrop */}
          <div 
            class="absolute inset-0 bg-black/95 cursor-default"
            onClick={props.onClose}
          />
          
          <div 
            class={`relative w-full ${props.width || 'max-w-md'} bg-black shadow-[8px_8px_0px_#FF7A00] flex flex-col overflow-hidden font-mono text-zinc-200 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVisible() ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
            }`}
            style={{
               "border": props.borderProgress !== undefined ? "4px solid #e4e4e7" : "4px solid #e4e4e7"
            }}
          >
            {/* Animated Border Overlay */}
            <Show when={props.borderProgress !== undefined}>
              <svg class="absolute inset-0 w-full h-full pointer-events-none z-50">
                <rect 
                  x="0" y="0" width="100%" height="100%" 
                  fill="none" 
                  stroke="#FF7A00" 
                  stroke-width="8" 
                  pathLength="100"
                  stroke-dasharray="100"
                  stroke-dashoffset={100 - props.borderProgress!} 
                />
              </svg>
            </Show>
            {/* Header */}
            <div class="flex items-center justify-between p-4 border-b-4 border-zinc-200 bg-zinc-900">
              <div class="flex items-center gap-3 text-white">
                <Show when={props.icon}>
                  <div class="text-[#FF7A00]">
                    {props.icon}
                  </div>
                </Show>
                <h2 class="text-lg font-bold tracking-widest uppercase">{props.title}</h2>
              </div>
              <button 
                onClick={props.onClose}
                class="p-2 bg-black border-2 border-transparent hover:border-[#FF7A00] hover:text-[#FF7A00] transition-colors cursor-pointer text-white"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Body */}
            <div class="p-6">
              {props.children}
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}