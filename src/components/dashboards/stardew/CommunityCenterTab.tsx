// @ts-nocheck
import { createMemo, createSignal, Show, For, Match, Switch } from 'solid-js';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { Building2, Sparkles, Check, ArrowRight } from 'lucide-solid';
import { stardewBundles } from '../../../data/stardew/bundlesData';
import { ItemSprite } from './ItemSprite';
import { Tooltip } from '../../Header';

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

export const CommunityCenterTab = () => {
  const store = useEditorStore();
  const [viewMode, setViewMode] = createSignal<'joja' | 'junimo'>('joja');
  const [selectedRoomIndex, setSelectedRoomIndex] = createSignal(0);

  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player;

  const mailReceivedPath = () => pv()?.SaveGame?.player ? 'SaveGame.player.mailReceived.string' : 'player.mailReceived.string';
  
  const mailList = createMemo(() => {
    const p = player();
    if (!p?.mailReceived?.string) return [];
    return toArray(p.mailReceived.string).map(item => getText(item));
  });

  const hasFlag = (flag: string) => mailList().includes(flag);

  const toggleFlag = (flag: string, add: boolean) => {
    let currentArray = player()?.mailReceived?.string ? toArray(player()?.mailReceived.string) : [];

    const hasItem = currentArray.some(item => getText(item) === flag);
    
    if (add && !hasItem) {

      updateValue(mailReceivedPath(), [...currentArray, flag]);
    } else if (!add && hasItem) {

      const newArray = currentArray.filter(item => getText(item) !== flag);
      updateValue(mailReceivedPath(), newArray.length > 0 ? newArray : []); 
    }
  };

  const bundles = [
    { id: 'ccVault', name: 'Bus', cost: '40000 g' },
    { id: 'ccCraftsRoom', name: 'Bridge', cost: '25000 g' },
    { id: 'ccFishTank', name: 'Panning', cost: '20000 g' },
    { id: 'ccBoilerRoom', name: 'Minecarts', cost: '15000 g' },
    { id: 'ccPantry', name: 'Greenhouse', cost: '35000 g' },
    { id: 'ccBulletinBoard', name: 'Friendship', cost: 'n/a' },
  ];

  const saveBundlesList = () => {
    let b = pv()?.SaveGame?.bundles?.item || pv()?.bundles?.item;
    return toArray(b);
  };

  const getBundleFlags = (bundleId: string) => {
    const list = saveBundlesList();
    const item = list.find((i: any) => String(i?.key?.int) === bundleId);
    if (!item || !item.value || !item.value.ArrayOfBoolean || !item.value.ArrayOfBoolean.boolean) return [];
    return toArray(item.value.ArrayOfBoolean.boolean);
  };

  const toggleBundleItem = (bundleId: string, itemIndex: number, totalItems: number) => {
    const list = saveBundlesList();
    let itemIndexInList = list.findIndex((i: any) => String(i?.key?.int) === bundleId);
    
    let newList = [...list];
    
    if (itemIndexInList === -1) {

      let bools = Array(totalItems).fill("false");
      bools[itemIndex] = "true";
      newList.push({
        key: { int: parseInt(bundleId, 10) },
        value: { ArrayOfBoolean: { boolean: bools } }
      });
    } else {
      let currentItem = { ...newList[itemIndexInList] };
      let bools = currentItem.value?.ArrayOfBoolean?.boolean ? [...toArray(currentItem.value.ArrayOfBoolean.boolean)] : Array(totalItems).fill("false");

      while (bools.length < totalItems) bools.push("false");

      bools[itemIndex] = getText(bools[itemIndex]) === "true" ? "false" : "true";
      
      currentItem.value = { ArrayOfBoolean: { boolean: bools } };
      newList[itemIndexInList] = currentItem;
    }

    const basePath = pv()?.SaveGame?.bundles ? 'SaveGame.bundles.item' : 'bundles.item';
    updateValue(basePath, newList);
  };

  const isBundleItemCompleted = (bundleId: string, itemIndex: number) => {
    const flags = getBundleFlags(bundleId);
    if (!flags[itemIndex]) return false;
    return getText(flags[itemIndex]) === "true";
  };

  return (
    <Show when={player()}>
      <div class="flex flex-col gap-24 bg-[#f6ba6f] p-32 rounded-8 shadow-inner text-[#4d2503] font-sans" style={{ border: '8px solid #c05b1c', "border-radius": '16px' }}>
      
      {/* Warning Banner */}
      <div class="bg-[#ff6b4a] text-black font-bold p-16 shadow-sm relative overflow-hidden">
        <div class="flex items-center gap-8 text-title-h4 font-black mb-4">
          Under Construction 🏗️
        </div>
        <div class="text-body-medium opacity-90">Parts of this page are still being worked on.</div>
        <div class="absolute right-16 top-16 text-4xl opacity-20"><Building2 size={64} /></div>
      </div>

      <div class="flex flex-col gap-16">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <h1 class="text-2xl md:text-4xl font-serif font-black">{viewMode() === 'joja' ? 'Joja Development' : 'Junimo Scrolls'}</h1>
          
          {/* Toggle Button */}
          <div class="flex flex-wrap bg-black/10 rounded-8 p-4 w-full md:w-auto">
            <button 
              onClick={() => setViewMode('junimo')}
              class={`flex-1 md:flex-none px-4 md:px-16 py-8 cursor-pointer rounded font-bold font-brains flex items-center justify-center gap-2 md:gap-8 transition-colors ${viewMode() === 'junimo' ? 'bg-[#c05b1c] text-white shadow-sm' : 'text-[#8c4614] hover:bg-black/5'}`}
            >
              <Sparkles size={16} /> Junimo Bundles
            </button>
            <button 
              onClick={() => setViewMode('joja')}
              class={`flex-1 md:flex-none px-4 md:px-16 py-8 cursor-pointer rounded font-bold font-brains flex items-center justify-center gap-2 md:gap-8 transition-colors ${viewMode() === 'joja' ? 'bg-[#4d5c7a] text-white shadow-sm' : 'text-[#8c4614] hover:bg-black/5'}`}
            >
              <Building2 size={16} /> Joja Form
            </button>
          </div>
        </div>
        
        <Show when={viewMode() === 'joja'}>
          <label class="flex items-center gap-8 cursor-pointer w-fit text-title-h5 font-bold">
            <input 
              type="checkbox" 
              checked={hasFlag('JojaMember')}
              onChange={(e) => toggleFlag('JojaMember', e.target.checked)}
              class="w-20 h-20 accent-[#4da839] cursor-pointer"
            />
            Enable Joja Membership
          </label>
        </Show>
      </div>

      <Switch>
        <Match when={viewMode() === 'joja'}>
          <div class="bg-white border-2 border-[#a3c2e0] p-16 mt-16 relative">
            <div class="absolute top-16 left-16 text-6xl font-bold font-brains text-[#8fbde6] opacity-60 tracking-widest">
              Joja *
            </div>
            
            <div class="text-right text-[#8fbde6] font-bold mb-32">
              <div>Community Development Projects</div>
              <div class="border-b-2 border-[#8fbde6] inline-block pb-4">Pelican Town</div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 relative z-10 text-[#4d5c7a] font-bold font-brains text-title-h5">
              <For each={bundles}>
                {(b) => (
                  <label class="flex items-center justify-between cursor-pointer group">
                    <div class="flex items-center gap-12">
                      <input 
                        type="checkbox" 
                        checked={hasFlag(b.id)}
                        onChange={(e) => toggleFlag(b.id, e.target.checked)}
                        class="w-16 h-16 accent-[#4d5c7a] cursor-pointer"
                      />
                      <span class="group-hover:text-black transition-colors">{b.name}</span>
                    </div>
                    <div class="flex items-center w-1/2">
                      <div class="flex-grow border-b-2 border-dotted border-[#4d5c7a]/30 mx-8 mb-4"></div>
                      <span>{b.cost}</span>
                    </div>
                  </label>
                )}
              </For>
            </div>

            <div class="text-right mt-48 text-[#8fbde6] text-[28px] leading-[32px] font-bold">
              Prepared by: <span class="text-[#4d5c7a] font-serif italic text-title-h3">x Morris</span>
              <div class="w-192 h-2 bg-[#8fbde6] ml-auto mt-4"></div>
            </div>
          </div>
        </Match>

        <Match when={viewMode() === 'junimo'}>
          <div class="flex flex-col lg:flex-row gap-16 mt-16">
            
            {/* Sidebar Rooms */}
            <div class="w-full lg:w-160 shrink-0 flex flex-col gap-8">
              <For each={stardewBundles}>
                {(room, idx) => (
                  <button 
                    onClick={() => setSelectedRoomIndex(idx())}
                    class={`p-12 cursor-pointer border-4 rounded-8 text-left transition-transform font-bold text-title-h5 flex justify-between items-center ${selectedRoomIndex() === idx() ? 'bg-white border-[#c05b1c] scale-105 shadow-sm' : 'bg-[#e5a253] border-[#b34915] text-[#4d2503] hover:bg-[#efb571]'}`}
                  >
                    <span>{room.roomName}</span>
                    <Show when={selectedRoomIndex() === idx()}>
                      <ArrowRight size={20} class="text-[#c05b1c]" />
                    </Show>
                  </button>
                )}
              </For>
            </div>

            {/* Main Room View */}
            <div class="flex-1 bg-[#f4d499] border-[6px] border-[#c0733a] p-16 rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)]">
              {(() => {
                const room = stardewBundles[selectedRoomIndex()];
                return (
                  <div class="flex flex-col gap-16">
                    
                    <div class="flex items-center justify-between bg-white/50 p-12 rounded-8 border-2 border-[#c0733a]/50">
                      <div>
                        <h2 class="text-3xl font-serif font-black text-[#8c4614] mb-2">{room.roomName}</h2>
                        <div class="text-body-medium font-serif text-[#4d2503] font-bold">Reward: {room.rewardText}</div>
                      </div>
                      <label class="flex items-center gap-8 bg-white px-12 py-8 rounded-8 border-2 border-[#c05b1c] cursor-pointer hover:bg-orange-50 transition-colors shadow-sm group">
                        <input 
                          type="checkbox"
                          checked={hasFlag(room.rewardFlag)}
                          onChange={(e) => toggleFlag(room.rewardFlag, e.target.checked)}
                          class="w-20 h-20 accent-[#c05b1c] cursor-pointer"
                        />
                        <div class="flex flex-col">
                          <span class="text-[12px] font-bold text-black group-hover:text-[#c05b1c]">Room Complete Flag</span>
                          <span class="text-[10px] text-gray-500 font-serif">(Unlocks {room.rewardText})</span>
                        </div>
                      </label>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-16">
                      <For each={room.bundles}>
                        {(bundle) => (
                          <div class="bg-white border-4 rounded-8 p-12 flex flex-col relative" style={{ "border-color": bundle.color === "green" ? "#a4d252" : bundle.color === "yellow" ? "#e6c43c" : bundle.color === "orange" ? "#d88b3b" : bundle.color === "red" ? "#c25e5e" : bundle.color === "purple" ? "#b07ac4" : bundle.color === "cyan" ? "#52add2" : bundle.color === "blue" ? "#4a7bb5" : "#c0733a" }}>
                            
                            <h3 class="text-title-h5 font-bold font-brains mb-12 flex justify-between items-center border-b-2 pb-4" style={{ "border-color": bundle.color === "green" ? "#a4d252" : bundle.color === "yellow" ? "#e6c43c" : bundle.color === "orange" ? "#d88b3b" : bundle.color === "red" ? "#c25e5e" : bundle.color === "purple" ? "#b07ac4" : bundle.color === "cyan" ? "#52add2" : bundle.color === "blue" ? "#4a7bb5" : "#c0733a", "color": bundle.color === "green" ? "#52731c" : bundle.color === "yellow" ? "#8c731c" : bundle.color === "orange" ? "#8c4d1c" : bundle.color === "red" ? "#732929" : bundle.color === "purple" ? "#613b73" : bundle.color === "cyan" ? "#29698c" : bundle.color === "blue" ? "#254873" : "#8c4614" }}>
                              {bundle.name} Bundle
                              <span class="text-[10px] bg-black/5 px-6 py-2 rounded-full font-serif text-black/50">ID: {bundle.id}</span>
                            </h3>

                            <Show when={bundle.isMoney}>
                              <div class="flex items-center justify-center p-16 gap-8">
                                <ItemSprite name="Gold Coin" class="w-32 h-32" />
                                <span class="text-title-h3 font-bold">{bundle.moneyAmount} g</span>
                              </div>
                            </Show>

                            <div class="flex flex-wrap gap-8">
                              <For each={bundle.items}>
                                {(item, idx) => {
                                  const isChecked = () => isBundleItemCompleted(bundle.id, idx());
                                  return (
                                    <Tooltip text={`${item.name}${item.count ? ` (x${item.count})` : ''}`}>
                                      <button 
                                        onClick={() => toggleBundleItem(bundle.id, idx(), bundle.items.length)}
                                        class={`w-48 h-48 rounded flex items-center justify-center border-2 relative transition-transform hover:scale-110 cursor-pointer ${isChecked() ? 'bg-green-100 border-green-500 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-black/5 border-black/20 hover:border-black/40 hover:bg-white'}`}
                                      >
                                        <ItemSprite name={item.name} class="w-32 h-32" />
                                        
                                        <Show when={item.count && item.count > 1}>
                                          <div class="absolute -bottom-4 -right-4 bg-white border border-black/20 text-[10px] font-bold font-brains px-4 rounded shadow-sm text-[#8c4614]">
                                            {item.count}
                                          </div>
                                        </Show>
                                        
                                        <Show when={item.quality && item.quality > 0}>
                                          <div class="absolute -top-4 -left-4">
                                            <ItemSprite name={item.quality === 2 ? "Gold Quality Star" : "Silver Quality Star"} class="w-16 h-16" />
                                          </div>
                                        </Show>

                                        <Show when={isChecked()}>
                                          <div class="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded">
                                            <div class="bg-green-500 text-white rounded-full p-2 shadow-md">
                                              <Check size={16} strokeWidth={4} />
                                            </div>
                                          </div>
                                        </Show>
                                      </button>
                                    </Tooltip>
                                  );
                                }}
                              </For>
                            </div>

                          </div>
                        )}
                      </For>
                    </div>

                  </div>
                );
              })()}
            </div>

          </div>
        </Match>
      </Switch>

      </div>
    </Show>
  );
};