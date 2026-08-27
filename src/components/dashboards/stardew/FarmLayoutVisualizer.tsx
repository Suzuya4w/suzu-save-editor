import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore, updateValue, deleteValue } from '../../../store/editorStore';
import { addToast } from '../../../store/toastStore';
import { Modal } from '../../Modal';
import { AlertTriangle, Trash2, Hammer, ArrowLeftRight, Package } from 'lucide-solid';
import buildingsDataRaw from '../../../data/stardew/buildings.json';
import { ItemSprite } from './ItemSprite';
import { BuildingSpawnerModal } from './BuildingSpawnerModal';
import { TreeSprite } from './TreeSprite';


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

const getObjectColor = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('artifact spot')) return '#ffeb3b';
  if (n.includes('fence')) return '#795548';
  if (n.includes('stone')) return '#707070';
  if (n.includes('weed')) return '#2e7d32';
  if (n.includes('twig') || n.includes('wood')) return '#8d6e63';
  if (n.includes('chest')) return '#9c27b0';
  if (
    n.includes('furnace') || 
    n.includes('sprinkler') || 
    n.includes('scarecrow') || 
    n.includes('lightning rod')
  ) return '#ffb300';
  return '#ff9800';
};

const isObjectSquare = (name: string): boolean => {
  const n = name.toLowerCase();
  return n.includes('chest') || n.includes('fence') || n.includes('furnace');
};

const getSafeTextureUrl = (texturePath?: string) => {
  if (!texturePath) return '';
  const safePath = texturePath.replace(/\\/g, '/').replace('.png', '');
  return `/stardew/buildings/${safePath}.png`;
};

export const FarmLayoutVisualizer = () => {
  const store = useEditorStore();
  const [useSpriteView, setUseSpriteView] = createSignal(false);
  const [isClearDebrisModalOpen, setClearDebrisModalOpen] = createSignal(false);
  const [buildingToDelete, setBuildingToDelete] = createSignal<{id: string, name: string} | null>(null);
  const [eraserMode, setEraserMode] = createSignal(false);
  const [moveMode, setMoveMode] = createSignal(false);

  const [stashMode, setStashMode] = createSignal(false);
  const [stashedItems, setStashedItems] = createSignal<any[]>([]);

  const groupedStashedItems = createMemo(() => {
    const groups = new Map<string, any>();
    
    stashedItems().forEach(item => {

      let groupKey = item.itemCategory === 'Building' 
        ? `Building_${item.type}` 
        : item.itemCategory === 'TerrainFeature'
          ? `Terrain_${item.name}`
          : `${item.itemCategory}_${item.name}_${item.itemId || ''}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          displayName: item.itemCategory === 'Building' ? item.type.replace('Building', '').trim() : item.name,
          itemCategory: item.itemCategory,
          sample: item,
          instances: []
        });
      }
      groups.get(groupKey).instances.push(item);
    });

    return Array.from(groups.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  const isStashed = (id: string) => stashedItems().some(item => item.id === id);

  const handleStashAll = () => {
    const allB = buildings().filter(b => !isBuildingLocked(b)).map(b => ({ ...b, itemCategory: 'Building', spawnCategory: 'Building' }));
    const allO = farmObjects().filter(o => !o.isHeld).map(o => ({ ...o, itemCategory: 'Object', spawnCategory: 'Object' }));
    const allF = (typeof farmFurniture === 'function' ? farmFurniture() : []).map(f => ({ ...f, itemCategory: 'Furniture', spawnCategory: 'Furniture' }));

    const allT = farmTerrainFeatures()
      .filter(t => t.type !== 'Grass')
      .map(t => ({ ...t, itemCategory: 'TerrainFeature', spawnCategory: 'TerrainFeature' }));
    
    setStashedItems([...allB, ...allO, ...allF, ...allT]);
  };

  const [swapMode, setSwapMode] = createSignal(false);
  const [firstSwapItem, setFirstSwapItem] = createSignal<any>(null);
  const [collisionData, setCollisionData] = createSignal<any>(null);
  const [isPainting, setIsPainting] = createSignal(false);
  const [isDraggingFromStash, setIsDraggingFromStash] = createSignal(false);

  const [isBuildingModalOpen, setBuildingModalOpen] = createSignal(false);
  const [buildingToPlace, setBuildingToPlace] = createSignal<any>(null);

  const [draggedBuilding, setDraggedBuilding] = createSignal<any>(null);
  const [dragPos, setDragPos] = createSignal<{x: number, y: number} | null>(null);
  const [mousePixelPos, setMousePixelPos] = createSignal<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = createSignal<{x: number, y: number} | null>(null);

  const LOCKED_STRUCTURES = ["Farmhouse", "Greenhouse", "Pet Bowl", "Cave", "Shipping Bin"];

  const handleItemClickForSwap = (e: MouseEvent, clickedItem: any, category: 'Building' | 'Object' | 'Furniture' | 'TerrainFeature') => {
    if (!swapMode()) return;
    e.stopPropagation();

if (!firstSwapItem()) {
      setFirstSwapItem({ ...clickedItem, category });

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clickedItem.name);
      const safeName = (isUUID || !clickedItem.name) ? (clickedItem.type || "Item") : clickedItem.name;

      addToast(`Target 1 locked: ${safeName}. Click second target to swap!`, 'info');
      return;
    }

    const itemA = firstSwapItem();
    const itemB = { ...clickedItem, category };

    if (itemA.id === itemB.id) {
      setFirstSwapItem(null);
      addToast("Swap cancelled.", "info");
      return;
    }

const normA = {
      ...itemA,
      tilesWide: itemA.tilesWide || itemA.tilesX || 1,
      tilesHigh: itemA.tilesHigh || itemA.tilesY || 1
    };
    const normB = {
      ...itemB,
      tilesWide: itemB.tilesWide || itemB.tilesX || 1,
      tilesHigh: itemB.tilesHigh || itemB.tilesY || 1
    };

    const getReadableName = (item: any) => {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.name);
      return (isUUID || !item.name) ? (item.type || "Item") : item.name;
    };

    const fitsAIntoB = isDropValid(itemB.tileX, itemB.tileY, normA, [itemB.id]);
    const fitsBIntoA = isDropValid(itemA.tileX, itemA.tileY, normB, [itemA.id]);

    if (!fitsAIntoB || !fitsBIntoA) {
      const nameA = getReadableName(normA);
      const nameB = getReadableName(normB);
      let failReason = "";

      if (!fitsAIntoB && !fitsBIntoA) {
        failReason = "Neither item fits in the new location.";
      } else if (!fitsAIntoB) {
        failReason = `Not enough space to place ${nameA} at ${nameB}'s location.`;
      } else {
        failReason = `Not enough space to place ${nameB} at ${nameA}'s location.`;
      }

      addToast(`SWAP REJECTED: ${failReason}`, "error");
      setFirstSwapItem(null);
      return;
    }

    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    const farmIdx = locations.findIndex((loc: any) => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
    if (farmIdx === -1) return;

    const origA_X = itemA.tileX.toString();
    const origA_Y = itemA.tileY.toString();
    const origB_X = itemB.tileX.toString();
    const origB_Y = itemB.tileY.toString();

    const getLockedStoreIndex = (item: any) => {
      const farm = locations[farmIdx];
      if (item.category === 'Building') {
        return toArray(farm.buildings?.Building).findIndex((b: any) => parseInt(getText(b?.tileX)||'0',10) === item.tileX && parseInt(getText(b?.tileY)||'0',10) === item.tileY);
      } else if (item.category === 'Object') {
        return toArray(farm.objects?.item).findIndex((o: any) => parseInt(getText(o?.key?.Vector2?.X)||'0',10) === item.tileX && parseInt(getText(o?.key?.Vector2?.Y)||'0',10) === item.tileY);
      } else if (item.category === 'TerrainFeature') {
        return toArray(farm.terrainFeatures?.item).findIndex((t: any) => parseInt(getText(t?.key?.Vector2?.X)||'0',10) === item.tileX && parseInt(getText(t?.key?.Vector2?.Y)||'0',10) === item.tileY);
      } else {
        return toArray(farm.furniture?.Furniture).findIndex((f: any) => parseInt(getText(f?.tileLocation?.X)||'0',10) === item.tileX && parseInt(getText(f?.tileLocation?.Y)||'0',10) === item.tileY);
      }
    };

    const indexA = getLockedStoreIndex(itemA);
    const indexB = getLockedStoreIndex(itemB);

    if (indexA === -1 || indexB === -1) {
      addToast("Failed to locate one of the items in store.", "error");
      setFirstSwapItem(null);
      return;
    }

    const mutateCoords = (targetCat: string, lockedIdx: number, newX: string, newY: string) => {
      const base = `SaveGame.locations.GameLocation.${farmIdx}`;
      if (targetCat === 'Building') {
        updateValue(`${base}.buildings.Building.${lockedIdx}.tileX`, newX);
        updateValue(`${base}.buildings.Building.${lockedIdx}.tileY`, newY);
      } else if (targetCat === 'Object') {
        updateValue(`${base}.objects.item.${lockedIdx}.key.Vector2.X`, newX);
        updateValue(`${base}.objects.item.${lockedIdx}.key.Vector2.Y`, newY);
        updateValue(`${base}.objects.item.${lockedIdx}.value.Object.tileLocation.X`, newX);
        updateValue(`${base}.objects.item.${lockedIdx}.value.Object.tileLocation.Y`, newY);
        if (locations[farmIdx].objects?.item?.[lockedIdx]?.value?.Object?.boundingBox) {
          updateValue(`${base}.objects.item.${lockedIdx}.value.Object.boundingBox.X`, (parseInt(newX)*64).toString());
          updateValue(`${base}.objects.item.${lockedIdx}.value.Object.boundingBox.Y`, (parseInt(newY)*64).toString());
        }
      } else if (targetCat === 'TerrainFeature') {
        updateValue(`${base}.terrainFeatures.item.${lockedIdx}.key.Vector2.X`, newX);
        updateValue(`${base}.terrainFeatures.item.${lockedIdx}.key.Vector2.Y`, newY);
      } else {
        updateValue(`${base}.furniture.Furniture.${lockedIdx}.tileLocation.X`, newX);
        updateValue(`${base}.furniture.Furniture.${lockedIdx}.tileLocation.Y`, newY);
        if (locations[farmIdx].furniture?.Furniture?.[lockedIdx]?.boundingBox) {
          updateValue(`${base}.furniture.Furniture.${lockedIdx}.boundingBox.X`, (parseInt(newX)*64).toString());
          updateValue(`${base}.furniture.Furniture.${lockedIdx}.boundingBox.Y`, (parseInt(newY)*64).toString());
        }
      }
    };

    mutateCoords(itemA.category, indexA, origB_X, origB_Y);
    mutateCoords(itemB.category, indexB, origA_X, origA_Y);

    addToast(`SWAP SUCCESS: ${getReadableName(normA)} ↔ ${getReadableName(normB)}!`, 'success');
    setFirstSwapItem(null);
  };

const isDropValid = (dropX: number, dropY: number, item: any, extraIgnoredIds: string[] = []) => {
    const tw = parseInt(item?.tilesWide || item?.tilesX || '1', 10);
    const th = parseInt(item?.tilesHigh || item?.tilesY || '1', 10);

    if (dropX < 0 || dropY < 0 || dropX + tw > bounds().width || dropY + th > bounds().height) {
      return false;
    }

    const ignoreSet = new Set([item.id, ...extraIgnoredIds]);

    const dropName = (item?.name || item?.type || '').toLowerCase();

    const allB = buildings();
    for (const b of allB) {
      if (ignoreSet.has(b.id) || isStashed(b.id)) continue;
      const btw = b.tilesWide || 1;
      const bth = b.tilesHigh || 1;
      if (dropX < b.tileX + btw && dropX + tw > b.tileX && dropY < b.tileY + bth && dropY + th > b.tileY) {
        return false;
      }
    }

    const allObj = farmObjects();
    for (const obj of allObj) {
      if (ignoreSet.has(obj.id) || isStashed(obj.id)) continue;
      
      if (dropX <= obj.tileX && dropX + tw > obj.tileX && dropY <= obj.tileY && dropY + th > obj.tileY) {

        const targetName = (obj.name || obj.type || '').toLowerCase();

        const isTorchOnSprinkler = dropName.includes('torch') && (targetName.includes('sprinkler') || targetName.includes('fence'));

        const isNozzleOnSprinkler = dropName.includes('nozzle') && targetName.includes('sprinkler');

        if (isTorchOnSprinkler || isNozzleOnSprinkler) {
          continue;
        }
        
        return false;
      }
    }

    const allFurn = typeof farmFurniture === 'function' ? farmFurniture() : [];
    for (const furn of allFurn) {
      if (ignoreSet.has(furn.id) || isStashed(furn.id)) continue;
      const ftw = furn.tilesWide || 1;
      const fth = furn.tilesHigh || 1;
      if (dropX < furn.tileX + ftw && dropX + tw > furn.tileX && dropY < furn.tileY + fth && dropY + th > furn.tileY) {
        return false;
      }
    }

    const allTerr = farmTerrainFeatures();
    for (const terr of allTerr) {
      if (ignoreSet.has(terr.id)) continue;
      const tType = terr.type.toLowerCase();

      if (tType.includes('flooring') || tType.includes('grass')) {
        if (item?.type === 'Flooring' && tType.includes('flooring')) {
          if (dropX <= terr.tileX && dropX + tw > terr.tileX && dropY <= terr.tileY && dropY + th > terr.tileY) return false;
        }
        continue;
      }
      
      if (dropX <= terr.tileX && dropX + tw > terr.tileX && dropY <= terr.tileY && dropY + th > terr.tileY) {

        const isTapperOnTree = dropName.includes('tapper') && tType.includes('tree') && !terr.isStump;
        
        if (isTapperOnTree) {
          continue;
        }

        return false;
      }
    }

    const colData = collisionData();
    if (colData && colData.grid) {
      for (let y = dropY; y < dropY + th; y++) {
        for (let x = dropX; x < dropX + tw; x++) {
          if (y >= 0 && y < colData.height && x >= 0 && x < colData.width) {
            if (colData.grid[y][x] === 0 && !dropName.includes('floor') && !dropName.includes('path')) {
               return false;
            }
          }
        }
      }
    }

    return true;
  };

  const isBuildingLocked = (b: any): boolean => {
    const lowerType = String(b.type || '').toLowerCase();
    const lowerName = String(b.name || '').toLowerCase();
    
    return LOCKED_STRUCTURES.some(locked => {
      const l = locked.toLowerCase();
      return lowerType.includes(l) || lowerName.includes(l);
    });
  };

  const generateBuildingXml = (bData: any, dropX: number, dropY: number) => {
    let xsiType = "Building";
    const name = bData.name;

    if (name === "Junimo Hut") xsiType = "JunimoHut";
    else if (name === "Fish Pond") xsiType = "FishPond";
    else if (name === "Mill") xsiType = "Mill";
    else if (name === "Shipping Bin") xsiType = "ShippingBin";
    else if (name === "Greenhouse") xsiType = "GreenhouseBuilding";
    else if (name === "Barn" || name === "Big Barn" || name === "Deluxe Barn") xsiType = "Barn";
    else if (name === "Coop" || name === "Big Coop" || name === "Deluxe Coop") xsiType = "Coop";

    const newBuilding: any = {
      "@xsi:type": xsiType,
      "buildingType": name,
      "tileX": String(dropX),
      "tileY": String(dropY),
      "tilesWide": String(bData.footprint.X),
      "tilesHigh": String(bData.footprint.Y),
      "maxOccupants": "0",
      "currentOccupants": "0",
      "daysOfConstructionLeft": "0",
      "daysUntilUpgrade": "0",
      "color": { "R": "255", "G": "255", "B": "255", "A": "255" }
    };

    if (xsiType === "FishPond") {
      newBuilding.fishType = "-1";
      newBuilding.seedOffset = "0";
      newBuilding.hasCompleetedRequest = "false";
    }

    return newBuilding;
  };

  const generateTerrainFeatureXml = (bData: any, dropX: number, dropY: number) => {
    if (bData.type === 'Flooring') {
      return {
        key: { Vector2: { X: String(dropX), Y: String(dropY) } },
        value: {
          TerrainFeature: {
            "@xsi:type": "Flooring",
            whichFloor: String(bData.whichFloor),
            whichView: "0",
            isSteppingStone: "false",
            isLostItem: "false",
            state: "0"
          }
        }
      };
    }
    return null;
  };

  const generateObjectXml = (bData: any, dropX: number, dropY: number) => {
    let xsiType = "Object";
    if (bData.name.toLowerCase().includes('fence')) xsiType = "Fence";
    else if (bData.name.toLowerCase().includes('chest')) xsiType = "Chest";

    const parentSheetIndex = bData.spriteIndex || bData._key || '0';

    return {
      key: { Vector2: { X: String(dropX), Y: String(dropY) } },
      value: {
        Object: {
          "@xsi:type": xsiType,
          isLostItem: "false",
          category: String(bData.category || 0),
          hasBeenInInventory: "false",
          name: bData.name,
          ...(!isNaN(Number(bData._key)) ? { parentSheetIndex: String(parentSheetIndex) } : {}),
          id: String(parentSheetIndex),
          itemId: String(parentSheetIndex),
          ItemId: String(parentSheetIndex),
          specialItem: "false",
          isRecipe: "false",
          quality: "0",
          stack: "1",
          tileLocation: { X: String(dropX), Y: String(dropY) },
          owner: store.saveData?.parsed_variables?.SaveGame?.player?.UniqueMultiplayerID || "0",
          type: bData.type || "Crafting",
          canBeSetDown: "true",
          canBeGrabbed: "true",
          isSpawnedObject: "false",
          questItem: "false",
          questId: "0",
          isOn: "true",
          fragility: "0",
          price: String(bData.price || 0),
          edibility: String(bData.edibility || -300),
          bigCraftable: (bData.category === -9 || bData._type === 'BigCraftable' || bData.type === 'BigCraftable') ? "true" : "false",
          setOutdoors: "true",
          setIndoors: "true",
          readyForHarvest: "false",
          showNextIndex: "false",
          flipped: "false",
          hasMachineFeatures: "false",
          isLamp: "false",
          minutesUntilReady: "0",
          boundingWidth: "1",
          boundingHeight: "1"
        }
      }
    };
  };

  const getFurnitureType = (typeStr: string) => {
    if (!typeStr) return 0;
    const typeMap: Record<string, number> = {
      "chair": 0, "bench": 1, "couch": 2, "armchair": 3, "dresser": 4,
      "lamp": 5, "window": 6, "fireplace": 7, "table": 8, "bookcase": 9,
      "other": 10, "sconce": 11, "rug": 12, "painting": 13, "fishtank": 14,
      "bed": 15, "decor": 10
    };
    return typeMap[typeStr.toLowerCase()] ?? 0;
  };

  const generateFurnitureXml = (bData: any, dropX: number, dropY: number) => {
    const itemId = bData._key || bData.spriteIndex || '0';
    const numericSpriteIndex = !isNaN(Number(bData._key)) ? bData._key : (bData.spriteIndex || '0');
    return {
      "@xsi:type": "Furniture",
      isLostItem: "false",
      category: "-100",
      hasBeenInInventory: "false",
      name: bData.name,
      id: String(itemId),
      itemId: String(itemId),
      ItemId: String(itemId),
      specialItem: "false",
      isRecipe: "false",
      quality: "0",
      stack: "1",
      SpecialVariable: "0",
      type: bData.type || "Crafting",
      canBeSetDown: "true",
      canBeGrabbed: "true",
      isSpawnedObject: "false",
      questItem: "false",
      questId: "0",
      isOn: "false",
      fragility: "0",
      price: String(bData.price || 0),
      edibility: "-300",
      bigCraftable: "false",
      setOutdoors: "true",
      setIndoors: "true",
      readyForHarvest: "false",
      showNextIndex: "false",
      flipped: "false",
      hasMachineFeatures: "false",
      ...(!isNaN(Number(itemId)) ? { parentSheetIndex: String(numericSpriteIndex) } : {}),
      owner: store.saveData?.parsed_variables?.SaveGame?.player?.UniqueMultiplayerID || "0",
      boundingBox: { X: String(dropX * 64), Y: String(dropY * 64), Width: String((bData.tilesX || 1) * 64), Height: String((bData.tilesY || 1) * 64) },
      furniture_type: String(getFurnitureType(bData.type)),
      rotations: String(bData.rotations || 1),
      currentRotation: "0",
      sourceRect: { X: "0", Y: "0", Width: String((bData.tilesX || 1) * 16), Height: String((bData.tilesY || 1) * 16) },
      defaultSourceRect: { X: "0", Y: "0", Width: String((bData.tilesX || 1) * 16), Height: String((bData.tilesY || 1) * 16) },
      defaultBoundingBox: { X: "0", Y: "0", Width: String((bData.tilesX || 1) * 64), Height: String((bData.tilesY || 1) * 64) }
    };
  };

  createEffect(() => {
    onCleanup(() => {
      if (stashedItems().length > 0) {
        setStashMode(false);
        setStashedItems([]);
        setBuildingToPlace(null);
      }
    });
  });

  createEffect(() => {
    const saveGame = store.saveData?.parsed_variables?.SaveGame;
    if (!saveGame) return;

    let farmTypeStr = saveGame.whichFarm;
    if (typeof farmTypeStr === 'object' && farmTypeStr !== null) {
      farmTypeStr = farmTypeStr['#text'] || farmTypeStr._text || Object.values(farmTypeStr)[0];
    }
    
    let farmId = "0";
    if (typeof farmTypeStr === 'string' && (farmTypeStr.includes("Meadowlands") || farmTypeStr.includes("Ranching"))) {
      farmId = "7";
    } else {
      farmId = parseInt(farmTypeStr || "0", 10).toString();
    }

    invoke('get_farm_collision_grid', {
      unpackedContentPath: 'C:\\Users\\Administrator\\Downloads\\Stardew Valley\\Content (unpacked)',
      farmId: farmId
    }).then((data) => {
      setCollisionData(data);
    }).catch((err) => {
      console.error("Failed to load collision data:", err);
    });
  });

  const deleteObject = (e: MouseEvent, tileX: number, tileY: number) => {
    if (!eraserMode()) return;
    e.stopPropagation();
    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    const farmIndex = locations.findIndex(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
    if (farmIndex === -1) return;
    
    const farm = locations[farmIndex];
    if (farm.objects && farm.objects.item) {
      const items = [...toArray(farm.objects.item)];
      const targetIndex = items.findIndex((item: any) => {
        const itemX = parseInt(getText(item?.key?.Vector2?.X) || '0', 10);
        const itemY = parseInt(getText(item?.key?.Vector2?.Y) || '0', 10);
        return itemX === tileX && itemY === tileY;
      });

      if (targetIndex !== -1) {
        deleteValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${targetIndex}`);
        addToast("Object removed", "success");
      }
    }
  };

  const deleteTerrain = (e: MouseEvent, tileX: number, tileY: number) => {
    if (!eraserMode()) return;
    e.stopPropagation();
    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    const farmIndex = locations.findIndex(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
    if (farmIndex === -1) return;
    
    const farm = locations[farmIndex];
    if (farm.terrainFeatures && farm.terrainFeatures.item) {
      const items = [...toArray(farm.terrainFeatures.item)];
      const targetIndex = items.findIndex((item: any) => {
        const itemX = parseInt(getText(item?.key?.Vector2?.X) || '0', 10);
        const itemY = parseInt(getText(item?.key?.Vector2?.Y) || '0', 10);
        return itemX === tileX && itemY === tileY;
      });

      if (targetIndex !== -1) {
        deleteValue(`SaveGame.locations.GameLocation.${farmIndex}.terrainFeatures.item.${targetIndex}`);
        addToast("Terrain removed", "success");
      }
    }
  };

  const requestDeleteBuilding = (e: MouseEvent, buildingId: string) => {
    if (!eraserMode()) return;
    e.stopPropagation();
    
    const building = buildings().find(b => b.id === buildingId);
    if (building && isBuildingLocked(building)) {
      addToast("Cannot delete permanent buildings.", "error");
      return;
    }

    setBuildingToDelete({ id: buildingId, name: building?.type || 'Building' });
  };

  const confirmDeleteBuilding = () => {
    const toDelete = buildingToDelete();
    if (!toDelete) return;

    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    const farmIndex = locations.findIndex(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
    if (farmIndex === -1) return;
    
    const parts = toDelete.id.split('-');
    if (parts.length >= 2) {
      const targetIndex = parseInt(parts[1], 10);
      deleteValue(`SaveGame.locations.GameLocation.${farmIndex}.buildings.Building.${targetIndex}`);
      addToast(`${toDelete.name} removed`, "success");
    }
    setBuildingToDelete(null);
  };

  const deleteFurniture = (e: MouseEvent, furnId: string) => {
    if (!eraserMode()) return;
    e.stopPropagation();
    
    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    const farmIndex = locations.findIndex(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
    if (farmIndex === -1) return;
    
    const parts = furnId.split('-');
    if (parts.length >= 2) {
      const targetIndex = parseInt(parts[1], 10);
      deleteValue(`SaveGame.locations.GameLocation.${farmIndex}.furniture.Furniture.${targetIndex}`);
      addToast("Furniture removed", "success");
    }
  };

  const confirmClearDebris = () => {
    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    const farmIndex = locations.findIndex(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
    
    if (farmIndex === -1) {
      addToast("Farm location not found.", "error");
      return;
    }

    const farm = locations[farmIndex];
    let itemsRemoved = 0;

    if (farm.objects && farm.objects.item) {
      const items = toArray(farm.objects.item);
      const filteredItems = items.filter((item: any) => {
        const obj = item?.value?.Object;
        const name = obj ? (getText(obj.name) || getText(obj.Name)) : '';
        const lowerName = name.toLowerCase();
        const isDebris = lowerName.includes('stone') || lowerName.includes('weed') || lowerName.includes('twig') || lowerName.includes('wood');
        return !isDebris;
      });

      itemsRemoved += items.length - filteredItems.length;
      updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item`, filteredItems);
    }

    if (farm.terrainFeatures && farm.terrainFeatures.item) {
      const terrains = toArray(farm.terrainFeatures.item);
      const filteredTerrains = terrains.filter((item: any) => {
        const feature = item?.value?.TerrainFeature;
        const type = feature ? (getText(feature['@xsi:type']) || getText(feature['@_xsi:type']) || getText(feature['xsi:type'])) : '';
        const isDebrisTerrain = type === 'Tree' || type === 'Grass';
        return !isDebrisTerrain;
      });

      itemsRemoved += terrains.length - filteredTerrains.length;
      updateValue(`SaveGame.locations.GameLocation.${farmIndex}.terrainFeatures.item`, filteredTerrains);
    }

    addToast(`Successfully cleared ${itemsRemoved} debris and wild terrain items!`, "success");
    setClearDebrisModalOpen(false);
  };

  const currentSeason = createMemo(() => {
    return store.saveData?.parsed_variables?.SaveGame?.currentSeason?.toLowerCase() || 'spring';
  });

  const farmData = createMemo(() => {
    const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
    return locations.find(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
  });

  const buildings = createMemo(() => {
    const farm = farmData();
    if (!farm || !farm.buildings) return [];
    
    return toArray(farm.buildings.Building).map((b: any, index: number) => {
      const type = getText(b.buildingType) || b['@xsi:type'] || b['@_xsi:type'] || 'Unknown Building';
      const tileX = parseInt(getText(b.tileX) || '0', 10);
      const tileY = parseInt(getText(b.tileY) || '0', 10);
      const tilesWide = parseInt(getText(b.tilesWide) || '1', 10);
      const tilesHigh = parseInt(getText(b.tilesHigh) || '1', 10);
      const name = getText(b.id) || getText(b.nameOfIndoorsWithoutUnique) || type;

      return {
        id: `building-${index}`,
        type,
        name,
        tileX,
        tileY,
        tilesWide,
        tilesHigh
      };
    }).sort((a, b) => (a.tileY + a.tilesHigh) - (b.tileY + b.tilesHigh));
  });

const farmObjects = createMemo(() => {
    const farm = farmData();
    if (!farm || !farm.objects || !farm.objects.item) return [];

    const parsedObjects: any[] = [];

    const digMatryoshkaDepth = (parentObj: any, tileX: number, tileY: number, depth = 1) => {
      if (!parentObj || !parentObj.heldObject || depth > 4) return;

      const heldItems = toArray(parentObj.heldObject);
      
      heldItems.forEach(child => {
        const childName = getText(child.name) || getText(child.Name);
        if (!childName) return;

        const childType = getText(child['@xsi:type']) || getText(child['@_xsi:type']) || getText(child.type) || 'Object';
        const childIdx = getText(child.parentSheetIndex) || getText(child.ParentSheetIndex) || '0';

        // Hanya render objek yang dipegang jika itu adalah obor (Torch) yang diletakkan di atas pagar/sprinkler.
        // Jika tidak difilter, hasil panen mesin (seperti Baterai di Solar Panel atau Mayones di Mesin) akan ikut tergambar.
        if (!childName.toLowerCase().includes('torch')) return;

        parsedObjects.push({
          id: `obj-held-${tileX}-${tileY}-${depth}`,
          name: childName,
          type: childType === 'Object' || childType === 'Crafting' ? (childName.includes('Torch') ? 'Crafting' : 'Object') : childType,
          itemId: childIdx,
          tileX,
          tileY,
          isHeld: true,
          heldDepth: depth
        });

        digMatryoshkaDepth(child, tileX, tileY, depth + 1);
      });
    };

    toArray(farm.objects.item).forEach((item: any) => {
      const tileX = parseInt(getText(item?.key?.Vector2?.X) || '0', 10);
      const tileY = parseInt(getText(item?.key?.Vector2?.Y) || '0', 10);
      const obj = item?.value?.Object;
      
      let type = obj ? (getText(obj['@xsi:type']) || getText(obj['@_xsi:type']) || getText(obj.type)) : 'Object';
      let name = obj ? (getText(obj.name) || getText(obj.Name)) : '';
      const parentSheetIndex = obj ? (getText(obj.parentSheetIndex) || getText(obj.ParentSheetIndex)) : '';

      const isBigCraftable = obj ? (getText(obj.bigCraftable) === 'true' || getText(obj.BigCraftable) === 'true') : false;
      if (isBigCraftable && (!type || type === 'Object' || type === 'Crafting')) {
        type = 'BigCraftable';
      }

      if (!name) {
        if (type === 'Fence') {
          const whichType = getText(obj.whichType);
          if (whichType === '1') name = 'Wood Fence';
          else if (whichType === '2') name = 'Stone Fence';
          else if (whichType === '3') name = 'Iron Fence';
          else if (whichType === '5') name = 'Hardwood Fence';
          else name = 'Gate';
        } else if (parentSheetIndex === '590') {
          name = 'Artifact Spot';
        } else {
          name = `Unknown (${parentSheetIndex})`;
        }
      }

      const isReadyForHarvest = getText(obj?.readyForHarvest) === 'true' || getText(obj?.ReadyForHarvest) === 'true';

      parsedObjects.push({
        id: `obj-${tileX}-${tileY}`,
        name: name || 'Object',
        type: type || 'Object',
        itemId: parentSheetIndex,
        tileX,
        tileY,
        isHeld: false,
        heldDepth: 0
      });

      if (!isReadyForHarvest && obj) {
        digMatryoshkaDepth(obj, tileX, tileY, 1);
      }
    });

    return parsedObjects.sort((a, b) => {
      if (a.tileY !== b.tileY) return (a.tileY + 1) - (b.tileY + 1);
      return a.heldDepth - b.heldDepth;
    });
  });

const farmFurniture = createMemo(() => {
    const farm = farmData();
    if (!farm || !farm.furniture || !farm.furniture.Furniture) return [];
    
    return toArray(farm.furniture.Furniture).map((furn: any, index: number) => {
      const name = getText(furn.name) || getText(furn.Name) || 'Furniture';
      const parentSheetIndex = getText(furn.id) || getText(furn.itemId) || getText(furn.parentSheetIndex);

      let tileX = 0, tileY = 0;
      let tilesWide = 1, tilesHigh = 1;

      if (furn.tileLocation) {
        tileX = parseInt(getText(furn.tileLocation.X) || '0', 10);
        tileY = parseInt(getText(furn.tileLocation.Y) || '0', 10);
      }

      if (furn.boundingBox) {
        const width = parseInt(getText(furn.boundingBox.Width) || '64', 10);
        const height = parseInt(getText(furn.boundingBox.Height) || '64', 10);
        tilesWide = Math.max(1, Math.round(width / 64));
        tilesHigh = Math.max(1, Math.round(height / 64));
      }

      return {
        id: `furn-${index}-${tileX}-${tileY}`,
        name,
        type: 'Furniture',
        itemId: parentSheetIndex,
        tileX,
        tileY,
        tilesWide,
        tilesHigh
      };
    }).sort((a, b) => (a.tileY + a.tilesHigh) - (b.tileY + b.tilesHigh));
  });

const farmTerrainFeatures = createMemo(() => {
    const farm = farmData();
    if (!farm || !farm.terrainFeatures || !farm.terrainFeatures.item) return [];

    const getFloorName = (id: string) => {
      const floors: Record<string, string> = {
        '0': 'Wood Floor', '1': 'Stone Floor', '2': 'Weathered Floor', '3': 'Crystal Floor',
        '4': 'Straw Floor', '5': 'Gravel Path', '6': 'Wood Path', '7': 'Crystal Path',
        '8': 'Cobblestone Path', '9': 'Stepping Stone Path', '10': 'Brick Floor',
        '11': 'Plank Floor', '12': 'Rustic Plank Floor'
      };
      return floors[id] || `Path/Floor (${id})`;
    };

    const getTreeName = (id: string) => {
      const trees: Record<string, string> = {
        '1': 'Oak Tree', '2': 'Maple Tree', '3': 'Pine Tree', '6': 'Palm Tree',
        '7': 'Mushroom Tree', '8': 'Mahogany Tree', '9': 'Ginger Island Palm',
        '10': 'Green Rain Tree (Type 1)', '11': 'Green Rain Tree (Type 2)', 
        '12': 'Green Rain Tree (Type 3)', '13': 'Mystic Tree'
      };
      return trees[id] || `Wild Tree (${id})`;
    };
    
    return toArray(farm.terrainFeatures.item).map((item: any) => {
      const tileX = parseInt(getText(item?.key?.Vector2?.X) || '0', 10);
      const tileY = parseInt(getText(item?.key?.Vector2?.Y) || '0', 10);
      const feature = item?.value?.TerrainFeature;
      const type = feature ? (getText(feature['@xsi:type']) || getText(feature['@_xsi:type']) || 'TerrainFeature') : 'TerrainFeature';

      let name = type;
      let treeType = '1';
      let whichFloor = '0';
      let isStump = false;
      let isGreenRainTree = false;

      if (type === 'HoeDirt') {
        const hasCrop = feature?.crop && Object.keys(feature.crop).length > 0;
        name = hasCrop ? 'Crop (Tilled Dirt)' : 'Tilled Dirt';
      } else if (type === 'Flooring') {
        whichFloor = getText(feature?.whichFloor);
        name = getFloorName(whichFloor);
      } else if (type === 'Tree') {
        treeType = getText(feature?.treeType) || getText(feature?.TreeType) || '1'; 
        isStump = (getText(feature?.stump) || getText(feature?.Stump)) === 'true';
        isGreenRainTree = (getText(feature?.isGreenRainTree) || getText(feature?.IsGreenRainTree)) === 'true';
        
        name = `${getTreeName(treeType)}${isGreenRainTree ? ' (Green Rain)' : ''}${isStump ? ' (Stump)' : ''}`;
      } else if (type === 'FruitTree') {
        name = 'Fruit Tree';
      }

      return {
        id: `terrain-${tileX}-${tileY}`,
        name, type,
        itemCategory: 'TerrainFeature', spawnCategory: 'TerrainFeature',
        tileX, tileY,
        rawKeyX: getText(item?.key?.Vector2?.X), rawKeyY: getText(item?.key?.Vector2?.Y),
        treeType, whichFloor, isStump, isGreenRainTree
      };
    });
});

  const mapInfo = createMemo(() => {
    const saveGame = store.saveData?.parsed_variables?.SaveGame;
    if (!saveGame) return { name: "Standard Farm", file: "StandardFarmDistances.png", width: 80, height: 65 };

    let farmTypeStr = saveGame.whichFarm;
    if (typeof farmTypeStr === 'object' && farmTypeStr !== null) {
      farmTypeStr = farmTypeStr['#text'] || farmTypeStr._text || Object.values(farmTypeStr)[0];
    }
    
    if (typeof farmTypeStr === 'string' && (farmTypeStr.includes("Meadowlands") || farmTypeStr.includes("Ranching"))) {
      return { name: "Meadowlands Farm", file: "Farm_RanchingDistances.png", width: 100, height: 75 };
    }

    const whichFarm = parseInt(farmTypeStr || "0", 10);
    
    switch (whichFarm) {
      case 0: return { name: "Standard Farm", file: "StandardFarmDistances.png", width: 80, height: 65 };
      case 1: return { name: "Riverland Farm", file: "RiverlandFarmDistances.png", width: 80, height: 65 };
      case 2: return { name: "Forest Farm", file: "ForestFarmDistances.png", width: 80, height: 65 };
      case 3: return { name: "Hill-top Farm", file: "Hill-topFarmDistances.png", width: 80, height: 65 };
      case 4: return { name: "Wilderness Farm", file: "WildernessFarmDistances.png", width: 80, height: 65 };
      case 5: return { name: "Four Corners Farm", file: "4CornersFarmDistances.png", width: 80, height: 80 };
      case 6: return { name: "Beach Farm", file: "BeachFarmDistances.png", width: 110, height: 110 };
      case 7: return { name: "Meadowlands Farm", file: "Farm_RanchingDistances.png", width: 100, height: 75 };
      default: return { name: "Standard Farm", file: "StandardFarmDistances.png", width: 80, height: 65 };
    }
  });

  const bounds = createMemo(() => {
    return { width: mapInfo().width, height: mapInfo().height };
  });

  const TILE_SIZE = 16; 

  createEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {

        if (buildingToPlace()) {
          setBuildingToPlace(null);
          setDragPos(null);
          setMousePixelPos(null);
        }

        if (draggedBuilding()) {
          setDraggedBuilding(null);
          setDragPos(null);
          setMousePixelPos(null);
          setDragOffset(null);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPainting(false);
      if (isDraggingFromStash()) {
        setIsDraggingFromStash(false);
        if (buildingToPlace() && dragPos()) {
          handlePlaceItem(dragPos()!.x, dragPos()!.y);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    onCleanup(() => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    });
  });

  const handleDragStart = (e: MouseEvent, b: any, itemCategory: 'Building' | 'Object' | 'Furniture' | 'TerrainFeature' = 'Building') => {
    if (!moveMode()) return;
    e.stopPropagation();
    e.preventDefault();

    if (itemCategory === 'Building' && isBuildingLocked(b)) {
      addToast("Locked! Sorry, this building cannot be moved.", "error");
      return;
    }

setDraggedBuilding({ 
      ...b, 
      itemCategory, 
      tilesWide: b.tilesWide || b.tilesX || 1, 
      tilesHigh: b.tilesHigh || b.tilesY || 1 
    });
    setDragPos({ x: b.tileX, y: b.tileY });

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    const container = document.getElementById('farm-map-container');
    if (container) {
      const contRect = container.getBoundingClientRect();
      setMousePixelPos({ x: e.clientX - contRect.left, y: e.clientY - contRect.top });
    }

    const onGlobalMouseMove = (moveEvent: MouseEvent) => {
      const cont = document.getElementById('farm-map-container');
      if (!cont) return;
      const contRect = cont.getBoundingClientRect();
      
      let rawX = moveEvent.clientX - contRect.left;
      let rawY = moveEvent.clientY - contRect.top;

      setMousePixelPos({ x: rawX, y: rawY });

      let clampX = Math.max(0, Math.min(rawX, contRect.width - 1));
      let clampY = Math.max(0, Math.min(rawY, contRect.height - 1));

      const x = Math.floor(clampX / TILE_SIZE);
      const y = Math.floor(clampY / TILE_SIZE);
      
      const currentPos = dragPos();
      if (!currentPos || currentPos.x !== x || currentPos.y !== y) {
        setDragPos({x, y});
      }
    };

const onGlobalMouseUp = () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);

      const bDrop = draggedBuilding();
      const posDrop = dragPos();

      if (bDrop && posDrop) {
        if (bDrop.tileX !== posDrop.x || bDrop.tileY !== posDrop.y) {
          if (isDropValid(posDrop.x, posDrop.y, bDrop)) {
            const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
            const farmIndex = locations.findIndex(loc => loc['@xsi:type'] === 'Farm' || loc['@_xsi:type'] === 'Farm');
            
            if (farmIndex !== -1) {
              const farm = locations[farmIndex];

              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bDrop.name);
              const safeName = (isUUID || !bDrop.name) ? (bDrop.type || "Item") : bDrop.name;

              if (bDrop.itemCategory === 'Building') {
                const items = toArray(farm.buildings?.Building);
                const originalIndex = items.findIndex((item: any) => parseInt(getText(item?.tileX) || '0', 10) === bDrop.tileX && parseInt(getText(item?.tileY) || '0', 10) === bDrop.tileY && (getText(item?.buildingType) || item['@xsi:type'] || item['@_xsi:type'] || '') === bDrop.type);
                
                if (originalIndex !== -1) {
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.buildings.Building.${originalIndex}.tileX`, posDrop.x.toString());
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.buildings.Building.${originalIndex}.tileY`, posDrop.y.toString());
                  addToast(`Moved ${safeName} to [${posDrop.x}, ${posDrop.y}]`, "success");
                }
              } 
              else if (bDrop.itemCategory === 'Object') {
                const items = toArray(farm.objects?.item);
                const originalIndex = items.findIndex((item: any) => parseInt(getText(item?.key?.Vector2?.X) || '0', 10) === bDrop.tileX && parseInt(getText(item?.key?.Vector2?.Y) || '0', 10) === bDrop.tileY);
                
                if (originalIndex !== -1) {
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${originalIndex}.key.Vector2.X`, posDrop.x.toString());
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${originalIndex}.key.Vector2.Y`, posDrop.y.toString());
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${originalIndex}.value.Object.tileLocation.X`, posDrop.x.toString());
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${originalIndex}.value.Object.tileLocation.Y`, posDrop.y.toString());
                  
                  if (items[originalIndex].value?.Object?.boundingBox) {
                    updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${originalIndex}.value.Object.boundingBox.X`, (posDrop.x * 64).toString());
                    updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item.${originalIndex}.value.Object.boundingBox.Y`, (posDrop.y * 64).toString());
                  }
                  addToast(`Moved ${safeName} to [${posDrop.x}, ${posDrop.y}]`, "success");
                }
              }
              else if (bDrop.itemCategory === 'Furniture') {
                const items = toArray(farm.furniture?.Furniture);
                const originalIndex = items.findIndex((item: any) => parseInt(getText(item?.tileLocation?.X) || '0', 10) === bDrop.tileX && parseInt(getText(item?.tileLocation?.Y) || '0', 10) === bDrop.tileY);
                
                if (originalIndex !== -1) {
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.furniture.Furniture.${originalIndex}.tileLocation.X`, posDrop.x.toString());
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.furniture.Furniture.${originalIndex}.tileLocation.Y`, posDrop.y.toString());
                  
                  if (items[originalIndex].boundingBox) {
                    updateValue(`SaveGame.locations.GameLocation.${farmIndex}.furniture.Furniture.${originalIndex}.boundingBox.X`, (posDrop.x * 64).toString());
                    updateValue(`SaveGame.locations.GameLocation.${farmIndex}.furniture.Furniture.${originalIndex}.boundingBox.Y`, (posDrop.y * 64).toString());
                  }
                  addToast(`Moved ${safeName} to [${posDrop.x}, ${posDrop.y}]`, "success");
                }
              }
              else if (bDrop.itemCategory === 'TerrainFeature') {
                const items = toArray(farm.terrainFeatures?.item);
                const originalIndex = items.findIndex((item: any) => parseInt(getText(item?.key?.Vector2?.X) || '0', 10) === bDrop.tileX && parseInt(getText(item?.key?.Vector2?.Y) || '0', 10) === bDrop.tileY);
                
                if (originalIndex !== -1) {
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.terrainFeatures.item.${originalIndex}.key.Vector2.X`, posDrop.x.toString());
                  updateValue(`SaveGame.locations.GameLocation.${farmIndex}.terrainFeatures.item.${originalIndex}.key.Vector2.Y`, posDrop.y.toString());
                  addToast(`Moved ${safeName} to [${posDrop.x}, ${posDrop.y}]`, "success");
                }
              }
            }
          } else {
            addToast("Cannot move there! Location is blocked.", "error");
          }
        }
      }

      setDraggedBuilding(null);
      setDragPos(null);
      setMousePixelPos(null);
      setDragOffset(null);
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
  };

  function handlePlaceItem(targetX: number, targetY: number) {
    if (!buildingToPlace()) return;
    const bData = buildingToPlace()!;
    const dummyCheck = {
      id: "temp", tileX: targetX, tileY: targetY,
      tilesWide: bData.footprint.X, tilesHigh: bData.footprint.Y
    };
    if (isDropValid(targetX, targetY, dummyCheck)) {
      const locations = toArray(store.saveData?.parsed_variables?.SaveGame?.locations?.GameLocation);
      const farmIndex = locations.findIndex((l: any) => l.name === "Farm" || l.name?.["#text"] === "Farm");
      if (farmIndex !== -1) {
        if (bData.isFromStash) {
          const base = `SaveGame.locations.GameLocation.${farmIndex}`;
          const farm = locations[farmIndex];
          
          if (bData.itemCategory === 'Building') {
              const items = toArray(farm.buildings?.Building);
              const idx = items.findIndex((item:any) => parseInt(getText(item?.tileX)||'0',10) === bData.tileX && parseInt(getText(item?.tileY)||'0',10) === bData.tileY && (getText(item?.buildingType)||item['@xsi:type']||item['@_xsi:type']||'') === bData.type);
              if (idx !== -1) {
                  updateValue(`${base}.buildings.Building.${idx}.tileX`, targetX.toString());
                  updateValue(`${base}.buildings.Building.${idx}.tileY`, targetY.toString());
              }
          } else if (bData.itemCategory === 'Object') {
              const items = toArray(farm.objects?.item);
              const idx = items.findIndex((item:any) => parseInt(getText(item?.key?.Vector2?.X)||'0',10) === bData.tileX && parseInt(getText(item?.key?.Vector2?.Y)||'0',10) === bData.tileY);
              if (idx !== -1) {
                  updateValue(`${base}.objects.item.${idx}.key.Vector2.X`, targetX.toString());
                  updateValue(`${base}.objects.item.${idx}.key.Vector2.Y`, targetY.toString());
                  updateValue(`${base}.objects.item.${idx}.value.Object.tileLocation.X`, targetX.toString());
                  updateValue(`${base}.objects.item.${idx}.value.Object.tileLocation.Y`, targetY.toString());
                  if (items[idx].value?.Object?.boundingBox) {
                      updateValue(`${base}.objects.item.${idx}.value.Object.boundingBox.X`, (targetX*64).toString());
                      updateValue(`${base}.objects.item.${idx}.value.Object.boundingBox.Y`, (targetY*64).toString());
                  }
              }
          } else if (bData.itemCategory === 'Furniture') {
              const items = toArray(farm.furniture?.Furniture);
              const idx = items.findIndex((item:any) => parseInt(getText(item?.tileLocation?.X)||'0',10) === bData.tileX && parseInt(getText(item?.tileLocation?.Y)||'0',10) === bData.tileY);
              if (idx !== -1) {
                  updateValue(`${base}.furniture.Furniture.${idx}.tileLocation.X`, targetX.toString());
                  updateValue(`${base}.furniture.Furniture.${idx}.tileLocation.Y`, targetY.toString());
                  if (items[idx].boundingBox) {
                      updateValue(`${base}.furniture.Furniture.${idx}.boundingBox.X`, (targetX*64).toString());
                      updateValue(`${base}.furniture.Furniture.${idx}.boundingBox.Y`, (targetY*64).toString());
                  }
              }
          } else if (bData.itemCategory === 'TerrainFeature') {
              const items = toArray(farm.terrainFeatures?.item);
              const idx = items.findIndex((item:any) => getText(item?.key?.Vector2?.X) === bData.rawKeyX && getText(item?.key?.Vector2?.Y) === bData.rawKeyY);
              if (idx !== -1) {
                  updateValue(`${base}.terrainFeatures.item.${idx}.key.Vector2.X`, targetX.toString());
                  updateValue(`${base}.terrainFeatures.item.${idx}.key.Vector2.Y`, targetY.toString());
                  if (items[idx].value?.TerrainFeature?.tileLocation) {
                      updateValue(`${base}.terrainFeatures.item.${idx}.value.TerrainFeature.tileLocation.X`, targetX.toString());
                      updateValue(`${base}.terrainFeatures.item.${idx}.value.TerrainFeature.tileLocation.Y`, targetY.toString());
                  }
              }
          }

          setStashedItems(prev => prev.filter(i => i.id !== bData.id));
          addToast(`Placed ${bData.name}!`, "success");
          
          const remaining = stashedItems().filter(i => {
             let key = i.itemCategory === 'Building' ? `Building_${i.type}` : i.itemCategory === 'TerrainFeature' ? `Terrain_${i.name}` : `${i.itemCategory}_${i.name}_${i.itemId || ''}`;
             return key === bData.groupKey && i.id !== bData.id;
          });
          
          if (remaining.length > 0) {
              const nextItem = remaining[0];
              setBuildingToPlace({
                  ...bData,
                  ...nextItem,
                  id: nextItem.id,
                  tileX: nextItem.tileX,
                  tileY: nextItem.tileY,
                  rawKeyX: nextItem.rawKeyX,
                  rawKeyY: nextItem.rawKeyY
              });
          } else {
              setBuildingToPlace(null);
              setIsPainting(false);
          }
          return;
        }

        if (bData.spawnCategory === 'Building') {
          const xmlToInject = generateBuildingXml(bData, targetX, targetY);
          const currentBuildings = toArray(locations[farmIndex].buildings?.Building) || [];
          updateValue(`SaveGame.locations.GameLocation.${farmIndex}.buildings.Building`, [...currentBuildings, xmlToInject]);
        } else if (bData.spawnCategory === 'Object') {
          const xmlToInject = generateObjectXml(bData, targetX, targetY);
          const currentObjects = toArray(locations[farmIndex].objects?.item) || [];
          updateValue(`SaveGame.locations.GameLocation.${farmIndex}.objects.item`, [...currentObjects, xmlToInject]);
        } else if (bData.spawnCategory === 'Furniture') {
          const xmlToInject = generateFurnitureXml(bData, targetX, targetY);
          const currentFurniture = toArray(locations[farmIndex].furniture?.Furniture) || [];
          updateValue(`SaveGame.locations.GameLocation.${farmIndex}.furniture.Furniture`, [...currentFurniture, xmlToInject]);
        } else if (bData.spawnCategory === 'TerrainFeature') {
          const xmlToInject = generateTerrainFeatureXml(bData, targetX, targetY);
          if (xmlToInject) {
            const currentTerrain = toArray(locations[farmIndex].terrainFeatures?.item) || [];
            updateValue(`SaveGame.locations.GameLocation.${farmIndex}.terrainFeatures.item`, [...currentTerrain, xmlToInject]);
          }
        }
        addToast(`${bData.name} placed successfully!`, "success");
      }
    } else {
      addToast("Invalid location or blocked by another object!", "error");
      setIsPainting(false);
    }
  };

  return (
    <div class="flex flex-col h-full bg-[#0a0a0a] text-white">
      <div class="p-16 border-b border-white/10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-16">
        <div class="flex flex-col xl:flex-row items-start xl:items-center justify-between flex-1 w-full gap-16">
          <div class="shrink-0">
            <div class="flex items-center gap-12">
              <h2 class="text-xl font-serif text-amber-200">Farm Layout Visualizer</h2>
              <span class="px-8 py-2 bg-white/10 text-white font-serif font-bold text-[10px] rounded border border-white/20 tracking-wider whitespace-nowrap">
                {mapInfo().name.toUpperCase()} - {currentSeason().toUpperCase()}
              </span>
            </div>
            <p class="text-[12px] text-gray-400 font-brains mt-4">
              Detected {buildings().length} buildings, {farmObjects().length} objects, and {farmTerrainFeatures().length} terrain features.
            </p>
          </div>
          
          <div class="flex flex-wrap items-center gap-8 justify-start xl:justify-end">
            <button
              onClick={() => { setBuildingModalOpen(true); setMoveMode(false); setEraserMode(false); setSwapMode(false); setStashMode(false); }}
              class={`px-12 py-6 flex items-center gap-2 border rounded-6 font-brains font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                buildingToPlace() 
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' 
                  : 'bg-black/40 border-white/20 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              <Hammer size={16} />
              {buildingToPlace() ? `Build: ${buildingToPlace().name}` : 'Build'}
            </button>
            <button
              onClick={() => { setMoveMode(!moveMode()); setEraserMode(false); setBuildingToPlace(null); setSwapMode(false); setFirstSwapItem(null); setStashMode(false); }}
              class={`px-12 py-6 flex items-center gap-2 border rounded-6 font-brains font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                moveMode() 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' 
                  : 'bg-black/40 border-white/20 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              <AlertTriangle size={16} />
              {moveMode() ? 'Move: ON' : 'Move: OFF'}
            </button>
            <button
              onClick={() => { 
                setSwapMode(!swapMode()); 
                setMoveMode(false); setEraserMode(false); setBuildingToPlace(null);
                setStashMode(false);
                setFirstSwapItem(null);
              }}
              class={`px-12 py-6 flex items-center gap-2 border rounded-6 font-brains font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                swapMode() 
                  ? 'bg-amber-600 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
                  : 'bg-black/40 border-white/20 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              <ArrowLeftRight size={16} />
              {swapMode() ? (firstSwapItem() ? 'Select Target 2...' : 'Swap: ON') : 'Swap: OFF'}
            </button>
            <button
              onClick={() => { 
                setStashMode(!stashMode()); 
                setMoveMode(false); setEraserMode(false); setSwapMode(false); setFirstSwapItem(null); setBuildingToPlace(null);
              }}
              class={`px-12 py-6 flex items-center gap-2 border rounded-6 font-brains font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                stashMode() 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.5)]' 
                  : 'bg-black/40 border-white/20 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              <Package size={16} />
              {stashMode() ? 'Village Edit: ON' : 'Village Edit: OFF'}
            </button>
            <button
              onClick={() => { setEraserMode(!eraserMode()); setMoveMode(false); setBuildingToPlace(null); setSwapMode(false); setFirstSwapItem(null); setStashMode(false); }}
              class={`px-12 py-6 flex items-center gap-2 border rounded-6 font-brains font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                eraserMode() 
                  ? 'bg-red-600 text-white border-red-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]' 
                  : 'bg-black/40 border-white/20 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              <Trash2 size={16} />
              {eraserMode() ? 'Eraser: ON' : 'Eraser: OFF'}
            </button>
            <button
              onClick={() => setClearDebrisModalOpen(true)}
              class="px-12 py-6 flex items-center gap-2 bg-red-900/40 text-red-200 border border-red-900/50 rounded-6 font-serif font-bold cursor-pointer hover:bg-red-800/60 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 size={16} />
              Clear All Debris
            </button>
            <button
              onClick={() => setUseSpriteView(!useSpriteView())}
              class={`px-12 py-6 cursor-pointer font-desc rounded-6 font-bold text-sm transition-colors border-2 whitespace-nowrap shrink-0 ${
                useSpriteView() 
                  ? 'bg-[#c0733a] border-[#8c4614] text-white shadow-inner' 
                  : 'bg-black/40 border-white/20 text-gray-400 hover:text-white hover:bg-black/60'
              }`}
            >
              {useSpriteView() ? '★ Sprite View' : '■ Simple View'}
            </button>
          </div>
        </div>
      </div>
      
      <div class={`flex-1 overflow-auto p-16 bg-[#111] transition-all duration-300 ${stashMode() ? 'pb-[200px]' : ''}`}>
        <Show 
          when={buildings().length > 0 || farmObjects().length > 0 || farmTerrainFeatures().length > 0} 
          fallback={
            <div class="h-full flex items-center justify-center text-gray-500 font-serif">
              No structures found on the farm.
            </div>
          }
        >
          <div 
            id="farm-map-container"
            class={`relative select-none border-2 border-white/5 bg-[#1a1a1a] rounded-8 overflow-hidden shadow-2xl ${eraserMode() ? 'cursor-crosshair' : buildingToPlace() ? 'cursor-cell' : ''}`}
            style={{
              width: `${bounds().width * TILE_SIZE}px`,
              height: `${bounds().height * TILE_SIZE}px`,
              "background-image": `
                linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), 
                linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
                linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)),
                url('/stardew/maps/${mapInfo().file}')
              `,
              "background-size": `${TILE_SIZE}px ${TILE_SIZE}px, ${TILE_SIZE}px ${TILE_SIZE}px, 100% 100%, 100% 100%`,
              "background-position": "0 0",
              "background-repeat": "repeat, repeat, no-repeat, no-repeat",
              "image-rendering": "pixelated"
            }}
            onMouseMove={(e) => {
              if (!buildingToPlace()) return;
              const rect = e.currentTarget.getBoundingClientRect();
              let rawX = e.clientX - rect.left;
              let rawY = e.clientY - rect.top;
              setMousePixelPos({ x: rawX, y: rawY });
              let clampX = Math.max(0, Math.min(rawX, rect.width - 1));
              let clampY = Math.max(0, Math.min(rawY, rect.height - 1));
              const x = Math.floor(clampX / TILE_SIZE);
              const y = Math.floor(clampY / TILE_SIZE);
              const currentPos = dragPos();
              if (!currentPos || currentPos.x !== x || currentPos.y !== y) {
                setDragPos({ x, y });
                if (isPainting()) {
                   handlePlaceItem(x, y);
                }
              }
            }}
            onMouseLeave={() => {
              if (buildingToPlace()) {
                setDragPos(null);
                setMousePixelPos(null);
              }
              setIsPainting(false);
            }}
            onContextMenu={(e) => {
              if (buildingToPlace() || draggedBuilding()) {
                e.preventDefault();
                e.stopPropagation();
                setBuildingToPlace(null);
                setDraggedBuilding(null);
                setDragPos(null);
                setMousePixelPos(null);
                setDragOffset(null);
                setIsPainting(false);
              }
            }}
            onMouseDown={(e) => {
              if (e.button === 0 && buildingToPlace() && dragPos()) {
                 e.stopPropagation();
                 setIsPainting(true);
                 handlePlaceItem(dragPos()!.x, dragPos()!.y);
              }
            }}
          >

            {/* Build Mode Preview */}
            <Show when={buildingToPlace() && dragPos()}>
              {(_) => {
                const bData = buildingToPlace()!;
                const pos = () => dragPos() || { x: 0, y: 0 };
                const mousePx = () => mousePixelPos() || { x: 0, y: 0 };
                const tw = bData.footprint.X;
                const th = bData.footprint.Y;
                const dummyCheck = () => ({ id: "temp", tileX: pos().x, tileY: pos().y, tilesWide: tw, tilesHigh: th });
                const valid = () => isDropValid(pos().x, pos().y, dummyCheck());

                const drawW = tw * TILE_SIZE;
                const drawH = th * TILE_SIZE;
                const texH = bData.textureSize?.Y || drawH;

                return (
                  <>
                    {/* Grid Validation Overlay */}
                    <div 
                      class="absolute pointer-events-none z-[9998]"
                      style={{
                        left: `${pos().x * TILE_SIZE}px`,
                        bottom: `${(bounds().height - (pos().y + th)) * TILE_SIZE}px`,
                        width: `${drawW}px`,
                        height: `${drawH}px`,
                        "background-color": valid() ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.3)',
                        "border": `2px solid ${valid() ? '#2ecc71' : '#e74c3c'}`
                      }}
                    >
                      <div class="absolute inset-0" style={{
                        "background-image": `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
                        "background-size": `${TILE_SIZE}px ${TILE_SIZE}px`,
                      }} />
{/* Ghost sprite in grid */}
<div class="absolute bottom-0 left-0 opacity-40 mix-blend-luminosity grayscale flex items-end justify-start">
{(() => {
  if (bData.itemCategory === 'TerrainFeature') {
    if (bData.type === 'Tree') return <div class="relative w-full h-full"><TreeSprite treeType={bData.treeType} season={currentSeason()} isStump={bData.isStump} isGreenRainTree={bData.isGreenRainTree} /></div>;
    if (bData.type === 'Flooring') {
      const fId = parseInt(bData.whichFloor || '0', 10);
      const cropX = (fId % 4) * 64 + 32;
      const cropY = Math.floor(fId / 4) * 64 + 16;
      const floorFile = currentSeason() === 'winter' ? 'Flooring_winter.png' : 'Flooring.png';
      return <div class="w-full h-full" style={{ "background-image": `url('/stardew/terrainFeatures/${floorFile}')`, "background-size": `${256 * (TILE_SIZE/16)}px auto`, "background-position": `-${cropX * (TILE_SIZE/16)}px -${cropY * (TILE_SIZE/16)}px`, "image-rendering": "pixelated" }} />;
    }
    if (bData.type === 'HoeDirt') return <div class="w-full h-full bg-[#5d4037] border border-[#3e2723]" style={{ "background-image": `url('/stardew/terrainFeatures/${currentSeason() === 'winter' ? 'hoeDirtSnow' : 'hoeDirt'}.png')`, "background-size": "100%", "image-rendering": "pixelated" }} />;
    return <div class="w-full h-full bg-[#d7ccc8] border border-gray-500 flex items-center justify-center text-[10px]">🧱</div>;
  }

  if (bData.itemCategory === 'Building' && bData.texture) {
    const hasSrcRect = bData.sourceRect && bData.sourceRect.Width > 0 && bData.sourceRect.Height > 0;

    if (hasSrcRect) {
      return (
        <div class="absolute" style={{
          "bottom": "0px", "left": "0px",
          "width": `${bData.sourceRect.Width}px`, "height": `${bData.sourceRect.Height}px`,
          "background-image": `url('${getSafeTextureUrl(bData.texture)}')`,
          "background-position": `-${bData.sourceRect.X}px -${bData.sourceRect.Y}px`,
          "background-repeat": "no-repeat", "image-rendering": "pixelated"
        }} />
      );
    } else {
      if (bData.type === "Junimo Hut") {
        return <div class="absolute" style={{ bottom: "0px", left: "0px", width: "48px", height: "64px", "background-image": `url('${getSafeTextureUrl(bData.texture)}')`, "background-position": `-0px -0px`, "image-rendering": "pixelated" }} />;
      }

      return (
        <div class="absolute" style={{ bottom: "0px", left: "0px" }}>
          {bData.type === "Fish Pond" && <div class="absolute z-[-1] bg-[#1e5e85]" style={{ top: "10px", left: "10px", right: "10px", bottom: "10px" }} />}
          <img src={getSafeTextureUrl(bData.texture)} class="max-w-none block" style={{ "image-rendering": "pixelated" }} />
        </div>
      );
    }
  }

  return <ItemSprite name={bData.name} itemId={bData.itemId} type={bData._type || bData.type} class="origin-bottom" scale={1} />;
})()}
</div>
                    </div>

{/* Cursor-following sprite */}
<div
  class="absolute opacity-90 drop-shadow-2xl pointer-events-none z-[9999] flex items-end justify-start"
  style={{
    top: "0px",
    left: "0px",
    width: `${drawW}px`,
    height: `${texH}px`,
    "transform": `translate3d(${mousePx().x - drawW / 2}px, ${mousePx().y - texH / 2}px, 0)`,
    "transform-origin": "top left"
  }}
>
{(() => {
  if (bData.itemCategory === 'TerrainFeature') {
    if (bData.type === 'Tree') return <div class="relative w-full h-full"><TreeSprite treeType={bData.treeType} season={currentSeason()} isStump={bData.isStump} isGreenRainTree={bData.isGreenRainTree} /></div>;
    if (bData.type === 'Flooring') {
      const fId = parseInt(bData.whichFloor || '0', 10);
      const cropX = (fId % 4) * 64 + 32;
      const cropY = Math.floor(fId / 4) * 64 + 16;
      const floorFile = currentSeason() === 'winter' ? 'Flooring_winter.png' : 'Flooring.png';
      return <div class="w-full h-full" style={{ "background-image": `url('/stardew/terrainFeatures/${floorFile}')`, "background-size": `${256 * (TILE_SIZE/16)}px auto`, "background-position": `-${cropX * (TILE_SIZE/16)}px -${cropY * (TILE_SIZE/16)}px`, "image-rendering": "pixelated" }} />;
    }
    if (bData.type === 'HoeDirt') return <div class="w-full h-full bg-[#5d4037] border border-[#3e2723]" style={{ "background-image": `url('/stardew/terrainFeatures/${currentSeason() === 'winter' ? 'hoeDirtSnow' : 'hoeDirt'}.png')`, "background-size": "100%", "image-rendering": "pixelated" }} />;
    return <div class="w-full h-full bg-[#d7ccc8] border border-gray-500 flex items-center justify-center text-[10px]">🧱</div>;
  }

  if (bData.itemCategory === 'Building' && bData.texture) {
    const hasSrcRect = bData.sourceRect && bData.sourceRect.Width > 0 && bData.sourceRect.Height > 0;

    if (hasSrcRect) {
      return (
        <div class="absolute" style={{
          "bottom": "0px", "left": "0px",
          "width": `${bData.sourceRect.Width}px`, "height": `${bData.sourceRect.Height}px`,
          "background-image": `url('${getSafeTextureUrl(bData.texture)}')`,
          "background-position": `-${bData.sourceRect.X}px -${bData.sourceRect.Y}px`,
          "background-repeat": "no-repeat", "image-rendering": "pixelated"
        }} />
      );
    } else {
      if (bData.type === "Junimo Hut") {
        return <div class="absolute" style={{ bottom: "0px", left: "0px", width: "48px", height: "64px", "background-image": `url('${getSafeTextureUrl(bData.texture)}')`, "background-position": `-0px -0px`, "image-rendering": "pixelated" }} />;
      }

      return (
        <div class="absolute" style={{ bottom: "0px", left: "0px" }}>
          {bData.type === "Fish Pond" && <div class="absolute z-[-1] bg-[#1e5e85]" style={{ top: "10px", left: "10px", right: "10px", bottom: "10px" }} />}
          <img src={getSafeTextureUrl(bData.texture)} class="max-w-none block" style={{ "image-rendering": "pixelated" }} />
        </div>
      );
    }
  }

  return <ItemSprite name={bData.name} itemId={bData.itemId} type={bData._type || bData.type} class="origin-bottom" scale={1} />;
})()}
</div>
                  </>
                );
              }}
            </Show>

          <Show when={draggedBuilding() && dragPos()}>
              {(_) => {
                const b = draggedBuilding()!;

                const pos = () => dragPos() || { x: b.tileX, y: b.tileY };
                const mousePx = () => mousePixelPos() || { x: 0, y: 0 };
                const offset = () => dragOffset() || { x: 0, y: 0 };
                const valid = () => isDropValid(pos().x, pos().y, b);

                const bData = useSpriteView() 
                  ? (buildingsDataRaw as any[]).find(d => d.name === b.type || d.displayName === b.type) 
                  : null;
                  
                const colorHue = String(b.type).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
                const hasSprite = useSpriteView() && bData && bData.texture;
                const srcRect = bData?.sourceRect || { X: 0, Y: 0, Width: 0, Height: 0 };

                let drawW = b.tilesWide * TILE_SIZE;
                let texH = b.tilesHigh * TILE_SIZE;

                if (hasSprite) {
                  if (srcRect.Width > 0 && srcRect.Height > 0) {
                    drawW = srcRect.Width;
                    texH = srcRect.Height;
                  } else {
                    texH = bData.textureSize?.Y || b.tilesHigh * TILE_SIZE;
                  }
                }

let bgPosX = 0;

const SpriteContent = () => {
  if (b.itemCategory === 'Object' || b.itemCategory === 'Furniture') {
    return (
<div class="absolute bottom-0 left-0 flex items-end justify-start">
        <ItemSprite name={b.name} itemId={b.itemId} type={b.type} class="origin-bottom" scale={1.2} />
      </div>
    );
  }

  return hasSprite ? (
    srcRect.Width > 0 && srcRect.Height > 0 ? (
      <div class="absolute" style={{
        bottom: "0px", left: "0px",
        width: `${srcRect.Width}px`, height: `${srcRect.Height}px`,
        "background-image": `url('${getSafeTextureUrl(bData.texture)}')`,
        "background-position": `-${srcRect.X}px -${srcRect.Y}px`,
        "image-rendering": "pixelated"
      }} />
    ) : (
      <div class="absolute" style={{ bottom: "0px", left: "0px" }}>
        {b.type === "Fish Pond" && (
          <div class="absolute z-[-1] bg-[#1e5e85]" style={{ top: "10px", left: "10px", right: "10px", bottom: "10px" }} />
        )}
        {b.type === "Junimo Hut" ? (
          <div style={{ width: "48px", height: "64px", "background-image": `url('${getSafeTextureUrl(bData.texture)}')`, "background-position": `-${bgPosX}px -0px`, "image-rendering": "pixelated" }} />
        ) : (
          <img src={getSafeTextureUrl(bData.texture)} class="max-w-none block" style={{ "image-rendering": "pixelated" }} />
        )}
      </div>
    )
  ) : (
    <div class="w-full h-full border border-white/20 flex items-center justify-center text-center overflow-hidden" style={{"background-color": `hsla(${colorHue}, 60%, 40%, 0.8)`}}>
      <span class="text-[9px] font-brains font-bold text-white drop-shadow-md px-2 truncate w-full">
        {b.type.replace('Building', '')}
      </span>
    </div>
  );
};

                return (
                  <>
                    <div 
                      class="absolute pointer-events-none z-[9998]"
                      style={{
                        left: `${pos().x * TILE_SIZE}px`,
                        bottom: `${(bounds().height - (pos().y + b.tilesHigh)) * TILE_SIZE}px`, 
                        width: `${b.tilesWide * TILE_SIZE}px`,
                        height: `${b.tilesHigh * TILE_SIZE}px`,
                        "background-color": valid() ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.3)',
                        "border": `2px solid ${valid() ? '#2ecc71' : '#e74c3c'}`
                      }}
                    >
                      <div class="absolute inset-0" style={{
                        "background-image": `
                          linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), 
                          linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
                        `,
                        "background-size": `${TILE_SIZE}px ${TILE_SIZE}px`,
                      }} />
                      
                      <div 
                        class="absolute bottom-0 left-0 opacity-40 mix-blend-luminosity grayscale" 
                        style={{ width: `${drawW}px`, height: `${texH}px` }}
                      >
                        <SpriteContent />
                      </div>
                    </div>

                    <div
                      class="absolute opacity-95 drop-shadow-2xl pointer-events-none z-[9999]"
                      style={{
                        top: "0px",
                        left: "0px",
                        width: `${drawW}px`,
                        height: `${texH}px`,
                        "transform": `translate3d(${mousePx().x - offset().x}px, ${mousePx().y - offset().y}px, 0)`,
                        "transform-origin": "top left"
                      }}
                    >
                      <SpriteContent />
                    </div>
                  </>
                );
              }}
            </Show>

            <For each={buildings().filter(b => !isStashed(b.id))}>
              {(b) => {
                const bData = (buildingsDataRaw as any[]).find(d => d.name === b.type || d.displayName === b.type);
                const colorHue = String(b.type).split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 360;
                
                return (
                  <Show 
                    when={useSpriteView() && bData && bData.texture}
                    fallback={
                      <div 
                        onClick={(e) => {
                          if (stashMode() && !isBuildingLocked(b)) {
                            e.stopPropagation();
                            setStashedItems([...stashedItems(), { ...b, itemCategory: 'Building', spawnCategory: 'Building' }]);
                          } else if (swapMode()) {
                            handleItemClickForSwap(e, b, 'Building');
                          } else if (eraserMode()) {
                            requestDeleteBuilding(e, b.id);
                          }
                        }}
                        onDragStart={(e) => e.preventDefault()}
                        onMouseDown={(e) => handleDragStart(e, b)}
                        class={`absolute border border-white/20 shadow-lg flex items-center justify-center text-center overflow-hidden transition-transform ${(moveMode() || swapMode()) ? (draggedBuilding()?.id === b.id ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing hover:border-indigo-500 hover:border-2 z-10') : eraserMode() ? 'cursor-crosshair hover:border-red-500 hover:border-2 hover:scale-105 z-10' : 'cursor-default hover:scale-105'}`}
                        style={{
                          left: `${b.tileX * TILE_SIZE}px`,
                          bottom: `${(bounds().height - (b.tileY + b.tilesHigh)) * TILE_SIZE}px`,
                          width: `${b.tilesWide * TILE_SIZE}px`,
                          height: `${b.tilesHigh * TILE_SIZE}px`,
                          "background-color": `hsla(${colorHue}, 60%, 40%, 0.6)`,
                          "z-index": b.tileY + b.tilesHigh,
                          "border": firstSwapItem()?.id === b.id ? '3px dashed #f59e0b' : 'none',
                          "filter": firstSwapItem()?.id === b.id ? 'drop-shadow(0 0 8px #f59e0b)' : 'none'
                        }}
                        title={`${b.type} (${b.tilesWide}x${b.tilesHigh}) at [${b.tileX}, ${b.tileY}]`}
                      >
                        <span class="text-[9px] font-brains font-bold text-white drop-shadow-md px-2 truncate w-full">
                          {b.type.replace('Building', '')}
                        </span>
                      </div>
                    }
                  >
                    {(() => {
                      const srcRect = bData.sourceRect || { X: 0, Y: 0, Width: 0, Height: 0 };
                      if (srcRect.Width > 0 && srcRect.Height > 0) {
                        return (
                          <div 
                            onClick={(e) => {
                              if (stashMode() && !isBuildingLocked(b)) {
                                e.stopPropagation();
                                setStashedItems([...stashedItems(), { ...b, itemCategory: 'Building', spawnCategory: 'Building' }]);
                              } else if (swapMode()) {
                                handleItemClickForSwap(e, b, 'Building');
                              } else if (eraserMode()) {
                                requestDeleteBuilding(e, b.id);
                              }
                            }}
                            onDragStart={(e) => e.preventDefault()}
                            onMouseDown={(e) => handleDragStart(e, b)}
                            class={`absolute transition-transform ${(moveMode() || swapMode()) ? (draggedBuilding()?.id === b.id ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing drop-shadow-[0_0_8px_rgba(99,102,241,1)] z-10') : eraserMode() ? 'cursor-crosshair hover:drop-shadow-[0_0_8px_rgba(239,68,68,1)] hover:z-50' : 'hover:z-50 cursor-default'}`}
                            style={{
                              left: `${b.tileX * TILE_SIZE}px`,
                              bottom: `${(bounds().height - (b.tileY + b.tilesHigh)) * TILE_SIZE}px`,
                              width: `${srcRect.Width}px`,
                              height: `${srcRect.Height}px`,
                              "background-image": `url('${getSafeTextureUrl(bData.texture)}')`,
                              "background-position": `-${srcRect.X}px -${srcRect.Y}px`,
                              "image-rendering": "pixelated",
                              "z-index": b.tileY + b.tilesHigh,
                              "border": firstSwapItem()?.id === b.id ? '3px dashed #f59e0b' : 'none',
                              "filter": firstSwapItem()?.id === b.id ? 'drop-shadow(0 0 8px #f59e0b)' : 'none'
                            }}
                            title={`${b.type} (${b.tilesWide}x${b.tilesHigh}) at [${b.tileX}, ${b.tileY}]`}
                          />
                        );
                      } else {
                        let texH = bData.textureSize?.Y || b.tilesHigh * TILE_SIZE;
                        const drawW = b.tilesWide * TILE_SIZE; 
                        let bgPosX = 0;
                        let bgPosY = 0;

                        if (b.type === "Fish Pond") {
                          texH = 88;
                        }
                        
                        return (
                          <div 
                              onClick={(e) => {
                                if (stashMode() && !isBuildingLocked(b)) {
                                  e.stopPropagation();
                                  setStashedItems([...stashedItems(), { ...b, itemCategory: 'Building', spawnCategory: 'Building' }]);
                                } else if (swapMode()) {
                                  handleItemClickForSwap(e, b, 'Building');
                                } else if (eraserMode()) {
                                  requestDeleteBuilding(e, b.id);
                                }
                              }}
                              onDragStart={(e) => e.preventDefault()}
                              onMouseDown={(e) => handleDragStart(e, b)}
                              class={`absolute transition-transform ${(moveMode() || swapMode()) ? (draggedBuilding()?.id === b.id ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing drop-shadow-[0_0_8px_rgba(99,102,241,1)] z-10') : eraserMode() ? 'cursor-crosshair hover:drop-shadow-[0_0_8px_rgba(239,68,68,1)] hover:z-50' : 'hover:z-50 cursor-default'}`}
                            style={{
                              left: `${b.tileX * TILE_SIZE}px`,
                              bottom: `${(bounds().height - (b.tileY + b.tilesHigh)) * TILE_SIZE}px`,
                              width: `${drawW}px`,
                              height: `${texH}px`,
                              "z-index": b.tileY + b.tilesHigh,
                              "border": firstSwapItem()?.id === b.id ? '3px dashed #f59e0b' : 'none',
                              "filter": firstSwapItem()?.id === b.id ? 'drop-shadow(0 0 8px #f59e0b)' : 'none'
                            }}
                            title={`${b.type} (${b.tilesWide}x${b.tilesHigh}) at [${b.tileX}, ${b.tileY}]`}
                          >
                            {b.type === "Fish Pond" && (
                              <div 
                                class="absolute"
                                style={{
                                  "background-color": "#1e5e85",
                                  top: "10px",
                                  left: "10px",
                                  right: "10px",
                                  bottom: "10px",
                                  "z-index": 0
                                }}
                              />
                            )}
                            <div 
                              class="absolute inset-0 pointer-events-none"
                              style={{
                                "background-image": `url('${getSafeTextureUrl(bData.texture)}')`,
                                "background-position": `-${bgPosX}px -${bgPosY}px`,
                                "background-repeat": "no-repeat",
                                "image-rendering": "pixelated",
                                "z-index": 1
                              }}
                            />
                          </div>
                        );
                      }
                    })()}
                  </Show>
                );
              }}
            </For>

{/* Render Terrain Features */}
            <For each={farmTerrainFeatures().filter(t => !isStashed(t.id))}>
              {(t) => {
                const type = t.type; 
                let bgColor = '#9e9e9e';
                let isCircle = false;

                if (type === 'Flooring') bgColor = '#d7ccc8';
                else if (type === 'HoeDirt') bgColor = '#5d4037';
                else if (type === 'Tree' || type === 'FruitTree') { bgColor = '#1b5e20'; isCircle = true; } 
                else if (type === 'Grass') bgColor = '#aed581';

                return (
                  <div 
                    onClick={(e) => {
                      if (stashMode() && type !== 'Grass') {
                        e.stopPropagation();
                        setStashedItems([...stashedItems(), { ...t, itemCategory: 'TerrainFeature', spawnCategory: 'TerrainFeature' }]);
                      } else if (swapMode() && type !== 'Grass') {
                        handleItemClickForSwap(e, t, 'TerrainFeature');
                      } else {
                        deleteTerrain(e, t.tileX, t.tileY);
                      }
                    }}
                    onDragStart={(e) => e.preventDefault()}
                    onMouseDown={(e) => { if (type !== 'Grass') handleDragStart(e, t, 'TerrainFeature'); }}
                    class={`absolute flex items-end justify-center ${isCircle && !useSpriteView() ? 'rounded-full' : ''} ${eraserMode() ? 'cursor-crosshair hover:border-red-500 hover:border-2 hover:z-50' : ((moveMode() || swapMode()) && type !== 'Grass') ? (draggedBuilding()?.id === t.id ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing hover:scale-125 z-10') : stashMode() && type !== 'Grass' ? 'cursor-grab hover:scale-125 hover:z-50 ring-2 ring-white' : 'cursor-default'}`}
                    style={{
                      left: `${t.tileX * TILE_SIZE}px`,
                      bottom: `${(bounds().height - (t.tileY + 1)) * TILE_SIZE}px`,
                      width: `${TILE_SIZE}px`,
                      height: `${TILE_SIZE}px`,
                      "background-color": useSpriteView() ? 'transparent' : bgColor,
                      "z-index": type.includes('Tree') ? t.tileY + 2 : 0
                    }}
                    title={`${t.name} at [${t.tileX}, ${t.tileY}]`}
                  >
{/* WUJUD HD KETIKA SPRITE VIEW ON */}
                    <Show when={useSpriteView()}>
{type === 'Tree' && (
  <TreeSprite 
    treeType={t.treeType}
    season={currentSeason()}
    isStump={t.isStump}
    isGreenRainTree={t.isGreenRainTree}
  />
)}

                      {/* TEKNIK RENDER TANAH CANGKUL (Support Musim Dingin!) */}
                      {type === 'HoeDirt' && (
                        <div class="w-full h-full bg-[#5d4037] border border-[#3e2723]" style={{
                           "background-image": `url('/stardew/terrainFeatures/${currentSeason() === 'winter' ? 'hoeDirtSnow' : 'hoeDirt'}.png')`,
                           "background-size": "100%", 
                           "image-rendering": "pixelated"
                        }} />
                      )}

                      {/* TEKNIK RENDER FLOORING.PNG (Support Salju Musim Dingin!) */}
                      {type === 'Flooring' && (() => {
                         const fId = parseInt(t.whichFloor || '0', 10);
                         const startX = (fId % 4) * 64;
                         const startY = Math.floor(fId / 4) * 64;
                         const cropX = startX + 32;
                         const cropY = startY + 16;

                         const floorFile = currentSeason() === 'winter' ? 'Flooring_winter.png' : 'Flooring.png';
                         
                         return (
                           <div class="w-full h-full opacity-90" style={{
                             "background-image": `url('/stardew/terrainFeatures/${floorFile}')`,
                             "background-size": `${256 * (TILE_SIZE/16)}px auto`,
                             "background-position": `-${cropX * (TILE_SIZE/16)}px -${cropY * (TILE_SIZE/16)}px`,
                             "image-rendering": "pixelated"
                           }} />
                         );
                      })()}

                    </Show>
                  </div>
                );
              }}
            </For>

{/* Render Objects */}
<For each={farmObjects().filter(o => {
  if (isStashed(o.id)) return false;
  if (o.isHeld && isStashed(`obj-${o.tileX}-${o.tileY}`)) return false;
  return true;
})}>
  {(o) => {
    return (
      <Show 
        when={useSpriteView()}
        fallback={
          <div 
            onClick={(e) => {
              if (o.isHeld) return; // Prevent direct interaction with held objects
              if (stashMode()) {
                e.stopPropagation();
                setStashedItems([...stashedItems(), { ...o, itemCategory: 'Object', spawnCategory: 'Object' }]);
              } else if (swapMode()) {
                handleItemClickForSwap(e, o, 'Object');
              } else {
                deleteObject(e, o.tileX, o.tileY);
              }
            }}
            class={`absolute ${isObjectSquare(o.name) ? 'rounded-sm' : 'rounded-full'} ${eraserMode() ? 'cursor-crosshair hover:border-red-500 hover:border-2 hover:z-50' : 'cursor-default'} ${o.isHeld ? 'pointer-events-none' : ''}`}
            style={{
              left: `${o.tileX * TILE_SIZE + 2}px`,

              bottom: `${(bounds().height - (o.tileY + 1)) * TILE_SIZE + (o.isHeld ? 4 : 0)}px`,
              width: `${TILE_SIZE - 4}px`,
              height: `${TILE_SIZE - 4}px`,
              "background-color": getObjectColor(o.name),

              "z-index": o.tileY + (o.isHeld ? 2 : 1) 
            }}
            title={`${o.name} (${o.type}) at [${o.tileX}, ${o.tileY}]`}
          />
        }
      >
        <div 
          onClick={(e) => {
            if (o.isHeld) return; // Prevent direct interaction with held objects
            if (stashMode()) {
              e.stopPropagation();
              setStashedItems([...stashedItems(), { ...o, itemCategory: 'Object', spawnCategory: 'Object' }]);
            } else if (swapMode()) {
              handleItemClickForSwap(e, o, 'Object');
            } else {
              deleteObject(e, o.tileX, o.tileY);
            }
          }}
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => { if (!o.isHeld) handleDragStart(e, o, 'Object') }}
          class={`absolute flex items-end justify-start ${eraserMode() ? 'cursor-crosshair hover:drop-shadow-[0_0_8px_rgba(239,68,68,1)] hover:z-50' : (moveMode() || swapMode()) ? (draggedBuilding()?.id === o.id ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing hover:scale-110 z-10') : 'cursor-default'} ${o.isHeld ? 'pointer-events-none' : ''}`}
          style={{
            left: `${o.tileX * TILE_SIZE}px`,
            bottom: `${(bounds().height - (o.tileY + 1)) * TILE_SIZE}px`,

            "z-index": o.tileY + 1 + (o.heldDepth || 0),
            "border": firstSwapItem()?.id === o.id ? '3px dashed #f59e0b' : 'none',
            "filter": firstSwapItem()?.id === o.id ? 'drop-shadow(0 0 8px #f59e0b)' : 'none'
          }}
          title={`${o.name} (${o.type}) at [${o.tileX}, ${o.tileY}]`}
        >
          {/* Jika isHeld true, gunakan CSS Tailwind transform untuk menggeser gambar Torch sedikit ke atas (-translate-y-3) */}
          <ItemSprite 
            name={o.name} 
            itemId={o.itemId} 
            type={o.type} 
            scale={1}
            class={`origin-bottom ${
      o.heldDepth === 1 ? '-translate-y-3 z-10 drop-shadow-md' : 
      o.heldDepth === 2 ? '-translate-y-6 z-20 drop-shadow-xl' : ''
    }`}
          />
        </div>
      </Show>
    );
  }}
</For>

{/* TAMBAHAN FASE 1: Render Furniture */}
            <For each={(typeof farmFurniture === 'function' ? farmFurniture() : []).filter((f: any) => !isStashed(f.id))}>
              {(f) => {
              const fw = f.tilesWide || 1;
              const fh = f.tilesHigh || 1;

                return (
                  <Show 
                    when={useSpriteView()}
                    fallback={
                      <div 
                        class={`absolute rounded-sm ${eraserMode() ? 'cursor-crosshair hover:border-red-500 hover:border-2 hover:z-50' : 'cursor-default'}`}
                        style={{
                          left: `${f.tileX * TILE_SIZE + 2}px`,
                          bottom: `${(bounds().height - (f.tileY + fh)) * TILE_SIZE}px`,
                          width: `${(fw * TILE_SIZE) - 4}px`,
                          height: `${(fh * TILE_SIZE) - 4}px`,
                          "background-color": "#8d6e63",
                          "z-index": f.tileY + fh
                        }}
                        title={`${f.name} (Furniture) at [${f.tileX}, ${f.tileY}]`}
                      />
                    }
                  >
                    <div 
                      onClick={(e) => {
                        if (stashMode()) {
                          e.stopPropagation();
                          setStashedItems([...stashedItems(), { ...f, itemCategory: 'Furniture', spawnCategory: 'Furniture' }]);
                        } else if (swapMode()) {
                          handleItemClickForSwap(e, f, 'Furniture');
                        } else if (eraserMode()) {
                          deleteFurniture(e, f.id);
                        }
                      }}
                      onDragStart={(e) => e.preventDefault()}
                      onMouseDown={(e) => handleDragStart(e, f, 'Furniture')}
                      class={`absolute flex items-end justify-start ${eraserMode() ? 'cursor-crosshair hover:drop-shadow-[0_0_8px_rgba(239,68,68,1)] hover:z-50' : (moveMode() || swapMode()) ? (draggedBuilding()?.id === f.id ? 'opacity-30 pointer-events-none' : 'cursor-grab active:cursor-grabbing hover:scale-110 z-10') : 'cursor-default'}`}
                      style={{
                        left: `${f.tileX * TILE_SIZE}px`,
                        bottom: `${(bounds().height - (f.tileY + fh)) * TILE_SIZE}px`,
                        "z-index": f.tileY + fh,
                        "border": firstSwapItem()?.id === f.id ? '3px dashed #f59e0b' : 'none',
                        "filter": firstSwapItem()?.id === f.id ? 'drop-shadow(0 0 8px #f59e0b)' : 'none'
                      }}
                      title={`${f.name} (Furniture) at [${f.tileX}, ${f.tileY}]`}
                    >
                      <ItemSprite name={f.name} itemId={f.itemId} type="Furniture" class="origin-bottom" scale={1} />
                    </div>
                  </Show>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Build Mode Cancel Banner */}
      <Show when={buildingToPlace()}>
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-12 bg-black/90 border border-emerald-500/50 rounded-12 px-16 py-10 shadow-2xl backdrop-blur-sm">
          <Hammer size={18} class="text-emerald-400" />
          <span class="text-sm text-white font-brains">Placing: <strong class="text-emerald-300">{buildingToPlace().name}</strong></span>
          <button 
            onClick={() => { setBuildingToPlace(null); setDragPos(null); setMousePixelPos(null); }}
            class="px-10 py-4 bg-red-600 hover:bg-red-500 text-white text-sm rounded-6 font-bold cursor-pointer transition-colors"
          >
            Cancel (ESC)
          </button>
        </div>
      </Show>

      {/* UI LACI VILLAGE EDIT MODE */}
      <Show when={stashMode()}>
        <div class="fixed bottom-0 left-0 w-full h-[180px] bg-[#c0733a] border-t-[6px] border-[#8c4614] z-[200] shadow-[0_-10px_25px_rgba(0,0,0,0.5)] flex flex-col font-desc transition-transform">
          
          <div class="flex justify-between items-center px-16 py-8 bg-[#8c4614] text-white text-sm">
            <span>🏠 Village Edit Mode (<strong class="text-amber-300">{stashedItems().length}</strong> items in stash)</span>
            <div class="flex gap-8 font-brains">
               <button onClick={handleStashAll} class="px-12 py-4 bg-amber-500 hover:bg-amber-400 text-amber-900 rounded font-bold shadow-sm transition-colors cursor-pointer">
                 Stash All
               </button>
               <button onClick={() => { setStashMode(false); setStashedItems([]); setBuildingToPlace(null); }} class="px-12 py-4 bg-red-500 hover:bg-red-400 text-white rounded font-bold shadow-sm transition-colors cursor-pointer">
                 {stashedItems().length > 0 ? 'Cancel & Restore All' : 'Close Mode'}
               </button>
            </div>
          </div>
          
          <div class="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-12 px-16 bg-[#e6c485] stardew-scrollbar pt-4 pb-8">
            <Show when={stashedItems().length === 0}>
              <div class="text-[#8c4614] w-full text-center font-bold font-serif opacity-70">
                Stash is empty. Click items on the map or use "Stash All" to begin.
              </div>
            </Show>
            
            <For each={groupedStashedItems()}>
              {(group) => {
                const count = group.instances.length;
                const item = group.sample;
                const displayName = group.displayName;

                const bData = item.itemCategory === 'Building' ? (buildingsDataRaw as any[]).find(d => d.name === item.type || d.displayName === item.type) : null;
                
let cropW = 16, cropH = 16;
if (bData && bData.texture) {
  const srcRect = bData.sourceRect || { X: 0, Y: 0, Width: 0, Height: 0 };
  cropW = srcRect.Width; cropH = srcRect.Height;
  if (cropW === 0 || cropH === 0) {
    cropW = (bData.footprint?.X || item.tilesWide || 1) * 16;
    cropH = bData.textureSize?.Y || ((bData.footprint?.Y || item.tilesHigh || 1) * 16);
  }
}

                const instanceToPlace = group.instances[0];
                const isSelected = buildingToPlace()?.id === instanceToPlace.id;

                return (
                  <button 
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      setIsDraggingFromStash(true);
                      const footprint = { 
  X: instanceToPlace.tilesWide || instanceToPlace.tilesX || 1, 
  Y: instanceToPlace.tilesHigh || instanceToPlace.tilesY || 1 
};
                      const safeName = instanceToPlace.itemCategory === 'Building' ? instanceToPlace.type.replace('Building', '').trim() : instanceToPlace.name;
                       setBuildingToPlace({
                         ...instanceToPlace,
                         name: safeName,
                         texture: bData?.texture || instanceToPlace.texture,
                         sourceRect: bData?.sourceRect || instanceToPlace.sourceRect,
                         textureSize: bData?.textureSize || instanceToPlace.textureSize,
                         isFromStash: true,
                         footprint,
                         groupKey: group.key
                       });
                    }}
                    class={`w-[90px] h-[90px] shrink-0 bg-[#fce8b8] border-4 border-[#c0733a] rounded-8 hover:scale-105 hover:-translate-y-2 transition-all flex flex-col items-center justify-center p-4 relative cursor-pointer shadow-sm ${isSelected ? 'ring-4 ring-blue-500 bg-white' : ''}`}
                    title={displayName}
                  >
<div class="w-full h-full flex items-center justify-center pointer-events-none mb-2">
  {item.itemCategory === 'TerrainFeature' ? (
    <div class="flex items-center justify-center w-full h-full">
      {item.type === 'Tree' ? (
        <div class="relative w-[16px] h-[16px] transform scale-[0.55] origin-center mt-6">
          <TreeSprite treeType={item.treeType} season={currentSeason()} isStump={item.isStump} isGreenRainTree={item.isGreenRainTree} />
        </div>
      ) : item.type === 'Flooring' ? (() => {
         const fId = parseInt(item.whichFloor || '0', 10);
         const startX = (fId % 4) * 64;
         const startY = Math.floor(fId / 4) * 64;
         const cropX = startX + 32;
         const cropY = startY + 16;
         const floorFile = currentSeason() === 'winter' ? 'Flooring_winter.png' : 'Flooring.png';
         return (
           <div class="w-[16px] h-[16px] transform scale-[2] opacity-90 shadow-sm" style={{
             "background-image": `url('/stardew/terrainFeatures/${floorFile}')`,
             "background-position": `-${cropX}px -${cropY}px`,
             "image-rendering": "pixelated"
           }} />
         );
      })() : item.type === 'HoeDirt' ? (
         <div class="w-[16px] h-[16px] transform scale-[2] bg-[#5d4037] border border-[#3e2723] shadow-sm" style={{
            "background-image": `url('/stardew/terrainFeatures/${currentSeason() === 'winter' ? 'hoeDirtSnow' : 'hoeDirt'}.png')`,
            "background-size": "100%", "image-rendering": "pixelated"
         }} />
      ) : (
         <div class="w-8 h-8 rounded-sm bg-[#d7ccc8] border border-gray-500 shadow-md flex items-center justify-center text-[10px]">🧱</div>
      )}
    </div>
) : item.itemCategory === 'Building' ? (
  <Show
    when={bData && bData.texture}
    fallback={<ItemSprite name={displayName} itemId={item.itemId} type={item.type || item.itemCategory} scale={1.5} class="drop-shadow-md" />}
  >
    {(() => {
      const hasSrcRect = bData.sourceRect && bData.sourceRect.Width > 0 && bData.sourceRect.Height > 0;

      const drawW = hasSrcRect ? bData.sourceRect.Width : (bData.footprint?.X || item.tilesWide || 1) * 16;
      const drawH = hasSrcRect ? bData.sourceRect.Height : (bData.textureSize?.Y || (bData.footprint?.Y || item.tilesHigh || 1) * 16);
      const scale = Math.min(1.5, 48 / drawW, 48 / drawH);

      let bgPosX = hasSrcRect ? bData.sourceRect.X : 0;
      let bgPosY = hasSrcRect ? bData.sourceRect.Y : 0;

      return (
        <div class="relative flex items-center justify-center">
          <div
            class="relative z-10 shadow-sm"
            style={{
              "width": `${drawW}px`, "height": `${drawH}px`,
              "background-image": `url('${getSafeTextureUrl(bData.texture)}')`,
              "background-position": `-${bgPosX}px -${bgPosY}px`,
              "background-repeat": "no-repeat", "image-rendering": "pixelated",
              "transform": `scale(${scale})`, "transform-origin": "center center"
            }}
          >
            {/* Tambahkan air dasar untuk Fish Pond karena asset aslinya transparan di tengah */}
            {item.type === "Fish Pond" && (
              <div class="absolute z-[-1] bg-[#1e5e85]" style={{ top: "10px", left: "10px", right: "10px", bottom: "10px" }} />
            )}
          </div>
        </div>
      );
    })()}
  </Show>
) : (
    /* Objek dan Furnitur biasa biarkan apa adanya */
    <ItemSprite name={displayName} itemId={item.itemId} type={item.type || item.itemCategory} scale={1.5} class="drop-shadow-md" />
  )}
</div>

                    <span class="absolute bottom-[-10px] text-[10px] text-white bg-black/80 px-4 rounded truncate max-w-[120%] font-serif border border-black/50 z-10">
                      {displayName}
                    </span>

                    {/* Lencana CoC Stack x999 */}
                    <Show when={count > 1}>
                      <div class="absolute -top-6 -right-6 bg-red-600 text-white text-[11px] font-brains font-bold px-6 py-2 rounded-full border-2 border-white shadow-md z-20">
                        x{count}
                      </div>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
          
        </div>
      </Show>

      <BuildingSpawnerModal 
        isOpen={isBuildingModalOpen()} 
        onClose={() => setBuildingModalOpen(false)} 
        onSelectBuilding={(b) => setBuildingToPlace(b)}
      />

      <Modal 
        isOpen={isClearDebrisModalOpen()} 
        onClose={() => setClearDebrisModalOpen(false)} 
        title="Clear All Debris"
        icon={<AlertTriangle size={20} class="text-red-500" />}
      >
        <div class="flex flex-col gap-16 text-zinc-300 font-serif">
          <p>
            This will remove all <strong class="text-white">stones, weeds, twigs, wild trees, and grass</strong> from your farm.
          </p>
          <div class="p-12 bg-yellow-900/20 border-l-4 border-[#c0733a] rounded-6">
            <p class="text-sm text-yellow-200/90 leading-relaxed">
              <strong class="text-yellow-400">Note:</strong> Fruit trees, crops, paths, equipment (Chests, Furnaces, etc.), and buildings will be safe.
            </p>
          </div>
          <p class="text-[15px] leading-relaxed text-red-300 font-bold">
            Are you sure you want to proceed?
          </p>
          <div class="flex gap-12 mt-8">
            <button 
              onClick={() => setClearDebrisModalOpen(false)}
              class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={confirmClearDebris}
              class="flex-1 py-12 rounded cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-sm"
            >
              Yes, Clear Debris
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hapus Bangunan */}
      <Modal 
        isOpen={buildingToDelete() !== null} 
        onClose={() => setBuildingToDelete(null)} 
        title="Delete Building"
        icon={<AlertTriangle size={20} class="text-red-500" />}
      >
        <div class="flex flex-col gap-16 font-serif text-zinc-300">
          <p>
            Are you sure you want to delete <strong class="text-red-400">{buildingToDelete()?.name}</strong>?
          </p>
          <div class="bg-red-500/10 border-l-4 border-red-500 p-12 text-red-400 text-sm font-medium flex items-start gap-8">
              <AlertTriangle size={20} class="shrink-0" />
              <span>Warning: All animals, machines, and items inside this building will be permanently lost!</span>
          </div>
          
          <div class="flex gap-12 mt-8">
            <button 
              onClick={() => setBuildingToDelete(null)}
              class="flex-1 py-12 rounded cursor-pointer bg-[#e6b167] hover:bg-[#d98b48] text-[#4d2503] font-bold transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDeleteBuilding}
              class="flex-1 py-12 rounded cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-sm"
            >
              Yes, Delete It
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};