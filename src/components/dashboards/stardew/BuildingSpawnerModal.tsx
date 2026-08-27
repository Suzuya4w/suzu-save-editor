import { createSignal, createEffect, onCleanup, For, Show, createMemo } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X, Search } from 'lucide-solid';
import buildingsDataRaw from '../../../data/stardew/buildings.json';
import itemInfoRaw from '../../../data/stardew/iteminfo.json';
import floorsAndPathsRaw from '../../../data/stardew/floorsandpaths.json';
import { ItemSprite } from './ItemSprite';

interface BuildingSpawnerProps {
  isOpen: boolean;
  onSelectBuilding: (buildingData: any) => void;
  onClose: () => void;
}

const getSafeTextureUrl = (texturePath?: string) => {
  if (!texturePath) return '';
  const safePath = texturePath.replace(/\\/g, '/').replace('.png', '');
  return '/stardew/buildings/' + safePath + '.png';
};

export const BuildingSpawnerModal = (props: BuildingSpawnerProps) => {

  const [shouldRender, setShouldRender] = createSignal(props.isOpen);
  const [isVisible, setIsVisible] = createSignal(props.isOpen);
  const [activeTab, setActiveTab] = createSignal('Buildings');
  const [searchQuery, setSearchQuery] = createSignal('');

  let scrollRef: HTMLDivElement | undefined;

createEffect(() => {
    if (props.isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          props.onClose();
        }
      };
      window.addEventListener('keydown', handleEscape, true);
      
      onCleanup(() => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleEscape, true);
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const FORBIDDEN_SPAWNS = ["Farmhouse", "Greenhouse", "Pet Bowl", "Cave"];
  
const bList = (buildingsDataRaw as any[]).filter(b => {
    return !FORBIDDEN_SPAWNS.some(forbidden => 
      b.name.toLowerCase().includes(forbidden.toLowerCase())
    );
  }).map(b => ({ ...b, spawnCategory: 'Building', itemCategory: 'Building' }));

  const parsedItems = Object.entries(itemInfoRaw as any).map(([key, v]: [string, any]) => {

    const itemData = Array.isArray(v) ? (v[1] || v[0] || v) : v;

    return { ...itemData, _key: itemData._key || key };
  });

  const fList = parsedItems.filter((i: any) => i._type === 'Furniture' || i.type === 'Furniture').map((f: any) => ({
    ...f,
    itemId: f._key,
    spawnCategory: 'Furniture',
    itemCategory: 'Furniture',
    footprint: { X: f.tilesX || 1, Y: f.tilesY || 1 }
  }));
const oList = parsedItems.filter((i: any) => {
    const t1 = i._type;
    const t2 = i.type;
    const cat = i.category;
    const name = (i.name || '').toLowerCase();

    const isPlaceableObject = t1 === 'Object' && (cat === -8 || cat === -9 || t2 === 'Crafting' || name.includes('chest'));
    const isBigCraftable = t1 === 'BigCraftable' || t2 === 'BigCraftable';
    const isFloorOrPath = cat === -24 || name.includes('floor') || name.includes('path');

    return isPlaceableObject || isBigCraftable || isFloorOrPath;
  }).map((o: any) => {
    const isFloorOrPath = o.category === -24 || (o.name || '').toLowerCase().includes('floor') || (o.name || '').toLowerCase().includes('path');

    if (isFloorOrPath) {
        const fEntry = Object.values(floorsAndPathsRaw as any).find((f: any) => f.ItemId === o._key);
        if (fEntry) {
            return {
                ...o,
                itemId: o._key,
                spawnCategory: 'TerrainFeature',
                itemCategory: 'TerrainFeature',
                type: 'Flooring',
                whichFloor: (fEntry as any).Id,
                footprint: { X: 1, Y: 1 }
            };
        }
    }

    return {
      ...o,
      itemId: o._key,
      spawnCategory: 'Object',
      itemCategory: 'Object',
      footprint: { X: 1, Y: 1 }
    };
  });

  const itemsToDisplay = createMemo(() => {
    let list: any[] = [];
    if (activeTab() === 'Buildings') list = bList;
    else if (activeTab() === 'Furniture') list = fList;
    else if (activeTab() === 'Objects') list = oList;

    const q = searchQuery().toLowerCase();
    if (q) {
      list = list.filter(item => {
        const name = item.displayName?.replace(/\[.*?\]/g, '').trim() || item.name || '';
        return name.toLowerCase().includes(q);
      });
    }
    return list;
  });

  return (
    <Show when={shouldRender()}>
      <Portal>
        <div 
          class={`fixed inset-0 z-[200] flex items-center justify-center p-16 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVisible() ? "opacity-100 bg-black/95" : "opacity-0 bg-transparent"
          }`}
        >
          <div 
            class={`bg-[#fce8b8] w-full max-w-5xl h-[80vh] border-[6px] border-[#c0733a] rounded-12 flex flex-col font-serif overflow-hidden shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVisible() ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
            }`}
          >
            
            <div class="bg-[#c0733a] text-white p-12 px-16 flex items-center justify-between shadow-md border-b-4 border-[#8c4614]">
              <div class="flex items-center gap-8">
                <span class="text-2xl">{">>"}</span>
                <h2 class="text-xl font-bold font-pixsans tracking-wider mt-1">Build Menu</h2>
              </div>
              
              <div class="flex items-center gap-4 bg-black/20 rounded-8 p-4">
{['Buildings', 'Furniture', 'Objects'].map(tab => (
                  <button
                    onClick={() => { 
                      setActiveTab(tab); 
                      setSearchQuery(''); 
                      if (scrollRef) scrollRef.scrollTop = 0; 
                    }}
                    class={`px-12 py-6 rounded font-bold font-serif tracking-wider text-sm transition-colors cursor-pointer ${
                      activeTab() === tab ? 'bg-[#f4d499] text-[#8c4614]' : 'hover:bg-white/10 text-white'
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              <div class="flex items-center gap-8">
                <div class="relative flex items-center">
                  <Search class="absolute left-8 text-black/50" size={16} />
<input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      props.onClose();
                    }
                  }}
                  class="pl-32 pr-8 py-6 rounded bg-[#f4d499] border-2 border-[#8c4614] text-black font-brains font-bold focus:outline-none focus:border-[#4d2503] text-sm w-[200px]"
                />
                </div>
                <button onClick={props.onClose} class="hover:bg-black/20 p-4 rounded transition-colors cursor-pointer">
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
            </div>

{/* FIX 4: Pasang ref di container scroll ini */}
            <div ref={scrollRef} class="flex-1 overflow-y-auto stardew-scrollbar p-16 bg-black/5 relative">
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-12">
                <For each={itemsToDisplay()}>
                  {(b) => {
                    const texName = b.displayName?.replace(/\[.*?\]/g, '').trim() || b.name;
                    
                    let cropW = 16, cropH = 16, scale = 2;
                    if (b.spawnCategory === 'Building') {
                      const srcRect = b.sourceRect || { X: 0, Y: 0, Width: 0, Height: 0 };
                      cropW = srcRect.Width; cropH = srcRect.Height;
                      if (cropW === 0 || cropH === 0) {
                        cropW = b.footprint.X * 16;
                        cropH = b.textureSize?.Y || (b.footprint.Y * 16);
                      }
                      scale = Math.min(1, 64 / cropW, 64 / cropH);
                    }

                    return (
                      <button
                        onClick={() => {
                          props.onSelectBuilding(b);
                          props.onClose();
                        }}
                        class="bg-[#f4d499] border-2 border-[#c0733a] rounded-8 flex flex-col items-center justify-start p-12 hover:bg-[#e6c485] hover:border-[#8c4614] hover:scale-105 transition-all shadow-sm cursor-pointer group h-[160px]"
                      >
                        <div class="w-full h-[72px] flex items-center justify-center shrink-0 mb-4">
                           {/* FIX 5: Hanya gunakan fallback Stardew default untuk BUILDING.
                               Lempar itemId ke ItemSprite agar gambar Furniture & Object akurat. */}
<Show 
                             when={b.spawnCategory === 'Building' && b.texture} 
                             fallback={<ItemSprite name={b.name} itemId={b.itemId || b._key} type={b._type || b.type} class="transform scale-[2]" />}
                           >
                             <div 
                               style={{
                                 "width": `${cropW}px`, "height": `${cropH}px`,
                                 "background-image": `url('${getSafeTextureUrl(b.texture)}')`,
                                 "background-position": `-${b.sourceRect?.X || 0}px -${b.sourceRect?.Y || 0}px`,
                                 "background-repeat": "no-repeat", "image-rendering": "pixelated",
                                 "transform": `scale(${scale})`, "transform-origin": "center center"
                               }}
                             />
                           </Show>
                        </div>
                        <div class="flex flex-col items-center justify-start flex-1 gap-4 w-full">
                          <span class="text-[12px] font-bold text-center text-[#4d2503] leading-tight line-clamp-2 text-shadow-sm">
                            {texName}
                          </span>
                          <span class="text-[10px] text-black/50 font-brains mt-auto">
                            {b.footprint?.X || 1}x{b.footprint?.Y || 1}
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
              <Show when={itemsToDisplay().length === 0}>
                <div class="flex items-center justify-center h-full text-black/40 font-bold font-pixsans text-xl">
                  No items found
                </div>
              </Show>
            </div>

          </div>
        </div>
      </Portal>
    </Show>
  );
};
