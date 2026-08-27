// @ts-nocheck
import { Show, createMemo } from 'solid-js';
import { 
  PrimaryBootColors, SecondaryBootColors, TertiaryBootColors, QuaternaryBootColors,
  PrimarySkinColors, SecondarySkinColors, TertiarySkinColors, AccessoryIsTinted
} from '../../../utils/stardew/CharacterColors';

interface CharacterPreviewProps {
  parsedVariables: any;
  scale?: number;
}

export const CharacterPreview = (props: CharacterPreviewProps) => {
  const getText = (obj: any) => (typeof obj === 'object' && obj ? obj['#text'] || obj['text'] : obj);

  const player = createMemo(() => {
    const pv = props.parsedVariables;
    return pv?.player || pv?.SaveGame?.player || pv || {};
  });
  
  const gender = createMemo(() => {
    const isMale = getText(player().isMale);
    return isMale === 'true' || isMale === true || isMale === '1' ? 'male' : 'female';
  });
  const isFemale = createMemo(() => gender() === 'female');

  const baseSheet = createMemo(() => `/stardew/img/${gender()}_farmer.png`);
  const otherSheet = createMemo(() => `/stardew/img/${gender()}_farmer_other.png`);
  const armsSheet = createMemo(() => `/stardew/img/${gender()}_farmer_arms.png`);
  const bootsSheet = createMemo(() => `/stardew/img/${gender()}_farmer_boots.png`);

  const hairstyleRaw = createMemo(() => parseInt(getText(player().hair) || '0', 10));
  const hairstyle = createMemo(() => hairstyleRaw() >= 56 ? hairstyleRaw() - 56 : hairstyleRaw());
  const hairSheet = createMemo(() => `/stardew/hairstyles${hairstyleRaw() >= 56 ? '2' : ''}.png`);
  
  const pantsSheet = '/stardew/pants.png';
  const shirtSheet = '/stardew/shirts.png';
  const accessoriesSheet = '/stardew/accessories.png';
  const hatSheet = '/stardew/hats.png';

  const defaultTint = { R: 0, G: 0, B: 0, A: 0 };
  
  const parseColor = (col: any, fallback: any) => {
    if (!col || (col.A === undefined && col.R === undefined)) return fallback;
    return {
      R: parseInt(getText(col.R) || '0', 10),
      G: parseInt(getText(col.G) || '0', 10),
      B: parseInt(getText(col.B) || '0', 10),
      A: parseInt(getText(col.A) || '255', 10)
    };
  };

  const skin = createMemo(() => parseInt(getText(player().skin) || '0', 10));
  const skinTones = createMemo(() => [
    PrimarySkinColors[skin()] || PrimarySkinColors[0],
    SecondarySkinColors[skin()] || SecondarySkinColors[0],
    TertiarySkinColors[skin()] || TertiarySkinColors[0],
  ]);

  const eyeTint = createMemo(() => parseColor(player().newEyeColor || player().eyeColor, { R: 122, G: 68, B: 52, A: 255 }));

  const hairTint = createMemo(() => parseColor(player().hairstyleColor, { R: 193, G: 90, B: 50, A: 255 }));

  const shirtItem = createMemo(() => player().shirtItem);
  const pantsItem = createMemo(() => player().pantsItem);
  const hatItem = createMemo(() => player().hat);
  const bootsItem = createMemo(() => player().boots);

  const shirtTint = createMemo(() => parseColor(shirtItem()?.clothesColor, defaultTint));

  const pantsTint = createMemo(() => {
    const itemCol = pantsItem()?.clothesColor;
    if (itemCol && getText(itemCol.A) !== '0') return parseColor(itemCol, defaultTint);
    const pCol = player().pantsColor;
    if (pCol) return parseColor(pCol, defaultTint);
    return { R: 46, G: 85, B: 183, A: 255 };
  });

  const bootIndex = createMemo(() => {
    let idxStr = getText(bootsItem()?.indexInColorSheet) || getText(bootsItem()?.indexInTileSheet) || getText(bootsItem()?.itemId);
    if (idxStr) idxStr = String(idxStr).replace(/^\([a-zA-Z]+\)/, '');
    return parseInt(idxStr || '0', 10);
  });
  
  const bootTints = createMemo(() => [
    PrimaryBootColors[bootIndex()] || PrimaryBootColors[0],
    SecondaryBootColors[bootIndex()] || SecondaryBootColors[0],
    TertiaryBootColors[bootIndex()] || TertiaryBootColors[0],
    QuaternaryBootColors[bootIndex()] || QuaternaryBootColors[0],
  ]);

  const HAT_SPRITES: Record<string, number> = {
    'AbigailsBow': 94, 'TricornHat': 95, 'JojaCap': 96, 'LaurelWreathCrown': 97,
    'GilsHat': 98, 'BlueBow': 99, 'DarkVelvetBow': 100, 'MummyMask': 101,
    'BucketHat': 102, 'SquidHat': 103, 'SportsCap': 104, 'RedFez': 105,
    'RaccoonHat': 106, 'SteelPanHat': 107, 'GoldPanHat': 108, 'IridiumPanHat': 109,
    'MysteryHat': 110, 'DarkBallcap': 111, 'LeprechuanHat': 112, 'JunimoHat': 113,
    'PaperHat': 114, 'PageboyCap': 115, 'JesterHat': 116, 'BlueRibbon': 117,
    'GovernorsHat': 118, 'WhiteBow': 119, 'SpaceHelmet': 120, 'InfinityCrown': 121
  };

  const CLOTHING_SPRITES: Record<string, number> = {
    'MysteryShirt': 300, 'SoftEdgePullover': 301
  };

  const getSpriteId = (item: any, expectedType: string = '') => {
    if (!item) return -1;
    let type = expectedType || item['@type'] || item['@_xsi:type'] || item['@xsi:type'] || item['xsi:type'] || getText(item.type) || 'Unknown';
    if (item.clothesType) type = 'Clothing';
    if (item.indexInColorSheet && !type) type = 'Hat';

    let idStr = getText(item.indexInTileSheet);
    if (!idStr || idStr === '-1') {
      idStr = getText(item.itemId) || getText(item.indexOfMenuItemView) || getText(item.IndexOfMenuItemView) || getText(item.parentSheetIndex) || getText(item.ParentSheetIndex) || getText(item.initialParentTileIndex) || getText(item.which);
    }
    if (idStr) idStr = String(idStr).replace(/^\([a-zA-Z]+\)/, '');
    let id = parseInt(idStr || '-1', 10);
    
    if (isNaN(id)) {
        if (type === 'Hat') id = HAT_SPRITES[idStr] !== undefined ? HAT_SPRITES[idStr] : -1;
        else if (type === 'Clothing') id = CLOTHING_SPRITES[idStr] !== undefined ? CLOTHING_SPRITES[idStr] : -1;
        else id = -1;
    }
    return id;
  };

  const shirtId = createMemo(() => {
    const item = shirtItem();
    if (item) return getSpriteId(item, 'Clothing');
    const pStr = getText(player().shirt);
    const parsed = parseInt(pStr || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  });
  
  const pantsId = createMemo(() => {
    const item = pantsItem();
    if (item) return getSpriteId(item, 'Clothing');
    const pStr = getText(player().pants);
    const parsed = parseInt(pStr || '0', 10);
    return isNaN(parsed) ? 0 : parsed;
  });

  const hatId = createMemo(() => getSpriteId(hatItem(), 'Hat'));
  const accessoryId = createMemo(() => {
    const pStr = getText(player().accessory);
    const parsed = parseInt(pStr || '-1', 10);
    return isNaN(parsed) ? -1 : parsed;
  });

  const showHair = createMemo(() => {
    const hatInfo = hatItem();
    if (!hatInfo) return true;
    const isHat = hatInfo['@_xsi:type'] === 'Hat' || hatInfo.type === 'Hat';
    if (!isHat) return true;
    const showReal = getText(hatInfo.info?.showRealHair);
    if (showReal === 'false') return false;
    return true;
  });

  const isItemPrismatic = (item: any, type: string) => {
    if (!item) return false;
    const itemName = getText(item.name) || getText(item.Name) || '';
    return itemName.includes('Prismatic') || 
           itemName.includes('Galaxy') || 
           (type === 'Clothing' && item.prismatic?.['#text'] === 'true') ||
           (type === 'Hat' && item.isPrismatic?.['#text'] === 'true') ||
           (itemName.includes('Magic') && itemName.includes('Hair'));
  };

  const isShirtPrismatic = createMemo(() => isItemPrismatic(shirtItem(), 'Clothing'));
  const isPantsPrismatic = createMemo(() => isItemPrismatic(pantsItem(), 'Clothing'));
  const isHatPrismatic = createMemo(() => isItemPrismatic(hatItem(), 'Hat'));

  const Layer = (p: { z: number; name: string; sheet: string; x: number; y: number; tint?: any; isMultiply?: boolean; style?: any; maskX?: number; isPrismatic?: boolean }) => {
    const hasTint = p.tint && p.tint.A > 0;
    const mx = p.maskX !== undefined ? p.maskX : p.x;
    return (
      <div 
        class={`absolute ${p.name} ${(p.isPrismatic && !hasTint) ? 'prismatic-anim' : ''}`}
        style={{
          "z-index": p.z,
          left: '0px',
          top: '0px',
          width: '16px',
          height: '32px',
          "background-image": `url(${p.sheet})`,
          "background-position": `-${p.x}px -${p.y}px`,
          "image-rendering": 'pixelated',
          ...(p.style || {})
        }}
      >
        <Show when={hasTint}>
          <div 
            class={p.isPrismatic ? 'prismatic-anim' : ''}
            style={{
              position: 'absolute', inset: 0,
              "background-color": p.isPrismatic ? '#ff0000' : `rgba(${p.tint.R}, ${p.tint.G}, ${p.tint.B}, ${p.tint.A / 255})`,
              "mix-blend-mode": p.isMultiply ? 'multiply' : 'normal',
              "-webkit-mask-image": `url(${p.sheet})`,
              "-webkit-mask-position": `-${mx}px -${p.y}px`,
              "mask-image": `url(${p.sheet})`,
              "mask-position": `-${mx}px -${p.y}px`
            }} 
          />
        </Show>
      </div>
    );
  };

  const scale = () => props.scale || 1;
  const finalScale = () => scale() * 2.5;

  return (
    <div class="flex items-center justify-center shrink-0" style={{ width: `${16 * finalScale()}px`, height: `${32 * finalScale()}px`, position: 'relative' }}>
      <div 
        class={`absolute top-0 left-0 w-[16px] h-[32px]`} 
        style={{ transform: `scale(${finalScale()})`, "transform-origin": "top left" }}
      >
      {/* Base Layers */}
      <Layer z={1} name="base-3" sheet={baseSheet()} x={32} y={0} tint={skinTones()[2]} />
      <Layer z={2} name="base-2" sheet={baseSheet()} x={16} y={0} tint={skinTones()[1]} />
      <Layer z={3} name="base-1" sheet={baseSheet()} x={0} y={0} tint={skinTones()[0]} />

      {/* Eyes & Iris */}
      <Layer z={4} name="eyes" sheet={otherSheet()} x={0} y={0} />
      <Layer z={5} name="iris" sheet={otherSheet()} x={16} y={0} tint={eyeTint()} />

      {/* Boots */}
      <Layer z={6} name="boots-4" sheet={bootsSheet()} x={16} y={0} tint={bootTints()[0]} />
      <Layer z={7} name="boots-3" sheet={bootsSheet()} x={32} y={0} tint={bootTints()[1]} />
      <Layer z={8} name="boots-2" sheet={bootsSheet()} x={0} y={0} tint={bootTints()[2]} />
      <Layer z={9} name="boots-1" sheet={bootsSheet()} x={48} y={0} tint={bootTints()[3]} />

      {/* Pants */}
      <Show when={pantsId() >= 0}>
        <Layer z={10} name="pants" sheet={pantsSheet} x={((pantsId() % 10) * 192) + (isFemale() ? 96 : 0)} y={(Math.floor(pantsId() / 10) * 688) + 0} tint={pantsTint()} isMultiply={true} isPrismatic={isPantsPrismatic()} style={{ top: '0px' }} />
      </Show>

      {/* Arms */}
      <Layer z={11} name="arms-3" sheet={armsSheet()} x={32} y={0} tint={skinTones()[2]} />
      <Layer z={12} name="arms-2" sheet={armsSheet()} x={16} y={0} tint={skinTones()[1]} />
      <Layer z={13} name="arms-1" sheet={armsSheet()} x={0} y={0} tint={skinTones()[0]} />

      {/* Shirt */}
      <Show when={shirtId() >= 0}>
        <Layer z={14} name="shirt" sheet={shirtSheet} x={(shirtId() % 16) * 8} y={Math.floor(shirtId() / 16) * 32} maskX={((shirtId() % 16) * 8) + (shirtTint().A > 0 ? 128 : 0)} tint={shirtTint()} isMultiply={true} isPrismatic={isShirtPrismatic()} style={{ width: '8px', height: '8px', top: isFemale() ? '16px' : '15px', left: '4px' }} />
      </Show>

      {/* Accessory */}
      <Show when={accessoryId() >= 0}>
        <Layer z={15} name="accessory" sheet={accessoriesSheet} x={(accessoryId() % 8) * 16} y={Math.floor(accessoryId() / 8) * 32} tint={AccessoryIsTinted(accessoryId()) ? hairTint() : undefined} isMultiply={true} style={{ width: '16px', height: '16px', top: isFemale() ? '3px' : '2px' }} />
      </Show>

      {/* Hair */}
      <Show when={showHair()}>
        <Layer z={16} name="hair" sheet={hairSheet()} x={(hairstyle() % 8) * 16} y={Math.floor(hairstyle() / 8) * (hairstyleRaw() >= 56 ? 128 : 96)} tint={hairTint()} isMultiply={true} style={{ width: '16px', height: '32px', top: isFemale() ? '1px' : '-1px' }} />
      </Show>

      {/* Hat */}
      <Show when={hatId() >= 0}>
        <Layer z={17} name="hat" sheet={hatSheet} x={(hatId() % 12) * 20} y={Math.floor(hatId() / 12) * 80} isPrismatic={isHatPrismatic()} style={{ width: '20px', height: '20px', top: isFemale() ? '-1px' : '-2px', left: '-2px' }} />
      </Show>

      </div>
    </div>
  );
};