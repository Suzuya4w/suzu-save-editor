const fs = require('fs');
const path = require('path');

const itemInfoRaw = require('./src/data/stardew/iteminfo.json'); 
const outputDir = path.join(__dirname, 'public', 'items');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const items = itemInfoRaw
  .filter(t => t && t[1] && t[1].name)
  .map(t => ({
    key: String(t[1]._key || t[0]),
    wikiName: t[1].name.replace(/ /g, '_')
  }));

async function downloadImages() {
  console.log(`Menyiapkan ${items.length} gambar untuk di-download...`);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const filePath = path.join(outputDir, `${item.key}.png`);
    
    if (fs.existsSync(filePath)) {
        console.log(`[${i + 1}/${items.length}] ⏭️ Skip (Sudah ada) -> ${item.key}.png`);
        continue;
    }

    try {
      const url = `https://stardewvalleywiki.com/Special:Filepath/${encodeURIComponent(item.wikiName)}.png`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/png,image/webp,image/apng,*/*;q=0.8'
        }
      });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        console.log(`[${i + 1}/${items.length}] ✅ Sukses -> ${item.key}.png (${item.wikiName}.png)`);
      } else {
        console.log(`[${i + 1}/${items.length}] ❌ Gagal ${response.status} -> ${item.wikiName}.png tidak ada di Wiki`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${items.length}] ⚠️ Error Koneksi -> ${item.key}.png`);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log("✨ Proses download selesai!");
}

downloadImages();
