const fs = require('fs');
const path = require('path');

const unpackedDir = 'C:/Users/Administrator/Downloads/Stardew Valley/Content (unpacked)';
const outputFile = path.join(__dirname, '../src/data/stardew/buildings.json');
const buildingsJsonPath = path.join(unpackedDir, 'Data/Buildings.json');

if (!fs.existsSync(buildingsJsonPath)) {
    console.error(`Missing Buildings.json at ${buildingsJsonPath}`);
    process.exit(1);
}

function getPngSize(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buf = Buffer.alloc(24);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    return { X: buf.readUInt32BE(16), Y: buf.readUInt32BE(20) };
}

const buildingsData = JSON.parse(fs.readFileSync(buildingsJsonPath, 'utf8'));
const extractedBuildings = [];

for (const [buildingType, data] of Object.entries(buildingsData)) {
    let texturePath = data.Texture;
    if (!texturePath) continue;
    
    const filename = path.basename(texturePath.replace(/\\/g, '/')) + '.png';
    const fullPngPath = path.join(unpackedDir, 'Buildings', filename);
    const textureSize = getPngSize(fullPngPath) || { X: 16, Y: 16 };

    extractedBuildings.push({
        name: buildingType,
        displayName: data.Name,
        footprint: data.Size || { X: 1, Y: 1 },
        texture: filename,
        textureSize: textureSize,
        sourceRect: data.SourceRect || { X: 0, Y: 0, Width: 0, Height: 0 },
        maxOccupants: data.MaxOccupants || 0,
        hayCapacity: data.HayCapacity || 0
    });
}

fs.writeFileSync(outputFile, JSON.stringify(extractedBuildings, null, '\t'));
console.log(`Successfully updated ${outputFile} with ${extractedBuildings.length} buildings (including texture sizes)!`);
