const fs = require('fs');
const path = require('path');

const unpackedDir = 'C:/Users/Administrator/Downloads/Stardew Valley/Content (unpacked)';
const publicDir = path.join(__dirname, '../public/stardew');

// Ensure directories exist
const buildingsPublicDir = path.join(publicDir, 'Buildings');
if (!fs.existsSync(buildingsPublicDir)) {
    fs.mkdirSync(buildingsPublicDir, { recursive: true });
}

// 1. Copy main spritesheets
const copyFiles = [
    { src: 'Maps/springobjects.png', dest: 'springobjects.png' },
    { src: 'TileSheets/Craftables.png', dest: 'Craftables.png' },
    { src: 'TileSheets/furniture.png', dest: 'furniture.png' },
    { src: 'Characters/Farmer/shirts.png', dest: 'shirts.png' },
    { src: 'Characters/Farmer/pants.png', dest: 'pants.png' },
    { src: 'Characters/Farmer/hats.png', dest: 'hats.png' },
    { src: 'TileSheets/tools.png', dest: 'tools.png' },
    { src: 'TileSheets/weapons.png', dest: 'weapons.png' },
];

console.log("Copying main spritesheets...");
for (const file of copyFiles) {
    const srcPath = path.join(unpackedDir, file.src);
    const destPath = path.join(publicDir, file.dest);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file.src} to public/stardew/${file.dest}`);
    } else {
        console.warn(`Missing file in unpacked: ${srcPath}`);
    }
}

// 2. Copy Buildings PNGs based on our buildings.json
console.log("\nCopying Building PNGs...");
const buildingsJsonPath = path.join(__dirname, '../src/data/stardew/buildings.json');
if (fs.existsSync(buildingsJsonPath)) {
    const buildingsData = JSON.parse(fs.readFileSync(buildingsJsonPath, 'utf8'));

    for (const data of buildingsData) {
        if (!data.texture) continue;
        
        // e.g., 'Barn.png' -> we need to look in 'Buildings/Barn.png'
        const srcPngPath = path.join(unpackedDir, 'Buildings', data.texture);
        const destPngPath = path.join(buildingsPublicDir, data.texture);

        if (fs.existsSync(srcPngPath)) {
            fs.copyFileSync(srcPngPath, destPngPath);
        } else {
            console.warn(`Could not find texture for ${data.name}: ${srcPngPath}`);
        }
    }
    console.log(`Finished copying building sprites.`);
} else {
    console.error(`Missing src/data/stardew/buildings.json`);
}
