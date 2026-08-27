# Wasm/Extism Modder Guide

Suzu Save Editor supports heavy-duty plugins written in any language that compiles to WebAssembly (Wasm). We use **Extism** as our Wasm engine, which means you can write your plugins in Rust, Go, AssemblyScript, Python, C#, C++, and more!

This guide will show you how to write a Wasm plugin using **Rust** as an example, but you can use the respective Extism PDK (Plugin Development Kit) for your preferred language.

## Prerequisites
If you are following along with Rust:
1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Add the Wasm target: `rustup target add wasm32-unknown-unknown`

## The Extism Interface

Your Wasm plugin must export four specific functions. Suzu Save Editor will call these functions directly.
Notice the data types carefully: Extism passes strings and bytes across the Wasm boundary.

1. `metadata()` -> Returns a `String` (JSON metadata)
2. `detect(data: &[u8])` -> Returns a `String` (`"true"` or `"false"`)
3. `parse_to_json(data: &[u8])` -> Returns a `String` (Parsed JSON)
4. `json_to_binary(json_str: String)` -> Returns `Vec<u8>` (Binary Save File)

## Creating a Rust Plugin

Create a new Rust library:
```bash
cargo new --lib my_save_parser
cd my_save_parser
```

Update your `Cargo.toml` to build a dynamic C library and include the Extism PDK:
```toml
[package]
name = "my_save_parser"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
extism-pdk = "1.0.0"
serde_json = "1.0"
```

### Writing the Code (`src/lib.rs`)

```rust
use extism_pdk::*;
use serde_json::json;

// 1. Metadata Function
#[plugin_fn]
pub fn metadata() -> FnResult<String> {
    let meta = json!({
        "name": "Advanced Rust Parser",
        "version": "1.0.0",
        "author": "Modder Name",
        "description": "High-performance Wasm parser for complex save files."
    });
    
    Ok(meta.to_string())
}

// 2. Detect Function
#[plugin_fn]
pub fn detect(data: Vec<u8>) -> FnResult<String> {
    // Check if the file starts with our magic header "SAVE"
    if data.len() >= 4 && &data[0..4] == b"SAVE" {
        Ok("true".to_string())
    } else {
        Ok("false".to_string())
    }
}

// 3. Parse Function
#[plugin_fn]
pub fn parse_to_json(data: Vec<u8>) -> FnResult<String> {
    // Here you would do your complex binary parsing (e.g., using nom or binrw).
    // For this example, we'll just return mock data.
    
    let parsed_data = json!({
        "player_name": "Suzuya (Wasm)",
        "level": 99,
        "gold": 50000
    });

    Ok(parsed_data.to_string())
}

// 4. Encode Function
#[plugin_fn]
pub fn json_to_binary(json_str: String) -> FnResult<Vec<u8>> {
    // Parse the JSON string back into a manageable object
    // let modified_data: serde_json::Value = serde_json::from_str(&json_str)?;
    
    // Here you would reconstruct your binary file, encrypt it, 
    // calculate checksums, etc.
    
    let mut new_bytes = Vec::new();
    new_bytes.extend_from_slice(b"SAVE");
    
    // (Append rest of your binary data here)

    Ok(new_bytes)
}
```

## Building and Installing

1. Build your Wasm plugin:
```bash
cargo build --target wasm32-unknown-unknown --release
```

2. Your compiled plugin will be located at `target/wasm32-unknown-unknown/release/my_save_parser.wasm`.
3. Open Suzu Save Editor -> Settings -> Plugins, and click **Open Plugins Folder**.
4. Copy `my_save_parser.wasm` into that folder.
5. Click **Reload All Plugins** in the app.

Your high-performance Wasm plugin is now active!
