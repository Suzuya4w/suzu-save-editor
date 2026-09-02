import { ErrorBoundary, JSX } from 'solid-js';
import { ShieldAlert, RefreshCcw } from 'lucide-solid';

interface GlobalErrorBoundaryProps {
  children: JSX.Element;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

export const GlobalErrorBoundary = (props: GlobalErrorBoundaryProps) => {
  const FallbackUI = (err: any, reset: () => void) => {
    return (
      <div class="flex-1 flex flex-col items-center justify-center p-8 bg-[#0B0E14] border border-red-900/30 text-red-500 font-mono w-full h-full min-h-[300px]">
        <ShieldAlert size={48} class="mb-4 animate-[pulse_2s_ease-in-out_infinite] opacity-80" />
        <h2 class="text-2xl md:text-3xl font-[Hacked] tracking-widest mb-2 drop-shadow-[2px_2px_0px_rgba(220,38,38,0.4)] text-red-500">{props.fallbackTitle || "CRITICAL RENDER FAILURE"}</h2>
        <p class="text-[10px] md:text-xs text-zinc-400 mb-6 max-w-lg text-center uppercase tracking-widest font-bold leading-relaxed">
          {props.fallbackMessage || "An unexpected anomaly crashed this component. The rest of the system remains operational."}
        </p>
        
        <div class="bg-red-950/20 border-l-4 border-red-800 text-red-400 text-xs p-4 mb-8 w-full max-w-2xl overflow-auto max-h-32 font-mono whitespace-pre-wrap break-all shadow-inner">
          {err ? err.toString() : 'Unknown System Error'}
        </div>
        
        <button 
          onClick={reset}
          class="flex items-center gap-3 px-6 py-3 bg-red-950/40 border-2 border-red-600 text-red-500 hover:bg-red-600 hover:text-black transition-all font-black uppercase tracking-widest text-xs cursor-pointer shadow-[4px_4px_0px_rgba(220,38,38,0.2)] hover:shadow-[4px_4px_0px_#dc2626] hover:-translate-y-1 hover:-translate-x-1"
        >
          <RefreshCcw size={16} /> <span>INITIALIZE RECOVERY</span>
        </button>
      </div>
    );
  };

  return (
    <ErrorBoundary fallback={FallbackUI}>
      {props.children}
    </ErrorBoundary>
  );
};
