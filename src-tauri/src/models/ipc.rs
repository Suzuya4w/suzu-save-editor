use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum EngineType {
    RpgMakerMv,
    RpgMakerMz,
    RenPy,
    RubyMarshal,
    StandardJson,
    UnityEs3,
    WolfRpg,
    Kirikiri,
    Naninovel,
    UnrealEngine,
    Godot,
    GameMaker,
    TyranoBuilder,
    FlashLegacy,
    CSharpXml,
    Twine,
    Ags,
    Nbt,
    Construct,
    Terraria,
    LuaParser(String),
    Unknown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StandardJson {
    pub engine_type: EngineType,
    pub parsed_variables: Value,
    pub raw_payload: Option<Value>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_standard_json_serialization() {
        let std_json = StandardJson {
            engine_type: EngineType::RpgMakerMv,
            parsed_variables: json!({ "gold": 1000 }),
            raw_payload: None,
        };

        let serialized = serde_json::to_string(&std_json).unwrap();
        assert!(serialized.contains("RpgMakerMv"));
        assert!(serialized.contains("1000"));
    }
}
