import { createSignal, Show, JSX, onMount, createEffect } from 'solid-js';
import { ShieldCheck, Wrench, Search, FileCode, ChevronDown, ChevronUp, BookOpen, MousePointerClick, Lightbulb, HelpCircle, Gamepad2, Info, AlignLeft, Code, Database, FolderPlus, RefreshCw } from 'lucide-solid';
import { useEditorStore, setHelpModalSection } from '../store/editorStore';
import { addToast } from '../store/toastStore';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

import { Modal } from './Modal'; 

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
          <div class="p-4 pt-0 font-fira text-zinc-400 text-xs leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
            {props.children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const HelpModal = (props: { isOpen: boolean; onClose: () => void }) => {
  const editorState = useEditorStore();
  const [activeSection, setActiveSection] = createSignal(editorState.helpModalSection || 'how_to_use');
  const [appVersion, setAppVersion] = createSignal('');

  onMount(async () => {
    try {
      const { getVersion } = await import('@tauri-apps/plugin-app');
      setAppVersion(await getVersion());
    } catch(e) {}
  });

  createEffect(() => {
    if (props.isOpen && editorState.helpModalSection) {
      setActiveSection(editorState.helpModalSection);
    }
  });

  const handleToggle = (id: string) => {
    setActiveSection(prev => prev === id ? '' : id);
  };

  const checkForUpdates = async () => {
    addToast("CHECKING FOR SYSTEM UPDATES...", "info");
    try {
      const update = await check();
      if (update) {
        addToast(`DOWNLOADING UPDATE [v${update.version}]... DO NOT CLOSE APP!`, "warning");
        await update.downloadAndInstall();
        addToast("UPDATE SUCCESSFUL! RESTARTING SYSTEM...", "success");
        await relaunch();
      } else {
        addToast(`SYSTEM IS UP TO DATE [v${appVersion() || '1.0.0'}]`, "success");
      }
    } catch (err: any) {
      console.error("Update failed:", err);
      addToast(`UPDATE CHECK FAILED: ${err.message || String(err)}`, "error");
    }
  };

  const handleClose = () => {
      props.onClose();
      setTimeout(() => {
        setHelpModalSection('how_to_use');
      }, 300);
  };

  return (
    <Modal 
      isOpen={props.isOpen} 
      onClose={handleClose} 
      title="Help & Information"
      icon={<BookOpen size={18} />}
      width="max-w-2xl"
    >
      <div class="flex flex-col max-h-[75vh]">
        
        {/* Content (Scrollable) */}
        <div class="overflow-y-auto custom-scrollbar pr-2">
          
          <div class="bg-yellow-500/5 border-l-2 border-yellow-500 p-5 mb-6">
            <div class="flex items-center gap-3 text-yellow-500 font-bold text-xs uppercase tracking-widest mb-2">
              <ShieldCheck size={16} />
              Auto-Backup System
            </div>
            <p class="text-xs font-desc text-yellow-500/80 leading-relaxed">
              This application modifies raw game data. For your safety, <span class="text-yellow-500">an automatic backup (.bak) is created in the same folder</span> whenever you overwrite a file. However, making extreme value changes may still cause game crashes. Modify responsibly!
            </p>
          </div>

          <AccordionItem title="How To Use" id="how_to_use" activeSection={activeSection()} onToggle={handleToggle} icon={MousePointerClick}>
            <div class="space-y-2">
              <p>1. Click <strong>Open Save File</strong> and locate your game's save data.</p>
              <p>2. Use <strong>Simple Mode</strong> for easy editing (Gold, HP, MP) or <strong>Advanced Mode</strong> to dig into raw variables.</p>
              <p>3. Make your desired changes in the input fields.</p>
              <p>4. Click the <strong>Save</strong> button in the top right corner.</p>
              <p>5. Choose to overwrite the existing file (a <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">.bak</code> backup will be created) or save as a new copy.</p>
            </div>
          </AccordionItem>

          <AccordionItem title="Tips & Tricks" id="tips" activeSection={activeSection()} onToggle={handleToggle} icon={Lightbulb}>
            <div class="space-y-3">
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Undo/Redo:</strong> Use <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">Ctrl + Z</code> and <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">Ctrl + Y</code> to undo and redo your changes instantly.</p></div>
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Search Bar:</strong> Use the Search bar at the top to quickly find specific items, weapons, or hidden variables in Advanced Mode.</p></div>
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Load Game DB:</strong> Loading the game's data folder will convert confusing Item IDs (like "Item_15") into their actual names (like "Excalibur").</p></div>
            </div>
          </AccordionItem>

          <AccordionItem title="FAQ & Troubleshooting" id="faq" activeSection={activeSection()} onToggle={handleToggle} icon={HelpCircle}>
            <div class="space-y-4">
              <div>
                <strong class="text-cyan-400 block mb-1">Q: I broke my game! How do I restore my save?</strong>
                <p>A: Go to your game's save folder. You will find a file ending in .bak (e.g., save01.rpgsave.bak). Delete the corrupted file, and simply remove the .bak extension from the backup file to restore it.</p>
              </div>
              <div>
                <strong class="text-cyan-400 block mb-1">Q: Why did my game crash after editing?</strong>
                <p>A: You likely entered a value that exceeds the game's hardcoded limits (e.g., setting HP to 999,999 when the maximum is 9,999).</p>
              </div>
              <div>
                <strong class="text-cyan-400 block mb-1">Q: I don't see the Simple Mode button.</strong>
                <p>A: Simple Mode is currently only supported for RPG Maker games. For other engines, you must use Advanced Mode or the Hex Viewer.</p>
              </div>
              <div>
                <strong class="text-cyan-400 block mb-1">Q: Why does the screen briefly blink when I close a save file?</strong>
                <p>A: It’s an automated memory cleanup feature! Opening massive save files in Raw JSON mode takes up a lot of RAM. To make sure your computer stays fast after closing the file, Suzu does a lightning-fast refresh to instantly hand gigabytes of RAM back to your system.</p>
              </div>
            </div>
          </AccordionItem>

          <AccordionItem title="Supported Engines" id="engines" activeSection={activeSection()} onToggle={handleToggle} icon={Gamepad2}>
            <div class="space-y-2">
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">RPG Maker (MV/MZ):</strong> Parses <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">.rpgsave</code> files.</p></div>
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Ren'Py:</strong> Supports standard <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">.save</code> files.</p></div>
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Naninovel (Unity):</strong> Extracts Deep JSON from <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">.nson</code> format.</p></div>
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Kirikiri/KAG:</strong> Parses TJS2 structure from <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">.ksd</code> format.</p></div>
              <div class="flex gap-2 items-start"><span class="text-cyan-400">•</span> <p><strong class="text-cyan-400">Others:</strong> Any unsupported file will open safely in the Hex Viewer (Raw Mode).</p></div>
            </div>
          </AccordionItem>

          <AccordionItem title="Data Scavenger (Search)" id="data" activeSection={activeSection()} onToggle={handleToggle} icon={Search}>
            <p class="mb-3">The Data Scavenger allows you to search for specific values in the raw hex payload. You can search by three data types:</p>
            <ul class="list-disc pl-5 space-y-2 mb-3">
              <li><strong class="text-cyan-400">Int32 (Little Endian):</strong> Used for searching exact numbers like Gold, HP, or EXP. If you have 99999 Gold, type 99999. The editor converts this into a 4-byte Little Endian hex format automatically.</li>
              <li><strong class="text-cyan-400">String (UTF-8):</strong> Used for searching character names, item names, or text dialogs in the save file.</li>
              <li><strong class="text-cyan-400">Hex Array:</strong> Used for searching exact byte patterns (e.g., <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">EF BB BF</code>).</li>
            </ul>
            <p>Once a value is found, you can inject a new payload directly into that offset address.</p>
          </AccordionItem>

          <AccordionItem title="Advanced Tools" id="advanced" activeSection={activeSection()} onToggle={handleToggle} icon={Wrench}>
            <ul class="list-disc pl-5 space-y-3">
              <li>
                <strong class="text-cyan-400">Entropy:</strong> Calculates the randomness of the file data. An entropy close to 8.0 means the file is heavily compressed or encrypted. An entropy below 5.0 usually means the file contains raw unencrypted text or structured data.
              </li>
              <li>
                <strong class="text-cyan-400">Strings:</strong> Extracts all readable human text (ASCII) from the binary file. Useful for finding hidden developer messages, item IDs, or variable names inside unknown save formats.
              </li>
              <li>
                <strong class="text-cyan-400">Unpack Zlib:</strong> Attempts to decompress the save file payload using Zlib. If a save file looks like garbage hex but starts with <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">78 9C</code> or <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">78 DA</code>, it is likely Zlib compressed.
              </li>
              <li>
                <strong class="text-red-400">Zlib (UTF-8 Fix):</strong> Some buggy games accidentally save ZLIB binary data as a UTF-8 string, causing byte corruption (e.g. <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">C3 AD</code>). This button reverses the UTF-8 corruption and recovers the original ZLIB stream.
              </li>
              <li>
                <strong class="text-blue-400">Auto-Heal Header:</strong> Automatically scans the first 1024 bytes of a file to find known magic signatures (Zlib, Zip, JSON). If a game obfuscates its save by prepending garbage text at the top, this tool will safely slice off the garbage and reveal the true payload.
              </li>
              <li>
                <strong class="text-purple-400">XOR Decrypt / Auto-Guess:</strong> A decryption tool for games that hide data by XOR-ing bytes (e.g. Wolf RPG). You can manually enter a Hex key, or use <strong class="text-purple-300">AUTO-GUESS KEY</strong>, which performs a Frequency Analysis to magically guess the correct XOR key based on the most frequent bytes!
              </li>
              <li>
                <strong class="text-indigo-400">ES3 Extractor:</strong> For Unity games utilizing Easy Save 3 (AES Encrypted saves). This tool scans the game's <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-mono">Assembly-CSharp.dll</code> and extracts potential hardcoded ES3 passwords.
              </li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Extracted Strings Filtering" id="strings_tool" activeSection={activeSection()} onToggle={handleToggle} icon={AlignLeft}>
            <p class="mb-2">The Extracted Strings tool pulls readable text from raw binary data. You can filter the results instantly:</p>
            <ul class="list-disc pl-5 space-y-3">
              <li>
                <strong class="text-cyan-400">Min Length:</strong> Sets the minimum consecutive characters required to form a valid string. Lower it to 1 to find isolated single characters/digits.
              </li>
              <li>
                <strong class="text-cyan-400">Character Toggles (Letters, Digits, Symbols):</strong> Unchecking a type turns those characters into "separators". For example, unchecking Letters will split "Item123Box" into just "123". This is extremely powerful for finding isolated numerical values!
              </li>
              <li>
                <strong class="text-cyan-400">Search / Regex:</strong> Filters the extracted list instantly. You can type a normal word, or use Regular Expressions like <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-brains">^[0-9]+$</code> to find lines that contain only numbers.
              </li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Database Profiles" id="database_tab" activeSection={activeSection()} onToggle={handleToggle} icon={Database}>
            <p class="mb-3">The Database tab allows you to download and apply community-curated profiles to instantly unlock CGs, max out items, or modify specific variables in your save file.</p>
            <ul class="list-disc pl-5 space-y-2 mb-3">
              <li><strong class="text-cyan-400">Update Profiles:</strong> Downloads the latest community profiles from GitHub.</li>
              <li><strong class="text-cyan-400">Inject JSON:</strong> Directly injects a custom JSON profile into the opened save data without saving it.</li>
              <li><strong class="text-cyan-400">Save JSON to DB:</strong> Imports and saves a custom JSON profile into your Local Database list for future use.</li>
              <li><strong class="text-cyan-400">Profile Filters:</strong> Easily filter the list between All Profiles, Community Profiles (GitHub), and Local / Custom Profiles.</li>
              <li><strong class="text-cyan-400">Apply Local Profile:</strong> Clicking on a profile in the list will attempt to parse and inject the specified values into your open save file.</li>
              <li><strong class="text-cyan-400">Bulk Export:</strong> Select multiple profiles and export them as JSON files to your computer.</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Folder Inject Tab" id="folder_inject_tab" activeSection={activeSection()} onToggle={handleToggle} icon={FolderPlus}>
            <p class="mb-3">The Folder Inject tab is used to scan a game directory (or import keys via CSV/JSON) and inject those exact variable names into your save file.</p>
            <div class="bg-blue-500/10 border-l-2 border-blue-500 p-3 mb-3">
              <p class="text-xs font-fira text-blue-400 leading-relaxed">
                <strong>Note:</strong> The scanner only reads extracted files and folders. If your game assets are packed inside archives (e.g., <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-fira">extra.xp3</code> for Kirikiri or <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-fira">archive.rpa</code> for Ren'Py), you must extract them first using external tools (like GARbro) before scanning.
              </p>
            </div>
            <ul class="list-disc pl-5 space-y-2 mb-3">
              <li><strong class="text-cyan-400">Scan Folder:</strong> Automatically extracts file names from a game directory and stages them as variable keys. Very useful for unlocking all CG/BGM/Gallery files.</li>
              <li><strong class="text-cyan-400">Prefix / Suffix:</strong> Append or prepend text to the extracted keys (e.g., adding "cg_" to every filename).</li>
              <li><strong class="text-cyan-400">Target Value:</strong> The value to inject for the selected keys (e.g., setting them all to '1', 'true', or '999').</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Profile Builder Tab" id="builder_tab" activeSection={activeSection()} onToggle={handleToggle} icon={Code}>
            <p class="mb-3">The Builder tab allows you to take the keys you staged in the Folder Inject tab and package them into a structured JSON Profile instead of injecting them directly.</p>
            <ul class="list-disc pl-5 space-y-2 mb-3">
              <li><strong class="text-cyan-400">Metadata:</strong> Add a title, author, engine, and notes so others know what your profile does.</li>
              <li><strong class="text-cyan-400">Export CSV:</strong> Dumps the selected keys to a CSV file for manual editing or documentation.</li>
              <li><strong class="text-cyan-400">Save to DB:</strong> Saves the generated JSON profile directly to your Local Database so you can apply it from the Database Tab later.</li>
              <li><strong class="text-cyan-400">Copy JSON:</strong> Copies the raw JSON output to your clipboard.</li>
              <li><strong class="text-cyan-400">View JSON:</strong> Opens a preview modal showing the formatted JSON structure.</li>
              <li><strong class="text-cyan-400">Export JSON:</strong> Saves your generated JSON profile as a physical file to your computer.</li>
            </ul>
          </AccordionItem>

          <AccordionItem title="Diff Profiles" id="profiles" activeSection={activeSection()} onToggle={handleToggle} icon={FileCode}>
            <p class="mb-2"><strong>What is it?</strong> A Profile is a custom map of variable names and their specific memory offsets.</p>
            <p class="mb-2"><strong>How to use:</strong></p>
            <ol class="list-decimal pl-5 space-y-1">
              <li>Open two different save files in the <strong>Diff Tool</strong> (e.g., one with 100 Gold, one with 500 Gold).</li>
              <li>Find the changing bytes and assign them a label (like "Player Gold").</li>
              <li>Save these mappings as a Local Profile.</li>
              <li>Back in the Hex Viewer, click <strong>Apply Profile</strong> and select your saved profile. The editor will automatically parse the raw binary into an easy-to-edit layout based on your map!</li>
            </ol>
          </AccordionItem>

          <AccordionItem title="Profile Builder" id="profile_builder" activeSection={activeSection()} onToggle={handleToggle} icon={Code}>
            <p class="mb-2">The Profile Builder allows you to manually create or edit a Diff Profile directly from the Hex Viewer without needing to compare two files.</p>
            <ul class="list-disc pl-5 space-y-2">
              <li><strong class="text-cyan-400">Add Field:</strong> Click the <strong>"+"</strong> button to create a new mapping entry.</li>
              <li><strong class="text-cyan-400">Offset:</strong> Enter the exact memory address (e.g., <code class="bg-zinc-800 px-1 py-0.5 text-orange-400 font-brains">0x1A4</code>) where the variable is located.</li>
              <li><strong class="text-cyan-400">Label:</strong> Give it a readable name (e.g., "Player HP").</li>
              <li><strong class="text-cyan-400">Type:</strong> Specify if the variable is a 16-bit integer, 32-bit integer, etc., so the editor knows how to read it.</li>
              <li><strong class="text-cyan-400">Save:</strong> Once done, enter a Profile Name and save it. You can then apply this profile from the "Apply Profile" tool to edit these variables easily in the future!</li>
            </ul>
          </AccordionItem>

          <AccordionItem 
            title="About Application" 
            id="about" 
            activeSection={activeSection()} 
            onToggle={handleToggle} 
            icon={Info}
          >
            <>
              <div class="text-center space-y-3 py-4">
                <h3 class="font-bold text-cyan-400 text-base uppercase tracking-widest">
                  Suzu Save Editor v{appVersion() || '1.0.0'}
                </h3>
                <p class="font-bold text-zinc-300">Ultimate Save Data Modifier & Analyzer</p>
                <p class="text-zinc-500 max-w-lg mx-auto text-xs leading-relaxed">
                  Developed to simplify the modification of game variables across various engines without requiring an external hex editor. Built with SolidJS, Tauri, and Rust for high performance.
                </p>
              </div>

              <div class="border-t-2 border-zinc-800 pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">

                <button
                  onClick={checkForUpdates}
                  class="flex items-center justify-center gap-4 px-5 py-3 border-2 text-xs font-black tracking-widest uppercase font-mono cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-zinc-900 text-zinc-300 border-zinc-600 hover:text-[#00F0FF] hover:border-[#00F0FF] hover:shadow-[4px_4px_0px_rgba(0,240,255,0.5)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_rgba(0,240,255,0.5)] transition-all w-full sm:w-auto"
                >
                  <RefreshCw size={14} />
                  CHECK FOR UPDATES
                </button>

                <a 
                  href="https://github.com/Suzuya4w/suzu-save-editor" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="flex items-center justify-center gap-4 px-5 py-3 border-2 text-xs font-black tracking-widest uppercase font-mono cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-zinc-900 text-zinc-300 border-zinc-600 hover:text-[#FF7A00] hover:border-[#FF7A00] hover:shadow-[4px_4px_0px_rgba(255,122,0,0.5)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_rgba(255,122,0,0.5)] transition-all w-full sm:w-auto text-center"
                >
                <svg class="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                  GITHUB REPO
                </a>

              </div>
            </>
          </AccordionItem>

        </div>

        <div class="pt-6 mt-4 border-t border-zinc-800">
          <button 
            onClick={handleClose}
            class="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
        
      </div>
    </Modal>
  );
};