use marshal_rs::{Value, load};
use serde_json::json;

fn main() {
    let data = [0x04, 0x08, 0x30]; // Marshal dump of `nil`
    let val: Value = load(&data, None).unwrap();
    let json_str = val.to_string();
    println!("JSON: {}", json_str);

    // Let's see if Value implements Deserialize
    let json_val = json!(null);
    let back_to_val: Result<Value, _> = serde_json::from_value(json_val);
    println!("Deserialize result: {:?}", back_to_val.is_ok());
}
