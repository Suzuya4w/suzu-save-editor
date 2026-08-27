import { createSignal, createEffect, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from './Modal';
import { Settings, Plug, FolderOpen, RefreshCw, AlertTriangle, ShieldCheck, Info } from 'lucide-solid';
import { useSettingsStore, setIsSettingsOpen, toggleEffects } from '../store/settingsStore';
import { addToast } from '../store/toastStore';
import { Tooltip } from './Header';

interface PluginMetadata {
    name: string;
    version: string;
    author: string;
    description: string;
}

interface LoadedPlugin {
    id: string;
    plugin_type: any; // { Lua: string } or { Wasm: string }
    metadata: PluginMetadata;
    active: boolean;
    is_corrupted: boolean;
}

export function SettingsModal() {
    const settings = useSettingsStore();
    const [activeTab, setActiveTab] = createSignal<'general' | 'plugins'>('general');
    const [plugins, setPlugins] = createSignal<LoadedPlugin[]>([]);
    const [isLoadingPlugins, setIsLoadingPlugins] = createSignal(false);
    const [showDocs, setShowDocs] = createSignal(false);

    createEffect(() => {
        if (settings.isSettingsOpen && activeTab() === 'plugins') {
            fetchPlugins();
        }
    });

    const fetchPlugins = async () => {
        setIsLoadingPlugins(true);
        try {
            if (!('__TAURI_INTERNALS__' in window)) {
                setPlugins([]);
                return;
            }
            const data: LoadedPlugin[] = await invoke('get_plugins');
            setPlugins(data);
        } catch (e: any) {
            addToast(`Failed to load plugins: ${e}`, 'error');
        } finally {
            setIsLoadingPlugins(false);
        }
    };

    const handleTogglePlugin = async (id: string, active: boolean) => {
        try {
            await invoke('toggle_plugin', { id, active });
            addToast(`Plugin ${active ? 'enabled' : 'disabled'}`, 'success');
            await fetchPlugins();
        } catch (e: any) {
            addToast(`Failed to toggle plugin: ${e}`, 'error');
        }
    };

    const handleReloadPlugins = async () => {
        try {
            await invoke('reload_plugins');
            addToast('Plugins reloaded successfully', 'success');
            await fetchPlugins();
        } catch (e: any) {
            addToast(`Failed to reload plugins: ${e}`, 'error');
        }
    };

    const handleOpenScriptsFolder = async () => {
        try {
            await invoke('open_scripts_folder');
        } catch (e: any) {
            addToast(`Failed to open scripts folder: ${e}`, 'error');
        }
    };

    return (
        <Modal
            isOpen={settings.isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            title="System Configuration"
            icon={<Settings size={18} />}
            width="max-w-3xl"
        >
            <div class="flex flex-col h-[500px]">
                {/* Tabs */}
                <div class="flex items-center gap-2 border-b-2 border-zinc-800 pb-4 shrink-0">
                    <button
                        onClick={() => setActiveTab('general')}
                        class={`px-4 py-2 cursor-pointer font-bold uppercase tracking-widest text-sm transition-colors border-2 ${
                            activeTab() === 'general' ? 'border-[#FF7A00] text-[#FF7A00] bg-[#FF7A00]/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 bg-transparent'
                        }`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('plugins')}
                        class={`flex items-center cursor-pointer gap-2 px-4 py-2 font-bold uppercase tracking-widest text-sm transition-colors border-2 ${
                            activeTab() === 'plugins' ? 'border-[#00F0FF] text-[#00F0FF] bg-[#00F0FF]/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 bg-transparent'
                        }`}
                    >
                        <Plug size={16} /> Plugins
                    </button>
                </div>

                {/* Content */}
                <div class="flex-1 overflow-y-auto custom-scrollbar pt-6 pr-2">
                    <Show when={activeTab() === 'general'}>
                        <div class="flex flex-col gap-6">
                            <div class="flex items-center justify-between p-4 bg-[#0a0a0a] border border-zinc-800">
                                <div class="flex flex-col">
                                    <span class="font-bold text-zinc-200 tracking-wider">VISUAL EFFECTS</span>
                                    <span class="text-xs font-desc text-zinc-500">Enable Background Animations</span>
                                </div>
                                <button 
                                    onClick={toggleEffects}
                                    class={`w-24 h-12 cursor-pointer flex items-center transition-colors border-2 ${settings.enableEffects ? 'bg-green-500/20 border-green-500' : 'bg-zinc-800 border-zinc-600'}`}
                                >
                                    <div class={`w-5 h-5 bg-white transition-transform ${settings.enableEffects ? 'translate-x-14' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </Show>

                    <Show when={activeTab() === 'plugins'}>
                        <div class="flex flex-col gap-4 h-full">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex flex-col">
                                    <h3 class="font-bold text-[#00F0FF] uppercase tracking-widest text-lg">Plugin Engine</h3>
                                    <p class="text-xs font-desc text-zinc-500">Manage external Wasm and Lua parsers</p>
                                </div>
                                <div class="flex gap-2">
                                    <Tooltip text="Plugin Development Guide" position="bottom" align="right">
                                    <button 
                                        onClick={() => setShowDocs(!showDocs())}
                                        class={`p-2 border transition-colors cursor-pointer tooltip-wrapper ${
                                            showDocs() ? 'border-[#00F0FF] text-[#00F0FF] bg-[#00F0FF]/10' : 'border-zinc-700 hover:border-[#00F0FF] hover:text-[#00F0FF] text-zinc-400 bg-[#0a0a0a]'
                                        }`}
                                    >
                                        <Info size={16} />
                                    </button>
                                    </Tooltip>
                                    <Tooltip text="Open Plugins Folder" position="bottom" align="right">
                                    <button 
                                        onClick={handleOpenScriptsFolder}
                                        class="p-2 border border-zinc-700 hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors text-zinc-400 bg-[#0a0a0a] cursor-pointer tooltip-wrapper"
                                    >
                                        <FolderOpen size={16} />
                                    </button>
                                    </Tooltip>
                                    <Tooltip text="Reload All Plugins" position="bottom" align="right">
                                    <button 
                                        onClick={handleReloadPlugins}
                                        class="p-2 border border-zinc-700 hover:border-green-500 hover:text-green-500 transition-colors text-zinc-400 bg-[#0a0a0a] cursor-pointer tooltip-wrapper"
                                    >
                                        <RefreshCw size={16} class={isLoadingPlugins() ? "animate-spin" : ""} />
                                    </button>
                                    </Tooltip>
                                </div>
                            </div>

                            <Show when={showDocs()}>
                                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 bg-black border-2 border-zinc-800 text-sm mb-4 font-desc">
                                    <h4 class="font-bold text-[#00F0FF] mb-2 tracking-widest uppercase">Lua Plugin Template</h4>
                                    <p class="text-zinc-400 mb-4 font-desc">Save files as <span class="text-white bg-zinc-800 px-1 py-0.5 rounded">plugin_name.lua</span> in the scripts folder. The <span class="text-white bg-zinc-800 px-1 py-0.5 rounded">metadata()</span> function must return a valid JSON string.</p>
                                    
                                    <pre class="p-3 bg-[#0a0a0a] border border-zinc-800 text-green-400 font-desc text-xs overflow-x-auto">
{`function metadata()
    return [[{
        "name": "My Save Parser",
        "version": "1.0.0",
        "author": "Modder Name",
        "description": "Parser for XYZ Engine saves"
    }]]
end

function detect(bytes)
    -- return true if this plugin can handle these bytes
    return string.sub(bytes, 1, 4) == "MAGC"
end

function parse(bytes)
    -- return JSON string of parsed save data
    return "{}"
end`}
                                    </pre>
                                </div>
                            </Show>

                            <Show when={plugins().length === 0 && !isLoadingPlugins() && !showDocs()}>
                                <div class="flex-1 font-desc flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 bg-[#0a0a0a]/50 p-8">
                                    <Plug size={32} class="text-zinc-600 mb-4" />
                                    <p class="text-zinc-400 font-bold uppercase tracking-widest">No Plugins Found</p>
                                    <p class="text-zinc-600 text-xs mt-2 text-center max-w-sm">Place your .wasm and .lua files in the scripts folder and reload.</p>
                                </div>
                            </Show>

                            <Show when={!showDocs() && plugins().length > 0}>
                                <div class="grid grid-cols-1 gap-3">
                                    <For each={plugins()}>
                                        {(plugin) => (
                                            <div class={`p-4 border-l-4 border-y border-r border-y-zinc-800 border-r-zinc-800 bg-[#0a0a0a] transition-all flex items-start justify-between ${
                                                plugin.active ? 'border-l-green-500' : 'border-l-zinc-600 opacity-60'
                                            }`}>
                                                <div class="flex flex-col gap-1 w-[80%]">
                                                    <div class="flex items-center font-desc gap-3">
                                                        <span class="font-bold text-zinc-100 tracking-wider text-lg">{plugin.metadata.name}</span>
                                                        <span class={`text-[10px] uppercase tracking-widest px-2 py-0.5 border ${
                                                            plugin.plugin_type.Wasm ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                                                        }`}>
                                                            {plugin.plugin_type.Wasm ? 'Wasm' : 'Lua'}
                                                        </span>
                                                        <span class="text-xs text-zinc-500 font-desc">v{plugin.metadata.version}</span>
                                                    </div>
                                                    
                                                    <span class="text-sm text-zinc-400 mb-2 font-desc truncate" title={plugin.metadata.description}>{plugin.metadata.description}</span>
                                                    
                                                    <div class="flex items-center gap-4 font-desc text-xs">
                                                        <div class="flex items-center gap-1 text-zinc-500">
                                                            <ShieldCheck size={12} />
                                                            <span>{plugin.metadata.author}</span>
                                                        </div>
                                                    </div>

                                                    <Show when={plugin.is_corrupted}>
                                                        <div class="mt-2 p-2 font-desc bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-red-400 text-xs">
                                                            <AlertTriangle size={14} class="shrink-0 mt-0.5" />
                                                            <span>Plugin file is corrupted or could not be loaded.</span>
                                                        </div>
                                                    </Show>
                                                </div>

                                                <button 
                                                    onClick={() => handleTogglePlugin(plugin.id, !plugin.active)}
                                                    class={`mt-2 px-4 py-1.5 font-bold uppercase tracking-widest text-xs border-2 transition-colors cursor-pointer ${
                                                        plugin.active 
                                                            ? 'border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-500 bg-transparent' 
                                                            : 'border-green-500/50 text-green-500 hover:border-green-400 hover:bg-green-500/10 bg-transparent'
                                                    }`}
                                                >
                                                    {plugin.active ? 'DISABLE' : 'ENABLE'}
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            </div>
        </Modal>
    );
}
