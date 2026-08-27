# Kaitai Struct Modder Guide

Suzu Save Editor fully supports parsers built with **Kaitai Struct**! However, because Suzu Save Editor loads plugins dynamically at runtime, you cannot directly drop a `.ksy` file into the `scripts/` folder.

Instead, you use Kaitai Struct to generate a parser in your favorite language (like Rust, JavaScript, or C++), wrap it in our Extism Wasm interface, and compile it into a `.wasm` plugin.

This gives you the best of both worlds: The incredibly fast, declarative parsing of Kaitai Struct, combined with the safety and speed of WebAssembly.

## The Workflow

1. Write your `.ksy` (Kaitai Struct YAML) file defining the save file format.
2. Compile the `.ksy` file to your target language (e.g., Rust) using the `kaitai-struct-compiler`.
3. Create a new Extism Wasm plugin (see `WASM_EXTISM_GUIDE.md`).
4. Import the generated Kaitai code into your Wasm plugin.
5. In your Wasm `parse_to_json` function, use the Kaitai parser to read the bytes, and serialize the resulting object to JSON.

## Example (Using Rust)

Let's assume you have a save file that stores a player's name and level.

### 1. Create the `.ksy` file (`save_data.ksy`)
```yaml
meta:
  id: save_data
  endian: le
seq:
  - id: magic
    contents: "SAVE"
  - id: level
    type: u2
  - id: name_len
    type: u1
  - id: player_name
    type: str
    size: name_len
    encoding: UTF-8
```

### 2. Generate the Rust Code
Run the compiler:
```bash
kaitai-struct-compiler -t rust save_data.ksy
```
This generates `save_data.rs`.

### 3. Wrap it in Extism
In your Rust Extism plugin (`src/lib.rs`), import the Kaitai runtime and your generated struct:

```rust
use extism_pdk::*;
use kaitai::KaitaiStream;
use serde_json::json;

// Import the generated code
mod save_data;
use save_data::SaveData;

#[plugin_fn]
pub fn detect(data: Vec<u8>) -> FnResult<String> {
    if data.len() >= 4 && &data[0..4] == b"SAVE" {
        Ok("true".to_string())
    } else {
        Ok("false".to_string())
    }
}

#[plugin_fn]
pub fn parse_to_json(data: Vec<u8>) -> FnResult<String> {
    // Parse the raw bytes using the Kaitai Struct generated parser!
    let parsed = SaveData::new(data, &mut KaitaiStream::new(&data)).unwrap();
    
    // Map the Kaitai struct to JSON for the UI
    let ui_data = json!({
        "player_name": parsed.player_name,
        "level": parsed.level
    });

    Ok(ui_data.to_string())
}
```

### 4. Important Note on Encoding / Saving
Kaitai Struct is currently read-only in many target languages. It generates code to *parse* binary data, but not necessarily to *write* it back (serialization is an ongoing project in the Kaitai ecosystem). 

To implement the `json_to_binary` function for saving data, you will currently need to manually construct the byte array in your Wasm plugin based on the JSON data provided by the UI.
