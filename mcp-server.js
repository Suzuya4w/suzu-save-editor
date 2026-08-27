const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

function getAppConfigDir() {
  if (process.env.MCP_STORAGE_DIR) {
    return process.env.MCP_STORAGE_DIR;
  }
  
  // Fallback if not injected by Rust (e.g. running manually during dev)
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'com.suzu.saveeditor');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'com.suzu.saveeditor');
  } else {
    return path.join(os.homedir(), '.config', 'com.suzu.saveeditor');
  }
}

const statusFile = path.join(getAppConfigDir(), 'mcp_status.json');

async function getMcpPort() {
  if (!fs.existsSync(statusFile)) {
    // Try the production fallback if dev fallback doesn't exist
    const prodStatusFile = statusFile.replace('.dev', '');
    if (fs.existsSync(prodStatusFile)) {
      const content = fs.readFileSync(prodStatusFile, 'utf8');
      const data = JSON.parse(content);
      return data.port;
    }
    throw new Error(`MCP Status file not found at ${statusFile}. Is the editor running?`);
  }
  const content = fs.readFileSync(statusFile, 'utf8');
  const data = JSON.parse(content);
  if (!data.port) throw new Error('Port not found in MCP status file');
  return data.port;
}

// Global state for available tools
let availableTools = [];

async function callMcpEndpoint(action, args = {}) {
  const port = await getMcpPort();
  
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
        path: '/api/mcp/call',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              resolve(body);
            }
          } else {
            reject(new Error(`HTTP Error ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.write(JSON.stringify({ action, args }));
    req.end();
  });
}

function sendResponse(id, result, error = null) {
  const response = { jsonrpc: "2.0", id };
  if (error) response.error = error;
  else response.result = result;
  process.stdout.write(JSON.stringify(response) + '\n');
}

function sendNotification(method, params = {}) {
  const notification = { jsonrpc: "2.0", method, params };
  process.stdout.write(JSON.stringify(notification) + '\n');
}

// Long-lived SSE connection for receiving Tauri events
async function connectToEvents() {
  try {
    const port = await getMcpPort();
    http.get({ hostname: '127.0.0.1', port: port, path: '/api/mcp/events' }, (res) => {
      res.on('data', (chunk) => {
        const text = chunk.toString();
        // naive SSE parser
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const eventName = line.substring(5).trim();
            if (eventName === 'tools/list_changed') {
               sendNotification('notifications/tools/list_changed');
            }
          }
        }
      });
      res.on('end', () => setTimeout(connectToEvents, 3000));
      res.on('error', () => setTimeout(connectToEvents, 3000));
    }).on('error', () => setTimeout(connectToEvents, 3000));
  } catch (e) {
    setTimeout(connectToEvents, 3000);
  }
}

connectToEvents();

process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; 

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      
      if (msg.method === 'initialize') {
        sendResponse(msg.id, {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: { name: "suzu-mcp-bridge", version: "2.0.0" }
        });
      }
      else if (msg.method === 'tools/list') {
        try {
          const toolsList = await callMcpEndpoint('get_tools_list');
          sendResponse(msg.id, { tools: toolsList });
        } catch (e) {
          // If disconnected, return empty tools
          sendResponse(msg.id, { tools: [] });
        }
      }
      else if (msg.method === 'tools/call') {
        try {
          const action = msg.params.name;
          const args = msg.params.arguments || {};
          
          const data = await callMcpEndpoint(action, args);
          sendResponse(msg.id, {
            content: [{ type: "text", text: typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data) }]
          });
        } catch (e) {
          sendResponse(msg.id, null, { code: -32000, message: e.message });
        }
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  }
});
