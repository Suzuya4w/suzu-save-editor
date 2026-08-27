// @ts-nocheck
import { createMemo, Show, onMount, createSignal, Index } from 'solid-js';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { Star, TrendingUp, Trophy } from 'lucide-solid';

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

const xpForLevel = [0, 100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000];
const xpToLevel = (xp: number) => {
  let level = 0;
  for (let i = 0; i < xpForLevel.length; i++) {
    if (xp >= xpForLevel[i]) level = i;
  }
  return Math.min(level, 10);
};

const SKILL_NAMES = ['Farming', 'Fishing', 'Foraging', 'Mining', 'Combat'];
const SKILL_KEYS = ['farmingLevel', 'fishingLevel', 'foragingLevel', 'miningLevel', 'combatLevel'];

const PROFESSION_GROUPS = [
  { name: 'Farming', ids: [0, 1, 2, 3, 4, 5], 0: 'Rancher', 1: 'Tiller', 2: 'Coopmaster', 3: 'Shepherd', 4: 'Artisan', 5: 'Agriculturist' },
  { name: 'Fishing', ids: [6, 7, 8, 9, 10, 11], 6: 'Fisher', 7: 'Trapper', 8: 'Angler', 9: 'Pirate', 10: 'Mariner', 11: 'Luremaster' },
  { name: 'Foraging', ids: [12, 13, 14, 15, 16, 17], 12: 'Forester', 13: 'Gatherer', 14: 'Lumberjack', 15: 'Tapper', 16: 'Botanist', 17: 'Tracker' },
  { name: 'Mining', ids: [18, 19, 20, 21, 22, 23], 18: 'Miner', 19: 'Geologist', 20: 'Blacksmith', 21: 'Prospector', 22: 'Excavator', 23: 'Gemologist' },
  { name: 'Combat', ids: [24, 25, 26, 27, 28, 29], 24: 'Fighter', 25: 'Scout', 26: 'Brute', 27: 'Defender', 28: 'Acrobat', 29: 'Desperado' },
];

const toArray = (obj: any): any[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return [obj];
};

export const SkillsTab = () => {
  const store = useEditorStore();

  const [isMounted, setIsMounted] = createSignal(false);
  const [staggerDelay, setStaggerDelay] = createSignal(true);

  const [lastLevels, setLastLevels] = createSignal([0, 0, 0, 0, 0]);

  onMount(() => {
    setTimeout(() => setIsMounted(true), 50); 
    setTimeout(() => setStaggerDelay(false), 1000);
  });

  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();
  const basePath = () => pv()?.SaveGame?.player ? 'SaveGame.player' : 'player';

  const getXpArrayPath = () => {
    let p = `${basePath()}.experiencePoints.int`;
    if (!player()?.experiencePoints) return null;
    return p;
  };
  const xpArrayPath = getXpArrayPath();
  
  const xpValues = createMemo(() => {
    const vals = [0, 0, 0, 0, 0];
    if (player()?.experiencePoints?.int) {
      const arr = toArray(player()?.experiencePoints.int);
      for (let i = 0; i < 5; i++) {
        vals[i] = parseInt(getText(arr[i]) || '0', 10);
      }
    }
    return vals;
  });

  const handleXpChange = (idx: number, newXp: number) => {
    if (!xpArrayPath) return; 

    const currentLevel = xpToLevel(xpValues()[idx]);
    setLastLevels(prev => {
      const next = [...prev];
      next[idx] = currentLevel;
      return next;
    });

    let currentArr = toArray(player()?.experiencePoints?.int);
    const valObj = currentArr[idx];
    let path = `${xpArrayPath}.${idx}`;
    if (typeof valObj === 'object' && valObj !== null) {
      if ('$text' in valObj) path += '.$text';
      else if ('$value' in valObj) path += '.$value';
      else if ('#text' in valObj) path += '.#text';
      else if ('' in valObj) path += '.';
    }

    const newLevel = xpToLevel(newXp);
    
    const levelKey = SKILL_KEYS[idx];
    const levelValObj = player() ? player()![levelKey] : undefined;
    let levelPath = `${basePath()}.${levelKey}`;
    if (typeof levelValObj === 'object' && levelValObj !== null) {
      if ('$text' in levelValObj) levelPath += '.$text';
      else if ('$value' in levelValObj) levelPath += '.$value';
      else if ('#text' in levelValObj) levelPath += '.#text';
      else if ('' in levelValObj) levelPath += '.';
    }

    updateValue(path, newXp);
    updateValue(levelPath, newLevel);
  };

  const activeProfessions = createMemo(() => {
    const set = new Set<number>();
    if (player()?.professions?.int) {
      toArray(player()?.professions.int).forEach(p => {
        const id = parseInt(getText(p), 10);
        if (!isNaN(id)) set.add(id);
      });
    }
    return set;
  });

  const toggleProfession = (id: number) => {
    const currentList = Array.from(activeProfessions());
    let newList;
    if (currentList.includes(id)) {
      newList = currentList.filter(p => p !== id);
    } else {
      newList = [...currentList, id];
    }
    
    if (newList.length === 0) {
       updateValue(`${basePath()}.professions.int`, []);
    } else {
       updateValue(`${basePath()}.professions.int`, newList);
    }
  };

  return (
    <Show when={player() && player()?.experiencePoints}>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-24">
        <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col gap-24">
          <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest flex items-center gap-8">
            <TrendingUp size={14} /> Experience Levels
          </h2>
          
          <div class="flex flex-col gap-16">
            <Index each={SKILL_NAMES}>
              {(name, idx) => {
                const xp = () => xpValues()[idx];
                const level = () => xpToLevel(xp());
                
                return (
                  <div class="flex flex-col gap-8">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-white text-body-medium font-serif">{name()} <span class="text-yellow-500 ml-4 font-brains">Lv.{level()}</span></span>
                      <div class="flex items-center gap-8">
                        <span class="text-[12px] leading-[16px] text-gray-500">XP</span>
                        <input 
                          type="number"
                          min="0"
                          value={xp()}
                          onInput={(e) => handleXpChange(idx, parseInt(e.target.value, 10) || 0)}
                          class="glass-input w-96 text-right h-28 text-[12px] leading-[16px] font-brains"
                        />
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-4">
                      <Index each={Array.from({ length: 10 })}>
                        {(_, i) => {
                          const fillPercentage = () => {
                            const currentLevel = level();
                            const currentXp = xp();
                            
                            if (i < currentLevel) return 100;
                            if (i === currentLevel) {
                              const currentLevelXp = xpForLevel[i];
                              const nextLevelXp = xpForLevel[i + 1];
                              if (nextLevelXp) {
                                return Math.max(0, Math.min(100, ((currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
                              }
                            }
                            return 0;
                          };

                          return (
                            <div 
                              onClick={() => handleXpChange(idx, xpForLevel[i + 1])}
                              title={`Set to Level ${i + 1} (${xpForLevel[i + 1]} XP)`}
                              class="h-12 flex-1 rounded-4 cursor-pointer relative overflow-hidden bg-white/5 border border-white/10 hover:brightness-125 hover:scale-105 transition-transform"
                            >
                              <div 
                                class="absolute top-0 left-0 h-full bg-[#10a37f]"
                                style={{ 
                                  width: isMounted() ? `${fillPercentage()}%` : '0%',
                                  transition: `width 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${
                                    staggerDelay() ? i * 75 : Math.abs(i - lastLevels()[idx]) * 35
                                  }ms` 
                                }}
                              />
                            </div>
                          );
                        }}
                      </Index>
                    </div>
                  </div>
                );
              }}
            </Index>
          </div>
        </div>

        <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col gap-24">
          <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest flex items-center gap-8">
            <Trophy size={14} /> Professions
          </h2>
          
          <div class="flex flex-col gap-24 overflow-y-auto pr-8 custom-scrollbar max-h-[500px]">
            {PROFESSION_GROUPS.map((group) => (
              <div key={group.name} class="flex flex-col gap-12">
                <h3 class="text-[12px] leading-[16px] font-serif text-gray-500 uppercase border-b border-white/10 pb-4">{group.name}</h3>
                <div class="grid grid-cols-2 gap-8">
                  {group.ids.map(id => {
                    const isActive = activeProfessions().has(id);
                    const name = (group as any)[id];
                    return (
                      <label 
                        key={id}
                        class={`flex items-center font-serif gap-8 p-8 rounded-8 border cursor-pointer transition-all ${isActive ? 'bg-[#10a37f]/20 border-[#10a37f]/50 text-[#10a37f]' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        <input 
                          type="checkbox"
                          checked={isActive}
                          onInput={() => toggleProfession(id)}
                          class="hidden"
                        />
                        <Star size={14} class={isActive ? 'fill-[#10a37f]' : ''} />
                        <span class="text-body-medium font-medium">{name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Show>
  );
};