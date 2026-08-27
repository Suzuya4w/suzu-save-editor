use std::fs;
use std::path::Path;

use suzu_save_editor_lib::parsers::csharp_xml::CSharpXmlParser;
use suzu_save_editor_lib::parsers::SaveEngineDecoder;
use tokio::runtime::Runtime;

fn main() {
    let rt = Runtime::new().unwrap();
    rt.block_on(async {
        let path = Path::new("C:\\Users\\Administrator\\AppData\\Roaming\\StardewValley\\Saves\\123123_441276547\\123123_441276547");
        let data = fs::read(path).unwrap();
        
        let parser = CSharpXmlParser;
        let json = parser.parse_to_standard_json(&data, None).await.unwrap();
        let encoded = parser.encode(&json, path, None).await.unwrap();
        
        fs::write("C:\\Users\\Administrator\\AppData\\Roaming\\StardewValley\\Saves\\123123_441276547\\encoded.xml", encoded).unwrap();
        println!("Encoded to encoded.xml");
    });
}
