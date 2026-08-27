import { Bot, Terminal, ShieldAlert, Copy, Check, ChevronDown, ChevronUp, Wrench, Lightbulb, Info } from 'lucide-solid';
import { Modal } from './Modal';
import { createSignal, onMount, Show, JSX } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

const AccordionItem = (props: { title: string; id: string; activeSection: string; onToggle: (id: string) => void; icon: any; children: JSX.Element }) => {
  const isOpen = () => props.activeSection === props.id;
  return (
    <div class="border border-zinc-800 bg-[#0a0a0a] overflow-hidden mb-3">
      <button 
        onClick={() => props.onToggle(props.id)}
        class="w-full flex items-center justify-between cursor-pointer p-4 bg-[#0a0a0a] hover:bg-zinc-900 transition-colors text-left"
      >
        <div class="flex items-center gap-8">
          <props.icon size={16} class="text-cyan-500" />
          <span class="font-bold text-xs uppercase tracking-widest text-zinc-200">{props.title}</span>
        </div>
        <Show when={isOpen()} fallback={<ChevronDown size={16} class="text-zinc-500" />}>
          <ChevronUp size={16} class="text-zinc-500" />
        </Show>
      </button>
      <div 
        class="grid transition-all duration-300 ease-in-out"
        style={{ "grid-template-rows": isOpen() ? "1fr" : "0fr" }}
      >
        <div class="overflow-hidden">
          <div class="p-4 pt-0 font-desc text-zinc-400 text-xs leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
            {props.children}
          </div>
        </div>
      </div>
    </div>
  );
};

interface McpInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function McpInfoModal(props: McpInfoModalProps) {
  const [activeSection, setActiveSection] = createSignal('setup');
  const [copied, setCopied] = createSignal(false);
  const [configCode, setConfigCode] = createSignal(`"mcpServers": {
  "suzu-save-editor": {
    "command": "node",
    "args": [
      "Loading path..."
    ]
  }
}`);

  onMount(async () => {
    try {
      const dynamicPath = await invoke<string>('get_mcp_script_path');
      setConfigCode(`"mcpServers": {
  "suzu-save-editor": {
    "command": "node",
    "args": [
      "${dynamicPath}"
    ]
  }
}`);
    } catch (e) {
      console.error("Failed to fetch MCP script path:", e);
    }
  });

  const handleToggle = (id: string) => {
    setActiveSection(prev => prev === id ? '' : id);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(configCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="MCP Bridge Integration"
      icon={<Bot size={18} />}
      width="max-w-3xl"
    >
      <div class="flex flex-col max-h-[75vh]">
        <div class="overflow-y-auto custom-scrollbar pr-2">
          
          <div class="bg-blue-500/10 border-l-2 border-blue-500 p-5 mb-6">
            <div class="flex items-center gap-3 text-blue-400 font-bold text-xs uppercase tracking-widest mb-2">
              <Info size={16} />
              Model Context Protocol (MCP)
            </div>
            <p class="text-xs font-desc text-blue-200/80 leading-relaxed">
              MCP is a local bridge that allows external AI agents (like Claude Desktop, Cursor, or Antigravity) to read and safely edit your active save data in real-time.
            </p>
          </div>

          <AccordionItem title="Integration Setup" id="setup" activeSection={activeSection()} onToggle={handleToggle} icon={Terminal}>
            <ol class="list-decimal list-inside space-y-3">
              <li>Ensure your save file is loaded into the editor.</li>
              <li>Toggle the MCP switch in the header until it displays <strong>MCP ACTIVE</strong>.</li>
              <li>Add the following configuration to your AI client (e.g., <code class="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs font-desc">claude_desktop_config.json</code>):
                <div class="relative bg-[#0a0a0a] p-4 mt-3 border border-zinc-800 rounded group shadow-[inset_0px_0px_10px_rgba(0,0,0,0.5)]">
                  <button 
                    onClick={handleCopy}
                    class="absolute top-3 right-3 p-1.5 bg-zinc-800/80 hover:bg-emerald-600 rounded text-zinc-400 hover:text-white transition-all cursor-pointer"
                    title="Copy Configuration"
                  >
                    {copied() ? <Check size={14} class="text-white" /> : <Copy size={14} />}
                  </button>
                  <pre class="font-desc text-xs text-[#00F0FF] overflow-x-auto whitespace-pre leading-relaxed">
                    {configCode()}
                  </pre>
                </div>
              </li>
            </ol>
          </AccordionItem>

          <AccordionItem title="Security & Lifecycle" id="security" activeSection={activeSection()} onToggle={handleToggle} icon={ShieldAlert}>
            <div class="space-y-3">
              <p>
                By default, the MCP Bridge is <strong>OFF</strong> to prevent unauthorized access. You must manually toggle it to <strong>MCP ACTIVE</strong>.
              </p>
              <p>
                <span class="text-zinc-300 font-bold border-b border-zinc-700 pb-0.5">Important Note:</span> Once activated, the MCP bridge will continuously run in the background. It will <strong>only disconnect</strong> if you manually turn it off or if you completely close the Suzu Save Editor program. Please ensure you trust the AI agent you are connecting to.
              </p>
            </div>
          </AccordionItem>

          <AccordionItem title="Available AI Tools" id="tools" activeSection={activeSection()} onToggle={handleToggle} icon={Wrench}>
            <div class="space-y-4">
              <p>The MCP Server exposes the following tools to your AI agent:</p>
              
              <div class="bg-zinc-900/50 p-3 border border-zinc-800 rounded">
                <strong class="text-[#FF7A00] block mb-1">Universal JSON Tools</strong>
                <ul class="list-disc list-inside space-y-1 mt-2 text-zinc-400">
                  <li><code class="text-xs text-zinc-300 font-desc">get_save_skeleton</code>: Maps the structure of the JSON save file.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">search_json_path</code>: Recursively searches the save JSON for a specific keyword.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">read_value_at_path</code> / <code class="text-xs text-zinc-300 font-desc">set_value_at_path</code>: Read or edit specific JSON values.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">add_json_item</code> / <code class="text-xs text-zinc-300 font-desc">delete_json_key</code>: Safely push items to arrays or delete keys from objects.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">create_save_backup</code> / <code class="text-xs text-zinc-300 font-desc">restore_save_backup</code>: Create a backup of the current save file and restore it if modifications fail.</li>
                </ul>
              </div>

              <div class="bg-zinc-900/50 p-3 border border-zinc-800 rounded">
                <strong class="text-[#FF7A00] block mb-1">Hex & Binary Tools</strong>
                <ul class="list-disc list-inside space-y-1 mt-2 text-zinc-400">
                  <li><code class="text-xs text-zinc-300 font-desc">search_hex_pattern</code>: Scans the hex file for a wildcard byte pattern (e.g. 'FF ?? A1 00') and returns matching offsets (Ultra-fast Rust implementation).</li>
                  <li><code class="text-xs text-zinc-300 font-desc">read_hex_segment</code> / <code class="text-xs text-zinc-300 font-desc">write_hex_segment</code>: Reads/writes raw bytes at specific offsets.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">convert_data_type</code>: Safely convert decimal to Little/Big Endian hex.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">get_active_diff_results</code>: Fetches byte differences if you are comparing two save files.</li>
                </ul>
              </div>

              <div class="bg-zinc-900/50 p-3 border border-zinc-800 rounded">
                <strong class="text-[#FF7A00] block mb-1">Game-Specific Tools (e.g. Stardew Valley)</strong>
                <ul class="list-disc list-inside space-y-1 mt-2 text-zinc-400">
                  <li><code class="text-xs text-zinc-300 font-desc">get_stardew_player_info</code>: Gets basic player info.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">update_stardew_money</code>: Updates the player's currency.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">spawn_stardew_item</code>: Injects an item directly into the player's inventory.</li>
                </ul>
              </div>

              <div class="bg-zinc-900/50 p-3 border border-zinc-800 rounded">
                <strong class="text-[#FF7A00] block mb-1">Game-Specific Tools (RPG Maker MV/MZ)</strong>
                <ul class="list-disc list-inside space-y-1 mt-2 text-zinc-400">
                  <li><code class="text-xs text-zinc-300 font-desc">get_rpg_maker_gold</code> / <code class="text-xs text-zinc-300 font-desc">update_rpg_maker_gold</code>: Easily manipulate the party's gold without needing to know the JSON path.</li>
                  <li><code class="text-xs text-zinc-300 font-desc">add_rpg_maker_item</code>: Add items directly into the party's inventory.</li>
                </ul>
              </div>
            </div>
          </AccordionItem>

          <AccordionItem title="Prompt Scenarios" id="prompts" activeSection={activeSection()} onToggle={handleToggle} icon={Lightbulb}>
            <div class="space-y-4">
              <p>Once connected, try copying and pasting these prompts to your AI agent:</p>
              
              <div>
                <strong class="text-cyan-400 block mb-1 text-[10px] uppercase tracking-widest">Scenario: Find & Modify Currency (RPG Maker/Ren'Py)</strong>
                <div class="bg-zinc-900/50 p-3 border-l-2 border-emerald-500 text-zinc-300 italic text-xs leading-relaxed">
                  "Call create_save_backup first to be safe. Then use get_rpg_maker_gold to check my gold, and update_rpg_maker_gold to change it to 999999. If it's not RPG Maker, use search_json_path to look for 'gold', then set_value_at_path."
                </div>
              </div>

              <div>
                <strong class="text-cyan-400 block mb-1 text-[10px] uppercase tracking-widest">Scenario: Unlocking CG Flags (Visual Novels)</strong>
                <div class="bg-zinc-900/50 p-3 border-l-2 border-[#00F0FF] text-zinc-300 italic text-xs leading-relaxed">
                  "Use get_save_skeleton to map out the 'flags' or 'variables' object. Search for any boolean keys containing 'unlocked' or 'cg_seen', and set them all to true using set_value_at_path."
                </div>
              </div>

              <div>
                <strong class="text-cyan-400 block mb-1 text-[10px] uppercase tracking-widest">Scenario: Hex / Save Diff Analysis (Unknown Engine)</strong>
                <div class="bg-zinc-900/50 p-3 border-l-2 border-[#FF7A00] text-zinc-300 italic text-xs leading-relaxed">
                  "Call get_active_diff_results to get byte differences. If diff is too large, use search_hex_pattern with 'FF ?? A1 00' to find the offset of the gold value. Convert 9999 to i32_le using convert_data_type, and inject it using write_hex_segment."
                </div>
              </div>
              
              <div>
                <strong class="text-cyan-400 block mb-1 text-[10px] uppercase tracking-widest">Scenario: Stardew Valley Instant Setup</strong>
                <div class="bg-zinc-900/50 p-3 border-l-2 border-purple-500 text-zinc-300 italic text-xs leading-relaxed">
                  "I am playing Stardew Valley. Use update_stardew_money to give me 50,000G, and use spawn_stardew_item to spawn 5 Iridium Sprinklers (ID: 645) into my inventory."
                </div>
              </div>
            </div>
          </AccordionItem>

        </div>
      </div>
    </Modal>
  );
}
