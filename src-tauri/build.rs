fn main() {
    let mcp_path = std::path::Path::new("../mcp-server.js");
    if !mcp_path.exists() {
        let _ = std::fs::write(mcp_path, "// Dummy MCP server script\n");
    }
    tauri_build::build()
}
