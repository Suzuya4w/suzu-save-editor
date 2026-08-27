// @ts-nocheck
import { For, Show } from 'solid-js';
import { TransitionGroup } from 'solid-transition-group';
import { useToastStore, removeToast } from '../store/toastStore';
import { X } from 'lucide-solid';

export const ToastContainer = () => {
  const toastState = useToastStore();

  return (
    <>
      <style>
        {`
          @keyframes cyber-draw-circle {
            0% { stroke-dashoffset: 100; transform: rotate(-90deg); transform-origin: center; }
            100% { stroke-dashoffset: 0; transform: rotate(-90deg); transform-origin: center; }
          }
          @keyframes cyber-draw-path {
            0% { stroke-dashoffset: 100; opacity: 0; }
            10% { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 1; }
          }
          .cyber-toast-enter {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          .cyber-toast-enter-active {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .cyber-toast-exit {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          .cyber-toast-exit-active {
            position: absolute;
            width: 100%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
          }
          .cyber-toast-exit-to {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          .cyber-toast-move {
            transition: transform 0.3s ease-in-out;
          }
        `}
      </style>

      <div 
        class="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-4 pointer-events-none"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
      >

        <TransitionGroup name="cyber-toast">
          <For each={toastState.toasts}>
            {(toast) => (
              <div class={`flex items-center gap-4 p-4 shadow-xl border pointer-events-auto transform-gpu min-w-[420px] max-w-xl font-bold uppercase tracking-widest ${
                toast.type === 'error' ? 'bg-[#150505] border-red-500/50 text-[#FF5252] shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
                toast.type === 'success' ? 'bg-[#05150a] border-[#00FF66]/50 text-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.2)]' :
                toast.type === 'warning' ? 'bg-[#150a05] border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]' :
                'bg-[#050a15] border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
              }`}>
                <div class="shrink-0 flex items-center justify-center relative w-[20px] h-[20px]">

                  {/* Error */}
                  <Show when={toast.type === 'error'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#FF5252] w-full h-full drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]">
                      <circle cx="12" cy="12" r="10" stroke="rgba(239,68,68,0.2)" stroke-width="2" />
                      <circle cx="12" cy="12" r="10" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-circle 0.3s ease-out forwards" }} />
                      <path d="M15 9l-6 6 M9 9l6 6" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-path 0.3s ease-out forwards 0.2s" }} />
                    </svg>
                  </Show>

                  {/* Success */}
                  <Show when={toast.type === 'success'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#00FF66] w-full h-full drop-shadow-[0_0_6px_rgba(0,255,102,0.8)]">
                      <circle cx="12" cy="12" r="10" stroke="rgba(0,255,102,0.2)" stroke-width="2" />
                      <circle cx="12" cy="12" r="10" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-circle 0.3s ease-out forwards" }} />
                      <path d="M8 12l3 3 5-6" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-path 0.3s ease-out forwards 0.2s" }} />
                    </svg>
                  </Show>

                  {/* Warning */}
                  <Show when={toast.type === 'warning'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-orange-400 w-full h-full drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]">
                      <path d="M12 2L22 20H2Z" stroke="rgba(249,115,22,0.2)" stroke-width="2" />
                      <path d="M12 2L22 20H2Z" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-path 0.3s ease-out forwards" }} />
                      <path d="M12 8v4 M12 16h.01" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-path 0.3s ease-out forwards 0.2s" }} />
                    </svg>
                  </Show>

                  {/* Info */}
                  <Show when={toast.type === 'info'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400 w-full h-full drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]">
                      <circle cx="12" cy="12" r="10" stroke="rgba(59,130,246,0.2)" stroke-width="2" />
                      <circle cx="12" cy="12" r="10" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-circle 0.3s ease-out forwards" }} />
                      <path d="M12 16v-4 M12 8h.01" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" style={{ animation: "cyber-draw-path 0.3s ease-out forwards 0.2s" }} />
                    </svg>
                  </Show>

                </div>

                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-mono leading-relaxed line-clamp-3">{toast.message}</p>
                </div>

                <button 
                  onClick={() => removeToast(toast.id)}
                  class="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity rounded-md hover:bg-white/10 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </For>
        </TransitionGroup>
      </div>
    </>
  );
};