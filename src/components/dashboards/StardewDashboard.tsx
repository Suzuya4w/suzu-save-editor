// @ts-nocheck
import { createSignal, createMemo, Show, Switch, Match, createEffect, For } from 'solid-js';
import { useEditorStore, updateValue, setStardewActiveTab } from '../../store/editorStore';
import { Users, User, BookOpen, Warehouse, Palette, TrendingUp, Gem, Shirt, Crown, Navigation, Home, Building2, Wand, Baby } from 'lucide-solid';
import { CharacterPreview } from './stardew/CharacterPreview';
import { InventoryGrid } from './stardew/InventoryGrid';
import { RelationshipsTab } from './stardew/RelationshipsTab';
import { RecipesTab } from './stardew/RecipesTab';
import { FarmhandsTab } from './stardew/FarmhandsTab';
import { BuildingsTab } from './stardew/BuildingsTab';
import { CommunityCenterTab } from './stardew/CommunityCenterTab';
import { ChildrenTab } from './stardew/ChildrenTab';
import { AppearanceTab } from './stardew/AppearanceTab';
import { SkillsTab } from './stardew/SkillsTab';
import { ItemSprite } from './stardew/ItemSprite';
import { StoryTab } from './stardew/StoryTab';
import { FarmLayoutVisualizer } from './stardew/FarmLayoutVisualizer';
import { Tooltip } from '../Header';

const toArray = (obj: any): any[] => {
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

const DashboardInput = (props: { value: string | number, type: 'text' | 'number', onChange: (val: string) => void, class?: string }) => {
  return (
    <input 
      type={props.type}
      value={String(props.value)}
      onInput={(e) => {
        props.onChange(e.currentTarget.value);
      }}
      class={props.class}
    />
  );
};

export const StardewDashboard = () => {
  const store = useEditorStore();
  const activeTab = () => store.stardewActiveTab;
  const setActiveTab = setStardewActiveTab;
  const [indicatorStyle, setIndicatorStyle] = createSignal({ left: '0px', width: '0px' });
  const tabRefs: Record<string, HTMLButtonElement> = {};

  createEffect(() => {
    const data = pv();
    const currentTab = activeTab();
    
    if (data) {
       setTimeout(() => {
         const btn = tabRefs[currentTab];
         if (btn) {
           setIndicatorStyle({
             left: `${btn.offsetLeft}px`,
             width: `${btn.offsetWidth}px`
           });
         }
       }, 10);
    }
  });
  
  const [selectedEquipmentPath, setSelectedEquipmentPath] = createSignal<string | null>(null);
  
  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();

  const getPath = (key: string) => {
    if (pv()?.SaveGame?.player) return `SaveGame.player.${key}`;
    if (pv()?.player) return `player.${key}`;
    return key;
  };

  const getNumber = (val: any): number => {
    const text = getText(val);
    if (text.startsWith('{')) return 0;
    return parseInt(text, 10) || 0;
  };

  const getUpdatePath = (key: string) => {
    const val = player() ? player()[key] : undefined;
    const p = getPath(key);
    if (typeof val === 'object' && val !== null) {
      if ('$text' in val) return `${p}.$text`;
      if ('$value' in val) return `${p}.$value`;
      if ('#text' in val) return `${p}.#text`;
      if ('' in val) return `${p}.`;
    }
    return p;
  };

const handleNumberChange = (key: string, valStr: string) => {
    if (valStr === '') {
      updateValue(getUpdatePath(key), 0);
      return;
    }
    const val = parseInt(valStr, 10);
    if (!isNaN(val)) updateValue(getUpdatePath(key), val);
  };

  const getGlobalNumber = (key: string): number => {
    const root = pv()?.SaveGame || pv();
    const text = getText(root?.[key]);
    if (text.startsWith('{')) return 0;
    return parseInt(text, 10) || 0;
  };

  const getGlobalString = (key: string): string => {
    const root = pv()?.SaveGame || pv();
    return getText(root?.[key]);
  };

  const handleGlobalStringChange = (key: string, val: string) => {
    const p = pv()?.SaveGame ? `SaveGame.${key}` : key;
    const root = pv()?.SaveGame || pv();
    const existing = root?.[key];
    let targetPath = p;
    if (typeof existing === 'object' && existing !== null) {
      if ('$text' in existing) targetPath = `${p}.$text`;
      else if ('$value' in existing) targetPath = `${p}.$value`;
      else if ('#text' in existing) targetPath = `${p}.#text`;
      else if ('' in existing) targetPath = `${p}.`;
    }
    updateValue(targetPath, val);
  };

  const handleGlobalNumberChange = (key: string, valStr: string) => {
    const val = parseInt(valStr, 10);
    if (!isNaN(val)) {
      const p = pv()?.SaveGame ? `SaveGame.${key}` : key;
      const root = pv()?.SaveGame || pv();
      const existing = root?.[key];
      let targetPath = p;
      if (typeof existing === 'object' && existing !== null) {
        if ('$text' in existing) targetPath = `${p}.$text`;
        else if ('$value' in existing) targetPath = `${p}.$value`;
        else if ('#text' in existing) targetPath = `${p}.#text`;
        else if ('' in existing) targetPath = `${p}.`;
      }
      updateValue(targetPath, val);
    }
  };

  const getWalletValue = (key: string) => {
    const val = player() ? player()[key] : undefined;
    if (!val) return false;
    const text = getText(val).toLowerCase();
    return text === 'true';
  };

  const toggleWalletItem = (key: string) => {
    const current = getWalletValue(key);
    updateValue(getUpdatePath(key), current ? false : true);
  };

  const classicWallet: { key: string, label: string, itemSpriteName: string, isEvent?: boolean, isMail?: boolean }[] = [
    { key: 'canReadJunimoText', label: 'Forest Magic', itemSpriteName: 'Forest Magic', isMail: true },
    { key: 'HasDwarvishTranslationGuide', label: 'Dwarvish Translation Guide', itemSpriteName: 'Dwarvish Translation Guide', isMail: true },
    { key: 'hasRustyKey', label: 'Rusty Key', itemSpriteName: 'Rusty Key' },
    { key: 'hasClubCard', label: 'Club Card', itemSpriteName: 'Club Card' },
    { key: 'hasSpecialCharm', label: 'Special Charm', itemSpriteName: 'Special Charm' },
    { key: 'hasSkullKey', label: 'Skull Key', itemSpriteName: 'Skull Key' },
    { key: 'hasMagnifyingGlass', label: 'Magnifying Glass', itemSpriteName: 'Magnifying Glass' },
    { key: 'hasDarkTalisman', label: 'Dark Talisman', itemSpriteName: 'Dark Talisman' },
    { key: 'hasMagicInk', label: 'Magic Ink', itemSpriteName: 'Magic Ink' },
    { key: '2120303', label: "Bear's Knowledge", itemSpriteName: "Bear's Knowledge", isEvent: true },
    { key: '3910979', label: "Spring Onion Mastery", itemSpriteName: "Spring Onion Mastery", isEvent: true },
    { key: 'HasTownKey', label: 'Key To The Town', itemSpriteName: 'Key To The Town', isMail: true }
  ];

  const hasStatValue = (key: string) => {
    const vals = toArray(player()?.stats?.Values?.item);
    return vals.some(v => getText(v?.key?.string) === key && parseInt(getText(v?.value?.unsignedInt) || '0', 10) > 0);
  };

const toggleStatValue = (key: string) => {
    const vals = toArray(player()?.stats?.Values?.item);
    const existsIndex = vals.findIndex(v => getText(v?.key?.string) === key);
    let newVals = [...vals];
    
    let isActivating = false;
    if (existsIndex >= 0) {
      if (parseInt(getText(newVals[existsIndex]?.value?.unsignedInt) || '0', 10) > 0) {
        newVals.splice(existsIndex, 1);

        if (key === 'mastery_4') {
          const trinketIdx = newVals.findIndex(v => getText(v?.key?.string) === 'trinketSlots');
          if (trinketIdx >= 0) newVals.splice(trinketIdx, 1);
        }
        
      } else {
        newVals[existsIndex] = { key: { string: key }, value: { unsignedInt: 1 } };
        isActivating = true;
      }
    } else {
      newVals.push({ key: { string: key }, value: { unsignedInt: 1 } });
      isActivating = true;
    }

    if (isActivating && key === 'mastery_4') {
      const trinketIdx = newVals.findIndex(v => getText(v?.key?.string) === 'trinketSlots');
      if (trinketIdx < 0) {
        newVals.push({ key: { string: 'trinketSlots' }, value: { unsignedInt: 1 } });
      } else {
        newVals[trinketIdx] = { key: { string: 'trinketSlots' }, value: { unsignedInt: 1 } };
      }
    }

    if (isActivating && key.startsWith('mastery_')) {
      const skillKeys = ['farmingLevel', 'fishingLevel', 'foragingLevel', 'miningLevel', 'combatLevel'];
      const basePath = pv()?.SaveGame?.player ? 'SaveGame.player' : 'player';
      
      skillKeys.forEach((sk, i) => {
        const levelValObj = player() ? player()![sk] : undefined;
        let levelPath = `${basePath}.${sk}`;
        if (typeof levelValObj === 'object' && levelValObj !== null) {
          if ('$text' in levelValObj) levelPath += '.$text';
          else if ('$value' in levelValObj) levelPath += '.$value';
          else if ('#text' in levelValObj) levelPath += '.#text';
          else if ('' in levelValObj) levelPath += '.';
        }
        
        const currentLvl = parseInt(getText(levelValObj) || '0', 10);
        if (currentLvl < 10) {
          updateValue(levelPath, 10);
        }

        const xpArr = toArray(player()?.experiencePoints?.int);
        if (xpArr.length > i) {
          const xpValObj = xpArr[i];
          let xpPath = `${basePath}.experiencePoints.int.${i}`;
          if (typeof xpValObj === 'object' && xpValObj !== null) {
            if ('$text' in xpValObj) xpPath += '.$text';
            else if ('$value' in xpValObj) xpPath += '.$value';
            else if ('#text' in xpValObj) xpPath += '.#text';
            else if ('' in xpValObj) xpPath += '.';
          }
          const currentXp = parseInt(getText(xpValObj) || '0', 10);
          if (currentXp < 15000) {
            updateValue(xpPath, 15000);
          }
        }
      });
    }

    if (key.startsWith('mastery_')) {
      let masteryCount = 0;
      newVals.forEach(v => {
         const k = getText(v?.key?.string);
         if (k && k.startsWith('mastery_') && parseInt(getText(v?.value?.unsignedInt) || '0', 10) > 0) {
            masteryCount++;
         }
      });

      const spentIdx = newVals.findIndex(v => getText(v?.key?.string) === 'masteryLevelsSpent');
      if (spentIdx >= 0) {
        newVals[spentIdx] = { key: { string: 'masteryLevelsSpent' }, value: { unsignedInt: masteryCount } };
      } else if (masteryCount > 0) {
        newVals.push({ key: { string: 'masteryLevelsSpent' }, value: { unsignedInt: masteryCount } });
      }

      const expRequired = [0, 10000, 25000, 45000, 70000, 100000];
      const targetExp = expRequired[masteryCount] || 100000;
      const expIdx = newVals.findIndex(v => getText(v?.key?.string) === 'MasteryExp');
      if (expIdx >= 0) {
         const currExp = parseInt(getText(newVals[expIdx]?.value?.unsignedInt) || '0', 10);
         if (currExp < targetExp) {
            newVals[expIdx] = { key: { string: 'MasteryExp' }, value: { unsignedInt: targetExp } };
         }
      } else if (targetExp > 0) {
         newVals.push({ key: { string: 'MasteryExp' }, value: { unsignedInt: targetExp } });
      }
    }

    const p = pv()?.SaveGame ? 'SaveGame.player.stats.Values.item' : 'player.stats.Values.item';
    updateValue(p, newVals);
  };

  const hasMailReceived = (id: string) => {
    const mails = toArray(player()?.mailReceived?.string);
    return mails.some(m => getText(m) === id);
  };

  const toggleMailReceived = (id: string) => {
    const mails = toArray(player()?.mailReceived?.string);
    let newMails = [...mails];
    const exists = newMails.some(m => getText(m) === id);
    if (exists) {
      newMails = newMails.filter(m => getText(m) !== id);
    } else {
      const template = mails.length > 0 ? (typeof mails[0] === 'object' ? { '#text': id } : id) : id;
      newMails.push(template);
    }
    const p = pv()?.SaveGame ? 'SaveGame.player.mailReceived.string' : 'player.mailReceived.string';
    updateValue(p, newMails);
  };

  const hasEventSeen = (id: string) => {
    const events = toArray(player()?.eventsSeen?.int);
    return events.some(e => getText(e) === id);
  };

  const toggleEventSeen = (id: string) => {
    const events = toArray(player()?.eventsSeen?.int);
    let newEvents = [...events];
    const exists = newEvents.some(e => getText(e) === id);
    if (exists) {
      newEvents = newEvents.filter(e => getText(e) !== id);
    } else {
      const template = events.length > 0 ? (typeof events[0] === 'object' ? { '#text': id } : id) : id;
      newEvents.push(template);
    }
    const p = pv()?.SaveGame ? 'SaveGame.player.eventsSeen.int' : 'player.eventsSeen.int';
    updateValue(p, newEvents);
  };

  const powersBooks = [
    { key: 'Book_PriceCatalogue', label: 'Price Catalogue', spriteName: "Price Catalogue" },
    { key: 'Book_Marlon', label: 'Mapping Cave Systems', spriteName: "Mapping Cave Systems" },
    { key: 'Book_Speed', label: 'Way Of The Wind pt. 1', spriteName: "Way Of The Wind pt. 1" },
    { key: 'Book_Speed2', label: 'Way Of The Wind pt. 2', spriteName: "Way Of The Wind pt. 2" },
    { key: 'Book_Void', label: 'Monster Compendium', spriteName: "Monster Compendium" },
    { key: 'Book_Friendship', label: 'Friendship 101', spriteName: "Friendship 101" },
    { key: 'Book_Defense', label: 'Jack Be Nimble, Jack Be Thick', spriteName: "Jack Be Nimble" },
    { key: 'Book_Woodcutting', label: 'Woody\'s Secret', spriteName: "Woody's Secret" },
    { key: 'Book_WildSeeds', label: 'Raccoon Journal', spriteName: "Raccoon Journal" },
    { key: 'Book_Roe', label: 'Jewels Of The Sea', spriteName: "Jewels Of The Sea" },
    { key: 'Book_Bombs', label: 'Dwarvish Safety Manual', spriteName: "Dwarvish Safety Manual" },
    { key: 'Book_Crabbing', label: 'The Art O\' Crabbing', spriteName: "The Art o' Crabbing" },
    { key: 'Book_Trash', label: 'The Alleyway Buffet', spriteName: "Alleyway Buffet" },
    { key: 'Book_Diamonds', label: 'The Diamond Hunter', spriteName: "Diamond Hunter" },
    { key: 'Book_Mystery', label: 'Book of Mysteries', spriteName: "Mystery Book" },
    { key: 'Book_Horse', label: 'Horse: The Book', spriteName: "Horse: The Book" },
    { key: 'Book_Artifact', label: 'Treasure Appraisal Guide', spriteName: "Treasure Appraisal Guide" },
    { key: 'Book_Slime', label: 'Ol\' Slitherlegs', spriteName: "Ol' Slitherlegs" },
    { key: 'Book_AnimalCatalogue', label: 'Animal Catalogue', spriteName: "Animal Catalogue" }
  ];

  const masteryStars = [
    { key: 'mastery_0', label: 'Farming Mastery' },
    { key: 'mastery_1', label: 'Fishing Mastery' },
    { key: 'mastery_2', label: 'Foraging Mastery' },
    { key: 'mastery_3', label: 'Mining Mastery' },
    { key: 'mastery_4', label: 'Combat Mastery' }
  ];

  const getPantsColor = () => {
    if (!player()?.pantsColor) return '#333333';
    const r = getText(player().pantsColor.R) || 0;
    const g = getText(player().pantsColor.G) || 0;
    const b = getText(player().pantsColor.B) || 0;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getEquipmentSprite = (item: any, expectedType?: string): any => {
    if (!item || typeof item !== 'object') return null;

    const xsiType = item['@_xsi:type'] || item['@xsi:type'] || item['xsi:type'];
    const combinedData = item.combinedRings || item.CombinedRings;
    if (xsiType === 'CombinedRing' && combinedData) {
        const items = combinedData.Item || combinedData.Ring;
        if (items) {
           let rings = Array.isArray(items) ? items : [items];
           if (rings.length >= 2) {
               let r1 = getEquipmentSprite(rings[0]);
               let r2 = getEquipmentSprite(rings[1]);
               if (r1 && r2) {
                   return { isCombinedRing: true, innerSprites: [r1, r2], spriteWidth: 16, spriteHeight: 16 };
               }
           }
        }
    }
    let type = item['@type'] || item['@_xsi:type'] || item['@xsi:type'] || item['xsi:type'] || getText(item.type) || expectedType;
    if (item.clothesType) type = 'Clothing';
    if (item.indexInTileSheet && !type) {
        if (item.clothesType) type = 'Clothing';
        else if (item.indexInColorSheet) type = 'Hat';
    }
    
    let sheetUrl = '/stardew/springobjects.png';
    let columns = 24;
    let blockWidth = 16; let blockHeight = 16;
    let spriteWidth = 16; let spriteHeight = 16;
    
    let idStr = '';
    if (type === 'Clothing' || type === 'Hat' || type === 'Boots') {
        idStr = getText(item.indexInTileSheet);
    }

    if (!idStr || idStr === '-1') {
        idStr = getText(item.itemId) || getText(item.indexOfMenuItemView) || getText(item.IndexOfMenuItemView) || getText(item.parentSheetIndex) || getText(item.ParentSheetIndex) || getText(item.initialParentTileIndex) || getText(item.which);
    }

    if (!idStr || idStr === '-1') {
      let itemIdVal = getText(item.itemId);
      if (itemIdVal) itemIdVal = String(itemIdVal).replace(/^\([a-zA-Z]+\)/, '');
      if (itemIdVal && !isNaN(parseInt(itemIdVal, 10))) idStr = itemIdVal;
    }

    let isPants = getText(item.clothesType) === '1' || getText(item.ClothesType) === '1' || expectedType === 'Pants';
    const itemName = getText(item.name) || getText(item.Name) || '';
    if (itemName.includes('Pants')) isPants = true;

    type = expectedType || getText(item['@_xsi:type']) || getText(item['@xsi:type']) || type || 'Unknown';
    if (type.includes('Ring')) type = 'Ring';
    if (type.includes('Clothing')) type = 'Clothing';
    if (type.includes('Boots')) type = 'Boots';
    if (type.includes('Hat')) type = 'Hat';
    if (expectedType === 'Pants') type = 'Clothing';

    const TRINKET_SPRITES: Record<string, number> = {
      'MagicHairDye': 1, 'FrogEgg': 6, 'MagicQuiver': 73, 'FairyBox': 74,
      'ParrotEgg': 2, 'IceRod': 78, 'IridiumSpur': 76, 'BasiliskPaw': 77
    };
    
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

    const cleanIdStr = idStr ? String(idStr).replace(/^\([a-zA-Z]+\)/, '') : '0';
    let id = parseInt(cleanIdStr, 10);

    if (type === 'Ring' || type === 'Boots') {
      sheetUrl = '/stardew/springobjects.png';
    } else if (type === 'Trinket') {
      sheetUrl = '/stardew/Objects_2.png';
      columns = 8;
      if (isNaN(id)) {
          id = TRINKET_SPRITES[cleanIdStr] || 0;
      }
    } else if (type === 'Hat') {
      sheetUrl = '/stardew/hats.png';
      columns = 12; blockWidth = 20; blockHeight = 80; spriteWidth = 20; spriteHeight = 20;
      if (isNaN(id)) {
          id = HAT_SPRITES[cleanIdStr] || 0;
      }
    } else if (type === 'Clothing') {
      if (isPants) {
         sheetUrl = '/stardew/pants.png';
         columns = 10; blockWidth = 192; blockHeight = 688; spriteWidth = 16; spriteHeight = 16; 
      } else {
         sheetUrl = '/stardew/shirts.png';
         columns = 16; blockWidth = 8; blockHeight = 32; spriteWidth = 8; spriteHeight = 8;
         if (isNaN(id)) {
             id = CLOTHING_SPRITES[cleanIdStr] || 0;
         }
      }
    }
    
    if (type === 'Trinket' && isNaN(id)) {
      id = TRINKET_SPRITES[cleanIdStr] || 0;
    }

    if ((isNaN(id) || !idStr) && !isPants) return null;
    if (id < 0 && type === 'Clothing') id = 0;
    if (isNaN(id) && isPants) id = 0;

    const upgradeLevel = parseInt(getText(item.upgradeLevel), 10) || 0;
    if (type === 'Pan') {
        if (upgradeLevel === 2) id = 18;
        else if (upgradeLevel === 3) id = 19;
        else if (upgradeLevel === 4) id = 20;
        else id = 12;
    }

    const x = (id % columns) * blockWidth;
    let y = Math.floor(id / columns) * blockHeight;
    if (isPants) y += 14;

    const maskX = type === 'Clothing' && !isPants ? x + 128 : x;
    const maskY = y;

    const rawItemId = String(getText(item.itemId) || getText(item.ItemId) || '').toLowerCase();
    const isPrismatic = 
      itemName.includes('Prismatic') || 
      rawItemId.includes('prismatic') ||
      itemName.includes('Galaxy') || 
      (type === 'Clothing' && item.prismatic?.['#text'] === 'true') ||
      (type === 'Hat' && item.isPrismatic?.['#text'] === 'true') ||
      (itemName.includes('Magic') && itemName.includes('Hair'));

    return { sheetUrl, x, y, spriteWidth, spriteHeight, type, maskX, maskY, isPrismatic };
  };

  const RenderEquipmentSlot = (props: { item: any, path: string, fallbackIcon: React.ReactNode, expectedType?: string }) => {
    const isNil = () => !props.item || props.item['@_xsi:nil'] === 'true' || props.item['@xsi:nil'] === 'true' || Object.keys(props.item).length === 0 || props.item === '';
    const sprite = createMemo(() => isNil() ? null : getEquipmentSprite(props.item, props.expectedType));
    const isSelected = () => selectedEquipmentPath() === props.path;
    
    const scaleX = () => sprite() ? 36 / sprite()!.spriteWidth : 1;
    const scaleY = () => sprite() ? 36 / sprite()!.spriteHeight : 1;
    const scale = () => Math.min(scaleX(), scaleY()) * 0.9; 

const dyeColor = () => props.item?.clothesColor;
    const isTinted = () => sprite()?.type === 'Clothing' && (dyeColor() || sprite()?.isPrismatic);
    
    const tintColor = () => {
       if (sprite()?.isPrismatic) return 'rgb(255, 50, 50)';
       
       const c = dyeColor();
       if (!c || getText(c.A) === '0') return 'transparent';
       const r = getText(c.R) || '255';
       const g = getText(c.G) || '255';
       const b = getText(c.B) || '255';
       return `rgb(${r}, ${g}, ${b})`;
    };

    return (
      <Show when={sprite()} fallback={
         <div 
           onClick={() => setSelectedEquipmentPath(props.path)}
           class={`w-40 h-40 bg-[#fce8b8] border-2 cursor-pointer transition-transform hover:scale-105 shadow-inner flex items-center justify-center opacity-70 rounded-4 overflow-hidden ${isSelected() ? 'border-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.5)] z-10 bg-white' : 'border-[#d79450]'}`} 
           title="Empty Slot"
         >
           {props.fallbackIcon}
         </div>
      }>
        <div 
          onClick={() => setSelectedEquipmentPath(props.path)}
          class={`w-40 h-40 bg-[#f0d8a8] border-2 cursor-pointer transition-transform hover:scale-105 border-[#c68c53] shadow-inner flex items-center justify-center rounded-4 overflow-hidden relative ${isSelected() ? 'border-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.5)] z-10' : ''}`}
          title={getText(props.item?.name) || getText(props.item?.Name) || props.expectedType || 'Equipment'}
        >
          <div style={{
            width: `${sprite()!.spriteWidth}px`, 
            height: `${sprite()!.spriteHeight}px`,
            transform: `scale(${scale()})`,
            position: 'relative'
          }}>
            <div 
               class={`absolute inset-0 ${(sprite()?.isPrismatic && !isTinted()) ? 'prismatic-anim' : ''}`}
            >
              {sprite()?.isCombinedRing ? (
                <>
                  <div
                    class="absolute inset-0"
                    style={{
                      "background-image": `url('${sprite()!.innerSprites[0].sheetUrl}')`,
                      "background-position": `-${sprite()!.innerSprites[0].x}px -${sprite()!.innerSprites[0].y}px`,
                      "image-rendering": "pixelated"
                    }}
                  />
                  <div
                    class="absolute inset-0"
                    style={{
                      "background-image": `url('${sprite()!.innerSprites[1].sheetUrl}')`,
                      "background-position": `-${sprite()!.innerSprites[1].x}px -${sprite()!.innerSprites[1].y}px`,
                      "image-rendering": "pixelated",
                      "transform": "translate(-1px, 1px)"
                    }}
                  />
                </>
              ) : (
                <div
                  class="absolute inset-0"
                  style={{
                    "background-image": `url('${sprite()!.sheetUrl}')`,
                    "background-position": `-${sprite()!.x}px -${sprite()!.y}px`,
                    "image-rendering": "pixelated"
                  }}
                />
              )}
              {isTinted() && !sprite()?.isCombinedRing && (
                <div
                  class={`absolute inset-0 ${sprite()?.isPrismatic ? 'prismatic-anim' : ''}`}
                  style={{
                    "background-color": tintColor(),
                    "mix-blend-mode": "multiply",
                    "-webkit-mask-image": `url('${sprite()!.sheetUrl}')`,
                    "-webkit-mask-position": `-${sprite()!.maskX}px -${sprite()!.maskY}px`,
                    "mask-image": `url('${sprite()!.sheetUrl}')`,
                    "mask-position": `-${sprite()!.maskX}px -${sprite()!.maskY}px`
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </Show>
    );
  };


  return (
    <Show when={store.saveData && store.saveData.parsed_variables}>
      <div class="flex-1 flex flex-col min-h-0 w-full bg-[#050505]">
      
      <div class="p-24 pb-0 shrink-0">
        <div class="flex items-center gap-16 mb-8">
          <div class="w-48 h-48 rounded-16 bg-[#1a1a1a] flex items-center justify-center border-2 border-[#d79450] shadow-inner overflow-hidden relative mt-4">
            <div class="absolute inset-0 bg-black/20" />
            <div class="relative z-10 pt-4">
              <CharacterPreview parsedVariables={store.saveData.parsed_variables} scale={1.2} />
            </div>
          </div>
          <div>
            <h1 class="text-[30px] md:text-[30px] font-stardew uppercase text-white tracking-wide drop-shadow-md">Stardew Valley Profile</h1>
            <p class="text-gray-500 font-serif text-body-medium">Manage your farmer's stats and wealth</p>
          </div>
        </div>

<div class="border-b border-white/5 pb-8 overflow-x-auto custom-scrollbar relative">
  <div class="flex items-center gap-16 whitespace-nowrap relative min-w-max px-2"> 
    <div class="absolute bottom-[-8px] h-2 bg-[#10a37f] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ left: indicatorStyle().left, width: indicatorStyle().width }} />
          <button ref={el => tabRefs['identity'] = el} onClick={() => setActiveTab('identity')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'identity' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><User size={16} /> Status & Inventory</button>
          <button ref={el => tabRefs['appearance'] = el} onClick={() => setActiveTab('appearance')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'appearance' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Palette size={16} /> Appearance</button>
          <button ref={el => tabRefs['skills'] = el} onClick={() => setActiveTab('skills')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'skills' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><TrendingUp size={16} /> Skills</button>
          <button ref={el => tabRefs['relationships'] = el} onClick={() => setActiveTab('relationships')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'relationships' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Users size={16} /> Relationships</button>
          <button ref={el => tabRefs['children'] = el} onClick={() => setActiveTab('children')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'children' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Baby size={16} /> Family</button>
          <button ref={el => tabRefs['recipes'] = el} onClick={() => setActiveTab('recipes')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'recipes' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><BookOpen size={16} /> Recipes</button>
          <button ref={el => tabRefs['community'] = el} onClick={() => setActiveTab('community')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'community' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Building2 size={16} /> Community</button>
          <button ref={el => tabRefs['farmhands'] = el} onClick={() => setActiveTab('farmhands')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'farmhands' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Warehouse size={16} /> Farmhands</button>
          <button ref={el => tabRefs['buildings'] = el} onClick={() => setActiveTab('buildings')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'buildings' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Home size={16} /> Buildings</button>
          <button ref={el => tabRefs['story'] = el} onClick={() => setActiveTab('story')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'story' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><BookOpen size={16} /> Story & Events</button>
          <button ref={el => tabRefs['farmmap'] = el} onClick={() => setActiveTab('farmmap')} class={`px-16 py-8 cursor-pointer text-body-medium font-desc font-semibold transition-colors flex items-center gap-8 ${activeTab() === 'farmmap' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}><Navigation size={16} /> Farm Map</button>
        </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar p-24 pt-24 flex flex-col gap-24 transform-gpu will-change-transform" style={{ "-webkit-font-smoothing": "antialiased" }}>
        <Switch>
          <Match when={activeTab() === 'identity'}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-24">
 <div class="bg-[#f4d499] border-[6px] border-[#c0733a] p-16 flex flex-col xl:flex-row items-center justify-center gap-32 xl:gap-[72px] rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)]">
                
                {/* --- LEFT: Equipment & Character --- */}
                <div class="flex flex-col gap-4 items-center">
                  <div class="flex gap-8">
                    <div class="flex flex-col gap-4">
                      <RenderEquipmentSlot item={player()?.leftRing} path={getPath('leftRing')} expectedType="Ring" fallbackIcon={<Gem size={16} class="text-[#c0733a] opacity-50" />} />
                      <RenderEquipmentSlot item={player()?.rightRing} path={getPath('rightRing')} expectedType="Ring" fallbackIcon={<Gem size={16} class="text-[#c0733a] opacity-50" />} />
                      <RenderEquipmentSlot item={player()?.boots} path={getPath('boots')} expectedType="Boots" fallbackIcon={<Navigation size={16} class="text-[#c0733a] opacity-50 transform rotate-180" />} />
                    </div>
                    
                    <div class="w-96 h-[140px] bg-[#fce8b8] border-4 border-[#d79450] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center rounded-4 relative overflow-hidden">
                      <div class="absolute inset-0 z-0" style={{
                        "background-image": "url('/stardew/daybg.png')",
                        "background-size": "cover",
                        "background-position": "center bottom",
                        "image-rendering": "pixelated"
                      }} />
                      <div class="relative z-10 pt-4">
                        <CharacterPreview parsedVariables={store.saveData.parsed_variables} scale={1} />
                      </div>
                    </div>

                    <div class="flex flex-col gap-4 relative">
                      <RenderEquipmentSlot item={player()?.hat} path={getPath('hat')} expectedType="Hat" fallbackIcon={<Crown size={18} class="text-[#c0733a] opacity-50" />} />
                      <div class="absolute top-0 left-full ml-4">
                      <RenderEquipmentSlot 
                        item={player()?.trinketItem} 
                        path={getPath('trinketItem')} 
                        expectedType="Trinket" 
                        fallbackIcon={<Wand size={18} class="text-[#c0733a] opacity-50" />} 
                      />
                      </div>
                      <RenderEquipmentSlot item={player()?.shirtItem} path={getPath('shirtItem')} expectedType="Clothing" fallbackIcon={<Shirt size={18} class="text-[#c0733a] opacity-50" />} />
                      <RenderEquipmentSlot item={player()?.pantsItem} path={getPath('pantsItem')} expectedType="Pants" fallbackIcon={<div style={{ "background-color": getPantsColor() }} class="w-32 h-32 rounded-4 border-2 border-black/40 shadow-inner" title="Default Farmer Pants" />} />
                    </div>
                  </div>
                  
                  <div class="mt-4 bg-[#d79450] border-2 border-[#8c4614] rounded-6 px-4 py-4 font-bold text-black shadow-sm text-center w-full max-w-[280px]">
                    <DashboardInput
                      type="text"
                      value={getText(player()?.name) || 'Unknown'}
                      onChange={(val) => updateValue(getUpdatePath('name'), val)}
                      class="bg-transparent font-serif w-full text-center focus:outline-none placeholder-black/50"
                    />
                  </div>
                </div>

                {/* --- RIGHT: Farm Details --- */}
                <div class="flex flex-col gap-16 font-serif text-black">
                  <div class="flex items-center gap-8">
                    <DashboardInput
                      type="text"
                      value={getText(player()?.farmName)}
                      onChange={(val) => updateValue(getUpdatePath('farmName'), val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-12 py-4 font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-center w-[160px] focus:outline-none focus:border-[#8c4614]"
                    />
                    <span class="text-[28px] leading-[32px] font-pixsans tracking-wide">Farm</span>
                  </div>
                  
<div class="flex items-center justify-between gap-16">
                    <span class="text-title-h5 font-bold">Current Funds:</span>
                    <DashboardInput
                      type="text" 
                      value={getNumber(player()?.money).toLocaleString('en-US')} 
                      onChange={(val) => handleNumberChange('money', val.replace(/\D/g, ''))} 
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-4 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-[144px] focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>

                  <div class="flex items-center justify-between gap-16">
                    <span class="text-title-h5 font-bold">Total Earnings:</span>
                    <DashboardInput
                      type="text"
                      value={getNumber(player()?.totalMoneyEarned).toLocaleString('en-US')}
                      onChange={(val) => handleNumberChange('totalMoneyEarned', val.replace(/\D/g, ''))}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-4 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-[144px] focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>

                  <div class="flex items-center justify-center gap-8 mt-4">
                    <span class="text-[18px] font-bold tracking-wide">Day</span>
                    <DashboardInput
                      type="number"
                      value={getGlobalNumber('dayOfMonth')}
                      onChange={(val) => handleGlobalNumberChange('dayOfMonth', val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-4 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-center w-48 focus:outline-none focus:border-[#8c4614]"
                    />
                    <span class="text-[18px] font-bold tracking-wide">of</span>
                    <select
                      value={getGlobalString('currentSeason').toLowerCase()}
                      onChange={(e) => handleGlobalStringChange('currentSeason', e.target.value)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-4 py-2 font-serif font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-center w-96 focus:outline-none focus:border-[#8c4614] capitalize"
                    >
                      <option value="spring">Spring</option>
                      <option value="summer">Summer</option>
                      <option value="fall">Fall</option>
                      <option value="winter">Winter</option>
                    </select>
                    <span class="text-[18px] font-bold tracking-wide">, Year</span>
                    <DashboardInput
                      type="number"
                      value={getGlobalNumber('year')}
                      onChange={(val) => handleGlobalNumberChange('year', val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-4 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-center w-56 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                </div>

              </div>
              
              <div class="bg-[#f4d499] border-[6px] border-[#c0733a] p-16 flex flex-col gap-8 rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] font-serif text-black overflow-hidden relative">
                <h2 class="text-[28px] leading-[32px] font-pixsans border-b-2 border-black pb-4 mb-8">Stats</h2>
                
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-3">
                  <div class="flex items-center justify-between gap-8">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4">Health <span>❤️</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif">Combat HP in Mines/Cavern</span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getNumber(player()?.maxHealth)}
                      onChange={(val) => {
                         handleNumberChange('maxHealth', val);
                         handleNumberChange('health', val);
                      }}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-8">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4">Stamina <span>⚡</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif">Note: Max is 508 (All 7 Stardrops)</span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getNumber(player()?.maxStamina)}
                      onChange={(val) => {
                         handleNumberChange('maxStamina', val);
                         handleNumberChange('stamina', val);
                         if (parseInt(val, 10) >= 508) {
                           ['CF_Fair', 'CF_Spouse', 'CF_Sewer', 'CF_Mines', 'CF_Fish', 'museumComplete', 'CF_Statue'].forEach(drop => {
                             if (!hasMailReceived(drop)) toggleMailReceived(drop);
                           });
                         }
                      }}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-8">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4 leading-tight">Golden Walnuts <span class="text-body-medium">🌰</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif">Currency used on Ginger Island</span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getNumber(player()?.goldenWalnuts)}
                      onChange={(val) => handleNumberChange('goldenWalnuts', val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-8">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4">Qi Gems <span>💎</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif">Currency for Mr. Qi's Walnut Room</span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getNumber(player()?.qiGems)}
                      onChange={(val) => handleNumberChange('qiGems', val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-8">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4">Qi Coins <span>💰</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif">Currency for Casino in the Desert</span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getNumber(player()?.clubCoins)}
                      onChange={(val) => handleNumberChange('clubCoins', val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                  <div class="flex items-center justify-between gap-8">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4">Hay <span>🌾</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif">Total animal feed stored in Silos</span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getGlobalNumber('piecesOfHay')}
                      onChange={(val) => handleGlobalNumberChange('piecesOfHay', val)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>

                  <div class="flex items-center justify-between gap-8 col-span-1 xl:col-span-2 mt-4 pt-4 border-t border-black/10">
                    <div class="flex flex-col">
                      <span class="font-bold flex items-center gap-4">House Upgrade Level <span>🏠</span></span>
                      <span class="text-[10px] text-black/70 leading-tight font-serif">Level in-game vs Farmhouse additions</span>
                    </div>
                    <select
                      value={getNumber(player()?.houseUpgradeLevel)}
                      onChange={(e) => handleNumberChange('houseUpgradeLevel', e.target.value)}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-serif font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-center w-[220px] focus:outline-none focus:border-[#8c4614] cursor-pointer"
                    >
                      <option value={0}>Level 1 (Starter House)</option>
                      <option value={1}>Level 2 (Kitchen Added)</option>
                      <option value={2}>Level 3 (Nursery Added)</option>
                      <option value={3}>Level 4 (Cellar Added)</option>
                    </select>
                  </div>

                <div class="flex items-center justify-between gap-8 col-span-1 xl:col-span-2">
                    <div class="flex flex-col gap-1">
                      <span class="font-bold flex items-center gap-4 text-[16px]">Deepest Mine <span>⛏️</span></span>
                      <span class="text-[11px] text-black/70 leading-tight font-serif max-w-xl">
                        <b>Note:</b> Floor 1-120 unlocks the regular Mines elevator. Floor 121+ is Skull Cavern (e.g., 220 = Skull Cavern Floor 100). Modifying Skull Cavern floors only unlocks achievements/quests, as there is no elevator in the vanilla game.
                      </span>
                    </div>
                    <DashboardInput
                      type="number"
                      value={getNumber(player()?.deepestMineLevel)}
                      onChange={(val) => {
                        handleNumberChange('deepestMineLevel', val);
                        if (parseInt(val, 10) >= 120) {
                          if (!getWalletValue('hasSkullKey')) toggleWalletItem('hasSkullKey');
                        }
                      }}
                      class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-8 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-right w-96 focus:outline-none focus:border-[#8c4614]"
                    />
                  </div>
                </div>

                <h2 class="text-[28px] leading-[32px] font-pixsans border-b-2 border-black pb-4 mt-12 mb-8">Special Items & Powers</h2>
                <div class="bg-[#fce8b8] border-2 border-[#c0733a] p-12 rounded flex flex-wrap justify-center gap-x-12 gap-y-16 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] relative">
                   
                   {/* Wallet Block */}
                   <div class="w-full flex flex-wrap justify-center gap-8 mb-4 border-b-2 border-[#c0733a]/30 pb-16">
                     <For each={classicWallet}>
                       {(wi) => {
                         const has = createMemo(() => wi.isEvent ? hasEventSeen(wi.key) : (wi.isMail ? hasMailReceived(wi.key) : getWalletValue(wi.key)));
                         return (
                           <Tooltip text={wi.label} position="bottom">
                             <div 
                               onClick={() => wi.isEvent ? toggleEventSeen(wi.key) : (wi.isMail ? toggleMailReceived(wi.key) : toggleWalletItem(wi.key))}
                               class={`w-[40px] h-[25px] flex items-center justify-center cursor-pointer transition-all hover:-translate-y-2 relative group will-change-transform ${has() ? 'opacity-100 drop-shadow-md' : 'opacity-50 grayscale hover:grayscale-0'}`}
                             >
                                <ItemSprite name={wi.itemSpriteName} />
                             </div>
                           </Tooltip>
                         );
                       }}
                     </For>
                   </div>

                  {/* Books of Power Block */}
                    <div class="w-full flex flex-wrap justify-center gap-6">
                      <For each={powersBooks}>
                        {(book) => {
                          const has = createMemo(() => book.isEvent ? hasEventSeen(book.key) : hasStatValue(book.key));
                          
                          return (
                            <Tooltip text={book.label} position="bottom">
                              <div 
                                onClick={() => book.isEvent ? toggleEventSeen(book.key) : toggleStatValue(book.key)}
                                class={`w-[40px] h-[40px] flex items-center justify-center cursor-pointer transition-all hover:-translate-y-2 relative group will-change-transform ${has() ? 'opacity-100 drop-shadow-md' : 'opacity-40 grayscale hover:grayscale-0'}`}
                              >
                                 <ItemSprite name={book.spriteName} />
                              </div>
                            </Tooltip>
                          );
                        }}
                      </For>
                    </div>
                </div>

                <h2 class="text-[28px] leading-[32px] font-pixsans border-b-2 border-black pb-4 mt-12 mb-8">Mastery Stars</h2>
                <div class="bg-[#fce8b8] border-2 border-[#c0733a] p-12 rounded flex flex-wrap gap-12 justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                   <For each={masteryStars}>
                     {(star) => {
                       const has = createMemo(() => hasStatValue(star.key));
                       return (
                         <Tooltip text={star.label} position="top">
                           <div 
                             onClick={() => toggleStatValue(star.key)}
                             class={`w-[48px] h-[48px] flex items-center justify-center cursor-pointer transition-all hover:-translate-y-2 relative group will-change-transform ${has() ? 'opacity-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]' : 'opacity-40 grayscale hover:grayscale-0'}`}
                           >
                              <ItemSprite name={star.label} />
                           </div>
                         </Tooltip>
                       );
                     }}
                   </For>
                </div>
              </div>
            </div>
            <InventoryGrid 
               selectedEquipmentPath={selectedEquipmentPath()}
               onClearEquipmentSelection={() => setSelectedEquipmentPath(null)}
            />
          </Match>

          <Match when={activeTab() === 'appearance'}>
            <AppearanceTab />
          </Match>

          <Match when={activeTab() === 'skills'}>
            <SkillsTab />
          </Match>

          <Match when={activeTab() === 'relationships'}>
            <RelationshipsTab />
          </Match>

          <Match when={activeTab() === 'children'}>
            <ChildrenTab />
          </Match>

          <Match when={activeTab() === 'recipes'}>
            <RecipesTab />
          </Match>

          <Match when={activeTab() === 'farmhands'}>
            <FarmhandsTab />
          </Match>

          <Match when={activeTab() === 'buildings'}>
            <BuildingsTab />
          </Match>
          
          <Match when={activeTab() === 'community'}>
            <CommunityCenterTab />
          </Match>

          <Match when={activeTab() === 'story'}>
            <StoryTab />
          </Match>

          <Match when={activeTab() === 'farmmap'}>
            <FarmLayoutVisualizer />
          </Match>
        </Switch>
      </div>
    </div>
    </Show>
  );
};