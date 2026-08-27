import { createEffect, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen, Event } from '@tauri-apps/api/event';
import { useHexStore, setRawPayload } from '../store/hexStore';
import { updateValue, editorState } from '../store/editorStore';

interface McpRequest {
  uuid: string;
  action: string;
  args: any;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

const normalizePath = (p: string) => p.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');

const resolvePath = (obj: any, path: string) => {
  if (!path || path === '') return obj;
  const normalized = normalizePath(path);
  return normalized.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const getSkeleton = (obj: any): string[] => {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return [`[Array of ${obj.length} items]`];
  }
  return Object.keys(obj).map(key => {
    const val = obj[key];
    const type = Array.isArray(val) ? 'Array' : (val === null ? 'Null' : typeof val);
    return `${key} (${type})`;
  });
};

const searchJsonRecursive = (
  obj: any, 
  keyword: string, 
  target: 'key' | 'value', 
  currentPath: string = '', 
  results: string[] = [], 
  maxResults: number = 30
) => {
  if (results.length >= maxResults) return;
  if (!obj || typeof obj !== 'object') return;

  const lowerKeyword = keyword.toLowerCase();

  for (const key of Object.keys(obj)) {
    if (results.length >= maxResults) break;
    
    const val = obj[key];
    const nextPath = currentPath ? `${currentPath}.${key}` : key;

    if (target === 'key' && key.toLowerCase().includes(lowerKeyword)) {
      results.push(nextPath);
    } else if (target === 'value' && val !== null && val !== undefined) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        if (String(val).toLowerCase().includes(lowerKeyword)) {
          results.push(nextPath);
        }
      }
    }

    if (typeof val === 'object' && val !== null) {
      searchJsonRecursive(val, keyword, target, nextPath, results, maxResults);
    }
  }
};

export const McpBridge = (props: { activeTab: string }) => {
  const hexStore = useHexStore();

  const getUniversalTools = (): ToolDefinition[] => [
    {
      name: "get_save_skeleton",
      description: "Gets the top-level keys and their types of the parsed JSON save data. Optionally drill down into nested objects by providing a path.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Optional dot-notation path (e.g. 'SaveGame.player') to inspect a specific sub-object." } }
      }
    },
    {
      name: "search_json_path",
      description: "Recursively searches the save JSON for a specific keyword in either keys or values. Returns up to 30 matching dot-notation paths.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "The string to search for." },
          target: { type: "string", enum: ["key", "value"], description: "Whether to search property names ('key') or primitive values ('value')." }
        },
        required: ["keyword", "target"]
      }
    },
    {
      name: "read_value_at_path",
      description: "Reads the value at a specific dot-notation path in the JSON.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "The dot-notation path (e.g. 'actors[0].hp' or 'party.gold')." } },
        required: ["path"]
      }
    },
    {
      name: "set_value_at_path",
      description: "Sets or overwrites the value at a specific dot-notation path in the JSON. Immediately updates the UI.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "The dot-notation path." },
          value: { description: "The new value to set." }
        },
        required: ["path", "value"]
      }
    },
    {
      name: "add_json_item",
      description: "Appends a new item to an array at a specific dot-notation path.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "The dot-notation path to the array." },
          item: { description: "The item to append." }
        },
        required: ["path", "item"]
      }
    },
    {
      name: "delete_json_key",
      description: "Deletes a key from an object or an item from an array at a specific dot-notation path.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "The dot-notation path to the key or index to delete." }
        },
        required: ["path"]
      }
    },
    {
      name: "create_save_backup",
      description: "Creates a backup of the currently loaded save file in the backend.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "restore_save_backup",
      description: "Restores a backup over the currently loaded save file.",
      inputSchema: {
        type: "object",
        properties: {
          backup_path: { type: "string", description: "The path of the backup file to restore." }
        },
        required: ["backup_path"]
      }
    }
  ];

  const getStardewTools = (): ToolDefinition[] => [
    {
      name: "get_stardew_player_info",
      description: "Gets the basic player info (name, money, stamina).",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "update_stardew_money",
      description: "Updates the player's money.",
      inputSchema: {
        type: "object",
        properties: { amount: { type: "number", description: "The new amount of money" } },
        required: ["amount"]
      }
    },
    {
      name: "spawn_stardew_item",
      description: "Spawns an item directly into the player's inventory.",
      inputSchema: {
        type: "object",
        properties: { 
          itemId: { type: "string", description: "The item ID (e.g. '221')" },
          amount: { type: "number", description: "Quantity" }
        },
        required: ["itemId", "amount"]
      }
    }
  ];

  const getRpgMakerTools = (): ToolDefinition[] => [
    {
      name: "get_rpg_maker_gold",
      description: "Gets the party's current gold.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "update_rpg_maker_gold",
      description: "Updates the party's current gold.",
      inputSchema: {
        type: "object",
        properties: { amount: { type: "number", description: "The new gold amount" } },
        required: ["amount"]
      }
    },
    {
      name: "add_rpg_maker_item",
      description: "Adds an item to the party's inventory.",
      inputSchema: {
        type: "object",
        properties: { 
          itemId: { type: "number", description: "The item ID" },
          amount: { type: "number", description: "Quantity to add" }
        },
        required: ["itemId", "amount"]
      }
    }
  ];

  const getHexTools = (): ToolDefinition[] => [
    {
      name: "search_hex_pattern",
      description: "Searches the hex file for a pattern (e.g. 'FF A1 ?? 00').",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Space separated hex strings with ?? for wildcard." }
        },
        required: ["pattern"]
      }
    },
    {
      name: "read_hex_segment",
      description: "Reads a chunk of raw hex data at a specific offset.",
      inputSchema: {
        type: "object",
        properties: {
          offset: { type: "number", description: "The starting byte offset" },
          length: { type: "number", description: "Number of bytes to read" }
        },
        required: ["offset", "length"]
      }
    },
    {
      name: "write_hex_segment",
      description: "Writes a chunk of raw hex data at a specific offset.",
      inputSchema: {
        type: "object",
        properties: {
          offset: { type: "number", description: "The starting byte offset" },
          hex_string: { type: "string", description: "The hex string to write (e.g. 'FF A0 2B')" }
        },
        required: ["offset", "hex_string"]
      }
    },
    {
      name: "convert_data_type",
      description: "Converts numbers to Little Endian / Big Endian hex safely.",
      inputSchema: {
        type: "object",
        properties: {
          value: { type: "number", description: "The decimal value to convert" },
          target_endianness: { type: "string", enum: ["i32_le", "i16_le", "u32_le"], description: "The target type" }
        },
        required: ["value", "target_endianness"]
      }
    },
    {
      name: "get_active_diff_results",
      description: "Gets the byte-by-byte differences between the currently loaded save file and the comparison file uploaded by the user. Supports pagination to prevent token exhaustion.",
      inputSchema: {
        type: "object",
        properties: {
          start_offset: { type: "number", description: "The starting index (array position, NOT byte offset) of the diffs to return. Default: 0" },
          limit: { type: "number", description: "Maximum number of diffs to return. Max: 250. Default: 250" }
        }
      }
    }
  ];

  const activeEngine = () => editorState.saveData?.engine_type || "Unknown";

  const getDynamicToolsList = () => {
    if (props.activeTab === 'hex' || activeEngine() === 'Unknown') {
      return getHexTools();
    }

    let tools = [...getUniversalTools()];

    switch (activeEngine()) {
      case 'StardewValley':
      case 'StandardJson': 
        tools.push(...getStardewTools());
        break;
      case 'RpgMakerMv':
      case 'RubyMarshal':
        tools.push(...getRpgMakerTools());
        break;
    }

    return tools;
  };

  createEffect(() => {
    // Only invoke on props/activeEngine change if actually needed, 
    // or just pass them here so solid tracks it:
    props.activeTab;
    activeEngine();
    invoke('mcp_notify_event', { eventName: 'tools/list_changed' }).catch(console.error);
  });

  createEffect(() => {
    const unlistenPromise = listen<McpRequest>('mcp_request', async (event: Event<McpRequest>) => {
      const { uuid, action, args } = event.payload;
      let responseData: any = { error: "Unknown action" };

      try {
        if (action === "get_tools_list") {
          responseData = getDynamicToolsList();
        } 
        else if (action === "get_save_skeleton") {
          const rootObj = editorState.saveData?.parsed_variables;
          if (!rootObj) {
            responseData = { error: "No JSON save file loaded" };
          } else {
            const targetObj = resolvePath(rootObj, args?.path || "");
            responseData = { 
              path: args?.path || "[Root]",
              skeleton: getSkeleton(targetObj) 
            };
          }
        }
        else if (action === "search_json_path") {
          const rootObj = editorState.saveData?.parsed_variables;
          if (!rootObj) {
            responseData = { error: "No JSON save file loaded" };
          } else {
            const results: string[] = [];
            searchJsonRecursive(rootObj, args.keyword, args.target, "", results, 30);
            responseData = { results };
          }
        }
        else if (action === "read_value_at_path") {
          const rootObj = editorState.saveData?.parsed_variables;
          if (!rootObj) {
            responseData = { error: "No JSON save file loaded" };
          } else {
            const val = resolvePath(rootObj, args.path);
            responseData = { path: args.path, value: val };
          }
        }
        else if (action === "set_value_at_path") {
          const rootObj = editorState.saveData?.parsed_variables;
          if (!rootObj) {
            responseData = { error: "No JSON save file loaded" };
          } else {
            updateValue(normalizePath(args.path), args.value);
            responseData = { success: true, path: args.path, value: args.value };
          }
        }
        else if (action === "get_stardew_player_info") {
          const SaveGame = editorState.saveData?.parsed_variables?.SaveGame;
          if (SaveGame) {
            responseData = {
              name: SaveGame.player?.name,
              money: SaveGame.player?.money,
              stamina: SaveGame.player?.stamina,
              maxStamina: SaveGame.player?.maxStamina,
              health: SaveGame.player?.health,
              totalEarnings: SaveGame.player?.totalMoneyEarned
            };
          } else {
            responseData = { error: "No Stardew Valley save loaded" };
          }
        }
        else if (action === "update_stardew_money") {
          updateValue('SaveGame.player.money', args.amount);
          responseData = { success: true, amount: args.amount };
        }
        else if (action === "spawn_stardew_item") {
          const SaveGame = editorState.saveData?.parsed_variables?.SaveGame;
          if (SaveGame) {
             const inventory = SaveGame.player?.items?.Item || [];
             const newItem = {
                "@xsi:type": "Object",
                "isLostItem": "false",
                "category": "-2",
                "hasBeenInInventory": "true",
                "name": "Spawned Item",
                "parentSheetIndex": args.itemId,
                "itemId": args.itemId,
                "stack": String(args.amount || 1)
             };
             const newArray = [...inventory];
             const emptyIndex = newArray.findIndex((i: any) => !i || i === "" || i["@xsi:nil"] === "true" || i["@_xsi:nil"] === "true" || Object.keys(i).length === 0);
             if (emptyIndex !== -1) {
                newArray[emptyIndex] = newItem;
             } else {
                newArray.push(newItem);
             }
             updateValue('SaveGame.player.items.Item', newArray);
             responseData = { success: true, message: `Spawned ${args.amount} of ${args.itemId}` };
          } else {
             responseData = { error: "No Stardew Valley save loaded" };
          }
        }
        else if (action === "read_hex_segment") {
          const payload = hexStore.rawPayload;
          if (payload) {
             const chunk = payload.slice(args.offset, args.offset + args.length);
             const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
             responseData = { hex };
          } else {
             responseData = { error: "No Hex file loaded" };
          }
        }
        else if (action === "write_hex_segment") {
          const payload = hexStore.rawPayload;
          if (payload) {
             const newPayload = new Uint8Array(payload);
             const bytes = args.hex_string.split(' ').map((h: string) => parseInt(h, 16));
             newPayload.set(bytes, args.offset);
             setRawPayload(newPayload);
             responseData = { success: true };
          } else {
             responseData = { error: "No Hex file loaded" };
          }
        }
        else if (action === "convert_data_type") {
          let hex = "";
          if (args.target_endianness === "i32_le") {
            const buf = new ArrayBuffer(4);
            new DataView(buf).setInt32(0, args.value, true);
            hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
          }
          responseData = { hex };
        }
        else if (action === "get_active_diff_results") {
          const allDiffs = hexStore.diffs;
          if (!allDiffs || allDiffs.length === 0) {
            responseData = { error: "No diff results available. Ask the user to load a second file and run the diff tool." };
          } else {
            const startOffset = args?.start_offset || 0;
            const limit = Math.min(args?.limit || 250, 250);
            
            const diffsSlice = allDiffs.slice(startOffset, startOffset + limit);
            
            responseData = {
              file_a_name: editorState.filePath ? editorState.filePath.split(/[/\\]/).pop() : "Unknown",
              file_b_name: hexStore.diffFileB ? hexStore.diffFileB.split(/[/\\]/).pop() : "Unknown",
              total_diffs_found: allDiffs.length,
              showing_count: diffsSlice.length,
              truncated: startOffset + limit < allDiffs.length,
              hint_for_ai: startOffset + limit < allDiffs.length ? "Terlalu banyak diff. Minta user mempersempit aksi di dalam game, atau gunakan parameter 'start_offset' untuk bergeser ke halaman berikutnya." : "",
              diffs: diffsSlice
            };
          }
        }
        else if (action === "add_json_item") {
          const rootObj = editorState.saveData?.parsed_variables;
          if (!rootObj) {
            responseData = { error: "No JSON save file loaded" };
          } else {
            const arr = resolvePath(rootObj, args.path);
            if (Array.isArray(arr)) {
              updateValue(normalizePath(args.path), [...arr, args.item]);
              responseData = { success: true };
            } else {
              responseData = { error: "Target is not an array" };
            }
          }
        }
        else if (action === "delete_json_key") {
          const rootObj = editorState.saveData?.parsed_variables;
          if (!rootObj) {
            responseData = { error: "No JSON save file loaded" };
          } else {
            const parts = normalizePath(args.path).split('.');
            const keyToRemove = parts.pop()!;
            const parentPath = parts.join('.');
            const parent = parentPath ? resolvePath(rootObj, parentPath) : rootObj;
            
            if (Array.isArray(parent)) {
              const idx = parseInt(keyToRemove, 10);
              const newArr = [...parent];
              newArr.splice(idx, 1);
              updateValue(parentPath, newArr);
              responseData = { success: true };
            } else if (parent && typeof parent === 'object') {
              const newObj = { ...parent };
              delete newObj[keyToRemove];
              if (parentPath) {
                updateValue(parentPath, newObj);
              } else {
                updateValue('', newObj); 
              }
              responseData = { success: true };
            } else {
              responseData = { error: "Invalid path" };
            }
          }
        }
        else if (action === "create_save_backup") {
          if (!editorState.filePath) {
            responseData = { error: "No file is currently loaded" };
          } else {
            const backupPath = await invoke<string>('mcp_create_backup', { path: editorState.filePath });
            responseData = { success: true, backup_path: backupPath };
          }
        }
        else if (action === "restore_save_backup") {
          if (!editorState.filePath) {
            responseData = { error: "No file is currently loaded" };
          } else {
            await invoke('mcp_restore_backup', { targetPath: editorState.filePath, backupPath: args.backup_path });
            // Since reload depends on the original engine parser, we trigger it via open_save_file instead of load_save_file 
            // open_save_file runs through the correct decoder, whereas load_save_file only reads raw JSON.
            // Oh wait, load_save_file might just read the JSON. If it's hex or other engine, we must use open_save_file.
            await invoke<any>('open_save_file', { path: editorState.filePath, activeProfileRules: null });
            // State update is handled inside Rust which pushes to SharedSaveState, but we also might need to update frontend state.
            // Wait, open_save_file returns the StandardJson. We should just do nothing, or rely on a standard reload event.
            // Let's just return success, the user can hit reload if needed, but we can try to emit a global reload.
            // For now, returning success is enough. AI can tell user "Please reload".
            responseData = { success: true, message: "Backup restored successfully on disk. Please tell the user to reload the file in the app if they want to see changes." };
          }
        }
        else if (action === "search_hex_pattern") {
          const payload = hexStore.rawPayload;
          if (payload) {
             let binary = '';
             const bytes = new Uint8Array(payload);
             const len = bytes.byteLength;
             for (let i = 0; i < len; i++) {
                 binary += String.fromCharCode(bytes[i]);
             }
             const base64Data = btoa(binary);
             const results = await invoke<number[]>('mcp_scan_pattern', { base64Data, pattern: args.pattern });
             responseData = { offsets: results };
          } else {
             responseData = { error: "No Hex file loaded" };
          }
        }
        else if (action === "get_rpg_maker_gold") {
          const party = resolvePath(editorState.saveData?.parsed_variables, 'party');
          if (party) {
            responseData = { gold: party._gold !== undefined ? party._gold : (party.gold || 0) };
          } else {
            responseData = { error: "Party data not found" };
          }
        }
        else if (action === "update_rpg_maker_gold") {
          const party = resolvePath(editorState.saveData?.parsed_variables, 'party');
          if (party) {
            const key = party._gold !== undefined ? 'party._gold' : 'party.gold';
            updateValue(key, args.amount);
            responseData = { success: true, amount: args.amount };
          } else {
            responseData = { error: "Party data not found" };
          }
        }
        else if (action === "add_rpg_maker_item") {
          const party = resolvePath(editorState.saveData?.parsed_variables, 'party');
          if (party && party._items) {
             const items = { ...party._items };
             items[String(args.itemId)] = (items[String(args.itemId)] || 0) + args.amount;
             updateValue('party._items', items);
             responseData = { success: true };
          } else {
             responseData = { error: "Party items not found" };
          }
        }
      } catch (err: any) {
        responseData = { error: err.message };
      }

      invoke('mcp_respond', { uuid, payload: responseData }).catch(console.error);
    });

    onCleanup(() => {
      unlistenPromise.then(unlisten => unlisten());
    });
  });

  return null;
};
