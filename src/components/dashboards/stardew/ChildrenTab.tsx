// @ts-nocheck
import { createMemo, createSignal, Show, Index, For } from 'solid-js';
import { useEditorStore, updateValue, deleteValue } from '../../../store/editorStore';
import { Baby, Trash2, ArrowUpCircle, PlusCircle, AlertTriangle } from 'lucide-solid';
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

export const ChildrenTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;
  const root = () => pv()?.SaveGame || pv() || {};
  const rootPath = store.saveData?.parsed_variables?.SaveGame ? 'SaveGame' : '';
  const player = () => root()?.player;
  const [updateTrigger, setUpdateTrigger] = createSignal(0);

  const farmHouseData = createMemo(() => {
    const locationsPath = rootPath ? `${rootPath}.locations.GameLocation` : 'locations.GameLocation';
    const locations = toArray(root()?.locations?.GameLocation);
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const type = loc['@_xsi:type'] || loc['@xsi:type'] || loc['xsi:type'] || getText(loc.type);
      const name = getText(loc.name);
      if (type === 'FarmHouse' || name === 'FarmHouse') {
        return { loc, index: i, path: `${locationsPath}.${i}` };
      }
    }
    return null;
  });

  const childrenData = createMemo(() => {
    updateTrigger();
    const fh = farmHouseData();
    if (!fh) return [];

    const npcs = toArray(fh.loc?.characters?.NPC);
    return npcs.map((npc, idx) => ({ npc, idx })).filter(item => {
      const type = item.npc['@_xsi:type'] || item.npc['@xsi:type'] || item.npc['xsi:type'] || getText(item.npc.type);
      return type === 'Child' || item.npc.idOfParent !== undefined;
    });
  });

  const getAgeStage = (age: number, daysOld: number) => {
    if (age === 0) return 'Newborn (Sleeping)';
    if (age === 1) return 'Infant (Carried/Crib)';
    if (age === 2) return 'Crawler';
    if (age === 3) return 'Toddler (Running)';
    return `Unknown (Age ${age})`;
  };

  const [deleteTarget, setDeleteTarget] = createSignal<{ idx: number, name: string } | null>(null);

  const handleThanosSnap = (idx: number, name: string) => {
    setDeleteTarget({ idx, name });
  };

  const confirmThanosSnap = () => {
    const target = deleteTarget();
    if (!target) return;
    const fh = farmHouseData();
    if (!fh) {
      setDeleteTarget(null);
      return;
    }
    
    const charsPath = `${fh.path}.characters.NPC`;
    const npcs = toArray(fh.loc?.characters?.NPC);
    const newNpcs = npcs.filter((_, i) => i !== target.idx);
    updateValue(charsPath, newNpcs);
    setDeleteTarget(null);
    setUpdateTrigger(t => t + 1);
  };

  const handleInstaGrow = (idx: number) => {
    const fh = farmHouseData();
    if (!fh) return;

    updateValue(`${fh.path}.characters.NPC.${idx}.age`, 3);
    updateValue(`${fh.path}.characters.NPC.${idx}.daysOld`, 55);
    setUpdateTrigger(t => t + 1);
  };

  const [spawnName, setSpawnName] = createSignal('');
  const [spawnGender, setSpawnGender] = createSignal('Male');
  
  const canSpawn = createMemo(() => {
    const upgradeLevel = parseInt(getText(player()?.houseUpgradeLevel) || '0', 10);
    const hasSpouse = !!getText(player()?.spouse);
    const hasRoom = childrenData().length < 2;
    return { upgradeLevel, hasSpouse, hasRoom, valid: upgradeLevel >= 2 && hasRoom };
  });

  const handleSpawn = () => {
    if (!spawnName()) {
      alert("Please enter a name for the child.");
      return;
    }
    
    const fh = farmHouseData();
    if (!fh) return;
    
    const parentId = getText(player()?.UniqueMultiplayerID) || '0';
    
    const newChild = {
      "@_xsi:type": "Child",
      "name": spawnName(),
      "forceOneTileWide": false,
      "isEmoting": false,
      "isCharging": false,
      "isGlowing": false,
      "coloredBorder": false,
      "flip": false,
      "drawOnTop": false,
      "faceTowardFarmer": false,
      "ignoreMovementAnimation": false,
      "faceAwayFromFarmer": false,
      "scale": { "float": 1 },
      "glowingTransparency": 0,
      "glowRate": 0,
      "Gender": spawnGender(),
      "willDestroyObjectsUnderfoot": true,
      "Position": { "X": 1280, "Y": 1792 },
      "Speed": 4,
      "FacingDirection": 0,
      "IsEmoting": false,
      "CurrentEmote": 20,
      "Scale": 1,
      "lastCrossroad": { "X": 0, "Y": 0, "Width": 0, "Height": 0, "Location": { "X": 0, "Y": 0 }, "Size": { "X": 0, "Y": 0 } },
      "daysAfterLastBirth": -1,
      "birthday_Day": 0,
      "age": 0,
      "manners": 0,
      "socialAnxiety": 0,
      "optimism": 0,
      "gender": spawnGender(),
      "sleptInBed": true,
      "isInvisible": false,
      "lastSeenMovieWeek": -1,
      "datingFarmer": { "@_xsi:nil": "true" },
      "divorcedFromFarmer": { "@_xsi:nil": "true" },
      "datable": false,
      "defaultMap": "FarmHouse",
      "id": -1,
      "daysUntilNotInvisible": 0,
      "followSchedule": true,
      "moveTowardPlayerThreshold": 0,
      "hasBeenKissedToday": { "boolean": false },
      "shouldPlayRobinHammerAnimation": { "boolean": false },
      "shouldPlaySpousePatioAnimation": { "boolean": false },
      "shouldWearIslandAttire": { "boolean": false },
      "isMovingOnPathFindPath": { "boolean": false },
      "endOfRouteBehaviorName": { "string": { "@_xsi:nil": "true" } },
      "previousEndPoint": { "X": 0, "Y": 0 },
      "squareMovementFacingPreference": -1,
      "DefaultFacingDirection": 0,
      "DefaultPosition": { "X": 1280, "Y": 1792 },
      "IsWalkingInSquare": false,
      "IsWalkingTowardPlayer": false,
      "daysOld": 0,
      "idOfParent": parentId,
      "darkSkinned": false,
      "skipHairDraw": false,
      "ignoreHairstyleOffset": true,
      "hairDrawType": 1,
      "isPrismatic": false
    };

    const charsPath = `${fh.path}.characters.NPC`;
    const npcs = toArray(fh.loc?.characters?.NPC);

    if (npcs.length === 0) {
      updateValue(charsPath, [newChild]);
    } else {
      updateValue(charsPath, [...npcs, newChild]);
    }
    
    setSpawnName('');
    setUpdateTrigger(t => t + 1);
  };

  return (
    <div class="h-full flex flex-col gap-16 overflow-y-auto p-4 custom-scrollbar">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16">
        
        {/* Existing Children List */}
        <div class="bg-[#fce8b8] border-[6px] border-[#c0733a] rounded-12 p-24 flex flex-col gap-16 font-serif text-black shadow-md">
          <div class="flex items-center gap-12 border-b-[4px] border-[#c0733a]/30 pb-12 mb-8">
            <Baby class="text-[#c0733a]" size={32} />
            <div>
              <h2 class="text-2xl font-bold font-pixsans text-[#8c4614]">Your Children</h2>
              <p class="text-black/60 italic text-sm">Manage the tiny inhabitants of your farmhouse.</p>
            </div>
          </div>
          
          <Show when={childrenData().length === 0}>
            <div class="text-center p-24 bg-black/5 rounded border border-black/10">
              <p class="italic text-black/60">You do not have any children.</p>
            </div>
          </Show>
          
          <div class="flex flex-col gap-16">
            <For each={childrenData()}>
              {(child) => {
                const name = getText(child.npc.name);
                const gender = getText(child.npc.gender) || getText(child.npc.Gender);
                const age = parseInt(getText(child.npc.age) || '0', 10);
                const daysOld = parseInt(getText(child.npc.daysOld) || '0', 10);
                
                return (
                  <div class="bg-white/50 border-[3px] border-[#c0733a]/50 rounded-lg p-16 flex flex-col sm:flex-row items-center justify-between gap-16 hover:bg-white/70 transition-colors shadow-sm">
                    <div class="flex items-center gap-16">
                      <div class="w-40 h-40 rounded-full flex items-center justify-center shrink-0 border-[3px] border-[#c0733a]"
                           classList={{
                             'bg-blue-300': gender?.toLowerCase() === 'male',
                             'bg-pink-300': gender?.toLowerCase() === 'female',
                             'bg-gray-300': !gender || (gender?.toLowerCase() !== 'male' && gender?.toLowerCase() !== 'female')
                           }}>
                        <Baby size={32} class="text-black/60" />
                      </div>
                      <div>
                        <div class="text-xl font-bold">{name}</div>
                        <div class="text-sm opacity-80">{gender} • {getAgeStage(age, daysOld)}</div>
                        <div class="text-xs opacity-60 mt-2">Days old: {daysOld}</div>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-8 w-full sm:w-auto">
                      <Show when={age < 3}>
                        <button 
                          onClick={() => handleInstaGrow(child.idx)}
                          class="flex-1 cursor-pointer sm:flex-none flex items-center justify-center gap-6 px-12 py-8 bg-[#8c4614] hover:bg-[#a65318] text-white rounded font-bold text-sm transition-colors shadow-sm"
                          title="Instantly grow into a Toddler"
                        >
                          <ArrowUpCircle size={16} /> Insta-Grow
                        </button>
                      </Show>
                      <button 
                        onClick={() => handleThanosSnap(child.idx, name)}
                        class="flex-1 cursor-pointer sm:flex-none flex items-center justify-center gap-6 px-12 py-8 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-sm transition-colors shadow-sm"
                        title="Erase child from existence"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
        
        {/* Spawn Child Section */}
        <div class="bg-[#fce8b8] border-[6px] border-[#c0733a] rounded-12 p-24 flex flex-col gap-16 font-serif text-black shadow-md h-fit">
          <div class="flex items-center gap-12 border-b-[4px] border-[#c0733a]/30 pb-12 mb-8">
            <PlusCircle class="text-[#c0733a]" size={32} />
            <div>
              <h2 class="text-2xl font-bold font-pixsans text-[#8c4614]">Amazon Prime Delivery</h2>
              <p class="text-black/60 italic text-sm">Instantly order a new baby to your doorstep.<span class="inline-block not-italic ml-1">😎</span>
              </p>
            </div>
          </div>
          
          <div class="flex flex-col gap-12 bg-white/50 p-16 rounded border border-black/10">
            <div class="font-bold border-b border-black/10 pb-4 mb-4 text-[#8c4614]">Requirements:</div>
            <div class="flex items-center justify-between text-sm">
              <span class={canSpawn().upgradeLevel >= 2 ? 'text-green-700' : 'text-red-600'}>House Upgrade Level 2+</span>
              <span>{canSpawn().upgradeLevel} / 2</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class={canSpawn().hasSpouse ? 'text-green-700' : 'text-orange-600'}>Married</span>
              <span>{canSpawn().hasSpouse ? 'Yes' : 'No'}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class={canSpawn().hasRoom ? 'text-green-700' : 'text-red-600'}>Room Available</span>
              <span>{childrenData().length} / 2 Kids</span>
            </div>
          </div>

          <div class="flex flex-col gap-16 mt-8">
            <div class="flex flex-col gap-8">
              <label class="font-bold text-sm text-[#8c4614]">Baby's Name</label>
              <input 
                type="text" 
                value={spawnName()} 
                onInput={(e) => setSpawnName(e.target.value)}
                placeholder="e.g. Dove, Yoba, Junimo..."
                class="bg-white border-2 border-[#c0733a]/50 rounded px-12 py-8 outline-none focus:border-[#c0733a] transition-colors"
                disabled={!canSpawn().valid}
              />
            </div>
            
            <div class="flex flex-col gap-8">
              <label class="font-bold text-sm text-[#8c4614]">Gender</label>
              <select 
                value={spawnGender()}
                onChange={(e) => setSpawnGender(e.target.value)}
                class="bg-white border-2 border-[#c0733a]/50 rounded px-12 py-8 outline-none focus:border-[#c0733a] transition-colors cursor-pointer"
                disabled={!canSpawn().valid}
              >
                <option value="Male">Boy</option>
                <option value="Female">Girl</option>
              </select>
            </div>
            
            <button 
              onClick={handleSpawn}
              disabled={!canSpawn().valid || spawnName().trim() === ''}
              class="mt-8 cursor-pointer flex items-center justify-center gap-8 py-12 px-24 bg-green-600 hover:bg-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded font-bold font-pixsans text-xl transition-colors shadow-md border-b-4 border-black/20 active:border-b-0 active:translate-y-[4px] disabled:active:border-b-4 disabled:active:translate-y-0"
            >
              <Baby size={24} /> Spawn Baby
            </button>
            <Show when={!canSpawn().valid || spawnName().trim() === ''}>
              <p class="text-red-600 italic text-xs text-center font-bold">
                {!canSpawn().valid 
                  ? "You must meet the requirements above before ordering a baby." 
                  : "Please enter a name for the baby."}
              </p>
            </Show>
          </div>
        </div>
      </div>

      <Modal
        isOpen={deleteTarget() !== null}
        onClose={() => setDeleteTarget(null)}
        title="DANGER: ERASING CHILD"
        icon={<AlertTriangle class="text-red-500" size={20} />}
      >
        <div class="flex flex-col gap-16 text-zinc-300 font-serif">
          <p class="text-white text-lg">
            Are you <b>ABSOLUTELY SURE</b> you want to erase <b>{deleteTarget()?.name}</b> from existence?
          </p>
          <div class="bg-red-900/30 border-l-4 border-red-500 p-12 text-red-200 text-sm">
            This action is irreversible. The child will be removed from your save file immediately. No Prismatic Shards required.
          </div>
          <div class="flex gap-12 mt-8">
            <button 
              onClick={() => setDeleteTarget(null)}
              class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={confirmThanosSnap}
              class="flex-1 py-12 rounded cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-sm flex items-center justify-center gap-8"
            >
              <Trash2 size={16} /> Yes, Erase Them!
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
