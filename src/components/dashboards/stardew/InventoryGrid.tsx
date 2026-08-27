// @ts-nocheck
import { createSignal, createMemo, Show, Index, For } from 'solid-js';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import itemInfoRaw from '../../../data/stardew/iteminfo.json';
import { ItemSpawnerModal } from './ItemSpawnerModal';

const itemMapById = new Map<string, any>();
const itemMapByIdAndType = new Map<string, any>();
(itemInfoRaw as any[]).forEach((tuple: any) => {
  if (tuple && tuple[1] && tuple[1]._key) {
    const key = String(tuple[1]._key);
    itemMapById.set(key, tuple[1]);
    
    const type = tuple[1]._type || 'Object';
    itemMapByIdAndType.set(`${type}_${key}`, tuple[1]);
  }
});

const ensureArray = (obj: any): any[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return [obj];
};

const getText = (val: any): string => {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) return getText(val[0]);
  if (typeof val === 'object') {
    if (val['$text']) return String(val['$text']);
    if (val['$value']) return String(val['$value']);
    if (val['#text']) return String(val['#text']);
    if (val['text']) return String(val['text']);
    return '';
  }
  return String(val);
};

const StatInput = (props: { value: number, step?: string, onChange: (val: number) => void }) => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleInput = (e: any) => {
      const val = props.step ? parseFloat(e.currentTarget.value) : parseInt(e.currentTarget.value, 10);
      if (isNaN(val)) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => props.onChange(val), 500);
    };

    return (
      <input 
        type="number" 
        value={props.value}
        step={props.step || "1"}
        onInput={handleInput}
        class="w-full bg-transparent border-none text-white text-right font-brains focus:outline-none transition-colors focus:text-yellow-400 cursor-text"
      />
    );
  };

const DyeColorPicker = (props: { colorObj: any, onChange: (r: number, g: number, b: number) => void }) => {
  const storeHex = () => {
    const r = parseInt(getText(props.colorObj?.R) || '255', 10) & 255;
    const g = parseInt(getText(props.colorObj?.G) || '255', 10) & 255;
    const b = parseInt(getText(props.colorObj?.B) || '255', 10) & 255;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const [localHex, setLocalHex] = createSignal<string | null>(null);
  const display = () => localHex() !== null ? localHex()! : storeHex();

  return (
    <input 
      type="color"
      value={display()}
      onInput={(e) => setLocalHex(e.target.value)}
      onChange={(e) => {
        setLocalHex(null);
        const hex = e.target.value;
        props.onChange(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
      }}
      class="w-32 h-32 rounded border-none cursor-pointer bg-transparent p-0"
    />
  );
};

export const InventoryGrid = (props: { selectedEquipmentPath?: string | null, onClearEquipmentSelection?: () => void }) => {
  const store = useEditorStore();
  
  const [selectedSlot, setSelectedSlot] = createSignal<number | null>(null);
  const [isSpawnerOpen, setIsSpawnerOpen] = createSignal(false);

  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();
  
  const rawItems = () => {
    let rItems = player()?.items?.Item || player()?.items;
    if (rItems && typeof rItems === 'object' && !Array.isArray(rItems) && rItems.Item) {
        return rItems.Item;
    }
    return rItems;
  };
  const items = () => ensureArray(rawItems());

  const paddedItems = createMemo(() => {
    return Array.from({ length: Math.max(36, items().length) }, (_, i) => items()[i] || null);
  });

  const basePath = () => pv()?.SaveGame?.player ? 'SaveGame.player.items.Item' : (pv()?.player ? 'player.items.Item' : 'items.Item');

  const resolvePath = (obj: any, path: string) => {
     return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };
  
  const equipmentItem = () => props.selectedEquipmentPath ? resolvePath(pv(), props.selectedEquipmentPath) : null;

  const selectedItem = createMemo(() => props.selectedEquipmentPath ? equipmentItem() : (selectedSlot() !== null ? items()[selectedSlot()!] : null));
  const isSelectedNil = () => selectedItem() && (selectedItem()!['@_xsi:nil'] === 'true' || selectedItem()!['@xsi:nil'] === 'true');
  const itemUpdateBasePath = () => props.selectedEquipmentPath ? props.selectedEquipmentPath : `${basePath()}.${selectedSlot()}`;

  const getSpriteInfo = (item: any): any => {
    if (!item) return null;

    const xsiType = item['@_xsi:type'] || item['@xsi:type'] || item['xsi:type'];
    const combinedData = item.combinedRings || item.CombinedRings;
    if (xsiType === 'CombinedRing' && combinedData) {
        const items = combinedData.Item || combinedData.Ring;
        if (items) {
          let rings = Array.isArray(items) ? items : [items];
          if (rings.length >= 2) {
             let r1 = getSpriteInfo(rings[0]);
             let r2 = getSpriteInfo(rings[1]);
             if (r1 && r2) {
                 return { isCombinedRing: true, innerSprites: [r1, r2], spriteWidth: 16, spriteHeight: 16, gridScale: 2, detailScale: 3 };
             }
          }
        }
    }
    
    let expectedType = '';
    if (props.selectedEquipmentPath && item === equipmentItem()) {
       if (props.selectedEquipmentPath.includes('hat')) expectedType = 'Hat';
       else if (props.selectedEquipmentPath.includes('shirt')) expectedType = 'Clothing';
       else if (props.selectedEquipmentPath.includes('pants')) expectedType = 'Pants';
       else if (props.selectedEquipmentPath.includes('Ring')) expectedType = 'Ring';
       else if (props.selectedEquipmentPath.includes('boots')) expectedType = 'Boots';
       else if (props.selectedEquipmentPath.toLowerCase().includes('trinket')) expectedType = 'Trinket';
    }

    let type = item['@type'] || item['@_xsi:type'] || item['@xsi:type'] || item['xsi:type'] || getText(item.type) || expectedType;

    const isBigCraftable = getText(item.bigCraftable) === 'true' || getText(item.BigCraftable) === 'true';
    if (isBigCraftable) {
        type = 'BigCraftable';
    }

    let sheetUrl = '/stardew/springobjects.png';
    let columns = 24;
    let blockWidth = 16;
    let blockHeight = 16;
    let spriteWidth = 16;
    let spriteHeight = 16;
    let textureWidth: number | undefined = undefined;
    let idStr = '';

    let itemIdVal = getText(item.itemId) || getText(item.ItemId);
    if (itemIdVal) {
        itemIdVal = String(itemIdVal).replace(/^\([a-zA-Z]+\)/, '');
    }
    
    if (itemIdVal && itemIdVal !== '-1') {
        idStr = itemIdVal;
    }

    if ((!idStr || idStr === '-1') && (type === 'Clothing' || type === 'Hat' || type === 'Boots')) {
        idStr = getText(item.indexInTileSheet);
    }

    let menuViewStr = getText(item.indexOfMenuItemView) || getText(item.IndexOfMenuItemView);
    if (!idStr || idStr === '-1') {
        idStr = (menuViewStr && menuViewStr !== '-1') ? menuViewStr : (
                getText(item.parentSheetIndex) || 
                getText(item.ParentSheetIndex) ||
                getText(item.initialParentTileIndex) || 
                getText(item.which)
        );
    }

    const itemName = getText(item.name) || getText(item.Name) || '';
    let isPants = getText(item.clothesType) === '1' || getText(item.ClothesType) === '1';
    
    let isSelectedEquipmentPants = props.selectedEquipmentPath && props.selectedEquipmentPath.toLowerCase().includes('pants') && item === equipmentItem();
    let rawItemId = String(getText(item.itemId) || getText(item.ItemId) || '').toLowerCase();
    if (itemName.includes('Pants') || isSelectedEquipmentPants || rawItemId.includes('pants')) {
        isPants = true;
    }

    if (isPants || expectedType === 'Pants' || type === 'Pants') {
        type = 'Clothing';
        isPants = true;
    }
    if (type === 'Shirt') {
        type = 'Clothing';
    }

    const cleanIdStr = idStr ? String(idStr).replace(/^\([a-zA-Z]+\)/, '') : '0';
    let id = parseInt(cleanIdStr, 10);

    let lookupType = type;
    if (type === 'Clothing') {
        lookupType = isPants ? 'Pants' : 'Shirt';
    } else if (!lookupType || lookupType === 'Unknown' || lookupType === '') {
        lookupType = 'Object';
    }
    
    let info = itemMapByIdAndType.get(`${lookupType}_${cleanIdStr}`);
    if (!info) info = itemMapById.get(cleanIdStr);

    if (info && info._type && (!type || type === 'Unknown' || type === 'Object' || type === '' || type === 'Scepter')) {
        type = info._type;
    }
    
    if (type === 'Pants') {
        type = 'Clothing';
        isPants = true;
    }
    if (type === 'Shirt') {
        type = 'Clothing';
    }
    
    if (info) {
        let actualIndex = (info.menuSpriteIndex !== undefined && info.menuSpriteIndex !== -1) ? info.menuSpriteIndex : info.spriteIndex;
        if (actualIndex !== undefined) {
            id = actualIndex;
        }
    }
    
    if (type === 'Weapon' || type === 'MeleeWeapon') {
      sheetUrl = '/stardew/weapons.png';
      columns = 8;
} else if (['Axe', 'Pickaxe', 'Hoe', 'WateringCan', 'FishingRod', 'Pan', 'Shears', 'MilkPail', 'Wand', 'Lantern', 'GenericTool', 'Tool'].includes(type)) {
    sheetUrl = '/stardew/tools.png';
      columns = 21;
    } else if (type === 'Boots') {
      sheetUrl = '/stardew/springobjects.png';
    } else if (type === 'Hat') {
      sheetUrl = '/stardew/hats.png';
      columns = 12;
      blockWidth = 20;
      blockHeight = 80;
      spriteWidth = 20;
      spriteHeight = 20;
    } else if (type === 'Clothing') {
      if (isPants) {
         sheetUrl = '/stardew/pants.png';
         columns = 10;
         blockWidth = 192;
         blockHeight = 688;
         spriteWidth = 16;
         spriteHeight = 16;
      } else {
         sheetUrl = '/stardew/shirts.png';
         columns = 16;
         blockWidth = 8;
         blockHeight = 32;
         spriteWidth = 8;
         spriteHeight = 8;
         textureWidth = 256;
      }
} else if (type === 'Ring') {
      sheetUrl = '/stardew/springobjects.png';

    } else if (type === 'BigCraftable') {
      sheetUrl = '/stardew/Craftables.png';
      columns = 8;
      blockWidth = 16;
      blockHeight = 32;
      spriteWidth = 16;
      spriteHeight = 32;

    } else if (type === 'Furniture' || type === 'BedFurniture' || type === 'FishTankFurniture') {
      if (info && info.texture) {
         const filename = info.texture.split(/[/\\]/).pop();
         sheetUrl = `/stardew/${filename}.png`;
      } else {
         sheetUrl = '/stardew/furniture.png';
      }
      const widths: Record<string, number> = {
         "furniture.png": 512, "furniture_2.png": 256, "furniture_3.png": 208, 
         "joja_furniture.png": 208, "junimo_furniture.png": 208, "retro_furniture.png": 208, "wizard_furniture.png": 208, "FreeCactuses.png": 128
      };
      const tw = widths[sheetUrl.split('/').pop() || "furniture.png"] || 512;
      columns = tw / 16;
      spriteWidth = (info?.tilesX || 1) * 16;
      spriteHeight = (info?.tilesY || 1) * 16;
      blockWidth = 16;
      blockHeight = 16;

    } else if (type === 'Trinket') {
      sheetUrl = '/stardew/Objects_2.png';
      columns = 8;
      if (isNaN(id)) {
          id = info?.sheetIndex ?? (info?.spriteIndex ?? 0);
      }
    }
    
    const rawItemIdStr = String(getText(item.itemId) || getText(item.ItemId) || '').toLowerCase();
    const itemNameStr = (getText(item.name) || getText(item.Name) || '').toLowerCase();

if (['Axe', 'Pickaxe', 'Hoe', 'WateringCan', 'FishingRod', 'Pan', 'Shears', 'MilkPail', 'Wand', 'Lantern', 'GenericTool', 'Tool'].includes(type) && isNaN(id)) {
        let menuIdx = getText(item.indexOfMenuItemView) || getText(item.IndexOfMenuItemView);
        let toolIdStr = (menuIdx && menuIdx !== '-1') ? menuIdx : (getText(item.initialParentTileIndex) || getText(item.upgradeLevel));
        id = parseInt(toolIdStr, 10);
    }

    const upgradeLevel = parseInt(getText(item.upgradeLevel) || getText(item.UpgradeLevel), 10) || 0;
    if (type === 'Pan') {
        if (upgradeLevel === 2) id = 18;
        else if (upgradeLevel === 3) id = 19;
        else if (upgradeLevel === 4) id = 20;
        else id = 12;
    }

    if ((isNaN(id) || !idStr) && type !== 'Clothing') return null;
    if (id < 0 && type === 'Clothing') id = 0; 
    if (isNaN(id) && type === 'Clothing') id = 0;

if (sheetUrl === '/stardew/tools.png') {
    const itemNameStr = (getText(item.name) || getText(item.Name) || '').toLowerCase();
    
    if (itemNameStr.includes('lantern')) {
        id = 3;
    } else if (itemNameStr.includes('trash can')) {
        const upgLevel = parseInt(getText(item.upgradeLevel) || getText(item.UpgradeLevel) || '0', 10);
        id = 13 + upgLevel;
    } else if (itemNameStr.includes('return scepter')) {
        id = 2;
    }
}

    const x = (id % columns) * blockWidth;
    let y = Math.floor(id / columns) * blockHeight;
    if (isPants) y += 14; 

    const maskX = type === 'Clothing' && !isPants ? x + 128 : x;
    const maskY = y;

    const gridScale = 32 / Math.max(spriteWidth, spriteHeight);
    const detailScale = 48 / Math.max(spriteWidth, spriteHeight);

    const isPrismatic = 
      itemName.includes('Prismatic') || 
      rawItemId.includes('prismatic') ||
      itemName.includes('Galaxy') || 
      (type === 'Clothing' && getText(item.prismatic) === 'true') ||
      (type === 'Hat' && getText(item.isPrismatic) === 'true') ||
      (itemName.includes('Magic') && itemName.includes('Hair'));

let finalItemId = info ? info._key : idStr;
    
    if (['Axe', 'Pickaxe', 'Hoe', 'WateringCan'].includes(type as string)) {
        const prefixes = ['', 'Copper', 'Steel', 'Gold', 'Iridium'];

        finalItemId = `${prefixes[upgradeLevel] || ''}${type}`;
        
    } else if (type === 'Pan') {
        const prefixes = ['', '', 'Steel', 'Gold', 'Iridium'];
        finalItemId = `${prefixes[upgradeLevel] || ''}Pan`;
    } else if (type === 'FishingRod') {
        const rodKeys = ['BambooPole', 'TrainingRod', 'FiberglassRod', 'IridiumRod', 'AdvancedIridiumRod'];
        finalItemId = rodKeys[upgradeLevel] || 'BambooPole';
    }

let imageCategory = info ? info._type : type;
if (['Axe', 'Pickaxe', 'Hoe', 'WateringCan', 'FishingRod', 'Pan', 'Shears', 'MilkPail', 'Wand', 'Lantern', 'GenericTool'].includes(imageCategory as string)) {
    imageCategory = 'Tool';
    } else if (imageCategory === 'MeleeWeapon') {
        imageCategory = 'Weapon';
    }

    return { 
      sheetUrl, x, y, spriteWidth, spriteHeight, gridScale, detailScale, 
      type, maskX, maskY, isPrismatic, columns, blockWidth, textureWidth, 
      itemId: finalItemId, 
      imageCategory
    };
  };

const RenderSprite = (props: { sprite: any, item: any, scale: number }) => {
     const dyeColor = () => props.item?.clothesColor;
     const isTinted = () => props.sprite.type === 'Clothing' && (dyeColor() || props.sprite.isPrismatic);
     
     const tintColor = () => {
        if (props.sprite.isPrismatic) return 'rgb(255, 50, 50)';
        
        const c = dyeColor();
        if (!c || getText(c.A) === '0') return 'transparent';
        const r = getText(c.R) || '255';
        const g = getText(c.G) || '255';
        const b = getText(c.B) || '255';
        return `rgb(${r}, ${g}, ${b})`;
     };

     if (props.sprite.isCombinedRing) {
         const combinedData = props.item.combinedRings || props.item.CombinedRings;
         const items = combinedData?.Item || combinedData?.Ring || [];
         const rings = Array.isArray(items) ? items : [items];
         
         return (
            <div style={{ 
               width: `${props.sprite.spriteWidth}px`, 
               height: `${props.sprite.spriteHeight}px`,
               transform: `scale(${props.scale})`, 
               "transform-origin": 'center',
               position: 'relative'
            }}>
               <div class="absolute" style={{ top: '-2px', left: '-2px', transform: 'scale(0.75)' }}>
                 <RenderSprite sprite={props.sprite.innerSprites[0]} item={rings[0]} scale={1} />
               </div>
               <div class="absolute" style={{ bottom: '-2px', right: '-2px', transform: 'scale(0.75)', "z-index": 10, filter: 'drop-shadow(-1px -1px 0px rgba(0,0,0,0.5))' }}>
                 <RenderSprite sprite={props.sprite.innerSprites[1]} item={rings[1]} scale={1} />
               </div>
            </div>
         );
     }

     return (
        <div style={{ 
           width: `${props.sprite.spriteWidth}px`, 
           height: `${props.sprite.spriteHeight}px`,
           transform: `scale(${props.scale})`, 
           "transform-origin": 'center',
           position: 'relative'
        }}>
           <div 
              class={`absolute inset-0 w-full h-full ${props.sprite.isPrismatic && !isTinted() ? 'prismatic-anim' : ''}`}
              style={{
                  "background-image": `url('${props.sprite.sheetUrl}')`,
                  "background-position": `-${props.sprite.x}px -${props.sprite.y + (props.sprite.type === 'Pants' ? 14 : 0)}px`,
                  "background-size": props.sprite.textureWidth ? `${props.sprite.textureWidth}px auto` : `${(props.sprite.columns || 24) * props.sprite.blockWidth}px auto`,
                  "image-rendering": "pixelated",
                  "background-repeat": "no-repeat"
              }}
           />
             <Show when={isTinted()}>
               <div
                 class={`absolute inset-0 w-full h-full ${props.sprite.isPrismatic ? 'prismatic-anim' : ''}`}
                 style={{
                   "background-color": tintColor(),
                   "mix-blend-mode": "multiply",
                   "-webkit-mask-image": `url('${props.sprite.sheetUrl}')`,
                   "-webkit-mask-position": `-${props.sprite.maskX || props.sprite.x}px -${props.sprite.maskY || props.sprite.y}px`,
                   "-webkit-mask-size": props.sprite.textureWidth ? `${props.sprite.textureWidth}px auto` : `${(props.sprite.columns || 24) * props.sprite.blockWidth}px auto`,
                   "-webkit-mask-repeat": "no-repeat",
                   "mask-image": `url('${props.sprite.sheetUrl}')`,
                   "mask-position": `-${props.sprite.maskX || props.sprite.x}px -${props.sprite.maskY || props.sprite.y}px`,
                   "mask-size": props.sprite.textureWidth ? `${props.sprite.textureWidth}px auto` : `${(props.sprite.columns || 24) * props.sprite.blockWidth}px auto`,
                   "mask-repeat": "no-repeat"
                 }}
               />
             </Show>
        </div>
     );
  };

  const applyUpdate = (field: string, val: any) => {
    const sObj = selectedItem()![field];
    let path = `${itemUpdateBasePath()}.${field}`;
    if (typeof sObj === 'object' && sObj !== null) {
      if ('$text' in sObj) path += '.$text';
      else if ('$value' in sObj) path += '.$value';
      else if ('#text' in sObj) path += '.#text';
      else if ('' in sObj) path += '.';
    }
    updateValue(path, val);
  };

  const handleSpawn = (newItem: any) => {
    if (props.selectedEquipmentPath) {
      let finalItem = { ...newItem };
const itemType = finalItem['@xsi:type'] || finalItem['@_xsi:type'] || finalItem['xsi:type'];

      if (itemType !== 'CombinedRing' && itemType !== 'Trinket') {
        delete finalItem['@xsi:type'];
        delete finalItem['@_xsi:type'];
        delete finalItem['xsi:type'];
      }

      if (itemType === 'Trinket') {
         const rawId = finalItem.itemId || finalItem.ItemId || '';
         if (rawId === 'MagicQuiver') finalItem.parentSheetIndex = 73;
         else if (rawId === 'ParrotEgg') finalItem.parentSheetIndex = 2;
         else if (rawId === 'FrogEgg') finalItem.parentSheetIndex = 6;
         else if (rawId === 'FairyBox') finalItem.parentSheetIndex = 74;
         else if (rawId === 'IridiumSpur') finalItem.parentSheetIndex = 76;
         else if (rawId === 'BasiliskPaw') finalItem.parentSheetIndex = 77;
         else if (rawId === 'IceRod') finalItem.parentSheetIndex = 78;
         else if (rawId === 'MagicHairGel') finalItem.parentSheetIndex = 1;
      }

      updateValue(props.selectedEquipmentPath, finalItem);
      
      const basePathMatch = props.selectedEquipmentPath.match(/^(.*)\.(boots|shirtItem|pantsItem)$/);
      if (basePathMatch) {
          const basePath = basePathMatch[1];
          const slotType = basePathMatch[2];
          
          if (slotType === 'boots' && finalItem.indexInColorSheet !== undefined) {
              updateValue(`${basePath}.shoes`, finalItem.indexInColorSheet);
          } else if (slotType === 'shirtItem') {
              updateValue(`${basePath}.shirt`, "-1");
          } else if (slotType === 'pantsItem') {
              updateValue(`${basePath}.pants`, "-1");
          }
      }

      setIsSpawnerOpen(false);
      return;
    }

    let currentArray = [...items()];
    const slot = selectedSlot() || 0;
    
    while (currentArray.length <= slot) {
      currentArray.push({ "@xsi:nil": "true" });
    }
    
    currentArray[slot] = newItem;
    updateValue(basePath(), currentArray);
    setIsSpawnerOpen(false);
  };

  const FORGE_ENCHANTS = ['RubyEnchantment', 'EmeraldEnchantment', 'JadeEnchantment', 'AquamarineEnchantment', 'AmethystEnchantment', 'TopazEnchantment', 'GalaxySoulEnchantment'];

  const addForgedPart = (enchType: string) => {
    if (!selectedItem()) return;
    let enchs = [...ensureArray(selectedItem()!.enchantments)];
    
    const isGalaxy = enchType === 'GalaxySoulEnchantment';
    const totalGems = enchs.filter(e => FORGE_ENCHANTS.includes(e['@_xsi:type'] || e['@xsi:type']) && (e['@_xsi:type'] || e['@xsi:type']) !== 'GalaxySoulEnchantment')
                           .reduce((sum, e) => sum + parseInt(e.level || '1', 10), 0);
    const totalSouls = enchs.filter(e => (e['@_xsi:type'] || e['@xsi:type']) === 'GalaxySoulEnchantment')
                            .reduce((sum, e) => sum + parseInt(e.level || '1', 10), 0);
                            
    if (isGalaxy && totalSouls >= 3) return;
    if (!isGalaxy && totalGems >= 3) return;

    const existingIdx = enchs.findIndex(e => (e['@_xsi:type'] || e['@xsi:type']) === enchType);
    
    if (existingIdx >= 0) {
      let currentLevel = parseInt(enchs[existingIdx].level || '1', 10);
      const updatedGem = { ...enchs[existingIdx], level: currentLevel + 1 };
      if (updatedGem['@_xsi:type']) { updatedGem['@xsi:type'] = updatedGem['@_xsi:type']; delete updatedGem['@_xsi:type']; }
      if (updatedGem['_xsi:type']) { updatedGem['@xsi:type'] = updatedGem['_xsi:type']; delete updatedGem['_xsi:type']; }
      if (updatedGem['xsi:type']) { updatedGem['@xsi:type'] = updatedGem['xsi:type']; delete updatedGem['xsi:type']; }
      enchs[existingIdx] = updatedGem;
    } else {
      enchs.push({ "@xsi:type": enchType, "level": 1 });
    }
    
    updateValue(`${itemUpdateBasePath()}.enchantments`, enchs);
  };

  const clearForgedParts = () => {
    if (!selectedItem()) return;
    let enchs = ensureArray(selectedItem()!.enchantments);
    enchs = enchs.filter(e => !FORGE_ENCHANTS.includes(e['@_xsi:type'] || e['@xsi:type']));
    updateValue(`${itemUpdateBasePath()}.enchantments`, enchs.length === 0 ? "" : enchs);
  };

  const setEnchantment = (enchantmentType: string) => {
    if (!selectedItem()) return;
    let enchs = [...ensureArray(selectedItem()!.enchantments)];
    enchs = enchs.filter(e => FORGE_ENCHANTS.includes(e['@_xsi:type'] || e['@xsi:type']));

    enchs = enchs.map(e => {
      const fixed = { ...e };
      if (fixed['@_xsi:type']) { fixed['@xsi:type'] = fixed['@_xsi:type']; delete fixed['@_xsi:type']; }
      if (fixed['_xsi:type']) { fixed['@xsi:type'] = fixed['_xsi:type']; delete fixed['_xsi:type']; }
      if (fixed['xsi:type']) { fixed['@xsi:type'] = fixed['xsi:type']; delete fixed['xsi:type']; }
      return fixed;
    });
    
    if (enchantmentType) {
      enchs.push({ "@xsi:type": enchantmentType, "level": 1 });
    }
    
    updateValue(`${itemUpdateBasePath()}.enchantments`, enchs.length === 0 ? "" : enchs);
  };

const handleToolUpgrade = (newLevel: number) => {
  if (!selectedItem()) return;
  
  let type = selectedItem()!['@type'] || selectedItem()!['@_xsi:type'] || selectedItem()!['@xsi:type'] || selectedItem()!['xsi:type'] || getText(selectedItem()!.type);
  const currentName = getText(selectedItem()!.name) || getText(selectedItem()!.Name) || '';

  if (!type || type === 'Tool') {
     if (currentName.includes('Axe')) type = 'Axe';
     else if (currentName.includes('Pickaxe')) type = 'Pickaxe';
     else if (currentName.includes('Hoe')) type = 'Hoe';
     else if (currentName.includes('Watering')) type = 'WateringCan';
     else if (currentName.includes('Pan')) type = 'Pan';
     else if (currentName.includes('Rod') || currentName.includes('Pole')) type = 'FishingRod';
     else if (currentName.includes('Trash') || currentName.includes('Can')) type = 'TrashCan';
  }
  
  let namePrefix = "";
  if (newLevel === 1) namePrefix = "Copper ";
  else if (newLevel === 2) namePrefix = "Steel ";
  else if (newLevel === 3) namePrefix = "Gold ";
  else if (newLevel === 4) namePrefix = "Iridium ";
  
  let baseName = type;
  if (type === 'WateringCan') baseName = 'Watering Can';
  if (type === 'TrashCan') baseName = 'Trash Can';

  // Penyesuaian khusus Pancingan (Fishing Rod) karena namanya berbeda-beda
  if (type === 'FishingRod') {
      baseName = ["Bamboo Pole", "Training Rod", "Fiberglass Rod", "Iridium Rod", "Advanced Iridium Rod"][newLevel] || "Bamboo Pole";
      namePrefix = ""; // Kosongkan prefix material
  }
  
  const newName = newLevel === 0 ? baseName : `${namePrefix}${baseName}`;

  // 1. UPDATE NAMA ALAT
  if (selectedItem()!.name !== undefined) applyUpdate('name', newName);
  if (selectedItem()!.Name !== undefined) applyUpdate('Name', newName);
  if (selectedItem()!.BaseName !== undefined) applyUpdate('BaseName', baseName);

  // 2. UPDATE ITEM ID (Wajib untuk stardew 1.6+)
  const itemIdVal = getText(selectedItem()!.itemId) || getText(selectedItem()!.ItemId);
  if (itemIdVal) {
    const idProp = selectedItem()!.itemId !== undefined ? 'itemId' : 'ItemId';
    applyUpdate(idProp, newName.replace(/\s+/g, ''));
  }

  // 3. UPDATE SPRITE/INDEX GAMBAR (Hanya untuk Alat Utama)
  if (['Axe', 'Pickaxe', 'Hoe', 'WateringCan'].includes(type as string)) {
    let menuIndex = 0;
    let spriteIndex = 0;
    
    if (type === 'Axe') {
      menuIndex = [215, 222, 229, 257, 264][newLevel];
      spriteIndex = [189, 196, 203, 231, 238][newLevel];
    } else if (type === 'Pickaxe') {
      menuIndex = [131, 138, 145, 173, 180][newLevel];
      spriteIndex = [105, 112, 119, 147, 154][newLevel];
    } else if (type === 'Hoe') {
      menuIndex = [47, 54, 61, 89, 96][newLevel];
      spriteIndex = [21, 28, 35, 63, 70][newLevel];
    } else if (type === 'WateringCan') {
      menuIndex = [296, 303, 310, 338, 345][newLevel];
      spriteIndex = [273, 280, 287, 315, 322][newLevel];
    }

    // Perbaikan: Cek kedua versi penulisan huruf (Kecil & Besar)
    if (selectedItem()!.indexOfMenuItemView !== undefined) applyUpdate('indexOfMenuItemView', String(menuIndex));
    if (selectedItem()!.IndexOfMenuItemView !== undefined) applyUpdate('IndexOfMenuItemView', String(menuIndex));

    if (selectedItem()!.initialParentTileIndex !== undefined) applyUpdate('initialParentTileIndex', String(spriteIndex));
    if (selectedItem()!.InitialParentTileIndex !== undefined) applyUpdate('InitialParentTileIndex', String(spriteIndex));

    if (selectedItem()!.currentParentTileIndex !== undefined) applyUpdate('currentParentTileIndex', String(spriteIndex));
    if (selectedItem()!.CurrentParentTileIndex !== undefined) applyUpdate('CurrentParentTileIndex', String(spriteIndex));
  }
};

  const handleDeleteItem = () => {
    if (props.selectedEquipmentPath) {
      updateValue(props.selectedEquipmentPath, { "@xsi:nil": "true" });
      if (props.onClearEquipmentSelection) props.onClearEquipmentSelection();
      return;
    }
    if (selectedSlot() === null) return;
    let currentArray = [...items()];
    currentArray[selectedSlot()!] = { "@xsi:nil": "true" };
    updateValue(basePath(), currentArray);
    setSelectedSlot(null);
  };

  return (
    <Show when={store.saveData?.parsed_variables} fallback={null}>
      <Show when={items()} fallback={<div class="p-32 text-center text-gray-500 italic">Failed to load inventory data.</div>}>
        <div class="flex flex-col lg:flex-row gap-24">
      
{/* LEFT GRID */}
      <div class="flex-1 glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col min-w-0">
         <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest self-start mb-16 shrink-0">Inventory</h2>
        
        <div class="w-full overflow-x-auto stardew-scrollbar pb-8">
          <div class="grid grid-cols-12 gap-4 bg-orange-900/30 p-8 rounded-12 border-4 border-orange-800/40 relative mx-auto w-max">
          <div 
            class="absolute border-4 border-yellow-300 rounded z-20 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_15px_rgba(253,224,71,0.6)] box-border"
            style={{
              width: '48px',
              height: '48px',
              left: `${8 + ((selectedSlot() || 0) % 12) * 52}px`,
              top: `${8 + Math.floor((selectedSlot() || 0) / 12) * 52}px`,
              opacity: selectedSlot() !== null && !props.selectedEquipmentPath ? 1 : 0,
              transform: selectedSlot() !== null && !props.selectedEquipmentPath ? 'scale(1.15)' : 'scale(1)'
            }}
          />

          <Index each={paddedItems()}>
            {(itemAccessor, idx) => {
              const item = () => itemAccessor();
              const isNil = () => !item() || item()!['@_xsi:nil'] === 'true' || item()!['@xsi:nil'] === 'true' || Object.keys(item()!).length === 0 || item() === '';
              
              return (
                <div 
                  onClick={() => { setSelectedSlot(idx); if (props.onClearEquipmentSelection) props.onClearEquipmentSelection(); }}
                  class={`w-48 h-48 relative bg-[#f0d8a8] border-2 cursor-pointer transition-transform hover:scale-105 border-[#c68c53]`}
                  title={
                  !isNil()
                    ? `${getText(item()!.name) || getText(item()!.Name) || '???'} x${getText(item()!.stack) || getText(item()!.Stack) || 1}`
                    : ''
                }
                >
                  <Show when={!isNil()} fallback={null}>
                    {(() => {
                      const sprite = getSpriteInfo(item()!);
                      const stack = parseInt(getText(item()!?.stack) || getText(item()!?.Stack) || '0', 10);
                      const itemName = getText(item()!.name) || getText(item()!.Name) || item()!['@type'] || item()!['@xsi:type'] || "???";

                      return (
                        <>
                          {sprite ? (
                            <div class="absolute inset-0 m-4 flex items-center justify-center overflow-hidden">
                              <RenderSprite sprite={sprite} item={item()!} scale={sprite.gridScale} />
                            </div>
                          ) : (
                            <div class="absolute inset-0 flex items-center justify-center overflow-hidden p-2">
                               <span class="text-[9px] text-gray-800 font-serif font-bold leading-none text-center break-words">{itemName}</span>
                            </div>
                          )}
                          
                          <Show when={stack > 1}>
                            <div 
                              class="absolute bottom-0 right-2 text-[14px] leading-none font-brains font-bold text-white z-10" 
                              style={{ "text-shadow": "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}
                            >
                              {stack}
                            </div>
                          </Show>
                        </>
                      );
                    })()}
                  </Show>
                </div>
              );
            }}
          </Index>
        </div>
        </div>
      </div>

    {/* DETAILS PANEL */}
      <div class="w-full lg:w-[420px] glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col gap-16 min-h-[520px]">
        <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest shrink-0">Item Details</h2>
        
        {selectedItem() && !isSelectedNil() ? (
          <div class="flex flex-col gap-16">
            
            {/* HEADER CARD */}
            <div class="flex items-center gap-16 bg-white/5 p-12 rounded-12 border border-white/10">
              <div class="w-64 h-64 bg-[#f0d8a8] border-2 border-[#c68c53] rounded flex items-center justify-center overflow-hidden shrink-0">
                 {(() => {
                    const spriteInfo = getSpriteInfo(selectedItem());
                    return spriteInfo ? (
                       <RenderSprite sprite={spriteInfo} item={selectedItem()!} scale={spriteInfo.detailScale} />
                    ) : (
                       <span class="text-[12px] leading-[16px] font-serif text-gray-600 font-bold px-4 text-center">NO IMG</span>
                    );
                 })()}
              </div>
              <div class="flex-1 min-w-0">
                <input
                  type="text"
                  value={getText(selectedItem()!.name) !== 'Error Item' && getText(selectedItem()!.name) ? getText(selectedItem()!.name) : (getText(selectedItem()!.Name) !== 'Error Item' && getText(selectedItem()!.Name) ? getText(selectedItem()!.Name) : (itemMapById.get(getText(selectedItem()!.itemId) || getText(selectedItem()!.ItemId))?.name || itemMapById.get(getText(selectedItem()!.parentSheetIndex))?.name || selectedItem()!['@type'] || selectedItem()!['@xsi:type'] || 'Unknown Item'))}
                  onChange={(e) => {
                    const propKey = selectedItem()!.name !== undefined ? 'name' : (selectedItem()!.Name !== undefined ? 'Name' : 'name');
                    applyUpdate(propKey, e.target.value);
                  }}
                  class="text-title-h5 font-semibold font-serif text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-yellow-400 focus:outline-none w-full truncate transition-colors"
                  placeholder="Item Name"
                />
                <div class="text-[12px] leading-[16px] text-gray-400 font-brains">ID: {getText(selectedItem()!.indexInTileSheet) || getText(selectedItem()!.itemId) || getText(selectedItem()!.indexOfMenuItemView) || getText(selectedItem()!.parentSheetIndex) || '?'}</div>
              </div>
            </div>

            {/* GENERAL INFO */}
            <div class="flex flex-col gap-12 bg-white/[0.02] p-12 rounded-12 border border-white/5">
            {/* STACK */}
            {(selectedItem()!.stack !== undefined || selectedItem()!.Stack !== undefined) && (
              <div class="flex items-center justify-between gap-16">
                <label class="text-[13px] leading-[16px] font-serif font-medium text-gray-400">Amount (Stack)</label>
                <div class="w-96 bg-[#111] border border-white/10 rounded-full px-12 py-4 shadow-inner">
                  <StatInput 
                    value={parseInt(getText(selectedItem()!.stack) || getText(selectedItem()!.Stack) || '1', 10)}
                    onChange={(val) => {
                      const propKey = selectedItem()!.stack !== undefined ? 'stack' : 'Stack';
                      applyUpdate(propKey, val);
                    }}
                  />
                </div>
              </div>
            )}
                          
              {/* QUALITY */}
              {selectedItem()!.quality !== undefined && (
                <div class="flex items-center justify-between gap-16">
                  <label class="text-[13px] leading-[16px] font-serif font-medium text-gray-400">Quality</label>
                  <select 
                    value={parseInt(getText(selectedItem()!.quality) || '0', 10)}
                    onChange={(e) => applyUpdate('quality', parseInt(e.target.value, 10) || 0)}
                    class="glass-input w-32 appearance-none bg-[#111] text-white text-center font-serif px-8 cursor-pointer"
                  >
                    <option value={0} class="bg-[#111] text-white">Normal (0)</option>
                    <option value={1} class="bg-[#111] text-white">Silver (1)</option>
                    <option value={2} class="bg-[#111] text-white">Gold (2)</option>
                    <option value={4} class="bg-[#111] text-white">Iridium (4)</option>
                  </select>
                </div>
              )}

{/* UPGRADE LEVEL */}
{(() => {

  const t = selectedItem()!['@type'] || selectedItem()!['@_xsi:type'] || selectedItem()!['@xsi:type'] || selectedItem()!['xsi:type'] || getText(selectedItem()!.type) || '';
  const n = getText(selectedItem()!.name) || getText(selectedItem()!.Name) || '';
  const isTool = ['Axe', 'Pickaxe', 'Hoe', 'WateringCan', 'FishingRod', 'Pan'].includes(t) || 
                 n.includes('Axe') || n.includes('Pickaxe') || n.includes('Hoe') || n.includes('Watering');
                 
  return isTool;
})() && (
  <div class="flex items-center justify-between gap-16">
    <label class="text-[13px] leading-[16px] font-serif font-medium text-gray-400">Upgrade Level</label>
    <select 
      value={parseInt(getText(selectedItem()!.upgradeLevel) || getText(selectedItem()!.UpgradeLevel) || '0', 10)}
      onChange={(e) => {
        const newLvl = parseInt(e.target.value, 10) || 0;
        const propKey = selectedItem()!.UpgradeLevel !== undefined ? 'UpgradeLevel' : 'upgradeLevel';
        applyUpdate(propKey, newLvl);
        handleToolUpgrade(newLvl);
      }}
      class="glass-input w-32 appearance-none bg-[#111] text-white text-center font-serif px-8 cursor-pointer"
    >
      <option value={0} class="bg-[#111] text-white">Basic (0)</option>
      <option value={1} class="bg-[#111] text-white">Copper (1)</option>
      <option value={2} class="bg-[#111] text-white">Steel (2)</option>
      <option value={3} class="bg-[#111] text-white">Gold (3)</option>
      <option value={4} class="bg-[#111] text-white">Iridium (4)</option>
    </select>
  </div>
)}

              {/* COLOR PICKER */}
              {selectedItem()!.clothesColor !== undefined && (
                <div class="flex items-center justify-between gap-16">
                  <label class="text-[13px] leading-[16px] font-serif font-medium text-gray-400">Dye Color</label>
                  <DyeColorPicker 
                    colorObj={selectedItem()!.clothesColor}
                    onChange={(r, g, b) => {
                      applyUpdate('clothesColor.R', r);
                      applyUpdate('clothesColor.G', g);
                      applyUpdate('clothesColor.B', b);

                      const a = parseInt(getText(selectedItem()!.clothesColor?.A) || '255', 10);
                      const packed = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
                      applyUpdate('clothesColor.PackedValue', packed);
                    }}
                  />
                </div>
              )}
            </div>

            {/* BOOTS STATS */}
            {(selectedItem()!['@type'] === 'Boots' || selectedItem()!['@_xsi:type'] === 'Boots' || selectedItem()!['@xsi:type'] === 'Boots' || selectedItem()!.defenseBonus !== undefined || selectedItem()!.immunityBonus !== undefined) && (
              <div class="flex flex-col gap-12 mt-4">
                <h3 class="text-[12px] leading-[16px] font-serif text-gray-500 uppercase tracking-widest">Boots Stats</h3>

                <div class="grid grid-cols-2 gap-8">
                  <For each={[
                    { key: 'defenseBonus', label: 'Defense', type: 'number' },
                    { key: 'immunityBonus', label: 'Immunity', type: 'number' }
                  ]}>
                    {(stat) => (
                      <div class="flex items-center justify-between gap-8 bg-white/5 border border-white/10 px-12 py-6 rounded-8 hover:bg-white/10 transition-colors">
                        <label class="text-[12px] font-serif leading-[16px] text-gray-400 whitespace-nowrap">{stat.label}</label>
                        <div class="flex-1 min-w-[40px]">
                          <StatInput 
                            value={parseInt(getText(selectedItem()![stat.key]) || '0', 10)}
                            onChange={(val) => applyUpdate(stat.key, val)}
                          />
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}

            {/* WEAPON STATS */}
            {((selectedItem()!['@type'] === 'Weapon' || selectedItem()!['@type'] === 'MeleeWeapon' || selectedItem()!['@_xsi:type'] === 'MeleeWeapon' || selectedItem()!['@xsi:type'] === 'MeleeWeapon') || 
               selectedItem()!.minDamage !== undefined) && (
              <div class="flex flex-col gap-12 mt-4">
                <h3 class="text-[12px] leading-[16px] font-serif text-gray-500 uppercase tracking-widest">Weapon Stats</h3>

                <div class="grid grid-cols-2 gap-8">
                  <For each={[
                    { key: 'minDamage', label: 'Min Dmg', type: 'number' },
                    { key: 'maxDamage', label: 'Max Dmg', type: 'number' },
                    { key: 'knockback', label: 'Knockback', type: 'number' },
                    { key: 'speed', label: 'Speed', type: 'number' },
                    { key: 'addedPrecision', label: 'Precision', type: 'number' },
                    { key: 'addedDefense', label: 'Defense', type: 'number' },
                    { key: 'areaOfEffect', label: 'AoE', type: 'number' },
                    { key: 'critChance', label: 'Crit %', type: 'number', step: '0.01' },
                    { key: 'critMultiplier', label: 'Crit Mult', type: 'number', step: '0.1' }
                  ]}>
                    {(stat) => (
                      <div class="flex items-center justify-between gap-8 bg-white/5 border border-white/10 px-12 py-6 rounded-8 hover:bg-white/10 transition-colors">
                        <label class="text-[12px] font-serif leading-[16px] text-gray-400 whitespace-nowrap">{stat.label}</label>
                        <div class="flex-1 min-w-[40px]">
                          <StatInput 
                            step={stat.step}
                            value={stat.step ? parseFloat(getText(selectedItem()![stat.key]) || '0') : parseInt(getText(selectedItem()![stat.key]) || '0', 10)}
                            onChange={(val) => applyUpdate(stat.key, val)}
                          />
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}

            {/* WEAPON FORGING */}
            {((selectedItem()!['@type'] === 'Weapon' || selectedItem()!['@type'] === 'MeleeWeapon' || selectedItem()!['@_xsi:type'] === 'MeleeWeapon' || selectedItem()!['@xsi:type'] === 'MeleeWeapon') || 
               selectedItem()!.minDamage !== undefined) && (
              <div class="flex flex-col gap-12 mt-4">
                <h3 class="text-[12px] leading-[16px] font-serif text-gray-500 uppercase tracking-widest">Forging & Enchantments</h3>
                
                {/* Forging UI */}
                <div class="bg-white/5 border border-white/10 p-12 rounded-8 flex flex-col gap-12">
                  <div class="flex items-center justify-between">
                    <label class="text-[13px] leading-[16px] font-serif font-medium text-gray-400">Forged Gems</label>
                    <span class="text-[12px] font-brains text-yellow-400 font-bold bg-yellow-400/10 px-6 py-2 rounded-4">
                      {(() => {
                        const FORGE_ENCHANTS = ['RubyEnchantment', 'EmeraldEnchantment', 'JadeEnchantment', 'AquamarineEnchantment', 'AmethystEnchantment', 'TopazEnchantment', 'GalaxySoulEnchantment'];
                        const enchs = ensureArray(selectedItem()!.enchantments);
                        const count = enchs.filter(e => FORGE_ENCHANTS.includes(e['@_xsi:type'] || e['@xsi:type']) && (e['@_xsi:type'] || e['@xsi:type']) !== 'GalaxySoulEnchantment')
                                           .reduce((sum, e) => sum + parseInt(e.level || '1', 10), 0);
                        const souls = enchs.filter(e => (e['@_xsi:type'] || e['@xsi:type']) === 'GalaxySoulEnchantment')
                                           .reduce((sum, e) => sum + parseInt(e.level || '1', 10), 0);
                        return souls > 0 ? `${count} Forges (${souls} Souls)` : `${count} Forges`;
                      })()}
                    </span>
                  </div>
                  
                  <div class="flex flex-wrap gap-8 justify-center">
                    {[
                      { id: 'RubyEnchantment', label: 'Ruby (Dmg)', color: 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/40' },
                      { id: 'EmeraldEnchantment', label: 'Emerald (Spd)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/40' },
                      { id: 'JadeEnchantment', label: 'Jade (Crit Dmg)', color: 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/40' },
                      { id: 'AquamarineEnchantment', label: 'Aqua (Crit %)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/40' },
                      { id: 'AmethystEnchantment', label: 'Amethyst (Knock)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/40' },
                      { id: 'TopazEnchantment', label: 'Topaz (Def)', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/40' },
                      { id: 'GalaxySoulEnchantment', label: 'Galaxy Soul', color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30 hover:bg-fuchsia-500/40' },
                    ].map(gem => {
                      const FORGE_ENCHANTS = ['RubyEnchantment', 'EmeraldEnchantment', 'JadeEnchantment', 'AquamarineEnchantment', 'AmethystEnchantment', 'TopazEnchantment', 'GalaxySoulEnchantment'];
                      const enchs = ensureArray(selectedItem()!.enchantments);
                      const gemData = enchs.find(e => (e['@_xsi:type'] || e['@xsi:type'] || e['xsi:type']) === gem.id);
                      const level = gemData ? parseInt(gemData.level || '1', 10) : 0;
                      return (
                      <button
                        onClick={() => addForgedPart(gem.id)}
                        class={`px-8 py-4 text-[11px] font-serif border rounded-4 transition-colors ${gem.color} ${level > 0 ? 'ring-2 ring-white/50 shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'opacity-70'} cursor-pointer`}
                        title={`Add 1 ${gem.label.split(' ')[0]}`}
                      >
                        + {gem.label} {level > 0 && `(x${level})`}
                      </button>
                    )})}
                  </div>

                  <button 
                    onClick={clearForgedParts}
                    class="mt-4 px-12 py-6 bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-900/50 rounded-6 text-[12px] font-bold font-serif transition-colors w-full cursor-pointer"
                  >
                    Clear All Forges
                  </button>
                </div>
              </div>
            )}

            {/* ENCHANTMENTS (Weapons & Tools) */}
            {(() => {
               const t = selectedItem()!['@type'] || selectedItem()!['@_xsi:type'] || selectedItem()!['@xsi:type'] || selectedItem()!['xsi:type'] || getText(selectedItem()!.type) || '';
               const n = getText(selectedItem()!.name) || getText(selectedItem()!.Name) || '';
               
               const isFishingRod = t === 'FishingRod' || n.includes('Fishing');
               const isWeapon = t === 'Weapon' || t === 'MeleeWeapon' || selectedItem()!.minDamage !== undefined;
               const isTool = ['Axe', 'Pickaxe', 'Hoe', 'WateringCan', 'Pan'].includes(t) || 
                              n.includes('Axe') || n.includes('Pickaxe') || n.includes('Hoe') || n.includes('Watering');

               if (!isTool && !isWeapon && !isFishingRod) return null;

               return (
                 <div class="flex flex-col gap-12 mt-4">
                   <h3 class="text-[12px] leading-[16px] font-serif text-gray-500 uppercase tracking-widest">Enchantment</h3>
                   <div class="bg-white/5 border border-white/10 p-12 rounded-8 flex flex-col gap-12">
                     <div class="flex items-center justify-between gap-16">
                       <label class="text-[13px] leading-[16px] font-serif font-medium text-gray-400">Enchantment</label>
                       <select
                         value={(() => {
                        const FORGE_ENCHANTS = ['RubyEnchantment', 'EmeraldEnchantment', 'JadeEnchantment', 'AquamarineEnchantment', 'AmethystEnchantment', 'TopazEnchantment', 'GalaxySoulEnchantment'];
                        const enchs = ensureArray(selectedItem()!.enchantments);
                        const mainEnch = enchs.find(e => !FORGE_ENCHANTS.includes(e['@_xsi:type'] || e['@xsi:type'] || e['xsi:type']));
                        if (mainEnch) return getText(mainEnch['@_xsi:type'] || mainEnch['@xsi:type'] || mainEnch['xsi:type']);
                        return '';
                         })()}
                         onChange={(e) => setEnchantment(e.target.value)}
                         class="glass-input flex-1 appearance-none bg-[#111] text-white text-center font-serif px-8 py-4 cursor-pointer text-[12px]"
                       >
                         <option value="" class="bg-[#111] text-white">-- None --</option>
                         
                         <Show when={isWeapon || isTool}>
                           <optgroup label="Weapon Enchantments" class="bg-[#222]">
                             <option value="ArtfulEnchantment" class="bg-[#111] text-white">Artful (Cooldown)</option>
                             <option value="BugKillerEnchantment" class="bg-[#111] text-white">Bug Killer (Bugs Dmg)</option>
                             <option value="CrusaderEnchantment" class="bg-[#111] text-white">Crusader (Undead)</option>
                             <option value="HaymakerEnchantment" class="bg-[#111] text-white">Haymaker (Fiber/Hay)</option>
                             <option value="VampiricEnchantment" class="bg-[#111] text-white">Vampiric (Heal)</option>
                           </optgroup>
                         </Show>

                         <Show when={isTool}>
                           <optgroup label="Tool Enchantments" class="bg-[#222]">
                             <option value="ShavingEnchantment" class="bg-[#111] text-white">Shaving (Axe: +Wood)</option>
                             <option value="ReachingToolEnchantment" class="bg-[#111] text-white">Reaching (Hoe/Can: 5x5)</option>
                             <option value="PowerfulEnchantment" class="bg-[#111] text-white">Powerful (Pickaxe/Axe: +Power)</option>
                             <option value="EfficientToolEnchantment" class="bg-[#111] text-white">Efficient (0 Stamina)</option>
                             <option value="SwiftToolEnchantment" class="bg-[#111] text-white">Swift (Fast Swing)</option>
                             <option value="GenerousEnchantment" class="bg-[#111] text-white">Generous (Hoe: +Items)</option>
                             <option value="BottomlessEnchantment" class="bg-[#111] text-white">Bottomless (Can: ∞ Water)</option>
                             <option value="ArchaeologistEnchantment" class="bg-[#111] text-white">Archaeologist (Hoe: Artifacts)</option>
                           </optgroup>
                         </Show>

                         <Show when={isFishingRod}>
                           <optgroup label="Fishing Enchantments" class="bg-[#222]">
                             <option value="AutoHookEnchantment" class="bg-[#111] text-white">Auto-Hook (Auto Catch)</option>
                             <option value="PreservingEnchantment" class="bg-[#111] text-white">Preserving (Tackle Lasts)</option>
                             <option value="MasterEnchantment" class="bg-[#111] text-white">Master (+1 Fishing Level)</option>
                           </optgroup>
                         </Show>
                       </select>
                     </div>
                   </div>
                 </div>
               );
            })()}

            <div class="mt-24 pt-24 border-t border-white/10 flex justify-between">
              <button
                onClick={handleDeleteItem}
                class="px-16 py-8 cursor-pointer bg-red-900/40 hover:bg-red-800/60 text-red-200 rounded-8 transition-colors text-sm font-medium font-serif border border-red-900/50"
              >
                Delete Item
              </button>
              <button 
                onClick={() => setIsSpawnerOpen(true)}
                class="px-16 py-8 cursor-pointer bg-[#2A2A2A] hover:bg-[#333] text-gray-300 rounded-8 transition-colors text-sm font-serif font-medium"
              >
                Replace Item
              </button>
            </div>
          </div>
        ) : (
          <div class="flex flex-col items-center justify-center flex-1 text-gray-500 font-serif gap-16 pb-32">
            <div class="w-64 h-64 border-4 border-dashed border-gray-700 rounded-12 flex items-center justify-center mb-8 opacity-50 bg-black/20">
               <span class="text-4xl text-gray-600">+</span>
            </div>
            {(selectedSlot() !== null || props.selectedEquipmentPath) ? (
              <>
                <p class="text-body-medium opacity-80 mb-8">Empty Slot Selected</p>
                <button 
                  onClick={() => setIsSpawnerOpen(true)}
                  class="px-24 py-12 cursor-pointer bg-[#c0733a] hover:bg-[#8c4614] text-white text-title-h5 font-bold font-brains rounded-8 shadow-[0_4px_10px_rgba(192,115,58,0.3)] hover:shadow-[0_4px_15px_rgba(192,115,58,0.5)] transition-all hover:scale-105"
                >
                  Spawn Item Here
                </button>
              </>
            ) : (
              <p class="opacity-50 italic text-body-medium">Select an item from the grid or equipment slot.</p>
            )}
          </div>
        )}
      </div>

        </div>
      </Show>

    <ItemSpawnerModal 
        isOpen={isSpawnerOpen()} 
        onClose={() => setIsSpawnerOpen(false)}
        onSpawn={handleSpawn}
        typeFilter={(() => {
          if (!props.selectedEquipmentPath) return undefined;
          if (props.selectedEquipmentPath.includes('hat')) return ['Hat'];
          if (props.selectedEquipmentPath.includes('shirt')) return ['Shirt'];
          if (props.selectedEquipmentPath.includes('pants')) return ['Pants'];
          if (props.selectedEquipmentPath.toLowerCase().includes('ring')) return ['Ring', 'CombinedRing'];
          if (props.selectedEquipmentPath.includes('boots')) return ['Boots'];
          if (props.selectedEquipmentPath.toLowerCase().includes('trinket')) return ['Trinket'];
          return undefined;
        })()}
      />
    </Show>
  );
};