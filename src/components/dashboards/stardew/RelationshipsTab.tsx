// @ts-nocheck
import { createMemo, createSignal, Show, Index, createComputed } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { Heart, Gift, MessageSquare, Check, AlertTriangle } from 'lucide-solid';
import { Tooltip } from '../../Header';
import { Modal } from '../../Modal';

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

const ROMANCEABLES = [
  'Alex', 'Elliott', 'Harvey', 'Sam', 'Sebastian', 'Shane',
  'Abigail', 'Emily', 'Haley', 'Leah', 'Maru', 'Penny'
];

const ALL_VILLAGERS = [
  ...ROMANCEABLES,
  'Caroline', 'Clint', 'Demetrius', 'Dwarf', 'Evelyn', 'George',
  'Gus', 'Jas', 'Jodi', 'Kent', 'Krobus', 'Leo', 'Lewis', 'Linus',
  'Marnie', 'Pam', 'Pierre', 'Robin', 'Sandy', 'Vincent', 'Willy', 'Wizard'
];

const toddlerCache = new Map<string, any>();
const imageErrorCache = new Set<string>();

const FriendshipCard = (props: { item: any, idx: number, basePath: string, freeLove: boolean }) => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();

  const getChildInfo = (childName: string) => {
    let result = { gender: 'boy', darkSkinned: false };
    const search = (obj: any, depth = 0): boolean => {
      if (!obj || typeof obj !== 'object' || depth > 5) return false;
      
      if (obj.name !== undefined && obj.gender !== undefined) {
        const nameVal = typeof obj.name === 'object' ? (obj.name.$text || obj.name['#text'] || obj.name) : obj.name;
        if (nameVal === childName) {
          const genderVal = typeof obj.gender === 'object' ? (obj.gender.$text || obj.gender['#text'] || obj.gender) : obj.gender;
          const darkVal = obj.darkSkinned ? (typeof obj.darkSkinned === 'object' ? (obj.darkSkinned.$text || obj.darkSkinned['#text'] || obj.darkSkinned) : obj.darkSkinned) : false;
          
          if (parseInt(genderVal) === 1 || String(genderVal).toLowerCase() === 'female') result.gender = 'girl';
          if (darkVal === 'true' || darkVal === true) result.darkSkinned = true;
          return true;
        }
      }
      
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (search(obj[i], depth + 1)) return true;
        }
      } else {
        for (const key in obj) {
          if (search(obj[key], depth + 1)) return true;
        }
      }
      return false;
    };
    
    try { search(pv()); } catch(e) {}
    return result;
  };

  const nameObj = () => props.item?.key?.string || props.item?.key;
  const name = () => getText(nameObj());

  const friendship = () => props.item?.value?.Friendship;
  const storePoints = () => parseInt(getText(friendship()?.Points) || '0', 10);
  const giftsThisWeek = () => parseInt(getText(friendship()?.GiftsThisWeek) || '0', 10);
  const talkedToToday = () => getText(friendship()?.TalkedToToday) === 'true';
  
  const status = () => {
    const s = getText(friendship()?.Status);
    if (s && s !== 'Friendly' && s !== 'Unmet') return s;
    if (ROMANCEABLES.includes(name())) return 'single';
    return null;
  };

  const [dragPoints, setDragPoints] = createSignal<number | null>(null);
  const [imgError, setImgError] = createSignal(false);
  const [isToddler, setIsToddler] = createSignal(false);

  createComputed(() => {
    const n = name();
    setDragPoints(null);
    if (imageErrorCache.has(n)) {
      setImgError(true);
      setIsToddler(false);
    } else if (toddlerCache.has(n)) {
      setIsToddler(true);
      setImgError(false);
    } else {
      setImgError(false);
      setIsToddler(false);
    }
  });

  const getMaxPoints = () => {
    const s = status()?.toLowerCase();
    if (s === 'married' || s === 'roommate') return 3749;
    if (s === 'dating') return 2749;
    if (s === 'single' || s === 'divorced') return 2249;
    return 2749;
  };

  const displayPoints = () => dragPoints() !== null ? dragPoints()! : storePoints();
  const hearts = () => Math.floor(displayPoints() / 250);

  const handleUpdateStore = (key: string, val: any) => {
    let path = `${props.basePath}.friendshipData.item.${props.idx}.value.Friendship.${key}`;
    const existingObj = friendship()?.[key];
    if (typeof existingObj === 'object' && existingObj !== null) {
      if ('$text' in existingObj) path += '.$text';
      else if ('$value' in existingObj) path += '.$value';
      else if ('#text' in existingObj) path += '.#text';
      else if ('' in existingObj) path += '.';
    }
    updateValue(path, val);
  };

  const handlePointsUpdate = (val: number) => {
    setDragPoints(null); 
    if (!isNaN(val)) handleUpdateStore('Points', val);
  };

  const toggleGift = (giftIndex: number) => {
    let current = giftsThisWeek();
    if (current === giftIndex) {
      handleUpdateStore('GiftsThisWeek', giftIndex - 1);
    } else {
      handleUpdateStore('GiftsThisWeek', giftIndex);
    }
  };

  const toggleTalk = () => {
    handleUpdateStore('TalkedToToday', !talkedToToday());
  };

  return (
    <Show when={name()}>
      <div class="bg-[#fce8b8] border-b-[4px] border-[#c0733a] p-12 flex flex-col xl:flex-row items-center gap-12 sm:gap-24 hover:bg-[#fff0c8] transition-colors relative">
        
        {/* Avatar & Name */}
        <div class="flex flex-col sm:flex-row items-center gap-16 w-full xl:w-[240px] shrink-0">
          <div class="w-[72px] h-[72px] border-4 border-[#c0733a] rounded bg-white flex items-center justify-center font-bold text-[28px] text-gray-300 relative shrink-0 shadow-md overflow-hidden">
            <Show when={imgError()}>
              <span class="relative z-0">{name().charAt(0)}</span>
            </Show>
            <Show when={!imgError()}>
              <img 
                src={isToddler() ? (() => {
                  const info = toddlerCache.get(name()) || getChildInfo(name());
                  let imgBase = info.gender === 'girl' ? 'Toddler_girl' : 'Toddler';
                  if (info.darkSkinned) imgBase += '_dark';
                  return `/stardew/portraits/${imgBase}.png`;
                })() : `/stardew/portraits/${name()}.png`}
                alt={name()}
                class="absolute top-0 left-0 z-10"
                style={isToddler() ? {
                  "width": "16px",
                  "height": "32px",
                  "object-fit": "none",
                  "object-position": "0 0",
                  "transform": "scale(2)",
                  "transform-origin": "0 0",
                  "left": "20px",
                  "top": "0px",
                  "image-rendering": "pixelated"
                } : {
                  "width": "64px",
                  "height": "64px",
                  "object-fit": "none",
                  "object-position": "top left",
                  "image-rendering": "pixelated"
                }}
                onError={() => {
                  if (!isToddler() && !imageErrorCache.has(name())) {
                    const info = getChildInfo(name());
                    toddlerCache.set(name(), info);
                    setIsToddler(true);
                  } else {
                    imageErrorCache.add(name());
                    setImgError(true);
                  }
                }}
              />
            </Show>
          </div>
          <div class="flex flex-col text-center sm:text-left">
            <div class="font-bold font-serif text-[24px] text-black leading-tight">{name()}</div>
            <Show when={ROMANCEABLES.includes(name()) || name() === 'Krobus'}>
              <select 
                class="mt-4 bg-white/50 border border-[#c0733a] rounded px-8 py-4 text-[14px] font-serif font-bold text-black/80 capitalize outline-none cursor-pointer hover:bg-white/80 transition-colors w-full max-w-[140px]"
                value={status() === 'single' ? 'Friendly' : (status() || 'Friendly')}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  const currentSpouseName = getText(player()?.spouse);
                  const currentName = name();
                  const currentIdx = props.idx;

                  const getNewMaxPoints = (s: string) => {
                    const ls = s.toLowerCase();
                    if (ls === 'married' || ls === 'roommate') return 3749;
                    if (ls === 'dating') return 2749;
                    return 2249;
                  };

                  if (!props.freeLove && (newStatus === 'Married' || newStatus === 'Roommate')) {
                     const allItems = toArray(player()?.friendshipData?.item);
                     allItems.forEach((fi: any, index: number) => {
                         const fiName = getText(fi?.key?.string || fi?.key);
                         if (fiName !== currentName) {
                             const fiStatus = getText(fi?.value?.Friendship?.Status);
                             if (fiStatus === 'Married' || fiStatus === 'Roommate') {
                                 let p = `${props.basePath}.friendshipData.item.${index}.value.Friendship.Status`;
                                 const existingObj = fi?.value?.Friendship?.Status;
                                 if (typeof existingObj === 'object' && existingObj !== null) {
                                   if ('$text' in existingObj) p += '.$text';
                                   else if ('$value' in existingObj) p += '.$value';
                                   else if ('#text' in existingObj) p += '.#text';
                                   else if ('' in existingObj) p += '.';
                                 }
                                 updateValue(p, 'Dating');

                                 const otherPts = parseInt(getText(fi?.value?.Friendship?.Points) || '0', 10);
                                 if (otherPts > 2749) {
                                     let ptsP = `${props.basePath}.friendshipData.item.${index}.value.Friendship.Points`;
                                     const existingPtsObj = fi?.value?.Friendship?.Points;
                                     if (typeof existingPtsObj === 'object' && existingPtsObj !== null) {
                                       if ('$text' in existingPtsObj) ptsP += '.$text';
                                       else if ('$value' in existingPtsObj) ptsP += '.$value';
                                       else if ('#text' in existingPtsObj) ptsP += '.#text';
                                       else if ('' in existingPtsObj) ptsP += '.';
                                     }
                                     updateValue(ptsP, 2749);
                                 }
                             }
                         }
                     });
                  }

                  let path = `${props.basePath}.friendshipData.item.${currentIdx}.value.Friendship.Status`;
                  const existingObj = friendship()?.Status;
                  if (typeof existingObj === 'object' && existingObj !== null) {
                    if ('$text' in existingObj) path += '.$text';
                    else if ('$value' in existingObj) path += '.$value';
                    else if ('#text' in existingObj) path += '.#text';
                    else if ('' in existingObj) path += '.';
                  }
                  updateValue(path, newStatus);

                  const maxPts = getNewMaxPoints(newStatus);
                  const currentPts = parseInt(getText(friendship()?.Points) || '0', 10);
                  if (currentPts > maxPts) {
                      let ptsPath = `${props.basePath}.friendshipData.item.${currentIdx}.value.Friendship.Points`;
                      const existingPtsObj = friendship()?.Points;
                      if (typeof existingPtsObj === 'object' && existingPtsObj !== null) {
                        if ('$text' in existingPtsObj) ptsPath += '.$text';
                        else if ('$value' in existingPtsObj) ptsPath += '.$value';
                        else if ('#text' in existingPtsObj) ptsPath += '.#text';
                        else if ('' in existingPtsObj) ptsPath += '.';
                      }
                      updateValue(ptsPath, maxPts);
                  }

                  if (newStatus === 'Married' || newStatus === 'Roommate') {
                     updateValue(`${props.basePath}.spouse`, currentName);
                  } else if (newStatus === 'Divorced') {
                     if (currentSpouseName === currentName) {
                        updateValue(`${props.basePath}.spouse`, '');
                     }
                  }
                }}
              >
                <option value="Friendly">Single</option>
                <option value="Dating">Dating</option>
                <option value="Engaged">Engaged</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <Show when={name() === 'Krobus'}><option value="Roommate">Roommate</option></Show>
              </select>
            </Show>
            <Show when={!ROMANCEABLES.includes(name()) && name() !== 'Krobus' && status()}>
              <div class="text-[14px] font-serif italic text-black/60 capitalize mt-4">({status()})</div>
            </Show>
          </div>
        </div>
        
        {/* Hearts & Slider */}
        <div class="flex flex-col gap-8 w-full max-w-[400px]">
          <div class="flex flex-wrap items-center gap-1">
            <Index each={Array.from({ length: (status()?.toLowerCase() === 'married' || status()?.toLowerCase() === 'roommate') ? 14 : 10 })}>
              {(_, i) => {
                const isLocked = () => {
                  const s = status()?.toLowerCase();
                  const maxUnlocked = (s === 'married' || s === 'roommate') ? 14 : 
                                      (s === 'dating' ? 10 : 
                                      (s === 'single' || s === 'divorced' ? 8 : 10));
                  return i >= maxUnlocked;
                };

                const fillPercentage = () => {
                  let pts = displayPoints();
                  const s = status()?.toLowerCase();
                  const maxUnlocked = (s === 'married' || s === 'roommate') ? 14 : 
                                      (s === 'dating' ? 10 : 
                                      (s === 'single' || s === 'divorced' ? 8 : 10));

                  if (pts > maxUnlocked * 250) pts = maxUnlocked * 250;
                  if (isLocked()) return 0;

                  const heartStart = i * 250;
                  const heartEnd = heartStart + 250;
                  if (pts >= heartEnd) return 100;
                  if (pts <= heartStart) return 0;
                  return ((pts - heartStart) / 250) * 100;
                };

                return (
                  <Tooltip text={isLocked() ? `Locked (Give Bouquet to unlock)` : `Set to ${(i + 1) * 250} Points (${i + 1} Hearts)`} position="top">
                    <div 
                      class={`relative w-16 h-16 flex-shrink-0 transition-transform ${isLocked() ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-125'}`}
                      onClick={() => !isLocked() && handlePointsUpdate((i + 1) * 250)}
                    >
                      <Heart size={16} class={`absolute top-0 left-0 ${isLocked() ? 'text-black/15' : 'text-black/30'}`} />
                      <div 
                        class="absolute top-0 left-0 h-full overflow-hidden pointer-events-none"
                        style={{ width: `${fillPercentage()}%` }}
                      >
                        <Heart size={16} class="text-red-500 fill-red-500 min-w-[16px]" />
                      </div>
                    </div>
                  </Tooltip>
                );
              }}
            </Index>
            <div class="flex items-center gap-4 ml-auto">
              <input
                type="number"
                value={displayPoints()}
                min="0"
                max={getMaxPoints()}
                onInput={(e) => setDragPoints(parseInt(e.target.value, 10) || 0)}
                onChange={(e) => handlePointsUpdate(parseInt(e.target.value, 10) || 0)}
                class="bg-[#fce8b8] border-2 border-[#c0733a] rounded px-4 py-2 font-brains font-bold text-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] text-center w-[100px] focus:outline-none focus:border-[#8c4614]"
              />
            </div>
          </div>
          
          <input 
            type="range"
            min="0"
            max={getMaxPoints()}
            step="1"
            value={displayPoints()}
            onInput={(e) => setDragPoints(parseInt(e.target.value, 10))}
            onChange={(e) => handlePointsUpdate(parseInt(e.target.value, 10))}
            class="w-full cursor-pointer accent-[#c0733a] hover:accent-[#8c4614] transition-all"
          />
        </div>

        {/* Gifts & Talk Checkboxes */}
        <div class="flex items-center justify-center gap-16 xl:ml-auto border-t xl:border-t-0 xl:border-l border-black/10 pt-12 xl:pt-0 xl:pl-24">
          
          <div class="flex flex-col items-center gap-4">
            <div class="flex items-center gap-4 text-[#c0733a]">
              <Gift size={16} class={giftsThisWeek() > 0 ? "fill-[#c0733a]" : ""} />
              <span class="text-[12px] font-bold font-serif leading-none">Gifts</span>
            </div>
            <div class="flex gap-4">
              <Tooltip text="Toggle Gift 1" position="bottom">
                <button 
                  onClick={() => toggleGift(1)}
                  class={`w-20 h-20 cursor-pointer border-[3px] border-[#c0733a] flex items-center justify-center bg-[#fce8b8] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors ${giftsThisWeek() >= 1 ? 'bg-green-400' : ''}`}
                >
                  <Show when={giftsThisWeek() >= 1}><Check size={16} class="text-white font-bold" /></Show>
                </button>
              </Tooltip>
              <Tooltip text="Toggle Gift 2" position="bottom">
                <button 
                  onClick={() => toggleGift(2)}
                  class={`w-20 h-20 cursor-pointer border-[3px] border-[#c0733a] flex items-center justify-center bg-[#fce8b8] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors ${giftsThisWeek() >= 2 ? 'bg-green-400' : ''}`}
                >
                  <Show when={giftsThisWeek() >= 2}><Check size={16} class="text-white font-bold" /></Show>
                </button>
              </Tooltip>
            </div>
          </div>

          <div class="flex flex-col items-center gap-4">
            <div class="flex items-center gap-4 text-[#c0733a]">
              <MessageSquare size={16} class={talkedToToday() ? "fill-[#c0733a]" : ""} />
              <span class="text-[12px] font-bold font-serif leading-none">Talk</span>
            </div>
            <Tooltip text="Toggle Talked Today" position="bottom" align="right">
              <button 
                onClick={toggleTalk}
                class={`w-20 h-20 cursor-pointer border-[3px] border-[#c0733a] flex items-center justify-center bg-[#fce8b8] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] transition-colors ${talkedToToday() ? 'bg-green-400' : ''}`}
              >
                <Show when={talkedToToday()}><Check size={16} class="text-white font-bold" /></Show>
              </button>
            </Tooltip>
          </div>

        </div>
      </div>
    </Show>
  );
};

export const RelationshipsTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();
  const basePath = () => pv()?.SaveGame?.player ? 'SaveGame.player' : 'player';

const friendshipItems = createMemo(() => {
  const p = player();
  if (!p?.friendshipData?.item) return [];

  let items = toArray(p.friendshipData.item).map((item, idx) => {
    const points = parseInt(getText(item?.value?.Friendship?.Points) || '0', 10);
    const status = getText(item?.value?.Friendship?.Status);
    const isSpouse = status === 'Married' || status === 'Engaged' || status === 'Roommate';
    
    return { item, idx, points, isSpouse };
  });

  items.sort((a, b) => {
    if (a.isSpouse && !b.isSpouse) return -1;
    if (!a.isSpouse && b.isSpouse) return 1;
    return b.points - a.points;
  });
  
  return items;
});



  const [freeLove, setFreeLove] = createSignal(false);
  const [showConfirmModal, setShowConfirmModal] = createSignal(false);

  const discoverAllNPCs = () => {
    let items = toArray(player()?.friendshipData?.item);
    let newItems = [...items];
    let changed = false;

    ALL_VILLAGERS.forEach(npc => {
      const exists = items.some(i => getText(i?.key?.string || i?.key) === npc);
      if (!exists) {
        changed = true;
        newItems.push({
          key: { string: npc },
          value: {
            Friendship: {
              Points: 0,
              GiftsThisWeek: 0,
              GiftsToday: 0,
              TalkedToToday: 'false',
              ProposalRejected: 'false',
              RoommateMarriage: 'false',
              IsMarried: 'false',
              IsEngaged: 'false',
              IsDating: 'false',
              IsDivorced: 'false',
              ProposeEvent: 'false',
              Status: 'Friendly'
            }
          }
        });
      }
    });

    if (changed) {
      updateValue(`${basePath()}.friendshipData.item`, newItems);
    }
  };

  return (
    <Show 
      when={friendshipItems().length > 0} 
      fallback={
        <div class="bg-[#f4d499] border-[6px] border-[#c0733a] rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] p-24 text-center text-black/50 py-80 flex flex-col justify-center items-center">
          <Heart class="mb-16 opacity-30" size={48} />
          <p class="font-serif font-bold text-xl">No friendship data found for this player.</p>
        </div>
      }
    >
      <div class="bg-[#f4d499] border-[6px] border-[#c0733a] rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] font-serif text-black overflow-hidden flex flex-col h-full">
        <div class="bg-[#c0733a] p-12 text-white font-pixsans text-[24px] shadow-md z-10 flex items-center justify-between shrink-0 flex-wrap gap-8">
          <div class="flex flex-col">
            <span>Social / Relationships</span>
            <span class="text-[14px] font-serif">Track Hearts, Gifts, & Talking</span>
          </div>
          <div class="flex flex-col items-end gap-4">
            <div class="flex items-center gap-8">
              <button
                onClick={() => setShowConfirmModal(true)}
                class="text-[12px] font-serif bg-white/20 hover:bg-white/40 text-white px-8 py-4 rounded shadow-sm transition-colors border border-white/20 flex items-center gap-4 cursor-pointer"
              >
                Discover All NPCs
              </button>
              <Tooltip text="If enabled, you can set 'Married' to multiple people without divorcing them. Requires 'PolyamorySweet' mod to work properly in-game." position="bottom" align="right">
                <label class="flex items-center gap-8 text-[14px] font-serif cursor-pointer hover:text-white/80 transition-colors bg-black/20 px-8 py-4 rounded">
                  <input type="checkbox" checked={freeLove()} onChange={(e) => setFreeLove(e.target.checked)} class="w-16 h-16 accent-[#fce8b8] cursor-pointer" />
                  <span>Enable Free Love (Polygamy)</span>
                </label>
              </Tooltip>
            </div>
            <Tooltip text="Download PolyamorySweet Mod for Stardew Valley" position="bottom" align="right">
              <a 
                href="https://www.nexusmods.com/stardewvalley/mods/20599" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-[12px] font-serif bg-[#8c4614] hover:bg-[#a65318] text-white px-8 py-4 rounded shadow-sm transition-colors border border-white/20 flex items-center gap-4"
              >
                Get PolyamorySweet Mod ↗
              </a>
            </Tooltip>
          </div>
        </div>
        <div class="flex flex-col overflow-y-auto stardew-scrollbar relative" style={{ "max-height": "calc(100vh - 200px)" }}>
          <Index each={friendshipItems()}>
            {(itemObj, i) => (
              <FriendshipCard 
                item={itemObj().item} 
                idx={itemObj().idx} 
                basePath={basePath()} 
                freeLove={freeLove()}
              />
            )}
          </Index>
        </div>
        
        <Modal
          isOpen={showConfirmModal()}
          onClose={() => setShowConfirmModal(false)}
          title="Discover All NPCs"
          icon={<AlertTriangle size={20} class="text-[#c0733a]" />}
        >
          <div class="flex flex-col gap-16 text-zinc-300 font-serif">
            <p>Are you sure you want to discover all NPCs? This will add all unmet villagers to your relationships list.</p>
            <div class="flex gap-12 mt-8">
              <button
                onClick={() => setShowConfirmModal(false)}
                class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  discoverAllNPCs();
                  setShowConfirmModal(false);
                }}
                class="flex-1 py-12 rounded cursor-pointer bg-[#c0733a] hover:bg-[#a65318] text-white font-bold transition-colors shadow-sm"
              >
                Discover
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </Show>
  );
};