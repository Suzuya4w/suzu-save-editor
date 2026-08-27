import { createSignal, Show } from 'solid-js';
import { RefreshCw, FileSearch, Scissors, Import, Loader2, ArrowRightLeft } from 'lucide-solid';
import { Modal } from './Modal';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { addToast } from '../store/toastStore';

interface PlatformConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlatformConverterModal(props: PlatformConverterModalProps) {
  const [activeTab, setActiveTab] = createSignal<'stripper' | 'injector' | 'endian'>('stripper');
  const [isConfirmOpen, setIsConfirmOpen] = createSignal(false)

  // Shared state
  const [selectedFile, setSelectedFile] = createSignal<string>('');
  const [isProcessing, setIsProcessing] = createSignal(false);

  // Stripper state
  const [stripBytesDec, setStripBytesDec] = createSignal<string>('16');
  const [stripBytesHex, setStripBytesHex] = createSignal<string>('0x10');

  // Injector state
  const [injectHex, setInjectHex] = createSignal<string>('');

  // Endian state
  const [endianChunk, setEndianChunk] = createSignal<number>(2); // 2, 4, or 8

  // Confirm state
  const [confirmAction, setConfirmAction] = createSignal<{type: 'stripper' | 'injector' | 'endian', msg: string} | null>(null);

  const closeConfirmModal = () => {
    setIsConfirmOpen(false);
    setTimeout(() => {
      setConfirmAction(null);
    }, 300); 
  };

  const executeAction = () => {
    const action = confirmAction()?.type;
    closeConfirmModal();
    if (action === 'stripper') executeStripper();
    if (action === 'injector') executeInjector();
    if (action === 'endian') executeEndian();
  };

  const selectFile = async () => {
    const file = await open({
      multiple: false,
      title: "Select Save File to Convert"
    });
    if (file) {
      setSelectedFile(file as string);
    }
  };

  const handleDecChange = (e: any) => {
    const val = e.target.value;
    setStripBytesDec(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      setStripBytesHex('0x' + parsed.toString(16).toUpperCase());
    } else {
      setStripBytesHex('');
    }
  };

  const handleHexChange = (e: any) => {
    let val = e.target.value;
    setStripBytesHex(val);
    
    val = val.replace('0x', '').replace('0X', '');
    const parsed = parseInt(val, 16);
    if (!isNaN(parsed)) {
      setStripBytesDec(parsed.toString(10));
    } else {
      setStripBytesDec('');
    }
  };

  const processStripper = async () => {
    if (!selectedFile()) return addToast("Please select a file first", "error");
    const bytes = parseInt(stripBytesDec(), 10);
    if (isNaN(bytes) || bytes < 0) return addToast("Invalid byte count", "error");

    setConfirmAction({
      type: 'stripper',
      msg: `Are you sure you want to remove ${bytes} bytes from the beginning of the file?`
    });
    setIsConfirmOpen(true);
  };

  const executeStripper = async () => {
    const bytes = parseInt(stripBytesDec(), 10);

    setIsProcessing(true);
    addToast("Stripping header...", "info");
    try {
      const outPath: string = await invoke('strip_save_header', { 
        filePath: selectedFile(), 
        bytesToStrip: bytes 
      });
      addToast(`Success! Saved as: ${outPath}`, "success");
    } catch (err: any) {
      addToast(`Error: ${err}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const processInjector = async () => {
    if (!selectedFile()) return addToast("Please select a file first", "error");
    if (!injectHex().trim()) return addToast("Please provide hex header", "error");

    setConfirmAction({
      type: 'injector',
      msg: 'Are you sure you want to inject this hex header into the file?'
    });
    setIsConfirmOpen(true);
  };

  const executeInjector = async () => {

    setIsProcessing(true);
    addToast("Injecting header...", "info");
    try {
      const outPath: string = await invoke('inject_save_header', { 
        filePath: selectedFile(), 
        hexStringHeader: injectHex() 
      });
      addToast(`Success! Saved as: ${outPath}`, "success");
    } catch (err: any) {
      addToast(`Error: ${err}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const processEndian = async () => {
    if (!selectedFile()) return addToast("Please select a file first", "error");

    setConfirmAction({
      type: 'endian',
      msg: `Are you sure you want to flip the data structure (${endianChunk()}-byte chunks)?`
    });
    setIsConfirmOpen(true);
  };

  const executeEndian = async () => {

    setIsProcessing(true);
    addToast("Swapping Endianness...", "info");
    try {
      const outPath: string = await invoke('swap_endianness', { 
        filePath: selectedFile(), 
        chunkSize: endianChunk() 
      });
      addToast(`Success! Saved as: ${outPath}`, "success");
    } catch (err: any) {
      addToast(`Error: ${err}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessClick = () => {
    if (activeTab() === 'stripper') processStripper();
    if (activeTab() === 'injector') processInjector();
    if (activeTab() === 'endian') processEndian();
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Cross-Platform Converter"
      icon={<RefreshCw size={18} />}
      width="max-w-3xl"
    >
      <div class="flex flex-col">
        {/* Custom Confirm Modal */}
      <Modal
        isOpen={isConfirmOpen()} 
        onClose={closeConfirmModal}
        title="DOUBLE CONFIRM"
        width="max-w-md"
      >
        <div class="flex flex-col">
          <p class="text-zinc-300 text-sm font-desc mb-6 leading-relaxed">{confirmAction()?.msg}</p>
          <div class="flex gap-4">
            <button 
              onClick={closeConfirmModal} 
              class="flex-1 px-4 py-3 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              onClick={executeAction}
              class="flex-1 px-4 py-3 bg-[#FF7A00] text-black hover:bg-[#FF7A00]/80 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Proceed
            </button>
          </div>
        </div>
      </Modal>

        {/* Info Banner */}
        <div class="bg-yellow-500/10 border-l-2 border-yellow-500 p-4 mb-6 shrink-0">
          <p class="text-xs font-desc text-yellow-500/90 leading-relaxed">
            <strong>Cross-Platform Conversion:</strong> Easily transfer save files between PC and Consoles (like Nintendo Switch or PS4). <br/>
            <span class="text-yellow-400">Don't worry, these tools will safely create a NEW copied file and will never overwrite your original save.</span>
          </p>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-zinc-800 shrink-0 mb-6">
          <button
            onClick={() => setActiveTab('stripper')}
            class={`flex cursor-pointer items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-widest transition-all border-b-2 ${
              activeTab() === 'stripper' ? 'text-[#00F0FF] border-[#00F0FF] bg-[#00F0FF]/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <Scissors size={14} /> Remove Console Lock
          </button>
          <button
            onClick={() => setActiveTab('injector')}
            class={`flex cursor-pointer items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-widest transition-all border-b-2 ${
              activeTab() === 'injector' ? 'text-[#FF7A00] border-[#FF7A00] bg-[#FF7A00]/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <Import size={14} /> Add Console Lock
          </button>
          <button
            onClick={() => setActiveTab('endian')}
            class={`flex cursor-pointer items-center gap-2 px-6 py-3 font-bold text-xs uppercase tracking-widest transition-all border-b-2 ${
              activeTab() === 'endian' ? 'text-emerald-400 border-emerald-400 bg-emerald-400/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            <ArrowRightLeft size={14} /> Flip Data Structure
          </button>
        </div>

        {/* File Picker (Shared) */}
        <div class="mb-8 shrink-0">
          <label class="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Select Your File</label>
          <div class="flex items-center gap-2">
            <button 
              onClick={selectFile}
              class="bg-zinc-900 cursor-pointer hover:bg-zinc-800 border border-zinc-700 text-zinc-300 px-4 py-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors shrink-0"
            >
              <FileSearch size={14} /> Browse
            </button>
            <div class="flex-1 bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-xs font-desc text-zinc-400 truncate overflow-hidden">
              {selectedFile() || "No file selected..."}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div class="h-[260px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 pb-4">
          
          <Show when={activeTab() === 'stripper'}>
            <div class="flex-1 flex flex-col space-y-6">
              <p class="text-xs text-zinc-400 font-desc leading-relaxed">
                Removes the extra "Console Lock" (Header) at the beginning of your console save file so it can be read on a PC. For example, Nintendo Switch games usually have 16 extra bytes at the top.
              </p>
              
              <div class="grid grid-cols-2 gap-6">
                <div>
                  <label class="block text-[10px] font-bold text-[#00F0FF] uppercase tracking-widest mb-2">Number to Remove (Decimal)</label>
                  <input 
                    type="number"
                    value={stripBytesDec()}
                    onInput={handleDecChange}
                    class="w-full bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-sm font-desc text-zinc-200 outline-none focus:border-[#00F0FF] transition-colors"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Number to Remove (Hex)</label>
                  <input 
                    type="text"
                    value={stripBytesHex()}
                    onInput={handleHexChange}
                    class="w-full bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-sm font-desc text-zinc-400 outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'injector'}>
            <div class="flex-1 flex flex-col space-y-6">
              <p class="text-xs text-zinc-400 font-desc leading-relaxed">
                Adds a "Console Lock" (Header) back to your save file so it can be played on your console again. Just paste the console's secret hex numbers here.
              </p>
              
              <div>
                <label class="block text-[10px] font-bold text-[#FF7A00] uppercase tracking-widest mb-2">Console Hex Code</label>
                <textarea 
                  value={injectHex()}
                  onInput={(e) => setInjectHex(e.target.value)}
                  placeholder="e.g. 00 00 00 10 4A 55 4E 4B"
                  class="w-full h-32 bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-sm font-desc text-zinc-200 outline-none focus:border-[#FF7A00] transition-colors resize-none"
                />
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'endian'}>
            <div class="flex-1 flex flex-col space-y-6">
              <p class="text-xs text-zinc-400 font-desc leading-relaxed">
                Flip the data structure of your save file. Older consoles like PS3 or Wii read data backwards compared to a PC. Use this to flip the data so the target console can understand it.
              </p>
              
              <div>
                <label class="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Flip Block Size</label>
                <select 
                  value={endianChunk()}
                  onChange={(e) => setEndianChunk(parseInt(e.target.value, 10))}
                  class="w-full bg-[#0a0a0a] border border-zinc-800 px-4 py-3 text-sm font-bold font-serif text-zinc-200 outline-none focus:border-emerald-400 transition-colors appearance-none cursor-pointer"
                >
                  <option value={2}>Small Block (16-bit / 2 Bytes)</option>
                  <option value={4}>Medium Block (32-bit / 4 Bytes)</option>
                  <option value={8}>Large Block (64-bit / 8 Bytes)</option>
                </select>
              </div>
            </div>
          </Show>
        </div>
<div class="shrink-0 mt-2 border-t border-zinc-800 pt-4">
          <button 
            onClick={handleProcessClick}
            disabled={isProcessing() || !selectedFile()}
            class={`w-full py-4 font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer ${
              activeTab() === 'stripper' ? 'bg-[#00F0FF]/10 border border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black' :
              activeTab() === 'injector' ? 'bg-[#FF7A00]/10 border border-[#FF7A00] text-[#FF7A00] hover:bg-[#FF7A00] hover:text-black' :
              'bg-emerald-400/10 border border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black'
            }`}
          >
            <Show when={isProcessing()}>
              <Loader2 size={16} class="animate-spin" /> Processing...
            </Show>
            <Show when={!isProcessing()}>
              <Show when={activeTab() === 'stripper'}>
                <Scissors size={16} /> Remove Lock & Save Copy
              </Show>
              <Show when={activeTab() === 'injector'}>
                <Import size={16} /> Add Lock & Save Copy
              </Show>
              <Show when={activeTab() === 'endian'}>
                <ArrowRightLeft size={16} /> Flip Data & Save Copy
              </Show>
            </Show>
          </button>
        </div>

      </div>
    </Modal>
  );
}
