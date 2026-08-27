// @ts-nocheck
import { createSignal, createMemo, createDeferred, For, Index, onMount, onCleanup, createEffect, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X, Search } from 'lucide-solid';
import { createVirtualizer } from '@tanstack/solid-virtual';
import itemInfoRaw from '../../../data/stardew/iteminfo.json';
import { ItemSprite } from './ItemSprite';

interface ItemSpawnerModalProps {
  isOpen: boolean;
  onSpawn: (itemXml: any) => void;
  onClose: () => void;
  typeFilter?: string[];
}

export const ItemSpawnerModal = (props: ItemSpawnerModalProps) => {

  const [shouldRender, setShouldRender] = createSignal(props.isOpen);
  const [isVisible, setIsVisible] = createSignal(props.isOpen);

  createEffect(() => {
    if (props.isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      onCleanup(() => clearTimeout(timer));
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const [search, setSearch] = createSignal('');
  const deferredSearch = createDeferred(search);

  const allItems = createMemo(() => {
    let items = (itemInfoRaw as any[]).filter(tuple => tuple && tuple[1] && tuple[1].name && typeof tuple[1].name === 'string' && tuple[1].name !== 'Combined Ring');
    if (props.typeFilter && props.typeFilter.length > 0) {
      items = items.filter(tuple => {
         const t1 = tuple[1]._type;
         const t2 = tuple[1].type;
         
         if (props.typeFilter!.includes('Clothing') && (t1 === 'Shirt' || t1 === 'Pants' || t1 === 'Clothing')) return true;
         if ((props.typeFilter!.includes('Ring') || props.typeFilter!.includes('CombinedRing')) && (t1 === 'Ring' || t2 === 'Ring' || t1 === 'CombinedRing')) return true;
         
         return props.typeFilter!.includes(t1) || props.typeFilter!.includes(t2);
      });
    }
    return items;
  });

  const filteredItems = createMemo(() => {
    const s = deferredSearch().toLowerCase();
    let results = allItems();
    if (s) {
      results = results.filter(tuple => tuple[1].name.toLowerCase().includes(s));
    }
    return results;
  });

const handleSpawn = (tuple: any) => {
    const itemData = tuple[1];
    const typeStr = itemData._type || 'Object';

let xsiType = "Object";
if (typeStr === 'Tool') xsiType = itemData.className || itemData.class || itemData.name.split(' ').pop() || "Tool";
    
    else if (typeStr === 'Weapon') xsiType = itemData.name.includes('Slingshot') ? "Slingshot" : "MeleeWeapon";
    else if (typeStr === 'Ring') xsiType = "Ring";
    else if (typeStr === 'Hat') xsiType = "Hat";
    else if (typeStr === 'Boots') xsiType = "Boots";
    else if (typeStr === 'Clothing' || typeStr === 'Shirt' || typeStr === 'Pants') xsiType = "Clothing";
    else if (typeStr === 'Trinket') xsiType = "Trinket";
    else if (typeStr === 'Furniture') {
      if (itemData.name && itemData.name.toLowerCase().includes('bed')) xsiType = "BedFurniture";
      else if (itemData.name && itemData.name.toLowerCase().includes('tank')) xsiType = "FishTankFurniture";
      else xsiType = "Furniture";
    }

    let upgradeLevel = itemData.upgradeLevel !== undefined ? itemData.upgradeLevel : 0;
    if (itemData.name.includes("Copper")) upgradeLevel = 1;
    else if (itemData.name.includes("Steel")) upgradeLevel = 2;
    else if (itemData.name.includes("Gold")) upgradeLevel = 3;
    else if (itemData.name.includes("Iridium")) upgradeLevel = 4;

    const newItem: any = {
      "@xsi:type": xsiType,
      "isLostItem": "false",
      "category": String(itemData.category || -2),
      "hasBeenInInventory": "true",
      "name": itemData.name,
      "id": String(itemData._key || tuple[0]),
      "itemId": String(itemData._key || tuple[0]),
      "ItemId": String(itemData._key || tuple[0]),
      "specialItem": "false",
      "isRecipe": "false",
      "quality": "0",
      "stack": "1",
      "SpecialVariable": "0"
    };

    if (['Tool', 'Axe', 'Pickaxe', 'Hoe', 'WateringCan', 'FishingRod', 'Pan', 'Shears', 'MilkPail', 'Wand', 'Lantern', 'GenericTool'].includes(xsiType) || typeStr === 'Tool') {

      let menuIndex = (itemData.menuSpriteIndex !== undefined && itemData.menuSpriteIndex !== -1) 
          ? itemData.menuSpriteIndex 
          : (itemData.spriteIndex || 0);
          
      let spriteIndex = itemData.spriteIndex || 0;
      
      if (xsiType === 'Axe') {
        menuIndex = [215, 222, 229, 257, 264][upgradeLevel];
        spriteIndex = [189, 196, 203, 231, 238][upgradeLevel];
      } else if (xsiType === 'Pickaxe') {
        menuIndex = [131, 138, 145, 173, 180][upgradeLevel];
        spriteIndex = [105, 112, 119, 147, 154][upgradeLevel];
      } else if (xsiType === 'Hoe') {
        menuIndex = [47, 54, 61, 89, 96][upgradeLevel];
        spriteIndex = [21, 28, 35, 63, 70][upgradeLevel];
      } else if (xsiType === 'WateringCan') {
        menuIndex = [296, 303, 310, 338, 345][upgradeLevel];
        spriteIndex = [273, 280, 287, 315, 322][upgradeLevel];
      }

      newItem.initialParentTileIndex = String(spriteIndex);
      newItem.currentParentTileIndex = String(spriteIndex);
      newItem.indexOfMenuItemView = String(menuIndex);
      newItem.instantUse = "false";
      newItem.isEfficient = "false";
      newItem.animationSpeedModifier = "1";
      newItem.swingTicker = "0";
      newItem.upgradeLevel = String(upgradeLevel);
      newItem.numAttachmentSlots = String(itemData.attachmentSlots || 0);
      newItem.attachments = {};

      newItem.InitialParentTileIndex = String(spriteIndex);
      newItem.IndexOfMenuItemView = String(menuIndex);
      newItem.InstantUse = "false";
      newItem.IsEfficient = "false";
      newItem.AnimationSpeedModifier = "1";
      newItem.BaseName = itemData.name;
      newItem.additionalPower = { int: "0" };
    }

    if (xsiType === 'MeleeWeapon') {
      newItem.type = String(itemData.weaponType || 3);
      newItem.minDamage = String(itemData.minDamage || 1);
      newItem.maxDamage = String(itemData.maxDamage || 2);
      newItem.speed = String(itemData.speed || 0);
      newItem.addedPrecision = String(itemData.addedPrecision || 0);
      newItem.addedDefense = String(itemData.addedDefense || 0);
      newItem.knockback = String(itemData.knockback || 1);
      newItem.critChance = String(itemData.critChance || 0.02);
      newItem.critMultiplier = String(itemData.critMultiplier || 3);
      newItem.areaOfEffect = String(itemData.areaOfEffect || 0);
      newItem.isOnSpecial = "false";
    }

    if (xsiType === 'Clothing') {
      newItem.clothesType = String(typeStr === 'Pants' ? 1 : (typeStr === 'Shirt' ? 0 : (itemData.clothesType || 1)));
      newItem.dyeable = String(itemData.canBeDyed || "false");
      
      let r = "255", g = "255", b = "255";
      if (itemData.defaultColor) {
        const parts = String(itemData.defaultColor).split(/[ ,]+/);
        if (parts.length >= 3) {
          r = parts[0]; g = parts[1]; b = parts[2];
        }
      }
      newItem.clothesColor = { "R": r, "G": g, "B": b, "A": "255" };
      
      newItem.isPrismatic = String(itemData.isPrismatic || "false");
      newItem.price = String(itemData.salePrice || itemData.price || 50);
      newItem.indexInTileSheet = String(itemData.spriteIndex !== undefined ? itemData.spriteIndex : (itemData.sheetIndex !== undefined ? itemData.sheetIndex : (itemData._key || tuple[0])));
    }

    if (xsiType === 'Boots') {
      newItem.defenseBonus = String(itemData.defenseBonus !== undefined ? itemData.defenseBonus : (itemData.defense || 0));
      newItem.immunityBonus = String(itemData.immunityBonus !== undefined ? itemData.immunityBonus : (itemData.immunity || 0));
      newItem.appliedBootSheetIndex = "-1";
      newItem.indexInTileSheet = String(itemData.spriteIndex !== undefined ? itemData.spriteIndex : (itemData.sheetIndex !== undefined ? itemData.sheetIndex : (itemData._key || tuple[0])));
      newItem.indexInColorSheet = String(itemData.colorIndex || 0);
      newItem.price = String(itemData.price || itemData.salePrice || 50);
    }

    if (xsiType === 'Hat') {
      newItem.isPrismatic = "false";
      newItem.hairDrawType = "0";
      newItem.ignoreHairstyleOffset = "false";
    }

if (xsiType === 'Furniture' || xsiType === 'BedFurniture' || xsiType === 'FishTankFurniture') {
      const tX = itemData.tilesX || 1;
      const tY = itemData.tilesY || 1;

      newItem.isOn = "false";
      newItem.category = "-24";
      const itemIdStr = String(itemData._key || tuple[0]);
      const isNumeric = !isNaN(Number(itemIdStr));
      const sheetIndex = itemData.spriteIndex !== undefined ? itemData.spriteIndex : (itemData.sheetIndex !== undefined ? itemData.sheetIndex : itemIdStr);
      if (isNumeric) {
        newItem.parentSheetIndex = String(sheetIndex); 
      }

      newItem.furniture_type = String(itemData.type === 'painting' ? 6 : (itemData.name.toLowerCase().includes('bed') ? 14 : (itemData.type === 'rug' ? 12 : 0)));
      newItem.rotations = String(itemData.rotations || 1);
      newItem.currentRotation = "0";

      newItem.defaultBoundingBox = {
        X: "0", Y: "0",
        Width: String(tX * 64),
        Height: String(tY * 64)
      };
      newItem.boundingBox = {
        X: "0", Y: "0",
        Width: String(tX * 64),
        Height: String(tY * 64)
      };

const spriteId = parseInt(sheetIndex, 10) || 0;

let sheetUrl = 'furniture.png';
if (itemData.texture) {
  const filename = itemData.texture.split(/[/\\]/).pop();
  sheetUrl = `${filename}.png`;
}

const widths: Record<string, number> = {
  "furniture.png": 512, "furniture_2.png": 256, "furniture_3.png": 208, 
  "joja_furniture.png": 208, "junimo_furniture.png": 208, "retro_furniture.png": 208, "wizard_furniture.png": 208, "FreeCactuses.png": 128
};

const textureWidth = widths[sheetUrl] || 512;
const cols = textureWidth / 16;

const srcX = (spriteId % cols) * 16;
const srcY = Math.floor(spriteId / cols) * 16;

      newItem.sourceRect = {
        X: String(srcX),
        Y: String(srcY),
        Width: String(tX * 16),
        Height: String(tY * 16)
      };
      newItem.defaultSourceRect = {
        X: String(srcX),
        Y: String(srcY),
        Width: String(tX * 16),
        Height: String(tY * 16)
      };

      if (xsiType === 'BedFurniture') {
        newItem.bedType = itemData.type === 'bed double' ? 'Double' : (itemData.type === 'bed child' ? 'Child' : 'Single');
      }
    }

    if (['Object', 'Ring', 'Trinket'].includes(xsiType)) {
      const itemIdStr = String(itemData._key || tuple[0]);
      const isNumeric = !isNaN(Number(itemIdStr));
      const sheetIndex = itemData.sheetIndex !== undefined ? itemData.sheetIndex : (itemData.spriteIndex !== undefined ? itemData.spriteIndex : itemIdStr);
      if (isNumeric) {
        newItem.parentSheetIndex = String(sheetIndex);
      }
      newItem.owner = "0";
      newItem.type = itemData.type || "Basic";
      newItem.canBeSetDown = "true";
      newItem.canBeGrabbed = "true";
      newItem.isSpawnedObject = "false";
      newItem.questItem = "false";
      newItem.isOn = "true";
      newItem.fragility = "0";
      newItem.price = String(itemData.price || itemData.salePrice || 0);
      newItem.edibility = String(itemData.edibility || -300);
      newItem.bigCraftable = typeStr === 'BigCraftable' ? "true" : "false";
      newItem.setOutdoors = "false";
      newItem.setIndoors = "false";
      newItem.readyForHarvest = "false";
      newItem.showNextIndex = "false";
      newItem.flipped = "true";
      newItem.isLamp = "false";
      newItem.minutesUntilReady = "0";
      newItem.destroyOvernight = "false";
    }
    
    props.onSpawn(newItem);
  };

  const [searchInput, setSearchInput] = createSignal<HTMLInputElement>();
  const [scrollContainer, setScrollContainer] = createSignal<HTMLDivElement>();
  
  const [containerWidth, setContainerWidth] = createSignal(0);

  const columns = createMemo(() => {
    const w = containerWidth();
    if (w >= 1024) return 5;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    if (w > 0) return 2;
    return 5;
  });

  const rowCount = createMemo(() => Math.ceil(filteredItems().length / columns()));

  const rowVirtualizer = createVirtualizer({
    get count() { return rowCount(); },
    getScrollElement: () => scrollContainer() || null,
    estimateSize: () => 140,
    overscan: 5,
  });

  createEffect(() => {
    const container = scrollContainer();
    if (container) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(container);
      onCleanup(() => resizeObserver.disconnect());
    }
  });

  createEffect(() => {
    const input = searchInput();
    if (input && isVisible()) {
      setTimeout(() => input.focus(), 50);
    }
  });

  createEffect(() => {
    if (shouldRender()) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') props.onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
    }
  });

return (
    <Show when={shouldRender()}>
      <Portal>
        <div 
          class={`fixed inset-0 z-[200] flex items-center justify-center p-16 md:p-32 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVisible() ? "opacity-100 bg-black/95" : "opacity-0 bg-transparent"
          }`}
        >
          <div 
            class={`bg-[#fce8b8] w-full max-w-4xl max-h-[90vh] border-[6px] border-[#c0733a] rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2),_0_10px_25px_rgba(0,0,0,0.5)] flex flex-col font-serif overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVisible() ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
            }`}
          >
            
            {/* Header */}
            <div class="bg-[#c0733a] text-white p-12 px-16 flex items-center justify-between shrink-0 shadow-md z-10 border-b-4 border-[#8c4614]">
              <h2 class="text-xl font-bold font-pixsans tracking-wider text-shadow-sm flex items-center gap-8">
                <span class="text-2xl">✨</span> Item Spawner
              </h2>
              <button 
                onClick={props.onClose}
                class="text-white cursor-pointer hover:text-[#fce8b8] transition-colors p-4 rounded hover:bg-black/20"
              >
                <X size={24} strokeWidth={3} />
              </button>
            </div>

        {/* Search */}
        <div class="p-16 bg-[#f4d499] border-b-2 border-black/10 shrink-0">
          <div class="relative max-w-md mx-auto">
            <div class="absolute inset-y-0 left-0 pl-12 flex items-center pointer-events-none">
              <Search class="text-[#c0733a]" size={20} />
            </div>
            <input
              ref={setSearchInput}
              type="text"
              placeholder="Search items by name..."
              value={search()}
              onInput={(e) => setSearch(e.target.value)}
              class="w-full bg-white border-2 border-[#c0733a] rounded-8 py-8 pl-40 pr-16 font-brains font-bold text-black shadow-inner focus:outline-none focus:border-[#8c4614]"
            />
          </div>
        </div>

        {/* Grid */}
        <div ref={setScrollContainer} class="flex-1 overflow-y-auto p-16 stardew-scrollbar bg-black/5 relative"> {/* <-- Ubah di sini */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <For each={rowVirtualizer.getVirtualItems()}>
              {(virtualRow) => {
                return (
                  <div
                    class="absolute top-0 left-0 w-full grid gap-8"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      "grid-template-columns": `repeat(${columns()}, minmax(0, 1fr))`
                    }}
                  >
                    <Index each={filteredItems().slice(virtualRow.index * columns(), virtualRow.index * columns() + columns())}>
                      {(tupleAccessor) => (
                        <button
                          onClick={() => handleSpawn(tupleAccessor())}
                          class="bg-[#f4d499] border-2 border-[#c0733a] rounded flex flex-col items-center justify-center p-8 gap-8 hover:bg-[#e6c485] hover:border-[#8c4614] hover:scale-105 transition-all shadow-sm cursor-pointer group h-[120px]"
                        >
                          <div class="w-48 h-48 flex items-center justify-center bg-white/50 rounded-full border border-black/10 group-hover:bg-white transition-colors shrink-0">
                            <ItemSprite 
                              name={tupleAccessor()[1].name} 
                              itemId={tupleAccessor()[1]._key || tupleAccessor()[0]} 
                              type={tupleAccessor()[1]._type} 
                              class="w-32 h-32" 
                            />
                          </div>
                          <span class="text-[12px] font-bold text-center leading-tight min-h-[2.5em] flex items-center text-shadow-sm text-[#4d2503] line-clamp-2">
                            {tupleAccessor()[1].name}
                          </span>
                        </button>
                      )}
                    </Index>
                  </div>
                );
              }}
            </For>
          </div>
          
          {filteredItems().length === 0 && (
            <div class="py-32 text-center text-black/40 font-bold w-full">
              No items found matching "{search()}"
            </div>
          )}
        </div>
        
      </div>
    </div>
    </Portal>
    </Show>
  );
};