import { createMemo, For, Show } from 'solid-js';
import { useEditorStore, updateValue } from '../../store/editorStore';
import { User, Heart, Zap, TrendingUp, Coins } from 'lucide-solid';

export const PartyView = () => {
  const store = useEditorStore();

  const gold = createMemo(() => {
    return store.saveData?.parsed_variables?.party?._gold || 0;
  });

  const actorsWithIndex = createMemo(() => {

    const targetData = store.saveData?.parsed_variables?.actors?._data?.['@a'] || [];
    
    if (Array.isArray(targetData)) {
      return targetData
        .map((actor, index) => ({ actor, originalIndex: index }))
        .filter((item) => item.actor !== null && typeof item.actor === 'object');
    }
    return [];
  });

  const handleGoldChange = (newValue: string) => {
    const val = Number(newValue);
    if (!isNaN(val)) {
      updateValue('party._gold', val);
    }
  };

  const handleStatChange = (index: number, statKey: string, newValue: string) => {
    const val = Number(newValue);
    if (!isNaN(val)) {
      const path = `actors._data.@a.${index}.${statKey}`;
      updateValue(path, val);
    }
  };

  return (
    <div class="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      
      {/* HEADER */}
      <div class="flex items-center gap-4 border-b border-zinc-800 pb-4">
        <div class="w-2 h-8 bg-[#FF7A00]"></div>
        <h2 class="text-4xl font-[Hacked] text-zinc-100 tracking-widest uppercase drop-shadow-[2px_2px_0px_#FF7A00]">
          PARTY DATABASE
        </h2>
      </div>

      {/* GOLD PANEL */}
      <div class="bg-[#0a0a0a] border-2 border-zinc-800 p-6 shadow-[4px_4px_0px_rgba(234,179,8,0.2)] flex items-center justify-between group hover:border-zinc-700 transition-colors">
        <div class="flex items-start gap-6">
          <div class="w-16 h-16 shrink-0 mt-5 bg-zinc-950 border border-zinc-800 flex items-center justify-center text-yellow-500 group-hover:border-yellow-500 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] group-hover:shadow-[2px_2px_0px_#EAB308]">
            <Coins size={32} />
          </div>
          <div>
            <h3 class="text-xl font-bold tracking-widest uppercase text-zinc-100">Party Gold</h3>
            <p class="text-xs text-zinc-500 font-brains mt-1">Manage total currency</p>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
          <label class="text-[35px] text-zinc-500 mt-2 font-bold tracking-widest uppercase">G</label>
          <input 
            type="number" 
            value={gold()}
            onInput={(e) => handleGoldChange(e.target.value)}
            class="w-[200px] bg-[#050505] border border-zinc-800 px-4 py-3 text-yellow-500 font-bold text-lg font-brains focus:outline-none focus:border-yellow-500 focus:shadow-[2px_2px_0px_#EAB308] transition-all rounded-none text-right"
          />
          <button 
            onClick={() => handleGoldChange('9999999')}
            class="px-4 py-3 cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-yellow-500 hover:text-yellow-500 text-zinc-500 font-bold text-xs uppercase tracking-widest transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_#EAB308] hover:-translate-y-0.5 hover:-translate-x-0.5"
          >
            MAX
          </button>
        </div>
      </div>
      
      {/* ACTORS GRID */}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
        <Show 
          when={actorsWithIndex().length > 0} 
          fallback={
            <div class="col-span-full py-16 flex items-center justify-center text-zinc-600 font-bold tracking-widest border-2 border-dashed border-zinc-800 uppercase text-sm font-brains">
              {">>"} NO ACTORS DETECTED_
            </div>
          }
        >
          <For each={actorsWithIndex()}>
            {(item) => {
              const actor = item.actor;
              const originalIndex = item.originalIndex;

              return (
                <div class="bg-[#0a0a0a] border-2 border-zinc-800 p-6 shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] hover:border-zinc-700 transition-all hover:-translate-y-1 hover:-translate-x-1 rounded-none flex flex-col gap-6 group">
                  
                  {/* Header: Name and ID */}
                  <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
                    <div class="flex items-start gap-6">
                      <div class="w-16 h-16 mt-[7px] bg-zinc-950 border border-zinc-800 flex items-center justify-center group-hover:border-[#FF7A00] group-hover:text-[#FF7A00] text-zinc-500 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        <User size={24} />
                      </div>
                      <div>
                        <div class="font-bold text-xl text-zinc-100 tracking-widest uppercase truncate max-w-[150px]">
                          {actor._name || `Actor ${actor._actorId}`}
                        </div>
                        <div class="text-xs text-[#00F0FF] font-black tracking-widest uppercase mt-1">
                          ID: {actor._actorId}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Inputs */}
                  <div class="flex flex-col gap-4 font-brains">
                    
                    {/* Level Input */}
                    <div class="flex items-center gap-6 group/level">
                      <div class="w-16 mt-[18px] flex justify-center text-zinc-600 group-hover:text-zinc-400 group-focus-within/level:!text-[#FF7A00] transition-colors">
                        <TrendingUp size={18} />
                      </div>
                      <div class="flex-1">
                        <label class="block text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1.5">Current Level</label>
                        <input 
                          type="number" 
                          value={actor._level || 0}
                          onInput={(e) => handleStatChange(originalIndex, '_level', e.target.value)}
                          class="w-full bg-[#050505] border border-zinc-800 px-3 py-2 text-zinc-200 font-bold focus:outline-none focus:border-[#FF7A00] focus:shadow-[2px_2px_0px_#FF7A00] transition-all rounded-none"
                        />
                      </div>
                    </div>

                  {/* HP Input */}
                  <div class="flex items-center gap-6 group/hp">
                    <div class="w-16 mt-[18px] flex justify-center text-zinc-600 group-hover:text-zinc-400 group-focus-within/hp:!text-[#FF0000] transition-colors">
                      <Heart size={18} />
                    </div>
                    <div class="flex-1">
                      <label class="block text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1.5">Max HP</label>
                      <input 
                        type="number" 
                        value={actor._hp || 0}
                        onInput={(e) => handleStatChange(originalIndex, '_hp', e.target.value)}
                        class="w-full bg-[#050505] border border-zinc-800 px-3 py-2 text-zinc-200 font-bold focus:outline-none focus:border-[#FF0000] focus:shadow-[2px_2px_0px_#FF0000] transition-all rounded-none"
                      />
                    </div>
                  </div>

                    {/* MP Input */}
                    <div class="flex items-center gap-6 group/mp">
                      <div class="w-16 mt-[18px] flex justify-center text-zinc-600 group-hover:text-zinc-400 group-focus-within/mp:!text-[#00F0FF] transition-colors">
                        <Zap size={18} />
                      </div>
                      <div class="flex-1">
                        <label class="block text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1.5">Max MP</label>
                        <input 
                          type="number" 
                          value={actor._mp || 0}
                          onInput={(e) => handleStatChange(originalIndex, '_mp', e.target.value)}
                          class="w-full bg-[#050505] border border-zinc-800 px-3 py-2 text-zinc-200 font-bold focus:outline-none focus:border-[#00F0FF] focus:shadow-[2px_2px_0px_#00F0FF] transition-all rounded-none"
                        />
                      </div>
                    </div>

                  </div>

                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
};