# Modder Guide: Creating Custom Parsers for Suzu Save Editor

Welcome to the Suzu Save Editor modding guide! This application is designed with a powerful plugin engine, allowing the community to easily create parsers for new games using Lua or WebAssembly.

## The Plugin System

Suzu Save Editor does not use complex folder structures or separate JSON profiles. Instead, a single script handles everything: identifying the file, providing metadata, reading (parsing) the data, and writing (encoding) it back.

You can write your plugins in **Lua** (great for simple scripts and beginners) or **Wasm/Extism** (great for heavy-duty parsing in Rust, Go, JS, etc.).
- For Lua, keep reading below.
- For Wasm/Extism, see the [WASM Extism Guide](file:///c:/saveEditor/suzu-save-editor/docs/modding/WASM_EXTISM_GUIDE.md).
- Want to use **Kaitai Struct**? See the [Kaitai Struct Guide](file:///c:/saveEditor/suzu-save-editor/docs/modding/KAITAI_STRUCT_GUIDE.md).

### Lua Plugin Architecture

Your Lua parser must define four global functions:
- `metadata()`
- `detect(bytes)`
- `parse_to_json(bytes)`
- `json_to_binary(json_table)`

### 1. `metadata()`
This function must return a valid JSON string containing the plugin's metadata. The application uses this to display your plugin in the Settings menu.

```lua
function metadata()
    return [[{
        "name": "My Save Parser",
        "version": "1.0.0",
        "author": "Modder Name",
        "description": "Parser for XYZ Engine saves"
    }]]
end
```

### 2. `detect(bytes)`
When a user opens a save file, the application asks all enabled plugins if they support this file. This function receives the raw file bytes (as a Lua table of integers/bytes) and should return `true` if it recognizes the file format (e.g., by checking magic headers).

```lua
function detect(bytes)
    -- Check if first 4 bytes match a magic string "MAGC"
    -- Note: 'bytes' is an array of byte values (0-255)
    return bytes[1] == 77 and bytes[2] == 65 and bytes[3] == 71 and bytes[4] == 67
end
```

### 3. `parse_to_json(bytes)`
If `detect` returns true, this function is called. It receives the raw file bytes and must return a Lua table representing the parsed data. The application will convert this table into JSON to generate the UI.

```lua
function parse_to_json(bytes)
    -- Extract values from the byte array
    return {
        player_name = "Suzuya",
        level = 50
    }
end
```

### 4. `json_to_binary(json_table)`
When the user clicks "Save", the modified data is passed back to this function as a Lua table. You must reconstruct the save file's binary format and return it as an array of bytes.

```lua
function json_to_binary(json_table)
    -- Reconstruct the save file based on the modified json_table
    local new_bytes = {77, 65, 71, 67} -- "MAGC"
    -- ... write actual data ...
    return new_bytes
end
```

## Installation & Testing

1. Create your Lua script (e.g., `my_parser.lua`).
2. Place the file inside the Suzu Save Editor scripts directory. You can easily find this by opening the app, going to Settings -> Plugins, and clicking the **Open Plugins Folder** icon.
3. In the Settings -> Plugins menu, click the **Reload All Plugins** button.
4. Enable your plugin and try opening a save file!

Check out `example-parser.lua` for a complete example.
