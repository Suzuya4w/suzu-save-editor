// @ts-nocheck
import { createMemo, createSignal, Show, Index } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { addToast } from '../../../store/toastStore';
import { Home, Plus, AlertTriangle } from 'lucide-solid';
import { AnimalSpawnerModal } from './AnimalSpawnerModal';
import { Modal } from '../../Modal';
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

const getAnimalEmoji = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('chicken')) return '🐔';
  if (t.includes('cow')) return '🐄';
  if (t.includes('sheep')) return '🐑';
  if (t.includes('goat')) return '🐐';
  if (t.includes('pig')) return '🐖';
  if (t.includes('duck')) return '🦆';
  if (t.includes('rabbit')) return '🐇';
  if (t.includes('dinosaur')) return '🦕';
  if (t.includes('ostrich')) return '🦤';
  if (t.includes('horse')) return '🐎';
  if (t.includes('cat')) return '🐱';
  if (t.includes('dog')) return '🐶';
  return '🐾';
};

const getAnimalSpriteData = (a: any) => {
  const data = a.data;
  let spriteName = '';
  let width = 32;
  let height = 32;

  let type = a.isPet ? (data['@_xsi:type'] || data['@xsi:type'] || data['xsi:type'] || 'Pet') : getText(data.type);
  if (type === 'Pet') {
    type = getText(data.petType) || 'Pet';
  }
  const typeLower = type.toLowerCase();

  if (typeLower.includes('chicken') || typeLower.includes('duck') || typeLower.includes('rabbit') || typeLower.includes('dinosaur')) {
    width = 16;
    height = 16;
  }

  if (a.isPet) {
    const breed = getText(data.petBreed) || getText(data.whichBreed) || '0';
    spriteName = breed === '0' ? typeLower : `${typeLower}${breed}`;
  } else if (typeLower === 'horse') {
    spriteName = 'horse';
  } else {
    const age = parseInt(getText(data.age) || '0', 10);
    const matureAge = parseInt(getText(data.ageWhenMature) || '0', 10);
    const isBaby = age < matureAge;
    
    spriteName = isBaby ? `Baby${getText(data.type)}` : getText(data.type);
  }

  return {
    url: `/stardew/Animals/${spriteName}.png`,
    width,
    height,
    offsetX: 0,
    offsetY: height
  };
};

const AnimalIcon = (props: { animal: any, aType: string }) => {
  const [error, setError] = createSignal(false);
  const sprite = createMemo(() => getAnimalSpriteData(props.animal));

  return (
    <div class="w-48 h-48 flex items-center justify-center shrink-0 drop-shadow-md relative bg-[#e6b167] border-2 border-[#c68c53] rounded-8 overflow-hidden">
      <Show when={!error()} fallback={<span class="text-title-h4 drop-shadow-md">{getAnimalEmoji(props.aType)}</span>}>
        <div style={{
          width: `${sprite().width}px`, 
          height: `${sprite().height}px`,
          position: 'relative',
          transform: `scale(${sprite().width === 16 ? 2.5 : 1.25})`,
          "transform-origin": 'center'
        }}>
          <img 
            src={sprite().url} 
            onError={() => setError(true)}
            style={{
              width: `${sprite().width}px`,
              height: `${sprite().height}px`,
              "object-fit": 'none',
              "object-position": `-${sprite().offsetX}px -${sprite().offsetY}px`,
              "image-rendering": 'pixelated'
            }}
          />
        </div>
      </Show>
    </div>
  );
};

const handleUpdate = (path: string, originalVal: any, newVal: any) => {
  let p = path;
  if (typeof originalVal === 'object' && originalVal !== null) {
    if ('$text' in originalVal) p += '.$text';
    else if ('$value' in originalVal) p += '.$value';
    else if ('#text' in originalVal) p += '.#text';
    else if ('' in originalVal) p += '.';
  }
  updateValue(p, newVal);
};

const AnimalCard = (props: { animal: any, onDelete?: (animalData: any) => void }) => {

  const a = () => props.animal();
  
  const aType = () => {
    if (a().isPet) {
      let t = a().data['@_xsi:type'] || a().data['@xsi:type'] || a().data['xsi:type'] || 'Pet';
      if (t === 'Pet') t = getText(a().data.petType) || 'Pet';
      return t;
    }
    return getText(a().data.type);
  };
  const storeIsMale = () => getText(a().data.isMale) === 'true';
  const hearts = () => Math.floor(storeFriendship() / 200);

  const storeName = () => getText(a().data.name);
  const storeFriendship = () => parseInt(getText(a().data.friendshipTowardFarmer) || '0', 10);
  const storeHappiness = () => parseInt(getText(a().data.happiness) || '0', 10);
  const storeFullness = () => parseInt(getText(a().data.fullness) || '0', 10);
  const storeDaysOwned = () => parseInt(getText(a().data.daysOwned) || '0', 10);

  const hasFriendship = () => a().data.friendshipTowardFarmer !== undefined;
  const hasHappiness = () => a().data.happiness !== undefined;
  const hasFullness = () => a().data.fullness !== undefined;
  const hasDaysOwned = () => a().data.daysOwned !== undefined;
  const hasGender = () => a().data.isMale !== undefined;

  const [localName, setLocalName] = createSignal<string | null>(null);
  const [localFriendship, setLocalFriendship] = createSignal<number | null>(null);
  const [localHappiness, setLocalHappiness] = createSignal<number | null>(null);
  const [localFullness, setLocalFullness] = createSignal<number | null>(null);
  const [localDays, setLocalDays] = createSignal<number | null>(null);
  const [localIsMale, setLocalIsMale] = createSignal<boolean | null>(null);

  const displayName = () => localName() !== null ? localName()! : storeName();
  const displayFriendship = () => localFriendship() !== null ? localFriendship()! : storeFriendship();
  const displayHappiness = () => localHappiness() !== null ? localHappiness()! : storeHappiness();
  const displayFullness = () => localFullness() !== null ? localFullness()! : storeFullness();
  const displayDays = () => localDays() !== null ? localDays()! : storeDaysOwned();
  const displayIsMale = () => localIsMale() !== null ? localIsMale()! : storeIsMale();

  const commitUpdate = (field: string, localSetter: any, originalVal: any, finalVal: any) => {
    localSetter(finalVal); // Do not set to null! Keep the local state so UI doesn't jump back to old unwrapped state.
    handleUpdate(`${a().path}.${field}`, originalVal, finalVal);
  };

  return (
    <div class="bg-[#f0d8a8] border-4 border-[#c68c53] rounded-8 p-16 shadow-sm flex flex-col gap-12 relative group">
      {/* Delete Button */}
      <Show when={!a().isPet && props.onDelete}>
        <div class="absolute top-12 right-12 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
          <Tooltip text="Delete Animal" position="bottom">
            <button 
              onClick={() => props.onDelete!(a().data)}
              class="w-[120px] h-24 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center shadow-sm cursor-pointer"
            >
              <span class="font-bold text-sm leading-none">Delete Animal</span>
            </button>
          </Tooltip>
        </div>
      </Show>

      {/* Animal Header */}
      <div class="flex items-center gap-12">
        <AnimalIcon animal={a()} aType={aType()} />
        <div class="flex flex-col">
          <span class="font-bold text-title-h5">{displayName()}</span>
          <span class="text-body-medium text-[#8c5026]">{aType()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div class="grid grid-cols-[100px_1fr_auto] gap-y-2 items-center text-body-medium font-bold">
        
        {/* Name */}
        <span>Name</span>
        <div class="col-span-2 mb-4">
          <input 
            type="text"
            value={displayName()}
            onInput={(e) => setLocalName(e.target.value)}
            onChange={(e) => commitUpdate('name', setLocalName, a().data.name, e.target.value)}
            class="w-full font-serif bg-[#e6b167] border-2 border-[#c68c53] rounded px-8 text-[#4d2503] font-bold"
          />
        </div>

        {/* Friendship */}
        <Show when={hasFriendship()}>
          <>
            <span>Friendship</span>
            <div class="flex items-center gap-4 text-[#8c5026]">
              <Index each={Array.from({ length: 5 })}>
                {(_, i) => <span>{i < hearts() ? '♥' : '♡'}</span>}
              </Index>
            </div>
            <div class="flex items-center justify-end gap-4">
              <input 
                type="number" min="0" max="1000"
                value={displayFriendship()}
                onInput={(e) => setLocalFriendship(parseInt(e.target.value, 10) || 0)}
                onChange={(e) => commitUpdate('friendshipTowardFarmer', setLocalFriendship, a().data.friendshipTowardFarmer, parseInt(e.target.value, 10) || 0)}
                class="w-64 bg-[#e6b167] border-2 border-[#c68c53] rounded px-4 text-right text-[#4d2503] font-bold"
              />
              <span class="text-[#8c5026] text-[12px] leading-[16px]">/ 1000</span>
            </div>
          </>
        </Show>

        {/* Happiness */}
        <Show when={hasHappiness()}>
          <>
            <span>Happiness</span>
            <div class="flex items-center gap-4 text-[#d34726]">
              <Index each={Array.from({ length: 5 })}>
                {(_, i) => <span class={i < (displayHappiness() / 51) ? "" : "text-[#d1bfa6]"}>☺</span>}
              </Index>
            </div>
            <div class="flex items-center justify-end gap-4">
              <input 
                type="number" min="0" max="255"
                value={displayHappiness()}
                onInput={(e) => setLocalHappiness(parseInt(e.target.value, 10) || 0)}
                onChange={(e) => commitUpdate('happiness', setLocalHappiness, a().data.happiness, parseInt(e.target.value, 10) || 0)}
                class="w-64 bg-[#e6b167] border-2 border-[#c68c53] rounded px-4 text-right text-[#4d2503] font-bold"
              />
              <span class="text-[#8c5026] text-[12px] leading-[16px]">/ 255</span>
            </div>
          </>
        </Show>

        {/* Fullness */}
        <Show when={hasFullness()}>
          <>
            <span>Fullness</span>
            <div class="flex items-center gap-4 text-[#d34726]">
              <Index each={Array.from({ length: 5 })}>
                {(_, i) => <span class={i < (displayFullness() / 51) ? "" : "text-[#d1bfa6]"}>✿</span>}
              </Index>
            </div>
            <div class="flex items-center justify-end gap-4">
              <input 
                type="number" min="0" max="255"
                value={displayFullness()}
                onInput={(e) => setLocalFullness(parseInt(e.target.value, 10) || 0)}
                onChange={(e) => commitUpdate('fullness', setLocalFullness, a().data.fullness, parseInt(e.target.value, 10) || 0)}
                class="w-64 bg-[#e6b167] border-2 border-[#c68c53] rounded px-4 text-right text-[#4d2503] font-bold"
              />
              <span class="text-[#8c5026] text-[12px] leading-[16px]">/ 255</span>
            </div>
          </>
        </Show>

        {/* Days Owned */}
        <Show when={hasDaysOwned()}>
          <>
            <span>Days Owned</span>
            <div class="col-span-2">
              <input 
                type="number" min="0"
                value={displayDays()}
                onInput={(e) => setLocalDays(parseInt(e.target.value, 10) || 0)}
                onChange={(e) => commitUpdate('daysOwned', setLocalDays, a().data.daysOwned, parseInt(e.target.value, 10) || 0)}
                class="w-64 bg-[#e6b167] border-2 border-[#c68c53] rounded px-4 text-[#4d2503] font-bold"
              />
            </div>
          </>
        </Show>

        {/* Gender */}
        <Show when={hasGender()}>
          <>
            <span>Gender</span>
            <div class="col-span-2 flex items-center gap-8">
              <button 
                onClick={() => commitUpdate('isMale', (v: any) => setLocalIsMale(v === 'true'), a().data.isMale, 'true')}
                class={`w-32 h-32 flex items-center justify-center font-bold text-white border-2 rounded transition-colors ${displayIsMale() ? 'bg-blue-500 border-blue-700' : 'bg-[#e6b167] border-[#c68c53] text-[#4d2503]'}`}
              >
                ♂
              </button>
              <button 
                onClick={() => commitUpdate('isMale', (v: any) => setLocalIsMale(v === 'true'), a().data.isMale, 'false')}
                class={`w-32 h-32 flex items-center justify-center font-bold text-white border-2 rounded transition-colors ${!displayIsMale() ? 'bg-pink-500 border-pink-700' : 'bg-[#e6b167] border-[#c68c53] text-[#4d2503]'}`}
              >
                ♀
              </button>
            </div>
          </>
        </Show>
      </div>
    </div>
  );
};

const BuildingCard = (props: { building: any, onUpdateTrigger?: () => void, onRequestDelete?: (animalData: any, bPath: string, currentAnimalsObj: any) => void }) => {
  const b = () => props.building();
  const type = () => getText(b().data.buildingType);
  const maxAnimals = () => parseInt(getText(b().data.maxOccupants) || '0', 10);
  
  const isCoopOrBarn = () => {
     const t = type().toLowerCase();
     return t.includes('coop') || t.includes('barn');
  };
  const canSpawn = () => isCoopOrBarn() && b().animals.length < maxAnimals();

  const [isSpawnerOpen, setIsSpawnerOpen] = createSignal(false);

const handleSpawn = (animalXml: any, newAnimalId: string) => {

    let currentAnimalsObj = b().data.indoors?.animals;

    if (!currentAnimalsObj || typeof currentAnimalsObj !== 'object' || Object.keys(currentAnimalsObj).length === 0) {
       updateValue(`${b().path}.indoors.animals`, { item: [animalXml] });
    } else {
       const newItems = currentAnimalsObj.item ? [...toArray(currentAnimalsObj.item), animalXml] : [animalXml];
       updateValue(`${b().path}.indoors.animals.item`, newItems);
    }

    // Fix issue 1: Delete capital "Animals" tag to prevent C# XML parser overwrite
    updateValue(`${b().path}.indoors.Animals`, undefined);

    let currentRegistryObj = b().data.animalsThatLiveHere;

    if (!currentRegistryObj || typeof currentRegistryObj !== 'object' || Object.keys(currentRegistryObj).length === 0) {
       updateValue(`${b().path}.animalsThatLiveHere`, { long: [newAnimalId] });
    } else {
       const newLongs = currentRegistryObj.long ? [...toArray(currentRegistryObj.long), newAnimalId] : [newAnimalId];
       updateValue(`${b().path}.animalsThatLiveHere.long`, newLongs);
    }

    const updatedOccupantsCount = b().animals.length + 1;
    updateValue(`${b().path}.currentOccupants`, updatedOccupantsCount.toString());

    setIsSpawnerOpen(false);
    if (props.onUpdateTrigger) props.onUpdateTrigger();
  };

  const handleDeleteAnimal = (animalData: any) => {
    const currentAnimalsObj = b().data.indoors?.animals;
    if (props.onRequestDelete) {
       props.onRequestDelete(animalData, b().path, currentAnimalsObj);
    }
  };

  return (
    <div class="flex flex-col gap-8">
      {/* Animal Spawner Modal */}
      <AnimalSpawnerModal 
        isOpen={isSpawnerOpen()}
        buildingType={type()}
        ownerID={b().ownerID || "0"}
        homeLocation={b().homeLocation || "Farm"}
        homeX={getText(b().data.tileX)}
        homeY={getText(b().data.tileY)}
        onSpawn={handleSpawn}
        onClose={() => setIsSpawnerOpen(false)}
      />

      {/* Building Header */}
      <div class="flex items-start gap-16 pb-8 border-b-2 border-[#d98b48] relative">
        <div class="w-64 h-64 bg-[#5dc9f9] border-4 border-[#8c5026] rounded-6 relative overflow-hidden shrink-0 shadow-sm" style={{ "image-rendering": 'pixelated' }}>
          {/* Clouds */}
          <div class="absolute top-4 left-8 w-16 h-8 bg-white/80 rounded-full" />
          <div class="absolute top-8 left-4 w-12 h-8 bg-white/80 rounded-full" />
          <div class="absolute top-4 right-8 w-12 h-8 bg-white/80 rounded-full" />
          {/* Grass */}
          <div class="absolute bottom-0 left-0 right-0 h-16 bg-[#4da839]" />
          <div class="absolute bottom-12 left-4 w-4 h-8 bg-[#4da839]" />
          <div class="absolute bottom-12 left-16 w-4 h-8 bg-[#4da839]" />
          <div class="absolute bottom-12 right-8 w-4 h-8 bg-[#4da839]" />
        </div>
        
        <div class="flex flex-col pt-4">
          <div class="flex items-center gap-12">
            <h3 class="text-[28px] leading-[32px] font-pixsans underline decoration-2 underline-offset-4">{type()}</h3>
            <Show when={canSpawn()}>
              <Show when={!b().data.indoors} fallback={
                <button 
                  onClick={() => setIsSpawnerOpen(true)}
                  class="flex cursor-pointer items-center gap-4 bg-[#4caf50] hover:bg-[#43a047] text-white px-12 py-4 rounded-full font-bold shadow-sm transition-transform active:scale-95"
                >
                  <Plus size={16} strokeWidth={3} />
                  <span class="text-sm">Spawn Animal</span>
                </button>
              }>
                <Tooltip text="Kandang belum terbuat utuh! Masuk ke dalam game dan Load save-nya agar game bisa membangun interiornya terlebih dahulu." position="top" class="z-10">
                  <button 
                    disabled
                    class="flex cursor-not-allowed items-center gap-4 bg-gray-400 text-white px-12 py-4 rounded-full font-bold shadow-sm opacity-50"
                  >
                    <Plus size={16} strokeWidth={3} />
                    <span class="text-sm">Spawn Animal</span>
                  </button>
                </Tooltip>
              </Show>
            </Show>
          </div>
          <Show when={maxAnimals() > 0 && isCoopOrBarn()}>
            <span class="text-body-medium text-[#8c5026] mt-4">{b().animals.length}/{maxAnimals()} animals inside</span>
          </Show>
        </div>
      </div>

      {/* Animals List */}
      <Show when={b().animals.length > 0}>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pl-0 lg:pl-[80px] mt-8">
          <Index each={b().animals}>
            {(animal) => <AnimalCard animal={animal} onDelete={handleDeleteAnimal} />}
          </Index>
        </div>
      </Show>
    </div>
  );
};

export const BuildingsTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;

  const [updateTrigger, setUpdateTrigger] = createSignal(0);
  const [deleteModalOpen, setDeleteModalOpen] = createSignal(false);
  const [animalToDelete, setAnimalToDelete] = createSignal<{ animalData: any, bPath: string, currentAnimalsObj: any } | null>(null);
  const [dontShowAgain, setDontShowAgain] = createSignal(false);

  const requestDeleteAnimal = (animalData: any, bPath: string, currentAnimalsObj: any) => {
     if (localStorage.getItem('stardew_skip_delete_animal_confirm') === 'true') {
        executeDelete(animalData, bPath, currentAnimalsObj);
     } else {
        setAnimalToDelete({ animalData, bPath, currentAnimalsObj });
        setDeleteModalOpen(true);
     }
  };

  const executeDelete = (overrideData?: any, overridePath?: string, overrideObj?: any) => {
     const data = overrideData || animalToDelete()?.animalData;
     const p = overridePath || animalToDelete()?.bPath;
     const c = overrideObj || animalToDelete()?.currentAnimalsObj;

     if (!data || !p || !c) return;

     if (dontShowAgain()) {
        localStorage.setItem('stardew_skip_delete_animal_confirm', 'true');
     }

     const animalName = getText(data.name) || "Animal";

     if (c && c.item) {
        const currentItems = toArray(c.item);
        const newItems = currentItems.filter(item => {
           const a = item.value?.FarmAnimal || item.value;
           return getText(a.myID) !== getText(data.myID);
        });
        
        if (newItems.length === 0) {
           updateValue(`${p}.indoors.animals`, ""); 
        } else {
           updateValue(`${p}.indoors.animals.item`, newItems);
        }
        setUpdateTrigger(t => t + 1);
        addToast(`${animalName} has been permanently deleted.`, 'success');
     }
     setDeleteModalOpen(false);
     
     // Delay clearing the data to allow the modal's exit animation to finish smoothly
     setTimeout(() => {
       setAnimalToDelete(null);
     }, 300);
  };

  const buildingsData = createMemo(() => {
    updateTrigger(); // Track this signal to force recomputation on spawn
    
    const results: { path: string; data: any; animals: any[] }[] = [];
    
    if (!pv()) return results;

    const rawPv = unwrap(pv());
    const rootPath = rawPv?.SaveGame ? 'SaveGame' : '';
    const root = rawPv?.SaveGame || rawPv;
    
    const locationsPath = rootPath ? `${rootPath}.locations.GameLocation` : 'locations.GameLocation';
    const locations = toArray(root?.locations?.GameLocation);
    
    locations.forEach((loc: any, locIdx: number) => {
      if (!loc || typeof loc !== 'object') return;
      
      const locPath = `${locationsPath}.${locIdx}`;
      const isBuildingsArray = Array.isArray(loc?.buildings?.Building);
      const buildingsArray = toArray(loc?.buildings?.Building);
      
      buildingsArray.forEach((building: any, bIdx: number) => {
         if (!building || typeof building !== 'object') return;
         if (building.buildingType && (building['@xsi:type'] !== 'FarmHand' && building['xsi:type'] !== 'FarmHand')) {
           const animals: any[] = [];
           const bPath = isBuildingsArray ? `${locPath}.buildings.Building.${bIdx}` : `${locPath}.buildings.Building`;
           
           if (building.indoors?.animals?.item) {
              const isItemArray = Array.isArray(building.indoors.animals.item);
              const items = toArray(building.indoors.animals.item);
              items.forEach((item: any, aIdx: number) => {
                 if (item.value?.FarmAnimal || item.value?.['@xsi:type'] === 'FarmAnimal' || item.value?.['@_xsi:type'] === 'FarmAnimal') {
                    const animal = item.value.FarmAnimal || item.value;
                    const aPath = isItemArray ? `${bPath}.indoors.animals.item.${aIdx}` : `${bPath}.indoors.animals.item`;
                    animals.push({
                       path: item.value.FarmAnimal ? `${aPath}.value.FarmAnimal` : `${aPath}.value`,
                       data: animal,
                       originalItem: item
                    });
                 }
              });
           }
           
           const bType = getText(building.buildingType).toLowerCase();
           const isTargetBuilding = bType.includes('coop') || bType.includes('barn');
           
           // Only show Barns, Coops (because they can spawn animals), or buildings that already have animals
           if (isTargetBuilding || animals.length > 0) {
             results.push({ 
                path: bPath, 
                data: building, 
                animals,
                homeLocation: getText(loc.name)
             });
           }
         }
      });
      
      const isCharsArray = Array.isArray(loc?.characters?.NPC);
      const charactersArray = toArray(loc?.characters?.NPC);
      const outdoorAnimals: any[] = [];
      
      charactersArray.forEach((char: any, cIdx: number) => {
        if (!char || typeof char !== 'object') return;
        const type = char['@_xsi:type'] || char['@xsi:type'] || char['xsi:type'] || '';
        if (type === 'Horse' || type === 'Cat' || type === 'Dog' || type === 'Turtle' || type === 'Pet') {
          const cPath = isCharsArray ? `${locPath}.characters.NPC.${cIdx}` : `${locPath}.characters.NPC`;
          outdoorAnimals.push({
             path: cPath,
             data: char,
             originalItem: char,
             isPet: true
          });
        }
      });
      
      if (outdoorAnimals.length > 0) {
        results.push({
           path: locPath,
           data: { buildingType: `Pets & Horses (${getText(loc.name)})`, maxOccupants: 0 },
           animals: outdoorAnimals
        });
      }
    });

    return results;
  });

  return (
    <Show 
      when={buildingsData().length > 0} 
      fallback={
        <div class="glass-panel p-24 text-center text-gray-500 py-80">
          <Home class="mx-auto mb-16 opacity-30" size={48} />
          <h3 class="text-[28px] leading-[32px] font-pixsans text-white mb-8">No Buildings Found</h3>
          <p>This save file does not appear to have any buildings.</p>
        </div>
      }
    >
      <Modal 
        isOpen={deleteModalOpen()} 
        onClose={() => setDeleteModalOpen(false)} 
        title="Confirm Deletion"
        icon={<AlertTriangle size={20} class="text-red-500" />}
      >
        <Show when={animalToDelete()}>
          <div class="flex flex-col gap-16 text-zinc-300 font-serif">
            <p>Are you sure you want to permanently delete <strong class="text-red-400">{getText(animalToDelete()!.animalData.name)}</strong>? This action will permanently remove the animal from your save file.</p>
            
            <label class="flex items-center gap-8 cursor-pointer mt-4">
              <input 
                type="checkbox" 
                checked={dontShowAgain()} 
                onChange={(e) => setDontShowAgain(e.target.checked)}
                class="w-16 h-16 accent-red-500 cursor-pointer"
              />
              <span class="font-bold text-sm text-zinc-400">Don't ask me again</span>
            </label>

            <div class="flex gap-12 mt-8">
              <button 
                class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                class="flex-1 py-12 rounded cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-sm"
                onClick={() => executeDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </Show>
      </Modal>

      <div class="flex flex-col gap-32 bg-[#f6ba6f] p-32 rounded-8 shadow-inner text-[#4d2503] font-serif" style={{ border: '8px solid #c05b1c', "border-radius": '16px' }}>
        <div>
          <h1 class="text-title-h3 font-black mb-4">Buildings</h1>
          <h2 class="text-title-h4 font-serif">Farm</h2>
        </div>

        <div class="flex flex-col gap-32">

          <Index each={buildingsData()}>
            {(building) => <BuildingCard building={building} onUpdateTrigger={() => setUpdateTrigger(t => t + 1)} onRequestDelete={requestDeleteAnimal} />}
          </Index>
        </div>
      </div>
    </Show>
  );
};