import { createSignal, createEffect, Show } from 'solid-js';
import { Search, Image as ImageIcon, Loader2, AlertTriangle } from 'lucide-solid';
import { fetchGameMetadata } from '../services/ipc';
import { Modal } from './Modal';

export function CoverMetadataModal(props: {
  isOpen: boolean;
  onClose: () => void;
  coverUrl: string | null;
  gameTitle: string;
  gameDesc: string;
  gameDeveloper?: string | null;
  fileName: string;
  onUpdateMetadata: (newTitle: string, newCover: string | null, newDesc: string, newDev?: string | null) => void;
}) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');
  const [isImageLoading, setIsImageLoading] = createSignal(true);
  const [imageError, setImageError] = createSignal(false);

  createEffect(() => {
    if (props.coverUrl) {
      setIsImageLoading(true);
      setImageError(false);
    }
  });

  const handleSearch = async () => {
    if (!searchQuery().trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const data = await fetchGameMetadata(searchQuery(), undefined, true);
      
      if (data) {
        props.onUpdateMetadata(
          data.title, 
          data.image_url, 
          data.description || '',
          data.developer || data.publisher || null
        );
        setIsLoading(false);
        return;
      }

      setErrorMsg("No metadata found for that title.");
    } catch (e) {
      setErrorMsg("Failed to fetch metadata. Check connection.");
    }
    
    setIsLoading(false);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="METADATA LINK"
      icon={<ImageIcon size={16} />}
      width="max-w-xl"
    >
      <div class="flex flex-col items-center overflow-y-auto custom-scrollbar -m-6 p-6 max-h-[80vh]">
          
          <div class="w-full bg-yellow-600/10 border border-yellow-500/30 text-yellow-400 p-3 mb-6 text-[10px] font-mono tracking-widest uppercase flex items-center justify-center gap-2 text-center">
            <AlertTriangle size={14} class="shrink-0" />
            THIS FEATURE IS JUST AN ADD-ON
          </div>
      <div class="w-full text-yellow-500 p-3 mb-6 text-[10px] font-mono tracking-widest uppercase flex items-center justify-center gap-2 text-center">
            TITLE BASED ON FILE NAME: "{props.fileName}"
          </div>

          <div class="w-[240px] aspect-[2/3] border-2 border-zinc-800 bg-[#0a0a0a] flex flex-col items-center justify-center mb-6 overflow-hidden relative group">
            <Show when={props.coverUrl} fallback={<span class="text-zinc-600 font-mono text-xs uppercase tracking-widest">NO SIGNAL</span>}>
              <Show when={isImageLoading() && !imageError()}>
                <div class="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
                  <div class="flex flex-col items-center gap-2">
                    <Loader2 size={20} class="text-orange-500 animate-spin" />
                    <span class="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">LOADING...</span>
                  </div>
                </div>
              </Show>
              <Show when={imageError()}>
                <div class="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
                  <span class="text-red-500 font-mono text-xs uppercase tracking-widest text-center px-4">SIGNAL LOST<br/><span class="text-[9px] text-zinc-500">IMAGE FAILED TO LOAD</span></span>
                </div>
              </Show>
              <img 
                src={props.coverUrl!} 
                alt="Cover" 
                referrerPolicy="no-referrer"
                class={`w-full h-full object-cover transition-opacity duration-500 ${isImageLoading() ? 'opacity-0' : 'opacity-100'}`} 
                onLoad={() => setIsImageLoading(false)}
                onError={() => { setIsImageLoading(false); setImageError(true); }}
              />
            </Show>
          </div>

          <h2 class="text-white font-bold font-brains text-xl text-center mb-2 tracking-wide">{props.gameTitle}</h2>
          <div class="flex flex-wrap items-center justify-center gap-2 mb-4">
            <Show when={props.gameDeveloper} fallback={
              <span class="inline-flex items-center gap-1.5 text-zinc-500 font-mono text-[11px] uppercase tracking-widest">
                 Metadata Link Established
              </span>
            }>
              <span class="inline-flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] uppercase tracking-widest">
                 DEV: <span class="text-zinc-300 font-bold">{props.gameDeveloper}</span>
              </span>
            </Show>
          </div>
          
          <Show when={props.gameDesc}>
            <div class="w-full max-h-[250px] overflow-y-auto custom-scrollbar mb-6 px-6">
              <p class="text-zinc-400 font-sans text-[13px] text-justify leading-relaxed tracking-wide">{props.gameDesc}</p>
            </div>
          </Show>

            {/* Horizontal Rule with OR */}
            <div class="w-full flex items-center gap-4 opacity-70">
              <div class="flex-1 h-[2px] bg-zinc-700"></div>
              <span class="text-zinc-500 font-bold tracking-widest uppercase">OR</span>
              <div class="flex-1 h-[2px] bg-zinc-700"></div>
            </div>

          <div class="w-full flex flex-col gap-2">
            <label class="text-zinc-400 text-[11px] font-mono tracking-widest uppercase">Wrong cover? Search manually:</label>
            <div class="flex gap-2">
              <input 
                type="text" 
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Enter exact game title..." 
                class="flex-1 bg-black border border-zinc-800 px-3 py-2 text-zinc-300 placeholder:text-zinc-600 font-mono text-sm focus:outline-none focus:border-orange-500 uppercase"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                onClick={handleSearch}
                disabled={isLoading()}
                class="bg-orange-500 hover:bg-orange-400 text-black px-4 py-2 font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <Show when={isLoading()} fallback={<Search size={16} />}>
                  <Loader2 size={16} class="animate-spin" />
                </Show>
              </button>
            </div>
            <Show when={errorMsg()}>
              <span class="text-red-500 text-xs font-mono mt-1">{errorMsg()}</span>
            </Show>
          </div>

      </div>
    </Modal>
  );
}
