import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { Modal } from './Modal';
import { Wifi, Send, Download, Smartphone, Loader2 } from 'lucide-solid';
import { addToast } from '../store/toastStore';
import { useEditorStore, loadSaveData } from '../store/editorStore';

export function LocalShareModal(props: { isOpen: boolean, onClose: () => void }) {
    const editorState = useEditorStore();
    const [activeTab, setActiveTab] = createSignal<'receive' | 'send'>('receive');
    
    // Receive State
    const [isReceiving, setIsReceiving] = createSignal(false);
    const [localIp, setLocalIp] = createSignal<string>('Detecting...');
    const [sharePort, setSharePort] = createSignal<number>(0);
    const [sharePin, setSharePin] = createSignal<string>('');
    const [qrCodeUrl, setQrCodeUrl] = createSignal<string>('');
    const [expandedQrCodeUrl, setExpandedQrCodeUrl] = createSignal<string>('');
    const [isQrExpanded, setIsQrExpanded] = createSignal(false);
    let unlisten: UnlistenFn | null = null;

    // Send State
    const [targetIp, setTargetIp] = createSignal<string>('');
    const [targetPin, setTargetPin] = createSignal<string>('');
    const [isSending, setIsSending] = createSignal(false);

    const generatePin = () => {
        return Math.floor(1000 + Math.random() * 9000).toString();
    };

    const startServer = async () => {
        try {
            const ip = await invoke<string>('get_local_ip');
            setLocalIp(ip);
            
            const pin = generatePin();
            setSharePin(pin);
            
            const port = await invoke<number>('start_share_server', { pin });
            setSharePort(port);
            setIsReceiving(true);
            
            const qrData = `suzu://share?ip=${ip}&port=${port}&pin=${pin}`;
            const QRCode = (await import('qrcode')).default || await import('qrcode');
            const qrUrl = await QRCode.toDataURL(qrData, { 
                color: { dark: '#00F0FF', light: '#00000000' },
                margin: 1,
                width: 400
            });
            setQrCodeUrl(qrUrl);
            
            const expandedQrUrl = await QRCode.toDataURL(qrData, { 
                color: { dark: '#000000', light: '#FFFFFF' },
                margin: 2,
                width: 800
            });
            setExpandedQrCodeUrl(expandedQrUrl);
            
            unlisten = await listen('local-share-received', (event: any) => {
                const payload = event.payload;
                if (!payload) return;
                
                addToast("Save file received successfully!", "success");
                loadSaveData(payload, payload.original_filename || 'received_save.dat', null);
                props.onClose();
            });
            
        } catch (err: any) {
            console.error(err);
            addToast(`Failed to start local server: ${err.message || String(err)}`, "error");
        }
    };

    const stopServer = async () => {
        try {
            await invoke('stop_share_server');
            if (unlisten) {
                unlisten();
                unlisten = null;
            }
            setIsReceiving(false);
            setSharePort(0);
        } catch (err) {
            console.error(err);
        }
    };

    createEffect(() => {
        if (props.isOpen && activeTab() === 'receive' && !isReceiving()) {
            startServer();
        } else if ((!props.isOpen || activeTab() === 'send') && isReceiving()) {
            stopServer();
        }
    });

    onCleanup(() => {
        stopServer();
    });

    const handleSend = async () => {
        if (!editorState.saveData) {
            addToast("No active save file to send!", "warning");
            return;
        }
        if (!targetIp()) {
            addToast("Please enter target IP address", "warning");
            return;
        }

        setIsSending(true);
        let url = targetIp().trim();
        if (!url.includes(':') && !url.startsWith('http')) {
            url = `http://${url}:41234/upload`;
        } else if (!url.startsWith('http')) {
            url = `http://${url}/upload`;
        } else if (!url.endsWith('/upload')) {
            url = `${url}/upload`;
        }

        try {
            const payload = {
                engine_type: editorState.saveData.engine_type,
                parsed_variables: editorState.saveData.parsed_variables,
                raw_payload: editorState.saveData.raw_payload,
                original_filename: editorState.filePath?.split(/[/\\]/).pop() || 'save.dat'
            };

            const response = await tauriFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Share-Pin': targetPin()
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                addToast("File sent successfully!", "success");
                props.onClose();
            } else {
                const errText = await response.text();
                addToast(`Failed to send: ${errText || response.statusText}`, "error");
            }
        } catch (err: any) {
            console.error(err);
            addToast(`Connection failed. Check IP or AP Isolation. Details: ${err.message || String(err)}`, "error");
        } finally {
            setIsSending(false);
        }
    };

    const handleSelectAndSend = async () => {
        if (!targetIp()) {
            addToast("Please enter target IP address", "warning");
            return;
        }

        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const { readFile } = await import('@tauri-apps/plugin-fs');
            
            const selectedPath = await open({
                multiple: false,
                directory: false,
            });

            if (!selectedPath || typeof selectedPath !== 'string') return;

            setIsSending(true);
            addToast("Parsing file...", "info");

            const bytes = await readFile(selectedPath);
            const parsedData = await invoke<any>('open_save_file_bytes', { 
                bytes: Array.from(bytes), 
                path: selectedPath 
            });

            if (!parsedData || (!parsedData.engine_type && !parsedData.raw_payload)) {
                throw new Error("Invalid save file format.");
            }

            let url = targetIp().trim();
            if (!url.includes(':') && !url.startsWith('http')) {
                url = `http://${url}:41234/upload`;
            } else if (!url.startsWith('http')) {
                url = `http://${url}/upload`;
            } else if (!url.endsWith('/upload')) {
                url = `${url}/upload`;
            }

            const payload = {
                engine_type: parsedData.engine_type || "Unknown",
                parsed_variables: parsedData.parsed_variables,
                raw_payload: parsedData.raw_payload,
                original_filename: selectedPath.split(/[/\\]/).pop() || 'save.dat'
            };

            const response = await tauriFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Share-Pin': targetPin()
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                addToast("Selected file sent successfully!", "success");
                props.onClose();
            } else {
                const errText = await response.text();
                addToast(`Failed to send: ${errText || response.statusText}`, "error");
            }
        } catch (err: any) {
            console.error(err);
            addToast(`Failed to send file: ${err.message || String(err)}`, "error");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={props.isOpen} onClose={props.onClose} title="SUZU QUICK SHARE" icon={<Wifi size={18} class="text-[#00F0FF]" />}>
            <div class="flex flex-col gap-4 min-h-[350px]">
                <div class="flex bg-black border border-zinc-800 p-1">
                    <button 
                        onClick={() => setActiveTab('receive')}
                        class={`flex-1 flex items-center cursor-pointer justify-center gap-4 py-3 text-xs font-bold tracking-widest uppercase transition-colors ${activeTab() === 'receive' ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Download size={14} /> Receive File
                    </button>
                    <button 
                        onClick={() => setActiveTab('send')}
                        class={`flex-1 flex items-center cursor-pointer justify-center gap-4 py-3 text-xs font-bold tracking-widest uppercase transition-colors ${activeTab() === 'send' ? 'bg-orange-500/20 text-orange-400 border border-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Send size={14} /> Send File
                    </button>
                </div>

                <Show when={activeTab() === 'receive'}>
                    <div class="flex-1 flex flex-col items-center justify-center border border-zinc-800 bg-[#050505] p-6 relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
                            <div class="w-64 h-64 border-2 border-[#00F0FF] rounded-full animate-ping opacity-20"></div>
                            <div class="absolute w-48 h-48 border-2 border-[#00F0FF] rounded-full animate-ping opacity-40" style="animation-delay: 0.5s"></div>
                        </div>

                        <div class="relative z-10 flex flex-col items-center">
                            <Show when={qrCodeUrl()} fallback={<Loader2 class="animate-spin text-[#00F0FF] mb-4" size={48} />}>
                                <div 
                                    onClick={() => setIsQrExpanded(true)}
                                    class="bg-black/50 p-4 border border-[#00F0FF]/50 backdrop-blur-md mb-6 cursor-pointer hover:bg-black/80 transition-colors group relative"
                                    title="Click to enlarge"
                                >
                                    <img src={qrCodeUrl()} alt="QR Code" class="w-64 h-64 [image-rendering:pixelated]" />
                                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                                        <span class="text-[#00F0FF] font-bold text-xs uppercase tracking-widest bg-black/80 px-3 py-1 border border-[#00F0FF]/50">Enlarge</span>
                                    </div>
                                </div>
                            </Show>
                            
                            <div class="text-zinc-400 font-desc text-sm mb-4 text-center">
                                Connect from another device on the same WiFi
                            </div>
                            
                            <div class="flex flex-col gap-2 text-center bg-black/60 border border-zinc-800 p-4 w-full">
                                <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Target IP</div>
                                <div class="font-mono text-xl text-[#00F0FF] font-bold tracking-wider select-all">{localIp()}:{sharePort()}</div>
                                
                                <div class="w-full h-px bg-zinc-800 my-2"></div>
                                
                                <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">PIN Code</div>
                                <div class="font-mono text-2xl text-white font-bold tracking-[0.5em]">{sharePin()}</div>
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={activeTab() === 'send'}>
                    <div class="flex-1 flex flex-col justify-center border border-zinc-800 bg-[#050505] p-6">
                        <div class="bg-orange-500/10 border border-orange-500/30 text-orange-200 text-xs font-desc p-3 mb-6 flex items-start gap-3">
                            <Smartphone class="shrink-0 text-orange-500" size={16} />
                            <div>
                                Enter the IP and PIN displayed on the receiving device. Ensure both devices are on the same WiFi network.
                            </div>
                        </div>

                        <div class="flex flex-col gap-4 mb-8">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Target IP or URL</label>
                                <input 
                                    type="text" 
                                    value={targetIp()} 
                                    onInput={(e) => setTargetIp(e.currentTarget.value)}
                                    placeholder="e.g. 192.168.1.15" 
                                    class="bg-black border border-zinc-700 text-white font-brains p-3 text-sm focus:outline-none focus:border-orange-500"
                                />
                            </div>
                            
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">PIN Code (If any)</label>
                                <input 
                                    type="text" 
                                    value={targetPin()} 
                                    onInput={(e) => setTargetPin(e.currentTarget.value)}
                                    placeholder="4-Digit PIN" 
                                    maxLength={4}
                                    class="bg-black border border-zinc-700 text-white font-brains p-3 text-sm focus:outline-none focus:border-orange-500 tracking-widest"
                                />
                            </div>
                        </div>

                        <Show when={editorState.saveData} fallback={
                            <button 
                                onClick={handleSelectAndSend}
                                disabled={isSending()}
                                class={`flex items-center cursor-pointer justify-center gap-3 w-full py-4 font-bold text-xs tracking-widest uppercase transition-colors ${
                                    isSending() ? 'bg-orange-900 text-orange-500 opacity-50 cursor-not-allowed' : 
                                    'bg-orange-500 hover:bg-orange-400 text-black border border-orange-600'
                                }`}
                            >
                                <Show when={isSending()} fallback={<><Download size={16} class="rotate-180" /> Select & Send File</>}>
                                    <Loader2 class="animate-spin" size={16} /> Sending...
                                </Show>
                            </button>
                        }>
                            <button 
                                onClick={handleSend}
                                disabled={isSending()}
                                class={`flex items-center justify-center gap-3 w-full py-4 font-bold text-xs tracking-widest uppercase transition-colors ${
                                    isSending() ? 'bg-orange-900 text-orange-500 opacity-50 cursor-not-allowed' : 
                                    'bg-orange-500 hover:bg-orange-400 text-black border border-orange-600'
                                }`}
                            >
                                <Show when={isSending()} fallback={<><Send size={16} /> Send Current Save File</>}>
                                    <Loader2 class="animate-spin" size={16} /> Sending...
                                </Show>
                            </button>
                        </Show>
                    </div>
                </Show>
            </div>
            
            <Show when={isQrExpanded()}>
                <Portal>
                    <div 
                        class="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-8 cursor-pointer"
                        onClick={() => setIsQrExpanded(false)}
                    >
                        <div class="bg-white p-2 w-[80vmin] h-[80vmin] max-w-[400px] max-h-[400px] flex items-center justify-center">
                            <img src={expandedQrCodeUrl() || qrCodeUrl()} alt="Expanded QR Code" class="w-full h-full object-contain [image-rendering:pixelated]" />
                        </div>
                        <div class="mt-8 text-white font-mono text-xl tracking-widest text-center">
                            <div>{localIp()}:{sharePort()}</div>
                            <div class="mt-4 bg-zinc-900 px-6 py-2 border border-zinc-700 font-bold tracking-[0.5em] text-3xl">PIN: {sharePin()}</div>
                        </div>
                        <div class="mt-8 text-zinc-500 font-bold uppercase tracking-widest text-xs">
                            [ CLICK ANYWHERE TO CLOSE ]
                        </div>
                    </div>
                </Portal>
            </Show>
        </Modal>
    );
}
