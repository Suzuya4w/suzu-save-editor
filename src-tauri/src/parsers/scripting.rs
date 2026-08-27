use mlua::{HookTriggers, Lua, LuaSerdeExt, StdLib};
use serde_json::Value;
use std::fs;
use std::path::Path;

pub struct ScriptParser;

impl ScriptParser {
    fn create_sandboxed_lua() -> Result<Lua, String> {
        let safe_libs = StdLib::TABLE | StdLib::STRING | StdLib::MATH;
        let lua = Lua::new_with(safe_libs, mlua::LuaOptions::default())
            .map_err(|e| e.to_string())?;

        // 5 million instructions ~ a few seconds depending on CPU, prevents infinite loops.
        lua.set_hook(
            HookTriggers::new().every_nth_instruction(5_000_000),
            |_lua, _debug| {
                Err(mlua::Error::RuntimeError(
                    "Execution Timeout: Script ran for too long (Infinite Loop Detected)".into(),
                ))
            },
        );

        Ok(lua)
    }

    pub async fn metadata(script_path: &Path) -> Result<String, String> {
        let script_content = fs::read_to_string(script_path).map_err(|e| e.to_string())?;
        tokio::task::spawn_blocking(move || {
            let lua = Self::create_sandboxed_lua()?;
            lua.load(&script_content).exec().map_err(|e| e.to_string())?;

            let func: mlua::Function = lua
                .globals()
                .get("metadata")
                .map_err(|_| "Function metadata not found".to_string())?;
            
            let result: String = func.call(()).map_err(|e| e.to_string())?;
            Ok(result)
        }).await.map_err(|e| e.to_string())?
    }

    pub async fn detect(script_path: &Path, chunk: &[u8]) -> Result<bool, String> {
        let script_content = fs::read_to_string(script_path).map_err(|e| e.to_string())?;
        let data = chunk.to_vec();
        
        tokio::task::spawn_blocking(move || {
            let lua = Self::create_sandboxed_lua()?;
            lua.load(&script_content).exec().map_err(|e| e.to_string())?;

            let func: mlua::Function = lua
                .globals()
                .get("detect")
                .map_err(|_| "Function detect not found".to_string())?;
            
            let result: bool = func.call(data).map_err(|e| e.to_string())?;
            Ok(result)
        }).await.map_err(|e| e.to_string())?
    }

    pub async fn parse_to_json(script_path: &Path, data: &[u8]) -> Result<Value, String> {
        let script_content = fs::read_to_string(script_path).map_err(|e| e.to_string())?;
        let data_vec = data.to_vec();

        tokio::task::spawn_blocking(move || {
            let lua = Self::create_sandboxed_lua()?;
            lua.load(&script_content).exec().map_err(|e| e.to_string())?;

            let func: mlua::Function = lua
                .globals()
                .get("parse_to_json")
                .map_err(|_| "Function parse_to_json not found".to_string())?;
            
            let result: mlua::Value = func.call(data_vec).map_err(|e| e.to_string())?;

            let parsed_variables: Value = lua
                .from_value(result)
                .map_err(|e| format!("Failed to serialize script output: {}", e))?;

            Ok(parsed_variables)
        }).await.map_err(|e| e.to_string())?
    }

    pub async fn json_to_binary(script_path: &Path, json: &Value) -> Result<Vec<u8>, String> {
        let script_content = fs::read_to_string(script_path).map_err(|e| e.to_string())?;
        let json_clone = json.clone();

        tokio::task::spawn_blocking(move || {
            let lua = Self::create_sandboxed_lua()?;
            lua.load(&script_content).exec().map_err(|e| e.to_string())?;

            let func: mlua::Function = lua
                .globals()
                .get("json_to_binary")
                .map_err(|_| "Function json_to_binary not found".to_string())?;
            
            let lua_value = lua.to_value(&json_clone).map_err(|e| e.to_string())?;
            let result: Vec<u8> = func.call(lua_value).map_err(|e| e.to_string())?;

            Ok(result)
        }).await.map_err(|e| e.to_string())?
    }
}
