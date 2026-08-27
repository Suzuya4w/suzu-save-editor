import { createMemo } from 'solid-js';
import { Star } from 'lucide-solid';
import itemInfoRaw from '../../../data/stardew/iteminfo.json';

function computeSpriteData(info: any) {
  if (!info) return null;

  let texture = info.texture;
  let spriteIndex = 0;

  if (typeof info.menuSpriteIndex === 'number' && info.menuSpriteIndex !== -1) {
    spriteIndex = info.menuSpriteIndex;
  } else if (typeof info.spriteIndex === 'number') {
    spriteIndex = info.spriteIndex;
  } else if (typeof info.sheetIndex === 'number') {
    spriteIndex = info.sheetIndex;
  } else if (typeof info.index === 'number') {
    spriteIndex = info.index;
  } else if (info._key) {
    spriteIndex = parseInt(info._key);
  }

  if (isNaN(spriteIndex)) {
    spriteIndex = 0;
  }

  // FIX BOGUS SPRITEINDEX DARI EKSTRAKTOR DATA
  // Furniture dasar (tanpa custom texture) di Stardew 1.6 SELALU menggunakan ID numeriknya sebagai index.
  // Ini mencegah item Furniture hasil konversi dari BigCraftable (seperti Sloth Skeleton L)
  // menggunakan index lamanya.
  if (info._type === 'Furniture' && !info.texture && info._key) {
    const keyAsInt = parseInt(info._key, 10);
    if (!isNaN(keyAsInt)) {
      spriteIndex = keyAsInt;
    }
  }

  const isItemPrismatic = texture === 'Prismatic' || 
                          (info.name && info.name.toLowerCase().includes('prismatic')) || 
                          (info.name && info.name.toLowerCase().includes('galaxy')) || 
                          (info.name && info.name.toLowerCase().includes('magic') && info._type === 'Hat') ||
                          info.isPrismatic?.['#text'] === 'true' || 
                          info.prismatic?.['#text'] === 'true';

  if (texture === 'Prismatic') texture = null;

  if (!texture) {
    if (info._type === 'Hat') texture = 'hats.png';
    else if (info._type === 'Clothing') {
      if (info.name && (info.name.toLowerCase().includes('pants') || info.name.toLowerCase().includes('shorts') || info.name.toLowerCase().includes('skirt'))) {
        texture = 'pants.png';
      } else {
        texture = 'shirts.png';
      }
    } else if (info._type === 'Pants') {
      texture = 'pants.png';
    } else if (info._type === 'Shirt') {
      texture = 'shirts.png';
    } else if (info._type === 'Boots') {
      texture = 'springobjects.png';
    } else if (info._type === 'Weapon' || info._type === 'MeleeWeapon') {
      texture = 'weapons.png';
    } else if (info._type === 'Tool') {
      texture = 'tools.png';
    } else if (info._type === 'BigCraftable') {
      texture = 'Craftables.png';
    } else if (info._type === 'Furniture') {
      texture = 'furniture.png';
    } else if (info._type === 'Mannequin') {
      texture = 'Mannequins.png';
    } else {
      texture = 'springobjects.png';
    }
  }

  let columns = 24;
  let spriteWidth = 16;
  let spriteHeight = 16;
  let blockWidth = 16;
  let blockHeight = 16;

  let textureWidth: number | undefined = undefined;

  if (texture) {
    const parts = texture.split(/[\/\\]/);
    const filename = parts[parts.length - 1];
    if (filename.toLowerCase().endsWith('.png')) texture = filename;
    else texture = filename + '.png';
    
    if (texture.toLowerCase() === 'objects.png' || texture.toLowerCase() === 'springobjects.png') texture = 'springobjects.png';
    if (texture.toLowerCase() === 'weapons.png') texture = 'weapons.png';
    if (texture.toLowerCase() === 'tools.png') texture = 'tools.png';
  }

  if (texture === 'tools.png') {
    columns = 21;
  } else if (texture === 'weapons.png') {
    columns = 8;
  } else if (texture === 'hats.png') {
    columns = 12;
    spriteWidth = 20;
    spriteHeight = 20;
    blockWidth = 20;
    blockHeight = 80;
  } else if (texture === 'shirts.png') {
    columns = 16;
    spriteWidth = 8;
    spriteHeight = 8;
    blockWidth = 8;
    blockHeight = 32;
    textureWidth = 256;
  } else if (texture === 'pants.png') {
    columns = 10;
    spriteWidth = 16;
    spriteHeight = 16;
    blockWidth = 192;
    blockHeight = 688;
  } else if (texture === 'Objects_2.png') {
    columns = 8;
  } else if (texture === 'springobjects.png') {
    columns = 24;
  } else if (texture === 'Craftables.png' || texture === 'Mannequins.png') {
    columns = 8;
    spriteWidth = 16;
    spriteHeight = 32;
    blockWidth = 16;
    blockHeight = 32;
  } else if (texture && (texture.includes('furniture') || texture.includes('Cactuses') || texture === 'accessories.png')) {
    const widths: Record<string, number> = {
      "furniture.png": 512,
      "furniture_2.png": 256,
      "furniture_3.png": 208,
      "joja_furniture.png": 208,
      "junimo_furniture.png": 208,
      "retro_furniture.png": 208,
      "wizard_furniture.png": 208,
      "FreeCactuses.png": 128
    };
    const tw = widths[texture] || 256;
    columns = tw / 16;
    
    spriteWidth = (info.tilesX || 1) * 16;
    spriteHeight = (info.tilesY || 1) * 16;
    if (info.type === 'lamp') {
      spriteHeight = 48; // Lamps are drawn as 1x3 tiles in the spritesheet
    }
    blockWidth = 16;
    blockHeight = 16;
  }

if (texture === 'tools.png') {
  const itemNameStr = (info.name || info.Name || '').toLowerCase();
  
  if (itemNameStr.includes('lantern')) {
    spriteIndex = 3;
  } else if (itemNameStr.includes('trash can')) {
    const upgLevel = parseInt(info.upgradeLevel || info.UpgradeLevel || '0', 10);
    spriteIndex = 13 + upgLevel;
  } else if (itemNameStr.includes('return scepter')) {
    spriteIndex = 2;
  }
}

  return {
    url: `/stardew/${texture}`,
    columns,
    spriteWidth,
    spriteHeight,
    blockWidth,
    blockHeight,
    textureWidth,
    isShirt: texture === 'shirts.png',
    isClothing: texture === 'shirts.png' || texture === 'pants.png',
    isPants: texture === 'pants.png',
    isPrismatic: isItemPrismatic,
    defaultColor: info.defaultColor || info.DefaultColor,
    index: spriteIndex
  };
}

const itemMapByName = new Map<string, any>();
const itemMapById = new Map<string, any>();
const itemMapByTypeAndId = new Map<string, any>();

(itemInfoRaw as any[]).forEach((tuple: any) => {
  if (tuple && tuple[1]) {
    const info = tuple[1];
    const computedData = computeSpriteData(info);
    if (!computedData) return;

    if (info.Name || info.name) {
      const name = String(info.Name || info.name);
      itemMapByName.set(name, computedData);
      itemMapByName.set(name.toLowerCase(), computedData);
    }
    if (info._key || tuple[0]) {
      const id = String(info._key || tuple[0]);
      itemMapById.set(id, computedData);
      
      // Kunci bawaan kodemu: "Object_93"
      if (info._type) {
        itemMapByTypeAndId.set(`${info._type}_${id}`, computedData);
      }
      // ---> TAMBAHKAN BARIS INI: Kunci penangkap spawner: "Crafting_93"
      if (info.type) {
        itemMapByTypeAndId.set(`${info.type}_${id}`, computedData);
      }
    }

    if (info.spriteIndex !== undefined && info._type) {
      const spriteKey = `${info._type}_${info.spriteIndex}`;
      if (!itemMapByTypeAndId.has(spriteKey)) {
        itemMapByTypeAndId.set(spriteKey, computedData);
      }
    }
  }
});

const WIKI_ICONS: Record<string, string> = {

  "Farming Mastery": "Mastery Icon.png",
  "Fishing Mastery": "Mastery Icon.png",
  "Foraging Mastery": "Mastery Icon.png",
  "Mining Mastery": "Mastery Icon.png",
  "Combat Mastery": "Mastery Icon.png",

  "Forest Magic": "Forest Magic.png",
  "Rusty Key": "Rusty Key.png",
  "Skull Key": "Skull Key.png",
  "Special Charm": "Special Charm.png",
  "Club Card": "Club Card.png",
  "Magnifying Glass": "Magnifying Glass.png",
  "Dark Talisman": "Dark Talisman.png",
  "Magic Ink": "Magic Ink.png",
  "Key To The Town": "Key To The Town.png",
  "Dwarvish Translation Guide": "Dwarvish Translation Guide.png",

  "Bear's Knowledge": "Bears_Knowledge.png",
  "Spring Onion Mastery": "Spring Onion Mastery.png",
  "Animal Catalogue": "Animal Catalogue.png",
  "Alleyway Buffet": "The Alleyway Buffet.png",
  "Diamond Hunter": "The Diamond Hunter.png",
  "Horse: The Book": "Horse The Book.png",
  "Mystery Book": "Book of Mysteries.png",
  "Treasure Appraisal Guide": "Treasure Appraisal Guide.png",
  "Monster Compendium": "Monster Compendium.png",
  "Price Catalogue": "Price Catalogue.png",
  "Mapping Cave Systems": "Mapping Cave Systems.png",
  "Way Of The Wind pt. 1": "Way Of The Wind pt. 1.png",
  "Way Of The Wind pt. 2": "Way Of The Wind pt. 2.png",
  "Friendship 101": "Friendship 101.png",
  "Jack Be Nimble": "Jack Be Nimble, Jack Be Thick.png",
  "Woody's Secret": "Woodys_Secret.png",
  "Raccoon Journal": "Ways Of The Wild.png",
  "Jewels Of The Sea": "Jewels Of The Sea.png",
  "Dwarvish Safety Manual": "Dwarvish Safety Manual.png",
  "The Art o' Crabbing": "The_Art_O_Crabbing.png",
  "Ol' Slitherlegs": "Ol_Slitherlegs.png"
};

const HARDCODED_SPRITES: Record<string, { url: string, columns?: number, index?: number, spriteWidth?: number, spriteHeight?: number, blockWidth?: number, blockHeight?: number }> = {
  "Torch": {
    url: "/stardew/springobjects.png",
    columns: 24,
    index: 93,
    spriteWidth: 16, spriteHeight: 16,
    blockWidth: 16, blockHeight: 16
  },
  "Spirit Torch": {
    url: "/stardew/springobjects.png",
    columns: 24,
    index: 94,
    spriteWidth: 16, spriteHeight: 16,
    blockWidth: 16, blockHeight: 16
  }
};

const LUCIDE_FALLBACKS: Record<string, any> = {
  // Only use the fallback if it's not in the iteminfo/hardcoded list.
  // Since i want to manually fit, the fallback won't be called for items that are in the list above!
};

export interface ItemSpriteProps {
  name: string;
  itemId?: string;
  type?: string;
  class?: string;
  scale?: number;
}

export const ItemSprite = (props: ItemSpriteProps) => {
  const spriteData = createMemo(() => {
    const hardcoded = HARDCODED_SPRITES[props.name];
    if (hardcoded) return hardcoded;

    const data = (props.itemId && props.type ? itemMapByTypeAndId.get(`${props.type}_${props.itemId.toString()}`) : null) || 
                 (props.itemId ? itemMapById.get(props.itemId.toString()) : null) ||
                 (props.name ? itemMapByName.get(props.name.toLowerCase()) : null);
                 
    return data || null;
  });

  const renderFallback = () => {
    return <div class={`w-full h-full flex items-center justify-center ${props.class || ''}`}>{LUCIDE_FALLBACKS[props.name] || <Star class="text-gray-400" />}</div>;
  };

  return (
    <div class="relative flex items-center justify-center w-full h-full">
      {WIKI_ICONS[props.name] ? (
        <img 
          src={`/stardew/wiki_icons/${WIKI_ICONS[props.name]}`} 
          alt={props.name}
          class={props.class || ''}
          style={{ width: "40px", height: "auto", "image-rendering": "pixelated" }}
        />
      ) : spriteData() ? (() => {
        const data = spriteData() as any;
        const sWidth = data.spriteWidth || 16;
        const sHeight = data.spriteHeight || 16;
        const bWidth = data.blockWidth || 16;
        const bHeight = data.blockHeight || 16;
        const cols = data.columns || 24;
        const idx = data.index || 0;
        return (
        <div 
          class={`${props.class || ''} ${data.isPrismatic ? 'prismatic-anim' : ''}`}
          style={{
            "background-image": `url('${data.url}')`,
            "background-position": `-${(idx % cols) * bWidth}px -${Math.floor(idx / cols) * bHeight + (data.url.includes('pants.png') ? 14 : 0)}px`,
            "background-size": data.textureWidth ? `${data.textureWidth}px auto` : `${cols * bWidth}px auto`,
            width: `${sWidth}px`,
            height: `${sHeight}px`,
            transform: props.scale !== undefined ? `scale(${props.scale})` : `scale(${16 / Math.max(sWidth, sHeight) * 2.5})`,
            "transform-origin": "center",
            "image-rendering": "pixelated",
            "background-repeat": "no-repeat",
            "filter": (data.url.includes('shirts.png') || data.url.includes('pants.png') || data.url.includes('hats.png') || data.isPrismatic) ? "drop-shadow(1px 1px 0px rgba(0,0,0,0.5))" : "none"
          }}
        >
          {data.isClothing && (
            <div 
              class={data.isPants && props.class && props.class.includes('prismatic-filter') ? 'prismatic-anim' : ''}
              style={{
                width: "100%",
                height: "100%",
                "background-color": (data.isPants && props.class && props.class.includes('prismatic-filter')) ? '#ff0000' : (data.defaultColor ? `rgb(${data.defaultColor.split(' ').join(',')})` : (data.isPants ? 'transparent' : '#fff')),
                "mask-image": `url('${data.url}')`,
                "mask-position": `-${((idx % cols) * bWidth) + (data.isShirt ? 128 : 0)}px -${Math.floor(idx / cols) * bHeight + (data.isPants ? 14 : 0)}px`,
                "mask-size": data.textureWidth ? `${data.textureWidth}px auto` : `${cols * bWidth}px auto`,
                "mask-repeat": "no-repeat",
                "-webkit-mask-image": `url('${data.url}')`,
                "-webkit-mask-position": `-${((idx % cols) * bWidth) + (data.isShirt ? 128 : 0)}px -${Math.floor(idx / cols) * bHeight + (data.isPants ? 14 : 0)}px`,
                "-webkit-mask-size": data.textureWidth ? `${data.textureWidth}px auto` : `${cols * bWidth}px auto`,
                "-webkit-mask-repeat": "no-repeat"
              }}
            />
          )}
        </div>
        );
      })() : renderFallback()}
    </div>
  );
};
