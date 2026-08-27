// @ts-nocheck
import { createMemo, createSignal, Show, Index } from 'solid-js';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { Utensils, Hammer, Search } from 'lucide-solid';

import itemInfoRaw from '../../../data/stardew/iteminfo.json';

const toArray = (obj: any): any[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return [obj];
};

const getText = (val: any): string => {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    if (val['$text']) return String(val['$text']);
    if (val['$value']) return String(val['$value']);
    if (val['#text']) return String(val['#text']);
    if (val['text']) return String(val['text']);
    if (val['string']) return String(val['string']);
    return JSON.stringify(val);
  }
  return String(val);
};

const getSpriteByName = (name: string, isCrafting: boolean) => {
  const recipeToItemMap: Record<string, string> = {
    'Transmute (Fe)': 'Iron Bar',
    'Transmute (Au)': 'Gold Bar',
    'Wild Seeds (Sp)': 'Spring Seeds',
    'Wild Seeds (Su)': 'Summer Seeds',
    'Wild Seeds (Fa)': 'Fall Seeds',
    'Wild Seeds (Wi)': 'Winter Seeds'
  };

  const lookupName = recipeToItemMap[name] || name;

  let sheetUrl = '/stardew/springobjects.png';
  let blockWidth = 16;
  let blockHeight = 16;
  let spriteWidth = 16;
  let spriteHeight = 16;
  let columns = 24;

  let foundTuple: any = null;
  for (const tuple of (itemInfoRaw as any[])) {
    if (tuple && tuple[1] && tuple[1].name === lookupName) {
      foundTuple = tuple[1];
      break;
    }
  }

  if (!foundTuple) return null;

  let id = parseInt(foundTuple.spriteIndex !== undefined ? foundTuple.spriteIndex : foundTuple._key, 10);
  if (isNaN(id)) return null;

  if (foundTuple.displayName && String(foundTuple.displayName).includes('BigCraftables')) {
    sheetUrl = '/stardew/Craftables.png';
    columns = 8;
    blockHeight = 32;
    spriteHeight = 32;
  }

  const x = (id % columns) * blockWidth;
  const y = Math.floor(id / columns) * blockHeight;
  return { sheetUrl, x, y, spriteWidth, spriteHeight };
};

const RecipeIcon = (props: { name: string, isCrafting: boolean }) => {
  const sprite = createMemo(() => getSpriteByName(props.name, props.isCrafting));

  return (
    <Show 
      when={sprite()} 
      fallback={<div class="w-32 h-32 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[12px] leading-[16px] opacity-50 shrink-0">{props.name.charAt(0)}</div>}
    >
      {(s) => {
        const scale = 32 / Math.max(s().spriteWidth, s().spriteHeight);
        return (
          <div class="w-32 h-32 shrink-0 flex items-center justify-center overflow-hidden">
            <div style={{
              width: `${s().spriteWidth}px`, height: `${s().spriteHeight}px`,
              position: 'relative',
              transform: `scale(${scale * 0.9})`,
              "transform-origin": 'center'
            }}>
              <div style={{
                width: '100%', height: '100%',
                "background-image": `url(${s().sheetUrl})`,
                "background-position": `-${s().x}px -${s().y}px`,
                "image-rendering": 'pixelated', 
              }} />
            </div>
          </div>
        );
      }}
    </Show>
  );
};

const RecipeRow = (props: { item: any, idx: number, type: 'cooking' | 'crafting', basePath: string }) => {

  const itemData = () => props.item();

  const nameObj = () => itemData()?.key?.string || itemData()?.key;
  const name = () => getText(nameObj());

  const countObj = () => itemData()?.value?.int || itemData()?.value;
  const storeCount = () => parseInt(getText(countObj()) || '0', 10);

  const [localCount, setLocalCount] = createSignal<number | null>(null);
  const displayCount = () => localCount() !== null ? localCount()! : storeCount();

  const handleUpdate = (val: number) => {
    setLocalCount(null);
    if (isNaN(val)) return;

    const vObj = countObj();
    let path = `${props.basePath}.${props.type}Recipes.item.${props.idx}.value.int`;
    if (!itemData()?.value?.int) path = `${props.basePath}.${props.type}Recipes.item.${props.idx}.value`;
    
    if (typeof vObj === 'object' && vObj !== null) {
      if ('$text' in vObj) path += '.$text';
      else if ('$value' in vObj) path += '.$value';
      else if ('#text' in vObj) path += '.#text';
      else if ('' in vObj) path += '.';
    }
    updateValue(path, val);
  };

  return (
    <Show when={name()}>
      <div class="flex items-center justify-between p-12 rounded-8 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
        <div class="flex items-center gap-12">
          <RecipeIcon name={name()} isCrafting={props.type === 'crafting'} />
          <span class="font-medium font-serif text-white">{name()}</span>
        </div>
        <div class="flex items-center gap-8">
          <span class="text-[12px] leading-[16px] text-gray-400">
            {props.type === 'cooking' ? 'Cooked:' : 'Crafted:'}
          </span>
          <input 
            type="number"
            min="0"
            value={displayCount()}
            onInput={(e) => setLocalCount(parseInt(e.target.value, 10) || 0)}
            onChange={(e) => handleUpdate(parseInt(e.target.value, 10) || 0)}
            class="glass-input font-brains w-80 text-center"
          />
        </div>
      </div>
    </Show>
  );
};

export const RecipesTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();
  const basePath = () => pv()?.SaveGame?.player ? 'SaveGame.player' : 'player';

  const [searchQuery, setSearchQuery] = createSignal('');

  const cookingItems = createMemo(() => {
    const items = player()?.cookingRecipes?.item;
    const arr = items ? toArray(items).map((item, idx) => ({ item, idx })) : [];
    const q = searchQuery().toLowerCase();
    if (!q) return arr;
    return arr.filter((e) => getText(e.item?.key?.string || e.item?.key).toLowerCase().includes(q));
  });

  const craftingItems = createMemo(() => {
    const items = player()?.craftingRecipes?.item;
    const arr = items ? toArray(items).map((item, idx) => ({ item, idx })) : [];
    const q = searchQuery().toLowerCase();
    if (!q) return arr;
    return arr.filter((e) => getText(e.item?.key?.string || e.item?.key).toLowerCase().includes(q));
  });

  const setAllTo1 = (type: 'cooking' | 'crafting') => {
    const items = type === 'cooking' ? cookingItems() : craftingItems();
    items.forEach((entry) => {
      const vObj = entry.item?.value?.int || entry.item?.value;
      const storeCount = parseInt(getText(vObj) || '0', 10);
      if (storeCount === 0) {
        let path = `${basePath()}.${type}Recipes.item.${entry.idx}.value.int`;
        if (!entry.item?.value?.int) path = `${basePath()}.${type}Recipes.item.${entry.idx}.value`;
        
        if (typeof vObj === 'object' && vObj !== null) {
          if ('$text' in vObj) path += '.$text';
          else if ('$value' in vObj) path += '.$value';
          else if ('#text' in vObj) path += '.#text';
          else if ('' in vObj) path += '.';
        }
        updateValue(path, 1);
      }
    });
  };

  return (
    <div class="flex flex-col gap-16">
      <div class="flex items-center justify-end">
        <div class="relative w-full max-w-md">
          <Search class="absolute left-12 top-1/2 -translate-y-1/2 text-white/40" size={16} />
          <input 
            type="text"
            placeholder="Search recipes (e.g. Omelet, Fence, Bomb)..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
            class="bg-[#0A0A0A]/90 border border-white/10 rounded-8 font-serif text-white w-full px-16 py-8 pl-40 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-24">
      
      {/* Cooking Recipes */}
      <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col h-[500px]">
        <div class="flex items-center justify-between mb-16">
          <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest flex items-center gap-8">
            <Utensils size={14} /> Cooking Recipes ({cookingItems().length})
          </h2>
          <button 
            onClick={() => setAllTo1('cooking')}
            class="text-[10px] cursor-pointer uppercase tracking-widest font-bold bg-white/10 hover:bg-white/20 px-8 py-4 rounded text-white transition-colors"
          >
            Cook All
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto pr-8 font-serif custom-scrollbar flex flex-col gap-8">
          <Show 
            when={cookingItems().length > 0} 
            fallback={<div class="text-center text-gray-500 font-serif py-40 text-body-medium">No cooking recipes unlocked yet.</div>}
          >

            <Index each={cookingItems()}>
              {(entry) => (
                <RecipeRow 
                  item={() => entry().item} 
                  idx={entry().idx} 
                  type="cooking" 
                  basePath={basePath()} 
                />
              )}
            </Index>
          </Show>
        </div>
      </div>

      {/* Crafting Recipes */}
      <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col h-[500px]">
        <div class="flex items-center justify-between mb-16">
          <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest flex items-center gap-8">
            <Hammer size={14} /> Crafting Recipes ({craftingItems().length})
          </h2>
          <button 
            onClick={() => setAllTo1('crafting')}
            class="text-[10px] cursor-pointer uppercase tracking-widest font-bold bg-white/10 hover:bg-white/20 px-8 py-4 rounded text-white transition-colors"
          >
            Craft All
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto font-serif pr-8 custom-scrollbar flex flex-col gap-8">
          <Show 
            when={craftingItems().length > 0} 
            fallback={<div class="text-center text-gray-500 py-40 text-body-medium">No crafting recipes unlocked yet.</div>}
          >
            <Index each={craftingItems()}>
              {(entry) => (
                <RecipeRow 
                  item={() => entry().item} 
                  idx={entry().idx} 
                  type="crafting" 
                  basePath={basePath()} 
                />
              )}
            </Index>
          </Show>
        </div>
      </div>

      </div>
    </div>
  );
};