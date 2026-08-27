// @ts-nocheck
import { createMemo, createSignal, Show, Index } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { User, Coins, Heart, Zap } from 'lucide-solid';

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

const handleUpdate = (path: string, originalVal: any, newVal: any) => {
  let p = path;
  if (typeof originalVal === 'object' && originalVal !== null) {
    if ('$text' in originalVal) p += '.$text';
    else if ('$value' in originalVal) p += '.$value';
    else if ('#text' in originalVal) p += '.#text';
    else if ('' in originalVal) p += '.';
  }
  updateValue(p, newVal);
};

const FarmhandCard = (props: { farmhand: any }) => {

  const fh = () => props.farmhand();

  const storeName = () => getText(fh().data.name) || 'Unknown';
  const storeMoney = () => parseInt(getText(fh().data.money) || '0', 10);
  const storeHealth = () => parseInt(getText(fh().data.health) || '0', 10);
  const storeMaxStamina = () => parseInt(getText(fh().data.maxStamina) || '0', 10);

  const [localName, setLocalName] = createSignal<string | null>(null);
  const [localMoney, setLocalMoney] = createSignal<number | null>(null);
  const [localHealth, setLocalHealth] = createSignal<number | null>(null);
  const [localMaxStamina, setLocalMaxStamina] = createSignal<number | null>(null);

  const displayName = () => localName() !== null ? localName()! : storeName();
  const displayMoney = () => localMoney() !== null ? localMoney()! : storeMoney();
  const displayHealth = () => localHealth() !== null ? localHealth()! : storeHealth();
  const displayMaxStamina = () => localMaxStamina() !== null ? localMaxStamina()! : storeMaxStamina();

  const commitUpdate = (field: string, localSetter: any, originalVal: any, finalVal: any) => {
    localSetter(null);
    handleUpdate(`${fh().path}.${field}`, originalVal, finalVal);
  };

  return (
    <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16">
      <h2 class="text-title-h5 font-bold text-white font-serif flex items-center gap-8 mb-16">
        <User size={18} class="text-[#10a37f]" /> Farmhand: {displayName()}
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div class="flex flex-col gap-4">
          <label class="text-[12px] font-serif leading-[16px] text-gray-500">Name</label>
          <input 
            type="text"
            value={displayName()}
            onInput={(e) => setLocalName(e.target.value)}
            onChange={(e) => commitUpdate('name', setLocalName, fh().data.name, e.target.value)}
            class="glass-input font-brains"
          />
        </div>
        
        <div class="flex flex-col gap-4">
          <label class="text-[12px] leading-[16px] font-serif text-yellow-500/70 flex items-center gap-4"><Coins size={10} /> Money</label>
          <input 
            type="number"
            value={displayMoney()}
            onInput={(e) => setLocalMoney(parseInt(e.target.value, 10) || 0)}
            onChange={(e) => commitUpdate('money', setLocalMoney, fh().data.money, parseInt(e.target.value, 10) || 0)}
            class="glass-input text-yellow-500 font-bold font-brains"
          />
        </div>
        
        <div class="flex flex-col gap-4">
          <label class="text-[12px] leading-[16px] text-green-500/70 font-serif flex items-center gap-4"><Heart size={10} /> Health</label>
          <input 
            type="number"
            value={displayHealth()}
            onInput={(e) => setLocalHealth(parseInt(e.target.value, 10) || 0)}
            onChange={(e) => commitUpdate('health', setLocalHealth, fh().data.health, parseInt(e.target.value, 10) || 0)}
            class="glass-input text-green-500 font-brains"
          />
        </div>
        
        <div class="flex flex-col gap-4">
          <label class="text-[12px] leading-[16px] font-serif text-blue-500/70 flex items-center gap-4"><Zap size={10} /> Max Stamina</label>
          <input 
            type="number"
            value={displayMaxStamina()}
            onInput={(e) => setLocalMaxStamina(parseInt(e.target.value, 10) || 0)}
            onChange={(e) => commitUpdate('maxStamina', setLocalMaxStamina, fh().data.maxStamina, parseInt(e.target.value, 10) || 0)}
            class="glass-input text-blue-500 font-brains"
          />
        </div>
      </div>
    </div>
  );
};

export const FarmhandsTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;

  const farmhandsData = createMemo(() => {
    const results: { path: string; data: any }[] = [];
    
    if (!pv()) return results;

    const rawPv = unwrap(pv());
    const rootPath = rawPv?.SaveGame ? 'SaveGame' : '';
    const root = rawPv?.SaveGame || rawPv;

    if (root?.farmhands?.FarmHand) {
       const fhArray = toArray(root.farmhands.FarmHand);
       const fhPath = rootPath ? `${rootPath}.farmhands.FarmHand` : 'farmhands.FarmHand';
       fhArray.forEach((fh: any, fhIdx: number) => {
          if (fh && typeof fh === 'object' && fh.name) {
             results.push({ path: `${fhPath}.${fhIdx}`, data: fh });
          }
       });
    }

    if (root?.locations?.GameLocation) {
       const locationsPath = rootPath ? `${rootPath}.locations.GameLocation` : 'locations.GameLocation';
       const locations = toArray(root.locations.GameLocation);
       
       locations.forEach((loc: any, locIdx: number) => {
         if (!loc || typeof loc !== 'object') return;
         
         const locPath = `${locationsPath}.${locIdx}`;
         const buildingsArray = toArray(loc?.buildings?.Building);
         
         buildingsArray.forEach((building: any, bIdx: number) => {
            if (!building || typeof building !== 'object') return;
            
            if (building.indoors?.farmhand) {
               const fh = building.indoors.farmhand;
               if (fh && typeof fh === 'object' && fh.name) {
                  results.push({ path: `${locPath}.buildings.Building.${bIdx}.indoors.farmhand`, data: fh });
               }
            }
         });
       });
    }

    return results;
  });

  return (
    <Show 
      when={farmhandsData().length > 0} 
      fallback={
        <div class="glass-panel p-24 text-center text-gray-500 py-80">
          <User class="mx-auto mb-16 opacity-30" size={48} />
          <h3 class="text-[28px] leading-[32px] font-desc text-white mb-8">No Farmhands Found</h3>
          <p class="font-desc">This save file does not appear to have any multiplayer farmhands (cabins).</p>
        </div>
      }
    >
      <div class="flex flex-col gap-24">
        <Index each={farmhandsData()}>
          {(fh) => <FarmhandCard farmhand={fh} />}
        </Index>
      </div>
    </Show>
  );
};