import { createMemo, createEffect, createSignal, For, Show } from 'solid-js';
import { useEditorStore, updateValue } from '../../store/editorStore';
import { Hash } from 'lucide-solid';
import { createVirtualizer } from '@tanstack/solid-virtual';

const VariableInput = (props: { index: number; value: number; path: string }) => {
  const [localVal, setLocalVal] = createSignal<string>(String(props.value));

  createEffect(() => {
    setLocalVal(String(props.value));
  });

  const handleBlur = () => {
    const numericVal = Number(localVal());
    if (!isNaN(numericVal)) {

      updateValue(props.path, numericVal);
    } else {
      setLocalVal(String(props.value));
    }
  };

  return (
    <input 
      type="number"
      value={localVal()}
      onInput={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      class="w-full bg-zinc-950 border-2 border-zinc-800 focus:border-[#FF7A00] text-[#FF7A00] px-4 py-2 outline-none transition-all font-brains text-sm shadow-inner text-right"
    />
  );
};

export const VariablesView = () => {
  const store = useEditorStore();

  const variablesList = createMemo(() => {
    const dataObj = store.saveData?.parsed_variables?.variables?._data;

    const hasAtA = dataObj && Array.isArray(dataObj['@a']);
    const rawVariables = hasAtA ? dataObj['@a'] : (dataObj || []);

    const basePath = hasAtA ? 'variables._data.@a' : 'variables._data';
    
    return Object.entries(rawVariables)
      .filter(([key, val]) => {

        return !key.startsWith('@') && key !== '0' && val !== null;
      })
      .map(([index, value]) => ({
        index: Number(index),
        value: Number(value) || 0,
        path: `${basePath}.${index}`
      }))
      .filter(v => !isNaN(v.index))
      .sort((a, b) => a.index - b.index); 
  });

  let scrollRef: HTMLDivElement | undefined;
  
  const virtualizer = createVirtualizer({
    get count() { return variablesList().length; },
    getScrollElement: () => scrollRef || null,
    estimateSize: () => 73,
    overscan: 10,
  });

  return (
    <div class="flex flex-col gap-8 w-full max-w-5xl mx-auto relative h-full flex-1 min-h-0">
      
      {/* HEADER */}
      <div class="flex items-center justify-between border-b border-zinc-800 pb-4 shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-2 h-8 bg-[#FF7A00]"></div>
          <h2 class="text-4xl font-[Hacked] text-zinc-100 tracking-widest uppercase drop-shadow-[2px_2px_0px_#FF7A00]">
            GLOBAL VARIABLES
          </h2>
        </div>
      </div>
      
      {/* TABLE CONTAINER */}
      <div class="bg-[#0a0a0a] border-2 border-zinc-800 shadow-[4px_4px_0px_rgba(255,122,0,0.2)] flex flex-col flex-1 min-h-0">
        
        {/* Table Header (CSS Grid) */}
        <div class="grid grid-cols-[80px_1fr_200px] gap-6 items-center p-4 border-b-2 border-zinc-800 bg-zinc-950 text-zinc-500 text-[10px] font-black uppercase tracking-widest shrink-0">
          <div class="text-center">ID</div>
          <div>Variable Name</div>
          <div class="text-right pr-4">Value (Number)</div>
        </div>

        {/* Table Body (Virtualized) */}
        <div class="flex flex-col font-brains flex-1 overflow-y-auto custom-scrollbar min-h-0" ref={scrollRef}>
          <Show 
            when={variablesList().length > 0}
            fallback={
              <div class="p-16 flex items-center justify-center text-zinc-600 font-bold tracking-widest border-t border-dashed border-zinc-800 uppercase text-sm">
                {">>"} NO VARIABLES FOUND_
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
                  const v = variablesList()[virtualRow.index];
                  const dbName = () => store.gameDatabase?.variables?.[v.index] || `Unknown Variable #${v.index}`;

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
                      <div class="grid grid-cols-[80px_1fr_200px] gap-6 items-center p-4 border-b border-zinc-800/50 hover:bg-[#FF7A00]/5 transition-colors group">
                        
                        {/* ID Column */}
                        <div class="text-center text-zinc-500 font-bold text-xs">
                          {String(v.index).padStart(4, '0')}
                        </div>

                        {/* Name Column */}
                        <div class="text-zinc-300 font-bold truncate flex items-center gap-3">
                          <Hash size={16} class="text-[#FF7A00] opacity-50" />
                          <span class="truncate">{dbName()}</span>
                        </div>

                          {/* Value Input Column */}
                          <div>
                            <VariableInput index={v.index} value={v.value} path={v.path} />
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
