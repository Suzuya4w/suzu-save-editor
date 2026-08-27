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
    // Membersihkan karakter ilegal untuk nama file Windows
    key: String(t[1]._key || t[0]).replace(/[<>:"\/\\|?*]+/g, ''), 
    wikiName: t[1].name.replace(/ /g, '_')
  }));

async function downloadImages() {
  console.log(`Menyiapkan ${items.length} gambar untuk di-download...`);
  
  for (let i = 0; i < 5; i++) { // JUST TEST FIRST 5
    const item = items[i];
    const filePath = path.join(outputDir, `${item.key}.png`);
    
    // Skip jika sudah ada
    if (fs.existsSync(filePath)) {
        console.log(`[${i + 1}/${items.length}] ⏭️ Skip (Sudah ada) -> ${item.key}.png`);
        continue;
    }

    try {
      const url = `https://stardewvalleywiki.com/Special:Filepath/${encodeURIComponent(item.wikiName)}.png`;
      
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'StardewLocalEditorBot/1.0 (Personal Use)',
          'Accept': 'image/webp,image/apng,image/png,image/*,*/*;q=0.8',
          'Referer': 'https://stardewvalleywiki.com/'
        }
      });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        console.log(`[${i + 1}/${items.length}] ✅ Sukses -> ${item.key}.png`);
      } else if (response.status === 404) {
        console.log(`[${i + 1}/${items.length}] ❌ Gagal 404 -> ${item.wikiName}.png tidak ada di Wiki`);
      } else {
        console.log(`[${i + 1}/${items.length}] ⚠️ Gagal ${response.status} -> Ditolak oleh server`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${items.length}] ⚠️ Error Koneksi -> ${item.key}.png`);
    }

    // Jeda 300ms agar tidak dicurigai sebagai serangan DDoS
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log("✨ Full proses download selesai!");
}

downloadImages();
