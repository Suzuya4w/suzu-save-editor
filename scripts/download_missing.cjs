const fs = require('fs');
const path = require('path');
const https = require('https');

const itemInfoRaw = require('./src/data/stardew/iteminfo.json'); 
const outputDir = path.join(__dirname, 'public', 'items');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Prepare items list
const items = itemInfoRaw
  .filter(t => t && t[1] && t[1].name)
  .map(t => {
    const key = String(t[1]._key || t[0]).replace(/[<>:"\/\\|?*]+/g, '');
    let wikiName = t[1].name;
    const type = t[1]._type;
    const spriteIndex = t[1].spriteIndex;

    // Manual overrides for items whose internal names completely differ from Wiki filenames
    const manualOverrides = {
      'MagicHairDye': 'Magic_Hair_Gel',
      'FrogEgg': 'Green_Frog_Egg',
      'Cursed_Mannequin_Male': 'Cursed_Male_Mannequin',
      'Cursed_Mannequin_Female': 'Cursed_Female_Mannequin',
      '126': 'Strange_Doll_(green)',
      '127': 'Strange_Doll_(yellow)',
      '168': 'Trash_(item)',
      '438': 'Large_Goat_Milk',
      '390': 'Stone',
      '590': 'Artifact_tile.gif', // Note: .gif extension!
      '788': 'Springobjects788',
      '789': 'Springobjects789',
      '790': 'Springobjects790',
      '864': 'War_Memento',
      '865': 'Gourmet_Tomato_Salt',
      '866': 'Stardew_Valley_Rose',
      '867': 'Advanced_TV_Remote',
      '868': 'Arctic_Shard',
      '869': 'Wriggling_Worm',
      '870': "Pirate's_Locket",
      '922': 'Supply_Crate_1',
      '923': 'Supply_Crate_2',
      '924': 'Supply_Crate_3',
      'SeedSpot': 'Seed_Spot.gif', // Note: .gif extension!
      'Book_Horse': 'Horse_The_Book',
      'Book_Grass': "Ol'_Slitherlegs",
      // Handle the shirt mismatch
      '194': 'Shirt135',
      // Base Tools
      'Axe': 'Basic_Axe',
      'Pickaxe': 'Basic_Pickaxe',
      'Hoe': 'Basic_Hoe',
      'WateringCan': 'Basic_Watering_Can'
    };

    if (manualOverrides[key]) {
      wikiName = manualOverrides[key];
    }
    // Handle specific shirt override, otherwise default to ShirtXXX
    else if (type === 'Shirt' && spriteIndex !== undefined) {
      wikiName = `Shirt${String(spriteIndex).padStart(3, '0')}`;
      // Intercept specific shirt issues
      if (spriteIndex === 194) wikiName = 'Shirt135';
    } 
    // 2. Weeds logic
    else if (wikiName === 'Weeds') {
      wikiName = `Weeds`; // This is fine
    }
    // 3. Remove colons and special characters that MediaWiki doesn't like in filenames
    else if (wikiName.includes(':')) {
      wikiName = wikiName.replace(/:/g, '');
    }
    // 4. Apostrophe handling - skip if it's our manual override Pirate's Locket
    else if (wikiName.includes("'") && !manualOverrides[key]) {
       // e.g. Haley's Lost Bracelet -> Haley's Lost Bracelet
       // Usually Wiki preserves apostrophe, but some might be removed.
       // We'll leave it for now and let the space replace handle it.
    }

    // Convert spaces to underscores
    wikiName = wikiName.replace(/ /g, '_');

    // 5. CamelCase handling for 1.6 Trinkets and similar items (MagicHairDye -> Magic_Hair_Dye)
    // Only if it doesn't already contain underscores
    if (!wikiName.includes('_') && !wikiName.includes('.')) {
        wikiName = wikiName.replace(/([a-z])([A-Z])/g, '$1_$2');
    }

    return {
      key, 
      type,
      wikiName,
      name: t[1].name
    };
  });

// Wrap https.get in a promise for async/await
function fetchUrl(url, options) {
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
           redirectUrl = new URL(redirectUrl, url).href;
        }
        resolve(fetchUrl(redirectUrl, options));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume(); // consume response data to free up memory
        reject(new Error(`Status Code: ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', err => reject(err));
  });
}

async function downloadImages() {
  console.log(`Menyiapkan ${items.length} gambar untuk pengecekan...`);
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const filePath = path.join(outputDir, `${item.type}_${item.key}.png`);
    
    // Skip if already exists
    if (fs.existsSync(filePath)) {
        skipCount++;
        // console.log(`[${i + 1}/${items.length}] ⏭️ Skip (Sudah ada) -> ${item.type}_${item.key}.png`);
        continue;
    }

    const extension = item.wikiName.includes('.') ? '' : '.png';
    console.log(`[${i + 1}/${items.length}] ⏳ Mendownload -> ${item.wikiName}${extension} ...`);

    try {
      const apiUrl = `https://stardewvalleywiki.com/mediawiki/api.php?action=query&titles=File:${encodeURIComponent(item.wikiName)}${extension}&prop=imageinfo&iiprop=url&format=json`;
      
      const apiResponse = await fetchUrl(apiUrl, {
        headers: {
          'User-Agent': 'StardewLocalEditorBot/2.0 (Fix Missing)',
          'Accept': 'application/json'
        }
      });
      
      const data = JSON.parse(apiResponse.body.toString());
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];

      if (pageId === "-1" || !pages[pageId].imageinfo || pages[pageId].imageinfo.length === 0) {
        console.log(`[${i + 1}/${items.length}] ❌ Gagal 404 -> ${item.wikiName}.png tidak ditemukan di Wiki`);
        failCount++;
        continue;
      }

      const actualImageUrl = pages[pageId].imageinfo[0].url;

      // Download the actual image
      const imageResponse = await fetchUrl(actualImageUrl, {
        headers: {
          'User-Agent': 'StardewLocalEditorBot/2.0 (Fix Missing)',
          'Referer': 'https://stardewvalleywiki.com/'
        }
      });

      fs.writeFileSync(filePath, imageResponse.body);
      console.log(`[${i + 1}/${items.length}] ✅ Sukses -> ${item.key}.png (dari ${item.wikiName})`);
      successCount++;
      
    } catch (error) {
      console.log(`[${i + 1}/${items.length}] ❌ Gagal Download -> ${item.key}.png: ${error.message}`);
      failCount++;
    }
    
    // Slight delay to be polite
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n🎉 PROSES SELESAI 🎉`);
  console.log(`✅ Berhasil Download: ${successCount}`);
  console.log(`⏭️ Di-skip (Sudah ada): ${skipCount}`);
  console.log(`❌ Gagal: ${failCount}`);
}

downloadImages();
