const fs = require('fs');
const path = require('path');

const inputDir = 'C:/Users/Administrator/Downloads/Stardew Valley/Content (unpacked)/Data';
const outputFile = path.join(__dirname, '../src/data/stardew/iteminfo.json');

const items = [];

function loadJson(filename) {
    const fullPath = path.join(inputDir, filename);
    if (fs.existsSync(fullPath)) {
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
    console.warn(`Warning: Could not find ${filename}`);
    return {};
}

// Helper to map object keys (lowercase first char)
function mapObject(key, obj, typeStr) {
    const mapped = { _type: typeStr, _key: String(key) };
    for (const [k, v] of Object.entries(obj)) {
        const newKey = k.charAt(0).toLowerCase() + k.slice(1);
        mapped[newKey] = v;
    }
    // Fallback name if missing
    if (!mapped.name && mapped.id) mapped.name = mapped.id;
    if (!mapped.name) mapped.name = mapped._key;
    return [mapped.name, mapped];
}

// Parse Objects (JSON Objects)
const objects = loadJson('Objects.json');
for (const [key, obj] of Object.entries(objects)) {
    items.push(mapObject(key, obj, 'Object'));
}

// Parse BigCraftables (JSON Objects)
const bigCraftables = loadJson('BigCraftables.json');
for (const [key, obj] of Object.entries(bigCraftables)) {
    items.push(mapObject(key, obj, 'BigCraftable'));
}

// Parse Weapons (JSON Objects)
const weapons = loadJson('Weapons.json');
for (const [key, obj] of Object.entries(weapons)) {
    items.push(mapObject(key, obj, 'Weapon'));
}

// Parse Shirts (JSON Objects)
const shirts = loadJson('Shirts.json');
for (const [key, obj] of Object.entries(shirts)) {
    items.push(mapObject(key, obj, 'Shirt'));
}

// Parse Pants (JSON Objects)
const pants = loadJson('Pants.json');
for (const [key, obj] of Object.entries(pants)) {
    items.push(mapObject(key, obj, 'Pants'));
}

// Parse Tools (JSON Objects)
const tools = loadJson('Tools.json');
for (const [key, obj] of Object.entries(tools)) {
    items.push(mapObject(key, obj, 'Tool'));
}

// Parse Boots (String: Name/Description/Price/Defense/Immunity/ColorIndex/DisplayName)
const boots = loadJson('Boots.json');
for (const [key, str] of Object.entries(boots)) {
    const parts = str.split('/');
    const mapped = {
        _type: 'Boots',
        _key: String(key),
        name: parts[0],
        description: parts[1],
        price: parseInt(parts[2]),
        defense: parseInt(parts[3]),
        immunity: parseInt(parts[4]),
        colorIndex: parseInt(parts[5]),
        displayName: parts[6] || parts[0]
    };
    items.push([mapped.name, mapped]);
}

// Parse Hats (String: Name/Description/SkipHairDraw/SkipHairOffset/DisplayName)
const hats = loadJson('Hats.json');
for (const [key, str] of Object.entries(hats)) {
    const parts = str.split('/');
    const mapped = {
        _type: 'Hat',
        _key: String(key),
        name: parts[0],
        description: parts[1],
        showRealHair: parts[2] === 'true',
        skipHairstyleOffset: parts[3] === 'true',
        texture: parts[4] || null,
        displayName: parts[5] || parts[0],
        spriteIndex: parts.length > 6 ? parseInt(parts[6], 10) : parseInt(key, 10)
    };
    if (isNaN(mapped.spriteIndex)) delete mapped.spriteIndex;
    items.push([mapped.name, mapped]);
}

// Parse Furniture (String: Name/Type/TilesX/TilesY/Rotations/Price/Placement/DisplayName)
const furniture = loadJson('Furniture.json');

const getDefaultFurnitureSize = (type) => {
    switch (type) {
        case "chair": return [1, 2];
        case "bench": return [2, 2];
        case "armchair": return [2, 2];
        case "couch": return [3, 2];
        case "dresser": return [2, 2];
        case "long table": return [5, 3];
        case "painting": return [2, 2];
        case "lamp": return [1, 2];
        case "window": return [1, 2];
        case "bookcase": return [2, 3];
        case "table": return [2, 3];
        case "rug": return [3, 2];
        case "fireplace": return [2, 5];
        case "sconce": return [1, 2];
        case "torch": return [1, 2];
        default: return [1, 1];
    }
};

for (const [key, str] of Object.entries(furniture)) {
    const parts = str.split('/');
    // 0: name, 1: type, 2: tilesSheetSize, 3: boundingBoxSize, 4: rotations, 5: price, 6: placementRestriction, 7: displayName, 8: index, 9: texture
    
    let tX = 1;
    let tY = 1;
    
    if (parts.length > 2) {
        const sheetSize = parts[2].split(' ');
        if (sheetSize.length >= 2) {
            tX = parseInt(sheetSize[0]);
            tY = parseInt(sheetSize[1]);
        }
    }
    
    if (tX === -1 || tY === -1 || isNaN(tX) || isNaN(tY)) {
        const defSize = getDefaultFurnitureSize(parts[1]);
        tX = defSize[0];
        tY = defSize[1];
    }

    const mapped = {
        _type: 'Furniture',
        _key: String(key),
        name: parts[0],
        type: parts[1],
        tilesX: tX || 1,
        tilesY: tY || 1,
        rotations: parseInt(parts[4]),
        price: parseInt(parts[5]),
        placement: parts[6],
        displayName: parts[7] || parts[0],
        spriteIndex: parts[8] ? parseInt(parts[8]) : undefined,
        texture: parts[9] || undefined
    };
    if (isNaN(mapped.spriteIndex)) delete mapped.spriteIndex;
    if (mapped.tilesX <= 0) mapped.tilesX = 1;
    if (mapped.tilesY <= 0) mapped.tilesY = 1;
    items.push([mapped.name, mapped]);
}

// Parse Trinkets (JSON Objects)
const trinkets = loadJson('Trinkets.json');
for (const [key, obj] of Object.entries(trinkets)) {
    items.push(mapObject(key, obj, 'Trinket'));
}

// Parse Mannequins (JSON Objects)
const mannequins = loadJson('Mannequins.json');
for (const [key, obj] of Object.entries(mannequins)) {
    items.push(mapObject(key, obj, 'Mannequin'));
}

// Write to iteminfo.json
fs.writeFileSync(outputFile, JSON.stringify(items, null, '\t'), 'utf8');
console.log(`Successfully generated iteminfo.json with ${items.length} items.`);
