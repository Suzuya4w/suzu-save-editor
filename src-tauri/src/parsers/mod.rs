#![allow(async_fn_in_trait)]
pub mod auto_detect;
pub mod csharp_xml;
pub mod database;
pub mod diff;
pub mod flash_sol;
pub mod gamemaker;
pub mod godot;
pub mod kirikiri;
pub mod metadata;
pub mod naninovel;
pub mod profiles;
pub mod renpy;
pub mod reverse_engineering;
pub mod rpgmv;
pub mod ruby_marshal;
pub mod scripting;
pub mod standard_json;
pub mod tyrano;
pub mod unity_es3;
pub mod unity_prefs;
pub mod unreal;
pub mod wolf_rpg;
pub mod tmx_parser;
pub mod twine;
pub mod wasm_engine;
pub mod plugin_manager;
pub mod ags;
pub mod nbt;
pub mod construct;
pub mod terraria;

use crate::models::ipc::StandardJson;
use std::path::Path;




#[async_trait::async_trait]
pub trait SaveEngineDecoder: Send + Sync {
    fn engine_type(&self) -> crate::models::ipc::EngineType;

    async fn detect(&self, path: &Path, raw_bytes: &[u8]) -> Result<bool, String>;

    async fn decode(&self, path: &Path, raw_data: &[u8]) -> Result<Vec<u8>, String>;

    async fn parse_to_standard_json(
        &self,
        data: &[u8],
        profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<StandardJson, String>;

    async fn encode(
        &self,
        standard_json: &StandardJson,
        original_file_path: &Path,
        profile_rules: Option<Vec<crate::parsers::profiles::ProfileRule>>,
    ) -> Result<Vec<u8>, String>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parsers_module_compiles() {
        assert!(true);
    }
}
