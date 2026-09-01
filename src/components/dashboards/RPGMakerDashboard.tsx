import { Switch, Match, For, createSignal, Show } from 'solid-js';
import { useEditorStore, setActiveTab, setGameDatabase, setOriginalGameDatabase, setTranslatedGameDatabase, setDatabaseTranslated } from '../../store/editorStore';
import { Users, Package, Sword, Shield, ToggleLeft, Hash, Database, Languages } from 'lucide-solid';
import { PartyView } from './PartyView';
import { ItemsView } from './ItemsView';
import { WeaponsView } from './WeaponsView';
import { ArmorsView } from './ArmorsView';
import { SwitchesView } from './SwitchesView';
import { VariablesView } from './VariablesView';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import { loadGameDatabase } from '../../services/ipc';

export const RPGMakerDashboard = () => {
  const store = useEditorStore();

  const categories = [
    { id: 'party', label: 'Party', icon: Users },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'weapons', label: 'Weapons', icon: Sword },
    { id: 'armors', label: 'Armors', icon: Shield },
    { id: 'switches', label: 'Switches', icon: ToggleLeft },
    { id: 'variables', label: 'Variables', icon: Hash },
  ] as const;

const [isLoadingDB, setIsLoadingDB] = createSignal(false);
const [isTranslating, setIsTranslating] = createSignal(false);
const [translationProgress, setTranslationProgress] = createSignal("");

  const handleTranslateDB = async () => {
    setIsTranslating(true);
    try {
      const cats = ['items', 'weapons', 'armors', 'switches', 'variables'];
      
      const toTranslate: { category: string, id: number, text: string }[] = [];

      for (const cat of cats) {
        const records = store.gameDatabase[cat];
        if (!records) continue;
        
        for (const [id, text] of Object.entries(records)) {
          if (text && text.trim().length > 0) {
            toTranslate.push({ category: cat, id: Number(id), text: text.trim() });
          }
        }
      }
      
      if (toTranslate.length === 0) {
        alert("Database is empty or already processed!");
        return;
      }

      const BATCH_SIZE = 200;
      const totalBatches = Math.ceil(toTranslate.length / BATCH_SIZE);

      const newDb: Record<string, Record<number, string>> = {
        items: { ...store.gameDatabase.items },
        weapons: { ...store.gameDatabase.weapons },
        armors: { ...store.gameDatabase.armors },
        switches: { ...store.gameDatabase.switches },
        variables: { ...store.gameDatabase.variables },
      };
      
      for (let i = 0; i < totalBatches; i++) {
        setTranslationProgress(`TRANSLATING...(BATCH ${i + 1}/${totalBatches})`);
        
        const batch = toTranslate.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const combinedText = batch.map(x => x.text).join(' \n|||\n ');
        
        try {
          const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `q=${encodeURIComponent(combinedText)}`
          });
          
          if (!response.ok) {
             console.error("Batch Failed, skipping...", response.status);
             await new Promise(r => setTimeout(r, 2000));
             continue;
          }
          
          const data = await response.json();
          let translatedCombined = "";
          for (const part of data[0]) {
             if (part[0]) translatedCombined += part[0];
          }
          
          const translatedArray = translatedCombined.split(/\|\|\|/).map((s: string) => s.trim());

          if (translatedArray.length === batch.length) {
            for (let j = 0; j < batch.length; j++) {
              const item = batch[j];
              newDb[item.category][item.id] = translatedArray[j];
            }
          } else {
            console.warn(`Mismatch length in batch ${i+1}. Expected ${batch.length}, got ${translatedArray.length}. Skipping this batch.`);
          }
          
        } catch (err) {
           console.error("Translation error in batch", err);
        }

        if (i < totalBatches - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      for (const cat of cats) {
         setGameDatabase(cat, newDb[cat]);
         setTranslatedGameDatabase(cat, newDb[cat]);
      }
      setDatabaseTranslated(true);
      
    } catch (err) {
      console.error(err);
      alert("Failed to translate the database.");
    } finally {
      setIsTranslating(false);
      setTranslationProgress("");
    }
  };

  const handleLoadDB = async () => {
    try {
      const selectedDir = await open({
        directory: true,
        multiple: false,
        title: 'Select RPG Maker "data" Folder (contains Items.json, etc.)'
      });

      if (selectedDir) {
        setIsLoadingDB(true);

        const dbResult = await loadGameDatabase(selectedDir);

        if (dbResult.items) { setGameDatabase('items', dbResult.items); setOriginalGameDatabase('items', dbResult.items); }
        if (dbResult.weapons) { setGameDatabase('weapons', dbResult.weapons); setOriginalGameDatabase('weapons', dbResult.weapons); }
        if (dbResult.armors) { setGameDatabase('armors', dbResult.armors); setOriginalGameDatabase('armors', dbResult.armors); }
        if (dbResult.actors) { setGameDatabase('actors', dbResult.actors); setOriginalGameDatabase('actors', dbResult.actors); }
        if (dbResult.skills) { setGameDatabase('skills', dbResult.skills); setOriginalGameDatabase('skills', dbResult.skills); }
        if (dbResult.switches) { setGameDatabase('switches', dbResult.switches); setOriginalGameDatabase('switches', dbResult.switches); }
        if (dbResult.variables) { setGameDatabase('variables', dbResult.variables); setOriginalGameDatabase('variables', dbResult.variables); }
        
        setDatabaseTranslated(false);

        console.log("Game DB Loaded:", dbResult);
      }
    } catch (err) {
      console.error("Failed to load Game DB:", err);
      alert("Failed to load Game Database. Make sure you selected the correct 'data' folder.");
    } finally {
      setIsLoadingDB(false);
    }
  };

  return (
    <div class="flex-1 w-full h-full flex flex-col md:flex-row bg-[#050505] text-zinc-200 overflow-hidden font-brains">
      
      {/* SIDEBAR */}
      <div class="w-full md:w-[200px] h-auto md:h-full bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col shrink-0">
        <div class="p-4 border-b border-zinc-800 flex flex-col gap-2">
        <button 
          onClick={handleLoadDB}
          disabled={isLoadingDB()}
          class="w-full py-6 cursor-pointer bg-zinc-900 border border-zinc-600 hover:border-[#FF7A00] hover:text-[#FF7A00] transition-colors flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] hover:-translate-y-0.5 hover:-translate-x-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Database size={14} /> 
          {isLoadingDB() ? 'SCANNING...' : 'Load Game DB'}
        </button>

        <Show when={Object.keys(store.translatedGameDatabase).length === 0} fallback={
          <button 
            onClick={() => setDatabaseTranslated(!store.isDatabaseTranslated)}
            class="w-full py-6 mt-4 cursor-pointer border transition-all flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase bg-zinc-900 border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00]/10 shadow-[4px_4px_0px_#FF7A00] hover:-translate-y-0.5 hover:-translate-x-0.5"
          >
            <Languages size={14} />
            {store.isDatabaseTranslated ? 'Show Original DB' : 'Show Translated DB'}
          </button>
        }>
          <button 
            onClick={handleTranslateDB}
            disabled={isTranslating() || Object.keys(store.gameDatabase).length === 0}
            class={`w-full py-6 mt-4 cursor-pointer border transition-all flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed ${
              isTranslating() 
                ? 'bg-[#FF7A00]/20 border-[#FF7A00] text-[#FF7A00] animate-pulse'
                : 'bg-zinc-900 border-zinc-600 hover:border-[#FF7A00] hover:text-[#FF7A00] shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] hover:-translate-y-0.5 hover:-translate-x-0.5'
            }`}
          >
            <Languages size={14} /> 
            {isTranslating() ? translationProgress() : 'Translate DB (EN)'}
          </button>
        </Show>
        <p class="hidden md:block text-[12px] text-zinc-400 font-brains mt-4 text-center px-2 leading-relaxed">
          Map IDs to real names (Select data/ folder)
        </p>
        </div>

        <div class="overflow-x-auto md:overflow-y-auto p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-6 custom-scrollbar shrink-0 md:flex-1 items-center md:items-stretch">
          <span class="hidden md:block text-[10px] text-zinc-500 mt-4 font-black tracking-widest uppercase mb-2 px-2">Categories</span>
          
          <For each={categories}>
            {(cat) => (
              <button 
                onClick={() => setActiveTab(cat.id)}
                class={`px-4 py-4 md:py-3 cursor-pointer flex items-center gap-2 md:gap-6 font-bold text-sm tracking-widest uppercase transition-all whitespace-nowrap ${
                  store.activeTab === cat.id 
                    ? 'bg-[#FF7A00]/10 border-b-2 md:border-b-0 md:border-l-2 border-[#FF7A00] text-[#FF7A00]' 
                    : 'border-b-2 md:border-b-0 md:border-l-2 border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <cat.icon class="shrink-0 w-5 h-5 md:w-4 md:h-4" /> {cat.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div class="flex-1 flex flex-col min-h-0 p-4 md:p-8 relative overflow-y-auto">
        {/* Background Watermark */}
        <div class="absolute right-8 top-8 opacity-5 pointer-events-none">
          <h1 class="text-8xl font-[Hacked] text-[#FF7A00]">{store.activeTab.toUpperCase()}</h1>
        </div>

        <div class="relative z-10 flex-1 flex flex-col min-h-0">
          <Switch fallback={
            <div class="flex items-center justify-center h-full text-zinc-600 uppercase tracking-widest text-sm font-bold mt-20">
              {">>"} SELECT A CATEGORY TO INJECT DATA_
            </div>
          }>
            <Match when={store.activeTab === 'party'}>
              <PartyView />
            </Match>
            <Match when={store.activeTab === 'items'}>
              <ItemsView />
            </Match>
            <Match when={store.activeTab === 'weapons'}>
              <WeaponsView />
            </Match>
            <Match when={store.activeTab === 'armors'}>
              <ArmorsView />
            </Match>
            <Match when={store.activeTab === 'switches'}>
              <SwitchesView />
            </Match>
            <Match when={store.activeTab === 'variables'}>
              <VariablesView />
            </Match>
          </Switch>
        </div>
      </div>

    </div>
  );
};