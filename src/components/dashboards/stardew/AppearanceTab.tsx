// @ts-nocheck
import { Show, createSignal, createEffect } from 'solid-js';
import { useEditorStore, updateValue } from '../../../store/editorStore';
import { User, Palette } from 'lucide-solid';

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

const getNumber = (val: any): number => parseInt(getText(val) || '0', 10);
const getBoolean = (val: any): boolean => getText(val) === 'true';

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    R: parseInt(result[1], 16),
    G: parseInt(result[2], 16),
    B: parseInt(result[3], 16),
    A: 255
  } : null;
};

const ColorPicker = (props: { label: string, colorKey: string, basePath: string, playerObj: any }) => {
  const getHexFromStore = () => {
    const obj = props.playerObj ? props.playerObj[props.colorKey] : undefined;
    if (!obj) return '#000000';
    return rgbToHex(getNumber(obj.R), getNumber(obj.G), getNumber(obj.B));
  };

  const [localColor, setLocalColor] = createSignal<string | null>(null);
  
  const displayColor = () => localColor() !== null ? localColor()! : getHexFromStore();

  const commitColor = (hex: string) => {
    setLocalColor(null);
    
    const rgb = hexToRgb(hex);
    if (!rgb) return;

    ['R', 'G', 'B', 'A'].forEach(channel => {
      const channelVal = props.playerObj ? props.playerObj[props.colorKey]?.[channel] : undefined;
      let path = `${props.basePath}.${props.colorKey}.${channel}`;
      if (typeof channelVal === 'object' && channelVal !== null) {
        if ('$text' in channelVal) path += '.$text';
        else if ('$value' in channelVal) path += '.$value';
        else if ('#text' in channelVal) path += '.#text';
        else if ('' in channelVal) path += '.';
      }
      updateValue(path, rgb[channel as keyof typeof rgb]);
    });

    const a = 255;
    const packed = ((a << 24) | (rgb.B << 16) | (rgb.G << 8) | rgb.R) >>> 0;
    
    const packedValObj = props.playerObj ? props.playerObj[props.colorKey]?.PackedValue : undefined;
    let packedPath = `${props.basePath}.${props.colorKey}.PackedValue`;
    if (typeof packedValObj === 'object' && packedValObj !== null) {
        if ('$text' in packedValObj) packedPath += '.$text';
        else if ('$value' in packedValObj) packedPath += '.$value';
        else if ('#text' in packedValObj) packedPath += '.#text';
        else if ('' in packedValObj) packedPath += '.';
    }
    updateValue(packedPath, packed.toString());
  };

  return (
    <div class="flex flex-col gap-4">
      <label class="text-[12px] leading-[16px] text-gray-500">{props.label}</label>
      <input 
        type="color" 
        value={displayColor()}
        onInput={(e) => setLocalColor(e.target.value)}
        onChange={(e) => commitColor(e.target.value)}
        class="w-full h-48 rounded-8 cursor-pointer bg-transparent border-0"
      />
    </div>
  );
};


export const AppearanceTab = () => {
  const store = useEditorStore();
  const pv = () => store.saveData?.parsed_variables;
  const player = () => pv()?.player || pv()?.SaveGame?.player || pv();
  const basePath = () => pv()?.SaveGame?.player ? 'SaveGame.player' : 'player';

  const handleStringChange = (key: string, val: string) => {
    const valObj = player() ? player()![key] : undefined;
    let path = `${basePath()}.${key}`;
    if (typeof valObj === 'object' && valObj !== null) {
      if ('$text' in valObj) path += '.$text';
      else if ('$value' in valObj) path += '.$value';
      else if ('#text' in valObj) path += '.#text';
      else if ('' in valObj) path += '.';
    }
    updateValue(path, val);
  };

  const handleNumberChange = (key: string, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const valObj = player() ? player()![key] : undefined;
    let path = `${basePath()}.${key}`;
    if (typeof valObj === 'object' && valObj !== null) {
      if ('$text' in valObj) path += '.$text';
      else if ('$value' in valObj) path += '.$value';
      else if ('#text' in valObj) path += '.#text';
      else if ('' in valObj) path += '.';
    }
    updateValue(path, num);
  };

  const handleBooleanChange = (key: string, val: boolean) => {
    const valObj = player() ? player()![key] : undefined;
    let path = `${basePath()}.${key}`;
    if (typeof valObj === 'object' && valObj !== null) {
      if ('$text' in valObj) path += '.$text';
      else if ('$value' in valObj) path += '.$value';
      else if ('#text' in valObj) path += '.#text';
      else if ('' in valObj) path += '.';
    }
    updateValue(path, val);
  };

  const handleGenderChange = (isMale: boolean) => {
     handleBooleanChange('isMale', isMale);
     if (player()?.gender !== undefined) {
         const genderVal = isMale ? 'Male' : 'Female';
         let path = `${basePath()}.gender`;
         const valObj = player()!.gender;
         if (typeof valObj === 'object' && valObj !== null) {
            if ('$text' in valObj) path += '.$text';
            else if ('$value' in valObj) path += '.$value';
            else if ('#text' in valObj) path += '.#text';
            else if ('' in valObj) path += '.';
         }
         updateValue(path, genderVal);
     }
  };

  const isPlayerMale = () => {
      const gender = getText(player()?.gender);
      if (gender === 'Male') return true;
      if (gender === 'Female') return false;
      return getBoolean(player()?.isMale);
  };

  return (
    <Show when={player()}>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-24">
      <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col gap-24">
        <h2 class="text-body-medium font-serif text-gray-400 uppercase tracking-widest flex items-center gap-8">
          <User size={14} /> Basic Identity
        </h2>
        
        <div class="flex flex-col gap-16">
          <div class="flex flex-col gap-4">
            <label class="text-[12px] leading-[16px] font-serif text-gray-500">Player Name</label>
            <input 
              type="text" 
              value={getText(player()?.name)}
              onInput={(e) => handleStringChange('name', e.target.value)}
              class="glass-input font-serif"
            />
          </div>

          <div class="flex flex-col gap-4">
            <label class="text-[12px] leading-[16px] font-serif text-gray-500">Farm Name</label>
            <div class="flex items-center gap-8">
              <input 
                type="text" 
                value={getText(player()?.farmName)}
                onInput={(e) => handleStringChange('farmName', e.target.value)}
                class="glass-input w-full font-serif"
              />
              <span class="text-gray-600 text-body-medium shrink-0">Farm</span>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <label class="text-[12px] leading-[16px] font-serif text-gray-500">Favorite Thing</label>
            <input 
              type="text" 
              value={getText(player()?.favoriteThing)}
              onInput={(e) => handleStringChange('favoriteThing', e.target.value)}
              class="glass-input font-serif"
            />
          </div>
        </div>
      </div>

      <div class="glass-panel p-24 border border-white/5 bg-[#0A0A0A]/90 rounded-16 flex flex-col gap-24">
        <h2 class="text-body-medium font-sans text-gray-400 uppercase tracking-widest flex items-center gap-8">
          <Palette size={14} /> Appearance
        </h2>

        <div class="grid grid-cols-2 gap-24">
          <div class="flex flex-col gap-16">
            <div class="flex flex-col gap-8">
              <label class="text-[12px] leading-[16px] font-serif text-gray-500">Gender</label>
              <div class="flex gap-8">
                <button 
                  onClick={() => handleGenderChange(true)}
                  class={`flex-1 py-8 font-serif cursor-pointer rounded-8 border text-body-medium font-bold transition-all ${isPlayerMale() ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                >
                  Male
                </button>
                <button 
                  onClick={() => handleGenderChange(false)}
                  class={`flex-1 font-serif py-8 cursor-pointer rounded-8 border text-body-medium font-bold transition-all ${!isPlayerMale() ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                >
                  Female
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <label class="text-[12px] font-serif leading-[16px] text-gray-500">Skin Tone</label>
              <input 
                type="number" min="0" max="23"
                value={getNumber(player()?.skin)}
                onInput={(e) => handleNumberChange('skin', e.target.value)}
                class="glass-input font-serif font-brains"
              />
            </div>

            <div class="flex flex-col gap-4">
              <label class="text-[12px] font-serif leading-[16px] text-gray-500">Hair Style</label>
              <input 
                type="number" min="0" max="100"
                value={getNumber(player()?.hair)}
                onInput={(e) => handleNumberChange('hair', e.target.value)}
                class="glass-input font-brains"
              />
            </div>

            <div class="flex flex-col gap-4">
              <label class="text-[12px] font-serif leading-[16px] text-gray-500">Accessory</label>
              <input 
                type="number" min="-1" max="100"
                value={getNumber(player()?.accessory)}
                onInput={(e) => handleNumberChange('accessory', e.target.value)}
                class="glass-input font-brains"
              />
            </div>
          </div>

          <div class="flex flex-col font-serif gap-16">
            <ColorPicker 
              label="Eye Color" 
              colorKey="newEyeColor" 
              basePath={basePath()} 
              playerObj={player()} 
            />
            <ColorPicker 
              label="Hair Color" 
              colorKey="hairstyleColor" 
              basePath={basePath()} 
              playerObj={player()} 
            />
          </div>
      </div>
    </div>
    </div>
    </Show>
  );
};