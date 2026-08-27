const fs = require('fs');
const path = 'C:/Users/Administrator/AppData/Roaming/StardewValley/Saves/Deadmans_371726322/Deadmans_371726322';
let xml = fs.readFileSync(path, 'utf8');

xml = xml.split('<name>Iridium Axe</name><itemId>IridiumAxe</itemId>').join('<name>Iridium Axe</name><itemId>Axe</itemId>');
xml = xml.split('<enchantments xsi:type="ShavingEnchantment"><level>1</level></enchantments>').join('<enchantments><Enchantment xsi:type="ShavingEnchantment"><level>1</level></Enchantment></enchantments>');

fs.writeFileSync(path, xml);
console.log('Fixed save file!');
