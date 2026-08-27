import { createMemo, For, Show } from 'solid-js';
import { useEditorStore, updateValue } from '../../store/editorStore';
import { ToggleLeft } from 'lucide-solid';
import { createVirtualizer } from '@tanstack/solid-virtual';

export const SwitchesView = () => {
  const store = useEditorStore();

  const switchesList = createMemo(() => {
    const dataObj = store.saveData?.parsed_variables?.switches?._data;
    
    const hasAtA = dataObj && Array.isArray(dataObj['@a']);
    const rawSwitches = hasAtA ? dataObj['@a'] : (dataObj || []);
    const basePath = hasAtA ? 'switches._data.@a' : 'switches._data';
    
    return Object.entries(rawSwitches)
      .filter(([key, val]) => !key.startsWith('@') && key !== '0' && val !== null)
      .map(([index, value]) => ({
        index: Number(index),
        value: Boolean(value),
        path: `${basePath}.${index}`
      }))
      .filter(sw => !isNaN(sw.index))
      .sort((a, b) => a.index - b.index); 
  });

  let scrollRef: HTMLDivElement | undefined;
  
  const virtualizer = createVirtualizer({
    get count() { return switchesList().length; },
    getScrollElement: () => scrollRef || null,
    estimateSize: () => 65,
    overscan: 10,
  });

  const handleToggle = (path: string, currentVal: boolean) => {
    updateValue(path, !currentVal);
  };

  return (
    <div class="flex flex-col gap-8 w-full max-w-5xl mx-auto relative h-full flex-1 min-h-0">
      
      {/* HEADER */}
      <div class="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-2 h-8 bg-[#FF7A00]"></div>
          <h2 class="text-4xl font-[Hacked] text-zinc-100 tracking-widest uppercase drop-shadow-[2px_2px_0px_#FF7A00]">
            GLOBAL SWITCHES
          </h2>
        </div>
      </div>
      
      {/* TABLE CONTAINER */}
      <div class="bg-[#0a0a0a] border-2 border-zinc-800 shadow-[4px_4px_0px_rgba(255,122,0,0.2)] flex flex-col flex-1 min-h-0">
        
        {/* Table Header (CSS Grid) */}
        <div class="grid grid-cols-[80px_1fr_120px] gap-6 items-center p-4 border-b-2 border-zinc-800 bg-zinc-950 text-zinc-500 text-[10px] font-black uppercase tracking-widest shrink-0">
          <div class="text-center">ID</div>
          <div>Switch Name</div>
          <div class="text-right">State</div>
        </div>

        {/* Table Body (Virtualized) */}
        <div class="flex flex-col font-brains flex-1 overflow-y-auto custom-scrollbar min-h-0" ref={scrollRef}>
          <Show 
            when={switchesList().length > 0}
            fallback={
              <div class="p-16 flex items-center justify-center text-zinc-600 font-bold tracking-widest border-t border-dashed border-zinc-800 uppercase text-sm">
                {">>"} NO SWITCHES FOUND_
              </div>
            }
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              <For each={virtualizer.getVirtualItems()}>
                {(virtualRow) => {
                  const sw = switchesList()[virtualRow.index];

                  const dbName = () => store.gameDatabase?.switches?.[sw.index] || `Unknown Switch #${sw.index}`;

                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div class="grid grid-cols-[80px_1fr_120px] gap-6 items-center p-4 border-b border-zinc-800/50 hover:bg-[#FF7A00]/5 transition-colors group">
                        
                        {/* ID Column */}
                        <div class="text-center text-zinc-500 font-bold text-xs">
                          {String(sw.index).padStart(4, '0')}
                        </div>

                        {/* Name Column */}
                        <div class="text-zinc-300 font-bold truncate flex items-center gap-3">
                          <ToggleLeft size={16} class="text-[#FF7A00] opacity-50" />
                          <span class="truncate">{dbName()}</span>
                        </div>

                        {/* Toggle Column */}
                          <div class="text-right">
                            <button 
                              onClick={() => handleToggle(sw.path, sw.value)}
                              class={`px-6 py-2 rounded-none text-[10px] cursor-pointer uppercase font-bold tracking-widest transition-all border-2 w-full max-w-[100px] inline-block ${
                                sw.value 
                                  ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF] shadow-[2px_2px_0px_#00F0FF]' 
                                  : 'bg-red-500/5 text-red-500/50 border-red-500/30 hover:border-red-500 hover:text-red-500'
                              }`}
                            >
                              {sw.value ? 'ON' : 'OFF'}
                            </button>
                          </div>

                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

      </div>
    </div>
  );
};
