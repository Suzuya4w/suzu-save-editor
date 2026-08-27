import { type as getOsType } from '@tauri-apps/plugin-os';
import { homeDir } from '@tauri-apps/api/path';

/**
 * Resolves the absolute path to a Stardew Valley save folder/file based on the current OS.
 * @param saveFolderName The name of the save folder, e.g., "Suzuya_123456789"
 * @param fileName Optional specific file name to target, defaults to "SaveGameInfo"
 * @returns The absolute path string to the save file
 */
export async function getStardewSavePath(saveFolderName: string, fileName: string = 'SaveGameInfo'): Promise<string> {
  const os = await getOsType();

  switch (os) {
    case 'windows': {
      // In Windows, saves are usually located in %appdata%\StardewValley\Saves
      const home = await homeDir();
      return `${home}\\AppData\\Roaming\\StardewValley\\Saves\\${saveFolderName}\\${fileName}`;
    }
    case 'linux': {
      // In Linux, it's in ~/.config/StardewValley/Saves
      const home = await homeDir();
      return `${home}/.config/StardewValley/Saves/${saveFolderName}/${fileName}`;
    }
    case 'macos': {
      // In macOS, it's in ~/.config/StardewValley/Saves
      const home = await homeDir();
      return `${home}/.config/StardewValley/Saves/${saveFolderName}/${fileName}`;
    }
    case 'android': {
      // INI LOKASI MUTLAK STARDEW VALLEY DI ANDROID:
      return `/data/data/com.chucklefish.stardewvalley/files/saves/${saveFolderName}/${fileName}`;
    }
    default:
      throw new Error(`OS ${os} belum di-support untuk Stardew Valley!`);
  }
}
