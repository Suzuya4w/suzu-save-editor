import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X } from 'lucide-solid';
import farmAnimalsData from '../../../data/stardew/farmanimals.json';

interface AnimalSpawnerModalProps {
  isOpen: boolean;
  buildingType: string;
  ownerID: string;
  homeLocation: string;
  homeX: string;
  homeY: string;
  onSpawn: (animalXml: any, newAnimalId: string) => void; 
  onClose: () => void;
}

export const AnimalSpawnerModal = (props: AnimalSpawnerModalProps) => {
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

  const [name, setName] = createSignal('New Animal');
  const [selectedType, setSelectedType] = createSignal('');

  const normalizedHouse = createMemo(() => {
    const bt = props.buildingType.toLowerCase();
    if (bt.includes('coop')) return 'Coop';
    if (bt.includes('barn')) return 'Barn';
    if (bt.includes('slime')) return 'Slime Hutch';
    return '';
  });

  const availableAnimals = createMemo(() => {
    const house = normalizedHouse();
    if (!house) return [];
    
    return Object.entries(farmAnimalsData)
      .filter(([_, data]: [string, any]) => data.House === house)
      .map(([type, data]: [string, any]) => ({
        type,
        displayName: data.DisplayName || type,
        isMale: data.Gender === 'Male'
      }));
  });

  createEffect(() => {
    if (props.isOpen && availableAnimals().length > 0 && !selectedType()) {
      setSelectedType(availableAnimals()[0].type);
    }
  });

  const generateSafeStardewId = (): string => {
    const array = new BigUint64Array(1);
    window.crypto.getRandomValues(array);
    // Mask with 0x7FFFFFFFFFFFFFFFn to guarantee a valid positive signed Int64
    return (array[0] & 0x7FFFFFFFFFFFFFFFn).toString();
  };

  const handleSpawn = () => {
    if (!name().trim() || !selectedType()) return;

    const myID = generateSafeStardewId();
    const animalConfig = availableAnimals().find(a => a.type === selectedType());
    const isMale = animalConfig ? animalConfig.isMale : false;

    const skeleton = {
      "key": { "long": myID },
      "value": {
        "FarmAnimal": {
          "name": name().trim(),
          "forceOneTileWide": "false",
          "isEmoting": "false",
          "isCharging": "false",
          "isGlowing": "false",
          "coloredBorder": "false",
          "flip": "false",
          "drawOnTop": "false",
          "faceTowardFarmer": "false",
          "ignoreMovementAnimation": "false",
          "faceAwayFromFarmer": "false",
          "scale": { "float": "1" },
          "glowingTransparency": "0",
          "glowRate": "0",
          "Gender": isMale ? "Male" : "Female",
          "willDestroyObjectsUnderfoot": "true",
          "Position": { "X": "128", "Y": "128" },
          "Speed": "2",
          "FacingDirection": "2",
          "IsEmoting": "false",
          "CurrentEmote": "32",
          "Scale": "1",
          "isSwimming": { "boolean": "false" },
          "friendshipTowardFarmer": "0",
          "age": "0",
          "daysOwned": "0",
          "health": "3",
          "produceQuality": "0",
          "daysSinceLastLay": "0",
          "happiness": "255",
          "fullness": "255",
          "wasAutoPet": "false",
          "wasPet": "false",
          "allowReproduction": "true",
          "type": selectedType(),
          "buildingTypeILiveIn": props.buildingType,
          "myID": myID,
          "ownerID": props.ownerID || "0",
          "parentId": "-1",
          "homeLocation": props.homeLocation,
          "home": { "X": props.homeX || "0", "Y": props.homeY || "0" },
          "hasEatenAnimalCracker": "false",
          "moodMessage": "0",
          "isEating": "false",
          "displayName": name().trim()
        }
      }
    };

    props.onSpawn(skeleton, myID);
    setName('New Animal');
  };

  return (
    <Show when={shouldRender()}>
      <Portal>
        <div 
          class={`fixed inset-0 z-[9999] flex items-center justify-center p-16 md:p-32 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isVisible() ? "opacity-100 bg-black/95" : "opacity-0 bg-transparent"
          }`}
        >
          <div class="absolute inset-0" onClick={props.onClose} />
          
          <div 
            class={`relative bg-[#fce8b8] w-full max-w-md border-[6px] border-[#c0733a] rounded-12 shadow-[inset_0_0_15px_rgba(0,0,0,0.2),_0_10px_25px_rgba(0,0,0,0.5)] flex flex-col font-serif overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isVisible() ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
            }`}
          >
            {/* Header */}
            <div class="bg-[#c0733a] text-white p-12 px-16 flex items-center justify-between shrink-0 shadow-md z-10 border-b-4 border-[#8c4614]">
              <h2 class="text-xl font-bold font-pixsans tracking-wider text-shadow-sm flex items-center gap-8">
                <span class="text-2xl">🐮</span> Spawn Animal
              </h2>
              <button 
                onClick={props.onClose}
                class="text-white cursor-pointer hover:text-[#fce8b8] transition-colors p-4 rounded hover:bg-black/20"
              >
                <X size={24} strokeWidth={3} />
              </button>
            </div>
            
            <div class="p-24">

            <Show when={availableAnimals().length > 0} fallback={<div class="text-[#8c5026] text-center italic py-8">No animals can be spawned in a {props.buildingType}.</div>}>
              <div class="flex flex-col gap-16 text-[#4d2503] font-bold">
                <div class="flex flex-col gap-8">
                  <label>Animal Name</label>
                  <input type="text" value={name()} onInput={(e) => setName(e.target.value)} class="w-full bg-[#f4d499] border-2 border-[#c0733a] rounded-8 p-12 text-[#4d2503] font-bold outline-none focus:ring-2 focus:ring-[#8c4614] shadow-inner" />
                </div>

                <div class="flex flex-col gap-8">
                  <label>Animal Type</label>
                  <select value={selectedType()} onChange={(e) => setSelectedType(e.target.value)} class="w-full bg-[#f4d499] border-2 border-[#c0733a] rounded-8 p-12 text-[#4d2503] font-bold outline-none cursor-pointer shadow-sm">
                    <For each={availableAnimals()}>
                      {(animal) => <option value={animal.type}>{animal.type}</option>}
                    </For>
                  </select>
                </div>
              </div>

              <button onClick={handleSpawn} disabled={!name().trim() || !selectedType()} class="mt-24 w-full cursor-pointer bg-[#4caf50] border-b-4 border-[#388e3c] hover:bg-[#43a047] hover:border-[#2e7d32] text-white font-bold font-serif tracking-wider py-16 rounded-8 shadow-sm transition-all active:translate-y-2 active:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed">
                SPAWN {selectedType() ? selectedType().toUpperCase() : 'ANIMAL'}
              </button>
            </Show>
          </div>
        </div>
        </div>
      </Portal>
    </Show>
  );
};
