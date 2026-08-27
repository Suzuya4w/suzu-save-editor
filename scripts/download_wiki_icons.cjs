const fs = require('fs');
const https = require('https');
const path = require('path');

const content = fs.readFileSync('C:\\\\Users\\\\Administrator\\\\.gemini\\\\antigravity\\\\brain\\\\d48eb43b-e0c3-42a5-b16f-d70eb2021f05\\\\.system_generated\\\\steps\\\\724\\\\content.md', 'utf8');
const regex = /<img alt="([^"]+)" src="([^"]+)"/g;

const outDir = path.join(__dirname, 'public', 'stardew', 'wiki_icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let match;
while ((match = regex.exec(content)) !== null) {
  let name = match[1];
  let urlPath = match[2];
  if (urlPath.startsWith('/')) urlPath = 'https://stardewvalleywiki.com' + urlPath;
  
  if (!name.endsWith('.png')) continue;
  
  const dest = path.join(outDir, name);
  console.log(`Downloading ${name} from ${urlPath}`);
  
  https.get(urlPath, (res) => {
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${name}:`, err.message);
  });
}
