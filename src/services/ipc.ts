import { invoke } from '@tauri-apps/api/core';

export type EngineType = 
  | 'RpgMakerMv'
  | 'RpgMakerMz'
  | 'RenPy'
  | 'WolfRpg'
  | 'Kirikiri'
  | 'Naninovel'
  | 'UnityEs3'
  | 'RubyMarshal'
  | 'StandardJson'
  | 'Lcf'
  | 'UnrealEngine'
  | 'Godot'
  | 'GameMaker'
  | 'TyranoBuilder'
  | 'FlashLegacy'
  | 'CSharpXml'
  | 'StardewValley'
  | 'Unknown';

export interface StandardJson {
  engine_type: EngineType;
  parsed_variables: Record<string, any>;
  raw_payload?: any;
}

import { readFile, writeFile } from '@tauri-apps/plugin-fs';

/**
 * Opens a save file, routes it to the correct Rust parser, and returns the standardized JSON.
 * @param path Absolute path to the save file
 * @param activeProfileRules Optional rules from a selected profile (used for Wolf RPG binary mapping)
 */
export async function openSaveFile(path: string, activeProfileRules?: any[]): Promise<StandardJson> {
  try {
    if (path.startsWith('content://')) {
      const bytes = await readFile(path);
      const result = await invoke<StandardJson>('open_save_file_bytes', { path, bytes, activeProfileRules });
      return result;
    }
    const result = await invoke<StandardJson>('open_save_file', { path, activeProfileRules });
    return result;
  } catch (error) {
    console.error("Failed to open save file:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

/**
 * Writes the modified standard JSON back to the disk after merging and re-encoding.
 * Automatically triggers a backup in the Rust backend.
 * @param modifiedData The StandardJson object containing the user's edits
 * @param path Absolute path to the original save file
 * @param activeProfileRules Optional rules from a selected profile
 * @param activeProfileChecksums Optional checksum rules to apply before saving
 */
export async function writeSaveFile(modifiedData: StandardJson, path: string, activeProfileRules?: any[], activeProfileChecksums?: any[]): Promise<string> {
  try {
    if (path.startsWith('content://')) {
      const bytes = await invoke<number[]>('save_file_bytes', { path, json: modifiedData, activeProfileRules, activeProfileChecksums });
      
      try {
        // Use Native Android ContentResolver to write to SAF URIs (works without Shizuku for normal folders like Download)
        await invoke('write_content_uri_bytes', { uri: path, bytes });
        return path;
      } catch (err: any) {
        // Fallback to Shizuku if SAF write fails (e.g., Android/data restrictions on Android 14)
        const isShizukuAvailable = await invoke<boolean>('shizuku_is_available').catch(() => false);
        if (isShizukuAvailable && path.includes('primary%3A')) {
          const parts = path.split('primary%3A');
          if (parts.length > 1) {
            const realPath = '/sdcard/' + decodeURIComponent(parts[1]);
            
            // Write to a temp file in the app's standard data dir
            // Since we can't reliably get appCacheDir without importing, we can use a trick:
            // Write to a known writable location or just use base64 echo if it's small? No, save files can be large.
            // Let's use `appDataDir` from @tauri-apps/api/path
            const { appCacheDir, join } = await import('@tauri-apps/api/path');
            const tempDir = await appCacheDir();
            const tempFile = await join(tempDir, 'shizuku_temp_save.tmp');
            
            await writeFile(tempFile, new Uint8Array(bytes));
            
            try {
              await invoke('shizuku_push_file', { localPath: tempFile, remotePath: realPath });
            } finally {
              const { remove } = await import('@tauri-apps/plugin-fs');
              await remove(tempFile).catch(() => {});
            }
            return path;
          }
        }
        throw new Error(`Failed to open file: Permission denied writing ${path}. You may need Shizuku active.`);
      }
    }
    const result = await invoke<string>('write_save_file', { modifiedData, path, activeProfileRules, activeProfileChecksums });
    return result;
  } catch (error) {
    console.error("Failed to write save file:", error);
    const msg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
    throw new Error(msg);
  }
}

/**
 * Loads the game database mapping (Items, Weapons, etc.) from the given data directory.
 * @param folderPath Absolute path to the game's data/ folder
 */
export async function loadGameDatabase(folderPath: string): Promise<Record<string, Record<number, string>>> {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    const parseItemsArray = async (filename: string) => {
      try {
        const p = await join(folderPath, filename);
        const txt = await readTextFile(p);
        const arr = JSON.parse(txt);
        const map: Record<number, string> = {};
        if (Array.isArray(arr)) {
          arr.forEach(i => {
            if (i && i.id !== undefined && i.name) map[i.id] = i.name;
          });
        }
        return map;
      } catch { return {}; }
    };

    const parseSystem = async () => {
      try {
        const p = await join(folderPath, 'System.json');
        const txt = await readTextFile(p);
        const obj = JSON.parse(txt);
        const sMap: Record<number, string> = {};
        const vMap: Record<number, string> = {};
        if (obj.switches && Array.isArray(obj.switches)) {
          obj.switches.forEach((n: string, i: number) => { if (n) sMap[i] = n; });
        }
        if (obj.variables && Array.isArray(obj.variables)) {
          obj.variables.forEach((n: string, i: number) => { if (n) vMap[i] = n; });
        }
        return { switches: sMap, variables: vMap };
      } catch { return { switches: {}, variables: {} }; }
    };

    const finalDb: Record<string, Record<number, string>> = {};
    const items = await parseItemsArray('Items.json');
    const weapons = await parseItemsArray('Weapons.json');
    const armors = await parseItemsArray('Armors.json');
    const actors = await parseItemsArray('Actors.json');
    const skills = await parseItemsArray('Skills.json');
    const sys = await parseSystem();

    if (Object.keys(items).length) finalDb.items = items;
    if (Object.keys(weapons).length) finalDb.weapons = weapons;
    if (Object.keys(armors).length) finalDb.armors = armors;
    if (Object.keys(actors).length) finalDb.actors = actors;
    if (Object.keys(skills).length) finalDb.skills = skills;
    if (Object.keys(sys.switches).length) finalDb.switches = sys.switches;
    if (Object.keys(sys.variables).length) finalDb.variables = sys.variables;

    return finalDb;
  } catch (error) {
    console.error("Failed to load game database:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

/**
 * Saves a constructed profile locally.
 */
export async function saveLocalProfile(profile: any): Promise<string> {
  try {
    const result = await invoke<string>('save_local_profile', { profile });
    return result;
  } catch (error) {
    console.error("Failed to save local profile:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

/**
 * Syncs game profiles from the GitHub repository.
 */
export async function syncProfilesFromGithub(): Promise<number> {
  try {
    const result = await invoke<number>('sync_profiles_from_github');
    return result;
  } catch (error) {
    console.error("Failed to sync profiles from GitHub:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

/**
 * Loads profiles stored locally in the app data directory.
 */
export async function loadLocalProfiles(): Promise<any[]> {
  try {
    const result = await invoke<any[]>('load_local_profiles');
    return result;
  } catch (error) {
    console.error("Failed to load local profiles:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

/**
 * Deletes a profile stored locally by ID.
 */
export async function deleteLocalProfile(id: string): Promise<string> {
  try {
    const result = await invoke<string>('delete_local_profile', { id });
    return result;
  } catch (error) {
    console.error("Failed to delete local profile:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export interface DiffResult {
  offset: number;
  original_byte: number;
  modified_byte: number;
}

/**
 * Compares two files byte-by-byte and returns the differences.
 */
export async function compareFiles(pathA: string, pathB: string): Promise<DiffResult[]> {
  try {
    const result = await invoke<DiffResult[]>('compare_files', { pathA, pathB });
    return result;
  } catch (error) {
    console.error("Failed to compare files:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export interface DetectedGame {
  name: string;
  path: string;
  save_path: string | null;
}

/**
 * Lists available Lua scripts for custom parsing.
 */
export async function listScripts(): Promise<string[]> {
  try {
    const result = await invoke<string[]>('list_scripts');
    return result;
  } catch (error) {
    console.error("Failed to list scripts:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

/**
 * Automatically detects installed Steam games and their paths.
 */
export async function detectInstalledGames(): Promise<DetectedGame[]> {
  try {
    const result = await invoke<DetectedGame[]>('detect_installed_games');
    return result;
  } catch (error) {
    console.error("Failed to detect games:", error);
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }
}

export interface GameMetadata {
  title: string;
  alttitle: string | null;
  image_url: string | null;
  description: string | null;
  developer: string | null;
  publisher: string | null;
}

/**
 * Fetches game metadata from the backend with Multi-API fallback and caching.
 * @param query The game title or search query
 * @param cacheKey Optional specific cache key (usually the original filename)
 * @param forceRefresh If true, bypass local cache and fetch from API
 */
export async function fetchGameMetadata(query: string, cacheKey?: string, forceRefresh: boolean = false): Promise<GameMetadata | null> {
  try {
    const result = await invoke<GameMetadata | null>('fetch_game_metadata', { 
      query, 
      cache_key: cacheKey, 
      force_refresh: forceRefresh 
    });
    return result;
  } catch (error) {
    console.error("Failed to fetch game metadata:", error);
    // Graceful degradation on the frontend side as well
    return null;
  }
}

/**
 * Reverse Engineering Utilities
 */

export async function calculateEntropy(base64Data: string): Promise<number> {
  return await invoke<number>('calculate_entropy', { base64Data });
}

export async function extractStrings(base64Data: string, minLen: number = 4, showLetters: boolean = true, showDigits: boolean = true, showSymbols: boolean = true): Promise<string[]> {
  return await invoke<string[]>('extract_strings', { base64Data, minLen, showLetters, showDigits, showSymbols });
}

export async function xorDecrypt(base64Data: string, hexKey: string): Promise<string> {
  return await invoke<string>('xor_decrypt', { base64Data, hexKey });
}

export async function autoGuessXorKey(base64Data: string): Promise<string> {
  return await invoke<string>('auto_guess_xor_key', { base64Data });
}

export async function autoHealHeader(base64Data: string): Promise<string> {
  return await invoke<string>('auto_heal_header', { base64Data });
}

export async function extractUnityEs3Password(dllPath: string): Promise<string> {
  return await invoke<string>('extract_unity_es3_password', { dllPath });
}

export async function decompressPayload(base64Data: string, method: string): Promise<string> {
  return await invoke<string>('decompress_payload', { base64Data, method });
}


