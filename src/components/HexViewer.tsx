// @ts-nocheck
import { createSignal, createEffect, createMemo, For, Show, onCleanup } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { useHexStore, setRawPayload, setDiffFileB, setDiffs, clearDiffs } from '../store/hexStore';
import { AlertTriangle, Binary, Search as SearchIcon, Replace, Cpu, ShieldAlert, AlignLeft, ArchiveRestore, Unlock, Activity, Info, X, FileDiff, Upload, ArrowRight, Plus, Save, Code, ChevronLeft, ChevronRight, HelpCircle, GitMerge } from 'lucide-solid';
import { Modal } from './Modal';
import { useEditorStore, updateRawPayload, loadSaveData, setIsHelpModalOpen, setHelpModalSection } from '../store/editorStore';
import { useToastStore, addToast } from '../store/toastStore';
import { openSaveFile, loadLocalProfiles, deleteLocalProfile, calculateEntropy, extractStrings, xorDecrypt, decompressPayload, compareFiles, DiffResult, saveLocalProfile } from '../services/ipc';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeTextFile } from '@tauri-apps/plugin-fs';

function Tooltip(props: { text: string, position?: 'top' | 'bottom', align?: 'center' | 'left' | 'right', class?: string, children: any }) {
  const [show, setShow] = createSignal(false);
 
  let alignmentClass = 'left-1/2 -translate-x-1/2';
  if (props.align === 'left') alignmentClass = 'left-0';
  if (props.align === 'right') alignmentClass = 'right-0';

  return (
    <div
      class="relative inline-flex items-center justify-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <div class={`absolute z-[100] whitespace-nowrap px-2 py-1 bg-black text-white text-[10px] font-black tracking-widest uppercase border-2 border-white pointer-events-none shadow-[4px_4px_0px_white] ${alignmentClass} ${props.position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${props.class || ''}`}>
          {props.text}
        </div>
      </Show>
    </div>
  );
}

const BYTES_PER_ROW = 16;

export const HexViewer = () => {
 const hexState = useHexStore();
 const editorState = useEditorStore();

 type SearchType = 'u8' | 'i16' | 'u16' | 'int32' | 'i32' | 'u32' | 'f32' | 'string' | 'hex';
 const [searchType, setSearchType] = createSignal<SearchType>('int32');
 const [searchValue, setSearchValue] = createSignal('');
 const [replaceValue, setReplaceValue] = createSignal('');
 const [scanResults, setScanResults] = createSignal<{offset: number, length: number}[]>([]);
 const [isScanning, setIsScanning] = createSignal(false);
 const [isInjectConfirmOpen, setIsInjectConfirmOpen] = createSignal(false);
 const [pendingInject, setPendingInject] = createSignal<{offset: number, length: number, type?: string} | null>(null);

 type ActiveTool = 'none' | 'strings' | 'xor' | 'profiles' | 'diff';
 const [activeTool, setActiveTool] = createSignal<ActiveTool>('none');
 const [localProfiles, setLocalProfiles] = createSignal<any[]>([]);
 const [isLoadingProfiles, setIsLoadingProfiles] = createSignal(false);
 const [extractedStrings, setExtractedStrings] = createSignal<string[]>([]);
 const [stringMinLen, setStringMinLen] = createSignal<number>(5);
 const [stringShowLetters, setStringShowLetters] = createSignal<boolean>(true);
 const [stringShowDigits, setStringShowDigits] = createSignal<boolean>(true);
 const [stringShowSymbols, setStringShowSymbols] = createSignal<boolean>(true);
 const [stringSearchQuery, setStringSearchQuery] = createSignal<string>("");

 const filteredStrings = createMemo(() => {
  const query = stringSearchQuery();
  const list = extractedStrings();
  if (!query) return list;
  try {
   const regex = new RegExp(query, 'i');
   return list.filter(s => regex.test(s));
  } catch {
   return list.filter(s => s.toLowerCase().includes(query.toLowerCase()));
  }
 });
 const [xorKeyInput, setXorKeyInput] = createSignal('');

 const [dockHeight, setDockHeight] = createSignal(Number(localStorage.getItem('suzu_dock_height')) || 300);
 const [isDraggingDock, setIsDraggingDock] = createSignal(false);

 const fileB = () => hexState.diffFileB;
 const setFileB = setDiffFileB;
 const diffs = () => hexState.diffs;
 const [isComparing, setIsComparing] = createSignal(false);
 const [fileBufferB, setFileBufferB] = createSignal<Uint8Array | null>(null);
 const [diffSearchQuery, setDiffSearchQuery] = createSignal('');
 const [diffSearchType, setDiffSearchType] = createSignal<'u8' | 'i16' | 'u16' | 'i32' | 'u32' | 'f32' | 'string'>('u32');

 const [isProfileBuilderOpen, setIsProfileBuilderOpen] = createSignal(false);
 const [profileName, setProfileName] = createSignal('New_Profile');
 const [profileDeveloper, setProfileDeveloper] = createSignal('');
 const [profileEngine, setProfileEngine] = createSignal('');
 const [profileAuthor, setProfileAuthor] = createSignal('');
 const [profileVersion, setProfileVersion] = createSignal('');
 const [profileNotes, setProfileNotes] = createSignal('');
 const [isMetadataOpen, setIsMetadataOpen] = createSignal(false);
 const [mappedVars, setMappedVars] = createSignal<{ offset: number; name: string; type: string; size: number }[]>([]);

 const [appliedProfileName, setAppliedProfileName] = createSignal<string | null>(null);
 const [appliedProfileMappings, setAppliedProfileMappings] = createSignal<{ offset: number; name: string; type: string; size: number }[]>([]);

 const [mappingOffset, setMappingOffset] = createSignal<number | null>(null);
 const [mapName, setMapName] = createSignal('');
 const [mapType, setMapType] = createSignal<'u8'|'i16'|'u16'|'i32'|'u32'|'f32'|'string'>('u8');
 const [manualOffsetStr, setManualOffsetStr] = createSignal('');
 const [isManualAddOpen, setIsManualAddOpen] = createSignal(false);

 const [selectedProfiles, setSelectedProfiles] = createSignal<string[]>([]);
 const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
 const [viewingProfile, setViewingProfile] = createSignal<any | null>(null);
 const [isProfileInfoOpen, setIsProfileInfoOpen] = createSignal(false);
 const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = createSignal(false);
 const [injectValues, setInjectValues] = createSignal<Record<number, string>>({});
 const [isApplyConfirmOpen, setIsApplyConfirmOpen] = createSignal(false);
 const [pendingApplyProfile, setPendingApplyProfile] = createSignal<any | null>(null);

 const confirmApplyProfile = (profile: any) => {
  setPendingApplyProfile(profile);
  setIsApplyConfirmOpen(true);
 };

 const handleDeleteSelectedProfiles = async () => {
  try {
   for (const id of selectedProfiles()) {
    await deleteLocalProfile(id);
   }
   addToast(`Successfully deleted ${selectedProfiles().length} profile(s).`, "success");
   setSelectedProfiles([]);
   setIsDeleteConfirmOpen(false);
   const profiles = await loadLocalProfiles();
   setLocalProfiles(profiles);
  } catch (err: any) {
   addToast(`Failed to delete: ${err}`, "error");
   setIsDeleteConfirmOpen(false);
  }
 };

 const handleExportSelectedProfiles = async () => {
  const selected = localProfiles().filter(p => selectedProfiles().includes(p.id));
  if (selected.length === 0) return;
  
  try {
   const savePath = await save({
    filters: [{ name: 'JSON Profile Data', extensions: ['json'] }],
    defaultPath: `exported_profiles_${selected.length}.json`
   });

   if (savePath) {
    await writeTextFile(savePath, JSON.stringify(selected, null, 2));
    addToast(`Successfully exported ${selected.length} profile(s).`, "success");
    setSelectedProfiles([]);
   }
  } catch (err: any) {
   addToast(`Failed to export: ${err}`, "error");
  }
 };

 const [scrollTop, setScrollTop] = createSignal(0);
 let scrollContainerRef: HTMLDivElement | undefined;
 
 const scrollToOffset = (offset: number) => {
  if (!scrollContainerRef) return;
  const rowIndex = Math.floor(offset / 16);
  scrollContainerRef.scrollTo({ top: rowIndex * 24, behavior: 'smooth' });
  setSelectionStart(offset);
  setSelectionEnd(offset);
 };
 const [clientHeight, setClientHeight] = createSignal(1080);
 const rowHeight = 24;
 const overscan = 40;

 const [selectionStart, setSelectionStart] = createSignal<number | null>(null);
 const [selectionEnd, setSelectionEnd] = createSignal<number | null>(null);
 const [isSelecting, setIsSelecting] = createSignal(false);

 // Inline Editing State
 const [editedBytes, setEditedBytes] = createStore<Record<number, number>>({});
 const [editBuffer, setEditBuffer] = createSignal<string>('');

 const [hoveredProfileVar, setHoveredProfileVar] = createSignal<any | null>(null);
 const [hoverPos, setHoverPos] = createSignal({x: 0, y: 0});

 createEffect(() => {
  const handleMouseUp = () => setIsSelecting(false);
 
   const handleKeyDown = async (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
     setSelectionStart(null);
     setSelectionEnd(null);
     setEditBuffer('');
     return;
    }

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
     if (activeEl.id !== 'hex-hidden-input') {
      return;
     }
    }

    const start = selectionStart();
    const end = selectionEnd();

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
     if (start !== null && end !== null && payload().length > 0) {
      e.preventDefault();
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      const selectedBytes = payload().slice(min, max + 1);

      let copyString = '';
      if (e.shiftKey) {
       copyString = Array.from(selectedBytes).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      } else {
       copyString = Array.from(selectedBytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      }
     
      if (copyString.length > 0) {
       try {
        await navigator.clipboard.writeText(copyString);
        addToast(`Copied ${max - min + 1} bytes to clipboard (${e.shiftKey ? 'ASCII' : 'HEX'})`, "success");
       } catch (err) {
        console.error("Clipboard API failed: ", err);
        const textArea = document.createElement("textarea");
        textArea.value = copyString;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
         document.execCommand('copy');
         addToast(`Copied ${max - min + 1} bytes to clipboard (${e.shiftKey ? 'ASCII' : 'HEX'})`, "success");
        } catch (err2) {
         addToast(`Failed to copy to clipboard`, "error");
        }
        document.body.removeChild(textArea);
       }
      }
     }
     return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (start !== null && end !== null) {
        e.preventDefault();
        setEditBuffer('');
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        
        const reverts: Record<number, any> = {};
        for (let i = min; i <= max; i++) {
          if (editedBytes[i] !== undefined) {
            reverts[i] = undefined;
          }
        }
        setEditedBytes(reverts);
      }
      return;
    }

    if (start !== null && end !== null) {
      const min = Math.min(start, end);
      const maxIdx = payload().length - 1;
      const max = Math.min(Math.max(start, end), maxIdx);
      const isSingleSelection = start === end;

      // Hex Input
      if (/^[0-9a-fA-F]$/.test(e.key)) {
        e.preventDefault();
        const char = e.key.toUpperCase();
        if (editBuffer().length === 0) {
          setEditBuffer(char);
        } else {
          const newHex = editBuffer() + char;
          const newByte = parseInt(newHex, 16);
          
          const newEdits: Record<number, number> = {};
          for (let i = min; i <= max; i++) {
            newEdits[i] = newByte;
          }
          setEditedBytes(newEdits);
          setEditBuffer('');
          
          if (isSingleSelection) {
            if (min < maxIdx) {
              setSelectionStart(min + 1);
              setSelectionEnd(min + 1);
              scrollToOffset(min + 1);
            }
          } else {
             // For multi-selection, collapse to the end
             setSelectionStart(max);
             setSelectionEnd(max);
             scrollToOffset(max);
          }
        }
        return;
      }

      // Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (editBuffer().length > 0) {
          setEditBuffer('');
        } else if (isSingleSelection && min > 0) {
          setSelectionStart(min - 1);
          setSelectionEnd(min - 1);
          scrollToOffset(min - 1);
        }
        return;
      }

      // Navigation
      if (e.key === 'ArrowRight' && max < maxIdx) { e.preventDefault(); setSelectionStart(max + 1); setSelectionEnd(max + 1); setEditBuffer(''); scrollToOffset(max + 1); return; }
      if (e.key === 'ArrowLeft' && min > 0) { e.preventDefault(); setSelectionStart(min - 1); setSelectionEnd(min - 1); setEditBuffer(''); scrollToOffset(min - 1); return; }
      if (e.key === 'ArrowDown' && max + 16 <= maxIdx) { e.preventDefault(); setSelectionStart(max + 16); setSelectionEnd(max + 16); setEditBuffer(''); scrollToOffset(max + 16); return; }
      if (e.key === 'ArrowUp' && min - 16 >= 0) { e.preventDefault(); setSelectionStart(min - 16); setSelectionEnd(min - 16); setEditBuffer(''); scrollToOffset(min - 16); return; }
    }
   };

  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('keydown', handleKeyDown);

  onCleanup(() => {
   window.removeEventListener('mouseup', handleMouseUp);
   window.removeEventListener('keydown', handleKeyDown);
  });
 });

 createEffect(() => {
  const b64 = editorState.saveData?.raw_payload;
  if (b64 && typeof b64 === 'string') {
   try {
    const binaryString = atob(b64);
    const newPayload = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
     newPayload[i] = binaryString.charCodeAt(i);
    }
    setRawPayload(newPayload);
   } catch (e) {
    console.error("Failed to decode base64 payload", e);
   }
  } else {
   setRawPayload(new Uint8Array(0));
  }
 });

 createEffect(() => {
  const handler = (e: CustomEvent) => {
   setEditorState(e.detail);
  };
  window.addEventListener('save-editor-update', handler as EventListener);
  return () => window.removeEventListener('save-editor-update', handler as EventListener);
 });

 let stringExtractTimeoutId: any;
 createEffect(() => {
  if (activeTool() !== 'strings') return;
  const b64 = editorState.saveData?.raw_payload;
  if (!b64 || typeof b64 !== 'string') return;
  
  const minLen = stringMinLen();
  const showL = stringShowLetters();
  const showD = stringShowDigits();
  const showS = stringShowSymbols();

  clearTimeout(stringExtractTimeoutId);
  stringExtractTimeoutId = setTimeout(async () => {
   try {
    const strs = await extractStrings(b64, minLen, showL, showD, showS);
    setExtractedStrings(strs);
   } catch (e) {
    addToast(`String extraction failed: ${e}`, "error");
   }
  }, 300);
 });

 const payload = () => hexState.rawPayload || new Uint8Array(0);
 const rowCount = () => Math.ceil(payload().length / BYTES_PER_ROW);

 const visibleRows = () => {
  const maxRow = rowCount() - 1;
  if (maxRow < 0) return [];
 
  const start = Math.max(0, Math.floor(scrollTop() / rowHeight) - overscan);
  const end = Math.min(maxRow, Math.ceil((scrollTop() + clientHeight()) / rowHeight) + overscan);
 
  const rows = [];
  for (let i = start; i <= end; i++) {
   rows.push(i);
  }
  return rows;
 };

 const getAsciiChar = (byte: number) => {
  return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
 };

 const handleScan = () => {
  if (!hexState.rawPayload) return;
  if (!searchValue()) return;

  let targetBytes: Uint8Array;

  try {
   if (searchType() === 'string') {
    targetBytes = new TextEncoder().encode(searchValue());
   } else if (searchType() === 'hex') {
    const cleaned = searchValue().replace(/\s/g, '');
    if (cleaned.length % 2 !== 0) throw new Error("Hex string must have an even number of characters");
    const match = cleaned.match(/.{1,2}/g);
    if (!match) throw new Error("Invalid Hex");
    targetBytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
   } else {
    const val = Number(searchValue());
    if (isNaN(val)) throw new Error(`Invalid number for ${searchType()}`);
    
    let buffer: ArrayBuffer;
    switch(searchType()) {
     case 'u8':
      buffer = new ArrayBuffer(1);
      new DataView(buffer).setUint8(0, val);
      break;
     case 'i16':
      buffer = new ArrayBuffer(2);
      new DataView(buffer).setInt16(0, val, true);
      break;
     case 'u16':
      buffer = new ArrayBuffer(2);
      new DataView(buffer).setUint16(0, val, true);
      break;
     case 'int32':
     case 'i32':
      buffer = new ArrayBuffer(4);
      new DataView(buffer).setInt32(0, val, true);
      break;
     case 'u32':
      buffer = new ArrayBuffer(4);
      new DataView(buffer).setUint32(0, val, true);
      break;
     case 'f32':
      buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, val, true);
      break;
     default:
      throw new Error(`Unsupported type: ${searchType()}`);
    }
    targetBytes = new Uint8Array(buffer);
   }
  } catch (e: any) {
   addToast(`Invalid search value: ${e.message}`, "error");
   return;
  }

  if (targetBytes.length === 0) return;

  setIsScanning(true);
  setTimeout(() => {
   const results: {offset: number, length: number}[] = [];
   const payload = hexState.rawPayload!;
   const targetLen = targetBytes.length;

   for (let i = 0; i <= payload.length - targetLen; i++) {
    let match = true;
    for (let j = 0; j < targetLen; j++) {
     if (payload[i + j] !== targetBytes[j]) {
      match = false;
      break;
     }
    }
    if (match) {
     results.push({ offset: i, length: targetLen });
    }
   }

   setScanResults(results);
   setIsScanning(false);
   addToast(`Found ${results.length} matching values!`, results.length > 0 ? "success" : "info");
  }, 100);
 };

 const handleReplace = (offset: number, targetLen: number, type: string) => {
  if (!hexState.rawPayload) return;
  if (!replaceValue()) return;

  let replaceBytes: Uint8Array;

  try {
   if (type === 'string') {
    replaceBytes = new TextEncoder().encode(replaceValue());
   } else if (type === 'hex') {
    const cleaned = replaceValue().replace(/\s/g, '');
    if (cleaned.length % 2 !== 0) throw new Error("Hex string must have an even number of characters");
    const match = replaceValue().match(/.{1,2}/g);
    if (!match) throw new Error("Invalid Hex");
    replaceBytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
   } else {
    const val = Number(replaceValue());
    if (isNaN(val)) throw new Error(`Invalid number for ${type}`);
    
    let buffer: ArrayBuffer;
    switch(type) {
     case 'u8':
      buffer = new ArrayBuffer(1);
      new DataView(buffer).setUint8(0, val);
      break;
     case 'i16':
      buffer = new ArrayBuffer(2);
      new DataView(buffer).setInt16(0, val, true);
      break;
     case 'u16':
      buffer = new ArrayBuffer(2);
      new DataView(buffer).setUint16(0, val, true);
      break;
     case 'int32':
     case 'i32':
      buffer = new ArrayBuffer(4);
      new DataView(buffer).setInt32(0, val, true);
      break;
     case 'u32':
      buffer = new ArrayBuffer(4);
      new DataView(buffer).setUint32(0, val, true);
      break;
     case 'f32':
      buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, val, true);
      break;
     default:
      throw new Error(`Unsupported type: ${type}`);
    }
    replaceBytes = new Uint8Array(buffer);
   }
  } catch (e: any) {
   addToast(`Invalid replacement value: ${e.message}`, "error");
   return;
  }

  if (replaceBytes.length !== targetLen) {
   addToast(`Length mismatch! Target is ${targetLen} bytes, Replacement is ${replaceBytes.length} bytes.`, "error");
   return;
  }

  const newPayload = new Uint8Array(hexState.rawPayload);
  for (let i = 0; i < targetLen; i++) {
   newPayload[offset + i] = replaceBytes[i];
  }

  setRawPayload(newPayload);

  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < newPayload.length; i += chunkSize) {
   binaryString += String.fromCharCode.apply(null, Array.from(newPayload.subarray(i, i + chunkSize)));
  }
  const base64String = btoa(binaryString);

  updateRawPayload(base64String);

  addToast(`Successfully patched offset 0x${offset.toString(16).toUpperCase()}!`, "success");
  handleScan();
 };

  const handleCommitEdits = () => {
   const editKeys = Object.keys(editedBytes).map(Number);
   if (editKeys.length === 0) return;

   const currentPayload = payload();
   if (!currentPayload) return;

   const newPayload = new Uint8Array(currentPayload);
   for (const offset of editKeys) {
    newPayload[offset] = editedBytes[offset];
   }

   setRawPayload(newPayload);

   let binaryString = '';
   const chunkSize = 8192;
   for (let i = 0; i < newPayload.length; i += chunkSize) {
    binaryString += String.fromCharCode.apply(null, Array.from(newPayload.subarray(i, i + chunkSize)));
   }
   const base64String = btoa(binaryString);

   updateRawPayload(base64String);
   setEditedBytes({});
   setEditBuffer('');
   addToast(`Committed ${editKeys.length} modifications to memory. Don't forget to SAVE FILE!`, "success");
  };

 const handleOpenProfiles = async () => {
  setActiveTool(activeTool() === 'profiles' ? 'none' : 'profiles');
  if (activeTool() !== 'profiles') return;
  setIsLoadingProfiles(true);
  try {
   const profiles = await loadLocalProfiles();
   setLocalProfiles(profiles);
  } catch(e) {
   addToast("Failed to load profiles", "error");
  } finally {
   setIsLoadingProfiles(false);
  }
 };

 const handleApplyProfile = async (profile: any) => {
  setActiveTool('none');
  try {
   const { filePath, saveData } = editorState;
   if (!filePath || !saveData?.raw_payload) return;
   
   const b64 = saveData.raw_payload;
   const binaryString = atob(b64);
   const buffer = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
   }
   
   const dataView = new DataView(buffer.buffer);
   let hasInjects = false;
   let newMappedVars: any[] = [];
   
   if (profile.rules && Array.isArray(profile.rules)) {
    for (const rule of profile.rules) {
     if (rule.type === "hex_inject") {
      hasInjects = true;
      const offset = rule.offset;
      const value = rule.value;
      
      switch (rule.value_type) {
       case 'u8':
        dataView.setUint8(offset, value);
        break;
       case 'i16':
        dataView.setInt16(offset, value, true);
        break;
       case 'u16':
        dataView.setUint16(offset, value, true);
        break;
       case 'i32':
        dataView.setInt32(offset, value, true);
        break;
       case 'u32':
        dataView.setUint32(offset, value, true);
        break;
       case 'f32':
        dataView.setFloat32(offset, value, true);
        break;
       case 'string': {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(value);
        const len = Math.min(encoded.length, rule.size || encoded.length);
        for (let i = 0; i < len; i++) {
         buffer[offset + i] = encoded[i];
        }
        break;
       }
      }
     } else if (rule.type === "HexOffset" || rule.type === "hex_offset") {
      newMappedVars.push({
       name: rule.keys && rule.keys.length > 0 ? rule.keys[0] : 'Unknown',
       offset: rule.offset,
       type: rule.value_type,
       size: rule.size || 0
      });
     }
    }
   }
   
   if (hasInjects) {
    let newBinaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < buffer.length; i += chunkSize) {
     newBinaryString += String.fromCharCode.apply(null, Array.from(buffer.subarray(i, i + chunkSize)));
    }
    const newBase64 = btoa(newBinaryString);
    
    updateRawPayload(newBase64);
    setRawPayload(buffer);
   }
   
   if (newMappedVars.length > 0) {
    setAppliedProfileMappings(newMappedVars);
    setAppliedProfileName(profile.title || profile.name || 'Unknown');
    setActiveTool('active_profile');
   }
   
   // Save checksum rules for the backend to process upon writing
   if (profile.checksums && Array.isArray(profile.checksums)) {
    setEditorState('activeProfileChecksums', profile.checksums);
   } else {
    setEditorState('activeProfileChecksums', null);
   }
   
   addToast(`Profile "${profile.title || profile.name || 'Unknown'}" applied successfully!`, "success");
  } catch (e) {
   addToast(`Failed to apply profile: ${e}`, "error");
  }
 };

 const handleEntropy = async () => {
  const b64 = editorState.saveData?.raw_payload;
  if (!b64 || typeof b64 !== 'string') {
   addToast("No valid binary payload found", "error");
   return;
  }
  try {
   const entropy = await calculateEntropy(b64);
   let msg = `Entropy: ${entropy.toFixed(4)} / 8.0`;
   if (entropy > 7.5) msg += " (High - Likely Encrypted/Compressed)";
   else if (entropy < 4.0) msg += " (Low - Likely Raw Data/Text)";
   addToast(msg, "info");
  } catch (e) {
   addToast(`Entropy failed: ${e}`, "error");
  }
 };

 const handleStrings = async () => {
  if (activeTool() === 'strings') {
   setActiveTool('none');
   return;
  }
  setActiveTool('strings');
 };

 const handleDecompress = async (method: string) => {
  const b64 = editorState.saveData?.raw_payload;
  if (!b64 || typeof b64 !== 'string') return;
  try {
   const newB64 = await decompressPayload(b64, method);
   updateRawPayload(newB64);
   const binaryString = atob(newB64);
   const newPayload = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) newPayload[i] = binaryString.charCodeAt(i);
   setRawPayload(newPayload);
   addToast(`Successfully unpacked using ${method.toUpperCase()}!`, "success");
  } catch (e) {
   addToast(`Decompression failed: ${e}`, "error");
  }
 };

 const handleDragStart = (e: MouseEvent) => {
  e.preventDefault();
  setIsDraggingDock(true);
  const startY = e.clientY;
  const startHeight = dockHeight();

  const handleMouseMove = (me: MouseEvent) => {
   const delta = startY - me.clientY;
   const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, startHeight + delta));
   setDockHeight(newHeight);
  };

  const handleMouseUp = () => {
   setIsDraggingDock(false);
   localStorage.setItem('suzu_dock_height', dockHeight().toString());
   window.removeEventListener('mousemove', handleMouseMove);
   window.removeEventListener('mouseup', handleMouseUp);
  };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
 };

 const handleSelectFileB = async () => {
  try {
   const selected = await open({
    multiple: false,
    title: "Select Modified Save File (File B)"
   });
   if (selected && typeof selected === 'string') {
    setFileB(selected);
   }
  } catch (err) {
   addToast("Failed to select File B", "error");
  }
 };

 const handleCompare = async () => {
  if (!editorState.filePath || !fileB()) return;
  setIsComparing(true);
  try {
   const buffer = await readFile(fileB()!);
   setFileBufferB(buffer);

   const result = await compareFiles(editorState.filePath, fileB()!);
   setDiffs(result);
   addToast(`Found ${result.length} differences!`, "success");
  } catch (error) {
   addToast(`Comparison failed: ${error}`, "error");
  } finally {
   setIsComparing(false);
  }
 };

 const filteredDiffs = createMemo(() => {
  const currentDiffs = diffs();
  const query = diffSearchQuery().trim();
  const type = diffSearchType();
  const buffer = fileBufferB();

  if (!query || !buffer) return currentDiffs;

  let numQuery = 0;
  if (type !== 'string') {
   numQuery = Number(query);
   if (isNaN(numQuery)) return [];
  }

  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  return currentDiffs.filter(diff => {
   try {
    const offset = diff.offset;
    switch (type) {
     case 'u8': return dataView.getUint8(offset) === numQuery;
     case 'i16': return dataView.getInt16(offset, true) === numQuery;
     case 'u16': return dataView.getUint16(offset, true) === numQuery;
     case 'i32': return dataView.getInt32(offset, true) === numQuery;
     case 'u32': return dataView.getUint32(offset, true) === numQuery;
     case 'f32': {
      const val = dataView.getFloat32(offset, true);
      return Math.abs(val - numQuery) < 0.0001;
     }
     case 'string': {
      const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, query.length);
      const str = new TextDecoder().decode(bytes);
      return str === query;
     }
     default: return true;
    }
   } catch (e) {
    return false;
   }
  });
 });

  const handleDiffClick = (offset: number) => {

      const rowIdx = Math.floor(offset / BYTES_PER_ROW);
      const targetScroll = rowIdx * rowHeight;
      
      setScrollTop(targetScroll);
      
      if (scrollContainerRef) {
        scrollContainerRef.scrollTop = targetScroll;
      }
      
      setSelectionStart(offset);
      setSelectionEnd(offset);
    };

  const handleScanResultClick = (offset: number, length: number) => {

      const rowIdx = Math.floor(offset / BYTES_PER_ROW);
      const targetScroll = rowIdx * rowHeight;
      
      setScrollTop(targetScroll);
      
      if (scrollContainerRef) {
        scrollContainerRef.scrollTop = targetScroll;
      }
      
      setSelectionStart(offset);
      setSelectionEnd(offset + length - 1);
    };

 const formatOffset = (offset: number) => {
  return offset.toString(16).toUpperCase().padStart(8, '0');
 };

 const handleAddMapping = () => {
  if (!mapName().trim() || mappingOffset() === null) return;
 
  let size = 4;
  if (mapType() === 'u8') size = 1;
  else if (mapType() === 'u16' || mapType() === 'i16') size = 2;
  else if (mapType() === 'string') size = 10;
 
  setMappedVars(prev => {
   const filtered = prev.filter(m => m.offset !== mappingOffset());
   return [...filtered, { offset: mappingOffset()!, name: mapName().trim(), type: mapType(), size }].sort((a, b) => a.offset - b.offset);
  });
 
  setMapName('');
  setMappingOffset(null);
  addToast("Variable mapped successfully! Review it in the Profile Builder tab.", "success");
 };

 const handleManualAddMapping = () => {
  if (!mapName().trim() || !manualOffsetStr().trim()) return;
  const parsedOffset = parseInt(manualOffsetStr().replace(/^0x/i, ''), 16);
  if (isNaN(parsedOffset)) return;

  let size = 4;
  if (mapType() === 'u8') size = 1;
  else if (mapType() === 'u16' || mapType() === 'i16') size = 2;
  else if (mapType() === 'string') size = 10;
 
  setMappedVars(prev => {
   const filtered = prev.filter(m => m.offset !== parsedOffset);
   return [...filtered, { offset: parsedOffset, name: mapName().trim(), type: mapType(), size }].sort((a, b) => a.offset - b.offset);
  });
 
  setMapName('');
  setManualOffsetStr('');
  setIsManualAddOpen(false);
 };

 const handleRemoveMapping = (offset: number) => {
  setMappedVars(prev => prev.filter(m => m.offset !== offset));
 };

 const handleSaveProfile = async () => {
  if (mappedVars().length === 0) {
   addToast("You must map at least one variable before exporting a profile!", "error");
   return;
  }
  const name = profileName().trim();
  if (!name) {
   addToast("Profile name cannot be empty!", "error");
   return;
  }
  const isDuplicate = localProfiles().some(p => p.title.toLowerCase() === name.toLowerCase());
  if (isDuplicate) {
   addToast("A profile with this name already exists!", "error");
   return;
  }
  try {
   const profileData: any = {
    id: profileName().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now(),
    title: profileName(),
    developer: profileDeveloper().trim() || "Unknown",
    engine: profileEngine().trim() || "Unknown",
    author: profileAuthor().trim() || undefined,
    version: profileVersion().trim() || undefined,
    notes: profileNotes().trim() || undefined,
    rules: mappedVars().map(m => ({
     type: "HexOffset",
     value: null,
     keys: [m.name],
     offset: m.offset,
     size: m.size,
     value_type: m.type
    }))
   };

   Object.keys(profileData).forEach(key => profileData[key] === undefined && delete profileData[key]);

   await saveLocalProfile(profileData);
   addToast(`Profile '${profileName()}' saved successfully!`, "success");
   setProfileName('New_Profile');
   setProfileDeveloper('');
   setProfileEngine('');
   setProfileAuthor('');
   setProfileVersion('');
   setProfileNotes('');
   setMappedVars([]);

   if (activeTool() === 'profiles') {
    const p = await loadLocalProfiles();
    setLocalProfiles(p);
   }
  } catch (err) {
   addToast(`Failed to save profile: ${err}`, "error");
  }
 };

 const handleXor = async () => {
  if (!xorKeyInput()) return;
  const b64 = editorState.saveData?.raw_payload;
  if (!b64 || typeof b64 !== 'string') return;
  try {
   const newB64 = await xorDecrypt(b64, xorKeyInput());
   updateRawPayload(newB64);
   const binaryString = atob(newB64);
   const newPayload = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) newPayload[i] = binaryString.charCodeAt(i);
   setRawPayload(newPayload);
   addToast("Successfully applied XOR decryption!", "success");
   setActiveTool('none');
  } catch (e) {
   addToast(`XOR Decryption failed: ${e}`, "error");
  }
 };

 return (
  <div class="w-full h-full flex flex-col lg:flex-row gap-6 p-6 overflow-hidden">
   {/* DATA SCAVENGER LEFT PANEL */}
   <div class="w-full lg:w-[380px] bg-[#050505] flex flex-col overflow-hidden shrink-0 border border-zinc-800">
    <div class="p-6 border-b border-zinc-800 flex items-center gap-4 bg-zinc-950">
     <Cpu size={18} class="text-[#FF7A00]" />
     <h2 class="font-bold text-sm tracking-widest uppercase text-zinc-300">Data Scavenger</h2>
    </div>
   
    <div class="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
     {/* High Risk Warning */}
     <div class="bg-red-500/5 border-l-2 border-red-500 p-4">
      <div class="flex ml-4 items-center gap-4 text-red-500 font-bold text-xs uppercase tracking-widest mb-2">
       <AlertTriangle size={14} /> [ HIGH RISK ]
      </div>
      <p class="text-[10px] ml-4 text-red-400/80 uppercase font-mono leading-relaxed">
       Blindly changing values in raw memory may corrupt the save file. Always ensure you know what you're doing!
      </p>
     </div>
     <div class="flex flex-col px-4 gap-2 border-b border-zinc-800 pb-6">
       <label class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Go To Offset</label>
       <div class="flex gap-2">
        <input
         type="text"
         placeholder="e.g. 0x1A4"
         onKeyDown={(e) => {
          if (e.key === 'Enter') {
           const val = e.currentTarget.value.trim().replace(/^0x/i, '');
           if (val) {
            const offset = parseInt(val, 16);
            if (!isNaN(offset)) scrollToOffset(offset);
           }
          }
         }}
         class="flex-1 bg-[#0a0a0a] border border-zinc-700 text-cyan-400 text-xs p-3 font-mono outline-none focus:border-[#FF7A00] transition-colors uppercase"
        />
        <button
         onClick={(e) => {
          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
          const val = input.value.trim().replace(/^0x/i, '');
          if (val) {
           const offset = parseInt(val, 16);
           if (!isNaN(offset)) scrollToOffset(offset);
          }
         }}
         class="bg-[#0a0a0a] hover:bg-[#FF7A00] text-zinc-300 hover:text-black px-4 py-2 font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-colors border border-zinc-700 hover:border-[#FF7A00] shrink-0"
        >
         JUMP
        </button>
       </div>
      </div>
     <div class="flex flex-col px-4 gap-2">
      <div class="flex items-center gap-2 mb-1">
       <label class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data Type</label>
       <Tooltip text="Help with Data Scavenger" class="ml-8">
       <button onClick={() => {
        setHelpModalSection('data');
        setIsHelpModalOpen(true);
       }}
       class="text-yellow-300 rounded-full ml-2 hover:text-[#00E5FF] hover:bg-zinc-700 transition-colors cursor-pointer">
        <Info size={12} />
       </button>
       </Tooltip>
      </div>
      <select
        value={searchType()}
        onChange={(e) => setSearchType(e.currentTarget.value as SearchType)}
        class="w-full appearance-none bg-[#0a0a0a] text-zinc-300 text-xs p-3 font-mono border border-zinc-800 outline-none focus:border-zinc-400 transition-colors cursor-pointer uppercase"
      >
       <option value="u8">U8 (1 Byte)</option>
       <option value="i16">Int16 (Little Endian)</option>
       <option value="u16">UInt16 (Little Endian)</option>
       <option value="int32">Int32 (Little Endian)</option>
       <option value="u32">UInt32 (Little Endian)</option>
       <option value="f32">Float32 (Little Endian)</option>
       <option value="string">String (UTF-8)</option>
       <option value="hex">Hex Array</option>
      </select>
     </div>

     <div class="flex flex-col px-4 gap-2">
      <label class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Find Value</label>
      <div class="flex gap-2">
       <input
        type="text"
        value={searchValue()}
        onInput={(e) => setSearchValue(e.target.value)}
        placeholder={searchType() === 'int32' ? 'e.g. 99999' : searchType() === 'hex' ? 'e.g. EF BB BF' : 'e.g. Cinnamon, Fraise'}
        class="flex-1 bg-[#0a0a0a] border border-zinc-700 text-zinc-300 text-xs p-3 font-spaceMono outline-none focus:border-zinc-400 transition-colors"
       />
       <button
        onClick={handleScan}
        disabled={isScanning() || !searchValue()}
        class="bg-zinc-800 hover:bg-zinc-200 text-zinc-300 hover:text-black px-4 py-2 font-bold text-xs cursor-pointer disabled:opacity-50 transition-colors border border-zinc-400 hover:border-zinc-200"
       >
        {isScanning() ? '...' : <SearchIcon size={14} />}
       </button>
      </div>
     </div>
    
     {scanResults().length > 0 && (
      <div class="mt-2 flex flex-col gap-4 border-t border-zinc-800 pt-6">
       <div class="flex flex-col gap-2">
        <label class="text-[10px] font-bold uppercase tracking-widest text-[#FF7A00]">Inject Value</label>
        <input
         type="text"
         value={replaceValue()}
         onInput={(e) => setReplaceValue(e.target.value)}
         placeholder="New value"
         class="bg-[#0a0a0a] border border-zinc-800 text-zinc-300 text-xs p-3 font-spaceMono outline-none focus:border-zinc-400 transition-colors"
        />
       </div>
       <div class="text-[10px] text-[#FF7A00] uppercase tracking-widest font-bold">
        [{scanResults().length} MATCHES]
       </div>
       <div class="flex flex-col gap-2 pr-2">
        {scanResults().slice(0, 50).map(({ offset, length }) => (
         <div key={offset} onClick={() => handleScanResultClick(offset, length)} class="flex justify-between items-center bg-[#0a0a0a] p-3 border border-zinc-800 hover:border-[#FF7A00]/50 transition-colors cursor-pointer group">
          <span class="text-[12px] font-desc text-zinc-400 font-bold group-hover:text-[#FF7A00] transition-colors">0x{offset.toString(16).toUpperCase()}</span>
         
          <Tooltip text={!replaceValue() ? "Fill in the INJECT VALUE first" : "Inject new values into this offset"} align="right" position="top">
           <div>
            <button
             onClick={(e) => {
              e.stopPropagation();
              setPendingInject({offset, length, type: searchType()});
              setIsInjectConfirmOpen(true);
             }}
             disabled={!replaceValue()}
            class="text-[10px] text-zinc-500 enabled:hover:text-white font-bold cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2 uppercase transition-colors"
           >
            <Replace size={12} /> Inject
           </button>
           </div>
          </Tooltip>
         </div>
        ))}
       </div>
      </div>
     )}
    </div>
   </div>
  
<div class="flex-1 flex flex-col gap-6 overflow-hidden">
 <div class="bg-yellow-500/5 border-l-2 border-yellow-500 p-4 md:p-6 flex items-center justify-between gap-4 shrink-0">
 
  <div class="flex-1 min-w-0">
   <div class="flex items-center gap-2 mb-1">
    <AlertTriangle size={12} class="text-yellow-500 shrink-0" />
    <span class="text-yellow-500 font-bold text-xs ml-4 uppercase tracking-widest">Raw Binary Mode</span>
    <span class="mx-2">|</span>
    <span class="text-yellow-400/60 text-[10px] font-mono font-bold">{payload().length.toLocaleString()} bytes</span>
   </div>

   <p class="text-[12px] text-white/90 leading-relaxed font-brains uppercase">
    Direct byte manipulation is provided for advanced users.
   </p>
  </div>

   <div class="flex items-center gap-4">
    <Show when={Object.keys(editedBytes).length > 0}>
     <button
      onClick={handleCommitEdits}
      class="px-4 py-2 bg-orange-500/10 border-2 border-orange-500 hover:bg-orange-500 hover:text-black text-orange-500 transition-colors text-[10px] font-bold uppercase tracking-widest shadow-[4px_4px_0px_rgba(249,115,22,0.3)] hover:shadow-[2px_2px_0px_#f97316] cursor-pointer flex items-center gap-2 animate-pulse"
     >
      <Save size={12} strokeWidth={3} /> Commit {Object.keys(editedBytes).length} Edits
     </button>
    </Show>
    <Show when={appliedProfileMappings().length > 0}>
     <button
      onClick={() => { setAppliedProfileMappings([]); setAppliedProfileName(null); if (activeTool() === 'active_profile') setActiveTool('none'); }}
      class="px-4 py-2 bg-red-500/10 border-2 border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 transition-colors text-[10px] font-bold uppercase tracking-widest shadow-[4px_4px_0px_rgba(239,68,68,0.3)] hover:shadow-[2px_2px_0px_#ef4444] cursor-pointer flex items-center gap-2"
     >
      <X size={12} strokeWidth={3} /> Clear Highlights
     </button>
    </Show>
    <button
     onClick={() => setIsProfileBuilderOpen(!isProfileBuilderOpen())}
    class={`px-4 py-2 gap-6 border-2 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer ${isProfileBuilderOpen() ? 'border-[#00E5FF] bg-[#00E5FF]/10 text-[#00E5FF]' : 'border-zinc-700 bg-black text-zinc-500 hover:text-white hover:border-white'}`}
   >
    <Code size={14} class="inline mr-2 mb-2" />
    PROFILE Builder
   </button>
   <button
    onClick={handleOpenProfiles}
    class="px-4 py-2 bg-[#FF7A00] hover:bg-white text-black font-bold uppercase tracking-widest text-[10px] transition-colors shadow-[4px_4px_0px_rgba(255,122,0,0.3)] hover:shadow-[2px_2px_0px_#FF7A00] cursor-pointer"
   >
    Apply Profile
   </button>
  </div>
 </div>
   
    <div class="flex flex-col gap-2 shrink-0">
     <div class="flex items-center gap-4 px-1">
      <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Advanced Tools</span>
      <Tooltip text="Help with Advanced Tools">
      <button onClick={() => {
       setHelpModalSection('advanced');
       setIsHelpModalOpen(true);
      }}
      class="text-yellow-300 rounded-full hover:text-[#00E5FF] hover:bg-zinc-700 transition-colors cursor-pointer">
       <Info size={13} />
      </button>
      </Tooltip>
     </div>
      <div class="flex flex-wrap gap-3">
       <button onClick={handleEntropy} class="flex items-center gap-2 px-5 py-2.5 bg-black border border-cyan-500/60 hover:bg-cyan-500/10 text-cyan-500 hover:border-cyan-500 text-xs font-bold cursor-pointer transition-colors uppercase tracking-widest">
        <Activity size={14} /> Entropy Graph
       </button>
       <button onClick={handleStrings} class={`flex items-center gap-2 px-5 py-2.5 bg-black border ${activeTool() === 'strings' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-500 hover:border-emerald-500'} text-xs font-bold cursor-pointer transition-colors uppercase tracking-widest`}>
        <AlignLeft size={14} /> Extract Strings
       </button>
       <button onClick={() => handleDecompress('zlib')} class="flex items-center gap-2 px-5 py-2.5 bg-black border border-amber-500/60 hover:bg-amber-500/10 text-amber-500 hover:border-amber-500 text-xs font-bold cursor-pointer transition-colors uppercase tracking-widest">
        <ArchiveRestore size={14} /> Unpack Zlib
       </button>
       <button onClick={() => setActiveTool(activeTool() === 'xor' ? 'none' : 'xor')} class={`flex items-center gap-2 px-5 py-2.5 bg-black border ${activeTool() === 'xor' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-purple-500/60 hover:bg-purple-500/10 text-purple-500 hover:border-purple-500'} text-xs font-bold cursor-pointer transition-colors uppercase tracking-widest`}>
        <Unlock size={14} /> XOR Decrypt
       </button>
       <button onClick={() => setActiveTool(activeTool() === 'diff' ? 'none' : 'diff')} class={`flex items-center gap-2 px-5 py-2.5 bg-black border ${activeTool() === 'diff' ? 'border-pink-500 bg-pink-500/20 text-pink-400' : 'border-pink-500/60 hover:bg-pink-500/10 text-pink-500 hover:border-pink-500'} text-xs font-bold cursor-pointer transition-colors uppercase tracking-widest`}>
        <GitMerge size={14} /> Diff Analyzer
       </button>
      </div>
     </div>
   
    <div class="flex flex-col flex-1 min-h-0 bg-black border border-zinc-800 overflow-hidden relative">
     <div class="px-[32px] py-[16px] border-b border-zinc-800 flex items-center text-sm font-bold shrink-0 z-10 text-zinc-500 font-mono tracking-widest uppercase bg-zinc-950 min-w-[900px]">
      <div class="w-[110px] shrink-0 text-white">Offset</div>
      <div class="flex gap-[8px] shrink-0">
       {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} class="w-[24px] shrink-0 text-center">{i.toString(16).padStart(2, '0').toUpperCase()}</div>
       ))}
     </div>
      <div class="flex-1 text-left text-white pl-[32px] border-l-2 border-zinc-800 ml-[32px]">ASCII</div>
     </div>
    
<div
 ref={(el) => {
    scrollContainerRef = el;
  let timeoutId: any;
  const ro = new ResizeObserver(entries => {

   clearTimeout(timeoutId);
   timeoutId = setTimeout(() => {
    setClientHeight(entries[0].contentRect.height);
   }, 50);
  });
  ro.observe(el);
  onCleanup(() => {
   ro.disconnect();
   clearTimeout(timeoutId);
  });
 }}
 onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
 class="flex-1 min-h-0 overflow-auto relative custom-scrollbar bg-black"
>
      <div style={{ height: `${rowCount() * 24}px`, width: '100%', position: 'relative' }} class="min-w-[900px]">
       <For each={visibleRows()}>
        {(rowIndex) => {
         const startIdx = () => rowIndex * BYTES_PER_ROW;
         const rowBytes = () => payload().slice(startIdx(), startIdx() + BYTES_PER_ROW);
         const hexDump = () => Array.from({ length: BYTES_PER_ROW }).map((_, i) => (i < rowBytes().length ? rowBytes()[i].toString(16).padStart(2, '0').toUpperCase() : ' '));
         const asciiChars = () => Array.from({ length: BYTES_PER_ROW }).map((_, i) => (i < rowBytes().length ? getAsciiChar(rowBytes()[i]) : ' '));
        
         const isSelected = (index: number) => {
          const s = selectionStart();
          const e = selectionEnd();
          if (s === null || e === null) return false;
          const min = Math.min(s, e);
          const max = Math.max(s, e);
          return index >= min && index <= max;
         };
         
         const getProfileVar = (byteIndex: number) => {
          const mappings = appliedProfileMappings();
          if (mappings.length === 0) return null;
          return mappings.find(m => byteIndex >= m.offset && byteIndex < m.offset + m.size);
         };

         return (
          <div
           style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `24px`, transform: `translateY(${rowIndex * 24}px)` }}
           class="flex px-[32px] items-center hover:bg-white/5 transition-colors text-base select-none"
          >
           <div class="w-[110px] shrink-0 text-cyan-500 font-brains font-medium select-text">{startIdx().toString(16).padStart(8, '0').toUpperCase()}</div>
           <div class="flex gap-[8px] shrink-0 font-mono overflow-hidden whitespace-pre">
            {hexDump().map((hex, i) => {
             const byteIndex = startIdx() + i;
             const profileVar = getProfileVar(byteIndex);
             const isEdited = editedBytes[byteIndex] !== undefined;
             const isSelectedByte = isSelected(byteIndex);
             const isBufferActive = isSelectedByte && editBuffer().length > 0;
             
             let displayHex = hex;
             if (isEdited) {
              displayHex = editedBytes[byteIndex].toString(16).padStart(2, '0').toUpperCase();
             }
             if (isBufferActive) {
              displayHex = editBuffer().padEnd(2, '_');
             }
             
             return (
              <div
               key={i}
               onMouseDown={() => {
                if (i < rowBytes().length) {
                 setSelectionStart(byteIndex);
                 setSelectionEnd(byteIndex);
                 setIsSelecting(true);
                 setEditBuffer('');
                 document.getElementById('hex-hidden-input')?.focus();
                }
               }}
               onTouchStart={() => {
                if (i < rowBytes().length) {
                 setSelectionStart(byteIndex);
                 setSelectionEnd(byteIndex);
                 setIsSelecting(true);
                 setEditBuffer('');
                 document.getElementById('hex-hidden-input')?.focus();
                }
               }}
               onMouseEnter={(e) => {
                if (isSelecting() && i < rowBytes().length) setSelectionEnd(byteIndex);
                if (profileVar) {
                 setHoveredProfileVar(profileVar);
                 setHoverPos({x: e.clientX, y: e.clientY});
                }
               }}
               onMouseLeave={() => { if (hoveredProfileVar() === profileVar) setHoveredProfileVar(null); }}
               onMouseMove={(e) => { if (profileVar) setHoverPos({x: e.clientX, y: e.clientY}); }}
               class={`w-[24px] shrink-0 text-center cursor-text transition-colors duration-75 ${
                  i < rowBytes().length && isSelectedByte ? 'bg-orange-500/40 text-white outline outline-1 outline-orange-500 z-10' :
                  isEdited ? 'text-red-500 font-bold bg-red-500/10' :
                  profileVar ? 'bg-[#00E5FF]/20 text-[#00E5FF] outline outline-1 outline-[#00E5FF]/50 z-0 hover:bg-[#00E5FF]/40' : 
                  displayHex === '00' ? 'opacity-20 text-zinc-500' : 
                  displayHex === ' ' ? 'opacity-0' : 'text-zinc-300 hover:text-[#FF7A00]'
               }`}
              >
               {displayHex}
              </div>
             );
            })}
           </div>
           <div class="flex-1 flex justify-start pl-[32px] border-l-2 border-zinc-800/50 ml-[32px] overflow-hidden whitespace-pre font-brains">
            {asciiChars().map((char, i) => {
             const byteIndex = startIdx() + i;
             const profileVar = getProfileVar(byteIndex);
             const isEdited = editedBytes[byteIndex] !== undefined;
             
             let displayChar = char;
             if (isEdited) {
              const b = editedBytes[byteIndex];
              displayChar = (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
             }
             const isSelectedByte = isSelected(byteIndex);
             return (
              <span
               key={i}
               onMouseDown={() => { if (i < rowBytes().length) { setSelectionStart(byteIndex); setSelectionEnd(byteIndex); setIsSelecting(true); setEditBuffer(''); document.getElementById('hex-hidden-input')?.focus(); } }}
               onTouchStart={() => { if (i < rowBytes().length) { setSelectionStart(byteIndex); setSelectionEnd(byteIndex); setIsSelecting(true); setEditBuffer(''); document.getElementById('hex-hidden-input')?.focus(); } }}
               onMouseEnter={(e) => { 
                if (isSelecting() && i < rowBytes().length) setSelectionEnd(byteIndex);
                if (profileVar) { setHoveredProfileVar(profileVar); setHoverPos({x: e.clientX, y: e.clientY}); }
               }}
               onMouseLeave={() => { if (hoveredProfileVar() === profileVar) setHoveredProfileVar(null); }}
               onMouseMove={(e) => { if (profileVar) setHoverPos({x: e.clientX, y: e.clientY}); }}
               class={`cursor-text transition-colors duration-75 ${
                  i < rowBytes().length && isSelectedByte ? 'bg-[#FF7A00] text-black font-black' : 
                  isEdited ? 'text-red-500 font-bold bg-red-500/10' :
                  profileVar ? 'bg-[#00E5FF]/30 text-[#00E5FF] outline outline-1 outline-[#00E5FF]/50' : 
                  displayChar === '.' ? 'opacity-30 text-zinc-600' : 'text-zinc-400 hover:text-[#FF7A00]'
               }`}
              >
               {displayChar}
              </span>
             );
            })}
           </div>
          </div>
         );
        }}
       </For>
      </div>

      <input
       id="hex-hidden-input"
       type="text"
       inputMode="text"
       class="absolute opacity-0 pointer-events-none w-0 h-0"
       style={{ top: '-9999px', left: '-9999px' }}
      />

      {payload().length === 0 && (
       <div class="absolute inset-0 flex flex-col items-center justify-center gap-6 text-zinc-800">
        <Binary size={48} />
        <div class="font-bold tracking-widest text-xs uppercase">
         NO BYTES LOADED
        </div>
       </div>
      )}

      <div class="fixed bottom-4 right-8 pointer-events-none hidden md:flex gap-4 text-[10px] font-mono text-zinc-500 font-bold tracking-widest px-4 py-2 border border-zinc-800/80 bg-black/95 transform-gpu shadow-lg z-30">
        <span class="flex items-center gap-2"><div class="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-sm">ESC</div> CLEAR HIGHLIGHT</span>
        <span class="flex items-center gap-2"><div class="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-sm">CTRL+C</div> COPY HEX</span>
        <span class="flex items-center gap-2"><div class="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-sm">CTRL+SHIFT+C</div> COPY ASCII</span>
      </div>
     </div>

     {/* IDE-STYLE BOTTOM DOCK */}
     <div
      class="shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
       height: activeTool() !== 'none' ? `${dockHeight()}px` : '0px',
       transition: isDraggingDock() ? 'none' : 'height 0.4s cubic-bezier(0.16,1,0.3,1)'
      }}
     >
      <div class="w-full h-full bg-[#050505] border-t border-[#00E5FF]/30 flex flex-col">
       
        {/* RESIZE HANDLE */}
        <div
         class="h-1.5 w-full cursor-row-resize bg-[#FF7A00] hover:bg-[#00E5FF] transition-colors shrink-0 z-30"
         onMouseDown={handleDragStart}
        ></div>

        {/* HEADER DOCK */}
        <div class="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0 select-none">
         <div class="flex items-center gap-3">
          <div class="w-2 h-2 bg-[#FF7A00]"></div>
          <span class="font-bold tracking-widest uppercase text-zinc-300 text-xs">
           {activeTool() === 'strings' && 'EXTRACTED STRINGS'}
           {activeTool() === 'xor' && 'XOR DECRYPTION'}
           {activeTool() === 'profiles' && 'APPLY PROFILE'}
           {activeTool() === 'diff' && 'DIFF ANALYZER'}
           {activeTool() === 'active_profile' && 'ACTIVE PROFILE'}
          </span>
           {activeTool() === 'strings' && (
             <Tooltip text="Help & Information">
               <button 
                 onClick={() => { setHelpModalSection('strings_tool'); setIsHelpModalOpen(true); }}
                 class="flex items-center justify-center w-12 h-12 cursor-pointer rounded-full bg-black-800 text-yellow-300 hover:text-[#00E5FF] hover:bg-zinc-700 transition-colors ml-2"
               >
                <HelpCircle size={18} />
               </button>
             </Tooltip>
           )}
         </div>
         <button onClick={() => setActiveTool('none')} class="text-zinc-500 hover:text-[#FF7A00] transition-colors cursor-pointer uppercase font-bold tracking-widest text-[10px]">
          [ CLOSE DOCK ]
         </button>
        </div>
       
        {/* DOCK CONTENT */}
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6">
        
         {/* STRINGS TOOL */}
         <div class={activeTool() === 'strings' ? 'flex flex-col gap-4 h-full' : 'hidden'}>
          <div class="flex flex-wrap items-center gap-4 border-b border-zinc-800 pb-4">
           {/* Min Length */}
           <div class="flex items-center gap-2 bg-[#0a0a0a] border border-zinc-800 px-3 py-1">
            <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Min Length:</span>
            <input type="number" min="1" value={stringMinLen()} onInput={(e) => setStringMinLen(parseInt(e.currentTarget.value) || 1)} class="w-44 bg-transparent text-cyan-400 font-brains text-sm outline-none" />
           </div>
           
           {/* Toggles */}
           <div class="flex items-center gap-6 px-2">
            <label class="flex items-center gap-4 cursor-pointer group">
             <input type="checkbox" checked={stringShowLetters()} onChange={(e) => setStringShowLetters(e.currentTarget.checked)} class="accent-[#FF7A00]" />
             <span class="text-[11px] uppercase font-bold text-zinc-400 group-hover:text-white transition-colors">Letters</span>
            </label>
            <label class="flex items-center gap-4 cursor-pointer group">
             <input type="checkbox" checked={stringShowDigits()} onChange={(e) => setStringShowDigits(e.currentTarget.checked)} class="accent-[#FF7A00]" />
             <span class="text-[11px] uppercase font-bold text-zinc-400 group-hover:text-white transition-colors">Digits</span>
            </label>
            <label class="flex items-center gap-4 cursor-pointer group">
             <input type="checkbox" checked={stringShowSymbols()} onChange={(e) => setStringShowSymbols(e.currentTarget.checked)} class="accent-[#FF7A00]" />
             <span class="text-[11px] uppercase font-bold text-zinc-400 group-hover:text-white transition-colors">Symbols</span>
            </label>
           </div>
           
           <div class="flex-1"></div>
           
           {/* Search */}
           <div class="flex items-center bg-[#0a0a0a] border border-zinc-800 px-3 py-2 w-300">
            <SearchIcon size={14} class="text-zinc-400 mr-2" />
            <input type="text" value={stringSearchQuery()} onInput={(e) => setStringSearchQuery(e.currentTarget.value)} placeholder="Search Filter (Regex supported)..." class="w-full bg-transparent text-zinc-300 text-[13px] font-brains outline-none placeholder:text-zinc-500" />
           </div>
          </div>

          <div class="flex justify-between items-center">
           <p class="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">
             Found <span class="text-[#FF7A00] text-[13px] font-black font-spaceMono">{filteredStrings().length}</span> ASCII strings. {filteredStrings().length < extractedStrings().length && <span class="text-zinc-600">({extractedStrings().length} total)</span>}
           </p>
          </div>
          <div class="flex-1 bg-[#0a0a0a] border border-zinc-800 p-6 overflow-y-auto custom-scrollbar font-brains text-sm text-zinc-300 whitespace-pre-wrap break-all">
           {filteredStrings().slice(0, 1000).join('\n')}
          </div>
         </div>

         {/* XOR TOOL */}
         <div class={activeTool() === 'xor' ? 'flex flex-col gap-6 max-w-xl' : 'hidden'}>
          <p class="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Enter the Hexadecimal key used to encrypt this file.</p>
          <input type="text" value={xorKeyInput()} onInput={(e) => setXorKeyInput(e.currentTarget.value)} class="w-full bg-[#0a0a0a] border border-zinc-800 px-6 py-4 text-cyan-400 font-mono uppercase tracking-widest outline-none focus:border-zinc-500 transition-colors" placeholder="e.g. A3 B2" />
          <button onClick={handleXor} class="px-8 py-3 bg-zinc-800 text-zinc-200 hover:bg-zinc-200 hover:text-black font-bold tracking-widest uppercase transition-colors cursor-pointer border border-zinc-700">DECRYPT</button>
         </div>

         {/* PROFILES TOOL */}
         <div class={activeTool() === 'profiles' ? 'flex flex-col gap-3 relative' : 'hidden'}>
          {isLoadingProfiles() && <div class="text-zinc-500 text-[10px] font-bold tracking-widest">LOADING...</div>}
          
          <Show when={localProfiles().length > 0}>
           <div class="flex items-center justify-between bg-[#050505] border border-zinc-800 p-2 mb-2">
            <div class="flex items-center gap-2">
             <button 
              onClick={() => {
               setIsBulkSelectMode(!isBulkSelectMode());
               if (!isBulkSelectMode()) setSelectedProfiles([]);
              }}
              class={`px-3 py-1 text-[10px] border border-zinc-700 font-bold tracking-widest uppercase transition-colors cursor-pointer ${isBulkSelectMode() ? 'text-[#FF7A00] border-[#FF7A00] hover:text-[#00E5FF] hover:border-[#00E5FF]' : 'bg-black text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF]'}`}
             >
              {isBulkSelectMode() ? 'CANCEL SELECT' : 'SELECT'}
             </button>
             <Show when={isBulkSelectMode()}>
              <button 
               onClick={() => {
                if (selectedProfiles().length === localProfiles().length) setSelectedProfiles([]);
                else setSelectedProfiles(localProfiles().map(p => p.id));
               }}
               class="px-3 py-1 text-[10px] border border-zinc-700 bg-black text-zinc-400 hover:text-[#00E5FF] hover:border-[#00E5FF] uppercase font-bold tracking-widest transition-colors cursor-pointer"
              >
               {selectedProfiles().length === localProfiles().length ? 'DESELECT ALL' : 'SELECT ALL'}
              </button>
             </Show>
            </div>
            <div class="flex items-center gap-2">
             <Show when={selectedProfiles().length > 0}>
              <button
               onClick={handleExportSelectedProfiles}
               class="px-3 py-1 text-[10px] border border-zinc-400 bg-black text-zinc-400 hover:text-green-400 hover:border-green-400 uppercase font-bold tracking-widest transition-colors cursor-pointer flex items-center gap-1"
              >
               <Upload size={12} /> EXPORT
              </button>
              <button
               onClick={() => setIsDeleteConfirmOpen(true)}
               class="px-3 py-1 text-[10px] border border-zinc-400 bg-black text-zinc-400 hover:text-red-500 hover:border-red-500 uppercase font-bold tracking-widest transition-colors cursor-pointer flex items-center gap-1"
              >
               <X size={12} /> DELETE
              </button>
             </Show>
            </div>
           </div>
          </Show>

          <For each={localProfiles()}>{(profile) => (
           <div class={`border p-4 hover:bg-white/5 flex justify-between items-center transition-colors bg-[#0a0a0a] ${isBulkSelectMode() && selectedProfiles().includes(profile.id) ? 'border-[#00E5FF]' : 'border-zinc-800 hover:border-zinc-500'}`}>
            <div 
             class="flex items-center gap-4 cursor-pointer flex-1" 
             onClick={() => {
              if (isBulkSelectMode()) {
               if (selectedProfiles().includes(profile.id)) {
                setSelectedProfiles(prev => prev.filter(id => id !== profile.id));
               } else {
                setSelectedProfiles(prev => [...prev, profile.id]);
               }
              } else {
               setViewingProfile(profile);
               setIsProfileInfoOpen(true);
              }
             }}
            >
<Show when={isBulkSelectMode()}>
 <input 
  type="checkbox" 
  checked={selectedProfiles().includes(profile.id)}
  readOnly
  class="w-12 h-12 accent-[#FF7A00] pointer-events-none"
 />
</Show>
             <div class="flex flex-col">
              <h4 class="font-bold text-zinc-300 uppercase tracking-widest cursor-pointer hover:text-white">{profile.title}</h4>
              <p class="text-zinc-600 text-[10px] font-brains">
               {profile.developer && profile.developer !== "Unknown" ? profile.developer : "Community Profile"}
               {profile.engine && profile.engine !== "Unknown" ? ` • Engine: ${profile.engine}` : ""}
              </p>
             </div>
            </div>
            <button 
             class="px-4 py-2 border border-zinc-700 bg-black text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-black hover:bg-[#00E5FF] hover:border-[#00E5FF] transition-colors" 
             onClick={() => confirmApplyProfile(profile)}
            >
             APPLY
            </button>
           </div>
          )}</For>



{/* Delete Confirm Modal (Global) */}
<Modal 
 isOpen={isDeleteConfirmOpen()} 
 onClose={() => setIsDeleteConfirmOpen(false)} 
 title="CONFIRM DELETION" 
 icon={<ShieldAlert size={18} />}
 width="max-w-md"
>
 <div class="flex flex-col items-center gap-6 text-center">
  <p class="text-zinc-300 text-sm font-bold uppercase tracking-widest leading-relaxed">
   You are about to delete <span class="text-red-500 font-black text-lg">{selectedProfiles().length}</span> profile(s).<br/>
   <span class="text-red-500/80 text-xs mt-2 block">This action is permanent and cannot be undone.</span>
  </p>
  
  <div class="flex w-full gap-4 mt-2">
   <button 
    onClick={() => setIsDeleteConfirmOpen(false)} 
    class="flex-1 py-3 bg-black border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-white font-black tracking-widest uppercase transition-colors cursor-pointer"
   >
    CANCEL
   </button>
   <button 
    onClick={handleDeleteSelectedProfiles} 
    class="flex-1 py-3 bg-red-500/10 border-2 border-red-500 hover:bg-red-500 hover:text-black text-red-500 font-black tracking-widest uppercase transition-colors cursor-pointer shadow-[4px_4px_0px_rgba(239,68,68,0.3)] hover:shadow-[6px_6px_0px_rgba(239,68,68,1)] hover:-translate-y-0.5 hover:-translate-x-0.5"
   >
    DELETE
   </button>
  </div>
 </div>
</Modal>
         </div>

         {/* ACTIVE PROFILE TOOL */}
         <div class={activeTool() === 'active_profile' ? 'flex flex-col gap-3 relative h-full' : 'hidden'}>
          <div class="flex items-center justify-between bg-[#050505] border border-zinc-800 p-4 mb-2 shrink-0">
           <div class="flex flex-col">
            <span class="text-[10px] font-bold text-zinc-500 tracking-widest uppercase mb-1">Currently Applied</span>
            <span class="text-sm font-bold text-[#00E5FF] tracking-widest uppercase">{appliedProfileName() || 'Unknown'}</span>
           </div>
           <button onClick={() => { setAppliedProfileMappings([]); setActiveTool('profiles'); setAppliedProfileName(null); }} class="px-4 py-2 bg-black border border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-500 hover:bg-red-500/10 uppercase tracking-widest text-[10px] font-bold cursor-pointer transition-colors">
            Unload
           </button>
          </div>

          <div class="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
           <For each={appliedProfileMappings()}>{(m) => (
            <div class="flex flex-col gap-3 p-4 bg-[#0a0a0a] border border-zinc-800 hover:border-[#00E5FF]/50 transition-colors group">
             <div class="flex justify-between items-center cursor-pointer" onClick={() => scrollToOffset(m.offset)}>
              <span class="text-sm font-bold text-white tracking-widest group-hover:text-[#00E5FF] transition-colors">{m.name}</span>
              <span class="text-[10px] font-mono text-zinc-500 bg-black border border-zinc-800 px-2 py-1 rounded">0x{m.offset.toString(16).toUpperCase()}</span>
             </div>
             
             <div class="flex items-center gap-2 mt-1">
              <input 
               type="text" 
               class="flex-1 bg-black border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-[#FF7A00] font-mono transition-colors"
               placeholder="New value..."
               value={injectValues()[m.offset] || ''}
               onInput={(e) => setInjectValues({...injectValues(), [m.offset]: e.currentTarget.value})}
              />
              <button 
               onClick={() => {
                const val = injectValues()[m.offset];
                if(val) {
                 setReplaceValue(val);
                 setPendingInject({offset: m.offset, length: m.size, type: m.type});
                 setIsInjectConfirmOpen(true);
                }
               }}
               class={`px-4 py-2 bg-black border text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${injectValues()[m.offset] ? 'border-[#FF7A00]/50 text-[#FF7A00] hover:bg-[#FF7A00]/20 hover:border-[#FF7A00]' : 'border-zinc-800 text-zinc-600 cursor-not-allowed'}`}
               disabled={!injectValues()[m.offset]}
              >
               Inject
              </button>
             </div>
            </div>
           )}</For>
          </div>
         </div>

         {/* DIFF ANALYZER TOOL */}
         <div class={activeTool() === 'diff' ? 'flex flex-col h-full overflow-hidden relative' : 'hidden'}>
          {/* PRO TIP AI MCP */}
          <Show when={diffs().length > 0}>
           <div class="mb-4 shrink-0">
            <button 
             onClick={async () => {
              await navigator.clipboard.writeText("I have loaded a diff between two save states in the Hex Viewer. Please call `get_active_diff_results` and tell me which bytes likely correspond to my character's Gold (previously 150, now 500).");
              addToast("Prompt copied to clipboard!", "success");
             }}
             class="w-full flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#00F0FF]/50 hover:bg-[#00F0FF]/10 hover:border-[#00F0FF] transition-colors cursor-pointer group"
            >
             <div class="flex items-center gap-3">
              <span class="text-xl">🤖</span>
              <div class="flex flex-col items-start">
               <span class="text-xs font-bold text-[#00F0FF] tracking-widest uppercase">PRO TIP: MCP AI Analysis</span>
               <span class="text-[10px] text-zinc-400 font-desc">Ask your MCP AI assistant to analyze these diff results!</span>
              </div>
             </div>
             <span class="text-[10px] font-black uppercase tracking-widest text-[#00F0FF] opacity-0 group-hover:opacity-100 transition-opacity bg-[#00F0FF]/20 px-2 py-1">CLICK TO COPY PROMPT</span>
            </button>
           </div>
          </Show>

          {/* Diff Controls */}
          <div class="flex flex-col md:flex-row gap-4 mb-4 shrink-0 p-4 bg-[#0a0a0a] border border-zinc-800">
           <div class="flex-1">
            <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">ORIGINAL FILE (FILE A)</label>
            <div class="bg-zinc-950 border-2 border-zinc-800 px-4 py-3 flex items-center justify-between">
             <span class="text-xs font-desc text-center text-[#00E5FF] truncate">{editorState.filePath ? editorState.filePath.split(/[/\\]/).pop() : 'NOT LOADED'}</span>
            </div>
           </div>
           <div class="flex items-center justify-center pt-16">
            <ArrowRight size={24} class="text-zinc-700 hidden md:block" />
           </div>
           <div class="flex-1">
            <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">MODIFIED FILE (FILE B)</label>
            <button
             onClick={handleSelectFileB}
             class="w-full font-desc border-2 border-dashed border-[#FF7A00]/50 hover:border-[#FF7A00] bg-zinc-950 hover:bg-[#FF7A00]/5 px-4 py-3 text-xs font-bold text-[#FF7A00] transition-colors cursor-pointer flex items-center justify-center gap-2 tracking-widest shadow-[inset_0_0_10px_rgba(255,122,0,0.05)]"
            >
             <Upload size={16} />
             {fileB() ? fileB()!.split(/[/\\]/).pop() : 'SELECT FILE B'}
            </button>
           </div>
           <div class="pt-6 flex gap-2">
            <button
             onClick={handleCompare}
             disabled={!fileB() || isComparing()}
             class="h-full px-8 bg-zinc-950 border-2 border-white hover:bg-white hover:text-black text-white font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-[4px_4px_0px_white] hover:shadow-[6px_6px_0px_white] hover:-translate-y-0.5 hover:-translate-x-0.5"
            >
             {isComparing() ? 'SCANNING...' : 'RUN DIFF'}
            </button>
            <Show when={diffs().length > 0 || fileB()}>
             <button
              onClick={() => { clearDiffs(); setDiffSearchQuery(''); setMappingOffset(null); }}
              class="h-full px-6 bg-zinc-950 border-2 border-red-500 hover:bg-red-500 hover:text-black text-red-500 font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[4px_4px_0px_#ef4444] hover:shadow-[6px_6px_0px_#ef4444] hover:-translate-y-0.5 hover:-translate-x-0.5"
             >
              <X size={16} strokeWidth={3} /> CLEAR
             </button>
            </Show>
           </div>
          </div>
         
          {/* Data Inspector / Search Bar */}
          <div class="bg-[#0a0a0a] border border-zinc-800 flex flex-col md:flex-row gap-4 items-center shrink-0 mb-4">
           <div class="flex-1 w-full relative flex items-center">
            <span class="absolute left-4 text-[#FF7A00]"><SearchIcon size={18} strokeWidth={3} /></span>
            <input
             type="text"
             value={diffSearchQuery()}
             onInput={(e) => setDiffSearchQuery(e.target.value)}
             placeholder="FIND TARGET VALUE IN MODIFIED FILE... (E.G. 490)"
             class="w-full bg-transparent border-none pl-[30px] pr-4 py-3 font-bold text-sm text-[#FF7A00] focus:outline-none tracking-widest placeholder:text-zinc-600 uppercase"
            />
           </div>
           <div class="w-full md:w-130 shrink-0 border-l border-zinc-800 relative">
            <select
             value={diffSearchType()}
             onInput={(e) => setDiffSearchType(e.target.value as any)}
             class="w-full bg-transparent px-8 py-3 font-bold text-sm text-[#FF7A00] focus:outline-none uppercase cursor-pointer appearance-none"
            >
             <option value="u8">U8 / BYTE</option>
             <option value="i16">I16 (SIGNED)</option>
             <option value="u16">U16 (UNSIGNED)</option>
             <option value="i32">I32 (SIGNED)</option>
             <option value="u32">U32 (UNSIGNED)</option>
             <option value="f32">FLOAT 32</option>
             <option value="string">TEXT STRING</option>
            </select>
            <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-[#FF7A00]"></div>
           </div>
          </div>

          {/* Diff List */}
          <div class="flex-1 overflow-y-auto custom-scrollbar border border-zinc-800 bg-[#0a0a0a] relative">
           <Show when={diffs().length === 0}>
            <div class="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 text-center font-bold tracking-widest uppercase text-sm">
             <Info size={32} class="opacity-20 mb-2" />
             <p>NO DIFFERENCES DETECTED<br/>RUN DIFF TO BEGIN ANALYSIS.</p>
            </div>
           </Show>
           <Show when={diffs().length > 0 && filteredDiffs().length === 0}>
            <div class="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 text-center font-bold tracking-widest uppercase text-sm">
             <SearchIcon size={32} class="opacity-20 mb-2 text-[#FF7A00]" />
             <p class="text-[#FF7A00]">NO MATCHES FOUND FOR TARGET VALUE.</p>
            </div>
           </Show>
           <Show when={filteredDiffs().length > 0}>
            <div class="flex flex-col divide-y divide-zinc-800">
             <For each={filteredDiffs()}>
              {(diff) => (
               <div class="flex flex-col bg-transparent hover:bg-white/5 transition-colors relative group">
                <div class="flex items-center justify-between p-3 cursor-pointer" onClick={() => handleDiffClick(diff.offset)}>
                 <div class="flex items-center gap-6">
                  <div class="text-[#00E5FF] font-brains font-black text-sm">0x{formatOffset(diff.offset)}</div>
                  <div class="flex items-center gap-4 font-mono text-sm">
                   <div class="flex flex-col items-center">
                    <span class="text-[#00E5FF]">{diff.original_byte.toString(16).padStart(2, '0').toUpperCase()}</span>
                   </div>
                   <ArrowRight size={14} class="text-zinc-600" />
                   <div class="flex flex-col items-center">
                    <span class="text-[#FF7A00] font-bold">{diff.modified_byte.toString(16).padStart(2, '0').toUpperCase()}</span>
                   </div>
                  </div>
                 </div>
                 <div class="flex items-center gap-4">
                  <button
                   onClick={(e) => {
                    e.stopPropagation();
                    setMappingOffset(mappingOffset() === diff.offset ? null : diff.offset);
                   }}
                   class="text-[10px] font-bold tracking-widest uppercase px-3 py-1 border border-zinc-700 text-zinc-400 hover:text-white hover:border-white transition-colors flex items-center gap-2 cursor-pointer"
                  >
                   {mappingOffset() === diff.offset ? <X size={12}/> : <Plus size={12}/>}
                   {mappingOffset() === diff.offset ? 'CANCEL' : 'MAP VARIABLE'}
                  </button>
                 </div>
                </div>
               
                {/* Inline Mapping Form */}
                <Show when={mappingOffset() === diff.offset}>
                 <div class="p-3 bg-zinc-950 border-t border-[#00E5FF] flex flex-col md:flex-row items-end gap-4 shadow-inner" onClick={(e) => e.stopPropagation()}>
                  <div class="flex-1 w-full relative">
                   <label class="text-[10px] font-black text-[#00E5FF] uppercase tracking-widest mb-1 flex items-center gap-2">
                    <span class="animate-pulse h-1.5 w-1.5 bg-[#00E5FF]"></span> VAR_NAME_INPUT
                   </label>
                   <div class="relative flex items-center">
                    <span class="absolute left-3 text-[#00E5FF] font-black text-xs">{">"}</span>
                    <input
                     type="text"
                     value={mapName()}
                     onInput={(e) => setMapName(e.target.value)}
                     placeholder="e.g. Player_Gold"
                     class="w-full bg-black border border-zinc-800 pl-12 pr-3 py-2 font-bold text-xs text-white focus:outline-none focus:border-[#00E5FF] uppercase tracking-wider"
                    />
                   </div>
                  </div>
                  <div class="w-full md:w-130 relative">
                   <label class="text-[10px] font-black text-[#00E5FF] uppercase tracking-widest mb-1 block">DATA_TYPE</label>
                   <div class="relative">
                    <select
                     value={mapType()}
                     onInput={(e) => setMapType(e.target.value as any)}
                     class="w-full bg-black border border-zinc-800 px-3 py-2 font-bold text-xs text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] uppercase cursor-pointer appearance-none"
                    >
                     <option value="u8">U8 (1 Byte - Small numbers 0-255)</option>
                     <option value="i16">I16 (2 Bytes - Signed numbers)</option>
                     <option value="u16">U16 (2 Bytes - Unsigned max 65535)</option>
                     <option value="i32">I32 (4 Bytes - Signed)</option>
                     <option value="u32">U32 (4 Bytes - Standard large numbers like Gold/HP)</option>
                     <option value="f32">FLOAT 32 (Decimal numbers)</option>
                     <option value="string">STRING (Text)</option>
                    </select>
                    <div class="absolute inset-y-0 right-6 pt-3 flex items-center pointer-events-none text-[#00E5FF] text-[10px]">▼</div>
                   </div>
                  </div>
                  <button
                   onClick={handleAddMapping}
                   class="px-4 py-2 border border-[#00E5FF] bg-black text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black uppercase font-black tracking-widest text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                   <Plus size={14} strokeWidth={3} /> SAVE
                  </button>
                 </div>
                </Show>
               </div>
              )}
             </For>
            </div>
           </Show>
          </div>
         </div>

        </div>
       </div>
      </div>
     </div>
    </div>
   {/* Right Panel: Profile Builder Drawer */}
   <div
    class={`fixed top-0 right-0 h-full z-[60] flex flex-col bg-[#050505] w-[420px] shadow-[-10px_0_30px_rgba(0,0,0,0.4)] border-l border-[#FF7A00]/50 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isProfileBuilderOpen() ? 'translate-x-0' : 'translate-x-[100%]'}`}
   >
<button
 onClick={() => setIsProfileBuilderOpen(!isProfileBuilderOpen())}
 class="absolute -left-18 top-1/2 -translate-y-1/2 w-24 flex flex-col items-end justify-center gap-1 group cursor-pointer"
>
 <div class="w-2 h-1 bg-zinc-800 group-hover:bg-[#FF7A00] transition-colors"></div>
 <div class="w-6 h-1 bg-zinc-800 group-hover:bg-[#FF7A00] transition-colors"></div>
 <div class="w-full bg-[#050505] border-y-2 border-l-2 border-[#FF7A00] py-4 flex items-center justify-center text-[#FF7A00] group-hover:bg-[#FF7A00] group-hover:text-black transition-colors shadow-[-5px_0_15px_rgba(0,0,0,0.8)]">
  <span class={`text-xl font-black font-mono tracking-tighter ${isProfileBuilderOpen() ? 'pl-0 mr-0' : 'pl-6 mr-1'}`}>
  {isProfileBuilderOpen() ? ">>" : "<<"}
  </span>
 </div>
 <div class="w-6 h-1 bg-zinc-800 group-hover:bg-[#FF7A00] transition-colors"></div>
 <div class="w-2 h-1 bg-zinc-800 group-hover:bg-[#FF7A00] transition-colors"></div>
</button>
    <div class="p-6 border-b-4 border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
     <h2 class="text-sm font-black tracking-widest uppercase text-white flex items-center gap-3">
      <div class="w-2 h-2 bg-[#FF7A00] animate-pulse"></div>
      {">>"} PROFILE_BUILDER
     </h2>
     <Tooltip text="Help & Information" align="right" position="bottom">
       <button 
         onClick={() => { setHelpModalSection('profile_builder'); setIsHelpModalOpen(true); }}
         class="flex items-center justify-center w-18 h-18 cursor-pointer text-yellow-300 rounded-full ml-2 hover:text-[#00E5FF] hover:bg-zinc-700 transition-colors"
       >
        <HelpCircle size={18} />
       </button>
     </Tooltip>
    </div>
   
    <div class="p-6 flex flex-col h-full overflow-hidden bg-black/50">
     <div class="mb-6 shrink-0 relative">
      <label class="text-[10px] font-black text-[#FF7A00] uppercase tracking-widest mb-2 flex items-center gap-2">
       <Code size={14} /> IDENTIFIER
      </label>
      <input
       type="text"
       value={profileName()}
       onInput={(e) => setProfileName(e.target.value)}
       class="w-full bg-black border-2 border-zinc-700 px-4 py-3 font-bold font-brains tracking-widest text-sm text-[#FF7A00] focus:outline-none focus:border-[#FF7A00] shadow-[inset_0_0_10px_rgba(255,122,0,0.05)]"
      />
     </div>

     <div class="mb-4 shrink-0">
      <button 
       onClick={() => setIsMetadataOpen(!isMetadataOpen())}
       class="w-full mb-3 py-2 bg-[#111] hover:bg-[#222] border border-zinc-800 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-2 uppercase font-bold text-[10px] tracking-widest cursor-pointer"
      >
       {isMetadataOpen() ? "HIDE METADATA" : "ADD METADATA (OPTIONAL)"}
      </button>

      <Show when={isMetadataOpen()}>
       <div class="mb-4 p-4 bg-zinc-900/50 border border-zinc-800 flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
         <div>
          <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Developer</label>
          <input type="text" value={profileDeveloper()} onInput={(e) => setProfileDeveloper(e.target.value)} class="w-full bg-black border border-zinc-800 px-2 py-1.5 font-bold font-brains text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500" />
         </div>
         <div>
          <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Engine</label>
          <input type="text" value={profileEngine()} onInput={(e) => setProfileEngine(e.target.value)} class="w-full bg-black border border-zinc-800 px-2 py-1.5 font-bold font-brains text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500" />
         </div>
         <div>
          <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Author</label>
          <input type="text" value={profileAuthor()} onInput={(e) => setProfileAuthor(e.target.value)} class="w-full bg-black border border-zinc-800 px-2 py-1.5 font-bold font-brains text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500" />
         </div>
         <div>
          <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Version</label>
          <input type="text" value={profileVersion()} onInput={(e) => setProfileVersion(e.target.value)} class="w-full bg-black border border-zinc-800 px-2 py-1.5 font-bold font-brains text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500" />
         </div>
        </div>
        <div>
         <label class="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 block">Notes / Desc</label>
         <input type="text" value={profileNotes()} onInput={(e) => setProfileNotes(e.target.value)} class="w-full bg-black border border-zinc-800 px-2 py-1.5 font-bold font-brains text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-500" />
        </div>
       </div>
      </Show>

      <button 
       onClick={() => setIsManualAddOpen(!isManualAddOpen())}
       class="w-full py-3 bg-[#111] hover:bg-[#222] border border-dashed border-zinc-700 hover:border-[#00E5FF] text-zinc-400 hover:text-[#00E5FF] transition-colors flex items-center justify-center gap-2 uppercase font-bold text-xs tracking-widest cursor-pointer"
      >
       <Plus size={14} /> {isManualAddOpen() ? "CANCEL" : "ADD NEW FIELD"}
      </button>

      <Show when={isManualAddOpen()}>
       <div class="mt-3 p-4 bg-zinc-950 border border-[#00E5FF]/30 flex flex-col gap-3">
        <div class="flex gap-3">
         <div class="flex-1">
          <label class="text-[10px] font-black text-[#00E5FF] uppercase tracking-widest mb-1 block">OFFSET (HEX)</label>
          <input
           type="text"
           value={manualOffsetStr()}
           onInput={(e) => setManualOffsetStr(e.target.value)}
           placeholder="e.g. 1A4 or 0x1A4"
           class="w-full bg-black border border-zinc-800 px-3 py-2 font-bold text-xs text-white focus:outline-none focus:border-[#00E5FF] uppercase"
          />
         </div>
         <div class="w-100 relative">
          <label class="text-[10px] font-black text-[#00E5FF] uppercase tracking-widest mb-1 block">DATA_TYPE</label>
          <div class="relative">
           <select
            value={mapType()}
            onInput={(e) => setMapType(e.target.value as any)}
            class="w-full bg-black border border-zinc-800 px-2 py-2 font-bold text-[10px] text-[#00E5FF] focus:outline-none focus:border-[#00E5FF] uppercase cursor-pointer appearance-none"
           >
            <option value="u8">U8 (1 Byte - Small numbers 0-255)</option>
            <option value="i16">I16 (2 Bytes - Signed numbers)</option>
            <option value="u16">U16 (2 Bytes - Unsigned max 65535)</option>
            <option value="i32">I32 (4 Bytes - Signed)</option>
            <option value="u32">U32 (4 Bytes - Standard large numbers like Gold/HP)</option>
            <option value="f32">FLOAT 32 (Decimal numbers)</option>
            <option value="string">STRING (Text)</option>
           </select>
           <div class="absolute inset-y-0 right-2 flex items-center pointer-events-none text-[#00E5FF] text-[8px]">▼</div>
          </div>
         </div>
        </div>
        <div>
         <label class="text-[10px] font-black text-[#00E5FF] uppercase tracking-widest mb-1 block">VAR_NAME_INPUT</label>
         <input
          type="text"
          value={mapName()}
          onInput={(e) => setMapName(e.target.value)}
          placeholder="e.g. Player_HP"
          class="w-full bg-black border border-zinc-800 px-3 py-2 font-bold font-brains text-xs text-white focus:outline-none placeholder:uppercase focus:border-[#00E5FF] tracking-wider"
         />
        </div>
        <button
         onClick={handleManualAddMapping}
         disabled={!mapName().trim() || !manualOffsetStr().trim()}
         class="w-full mt-1 py-2 bg-[#00E5FF]/10 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black uppercase font-black tracking-widest text-[10px] transition-colors disabled:opacity-50 cursor-pointer"
        >
         SAVE
        </button>
       </div>
      </Show>
     </div>

     <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2 mb-6">
      <Show when={mappedVars().length === 0}>
       <div class="text-xs font-bold tracking-widest uppercase text-zinc-600 text-center py-12 border-2 border-dashed border-zinc-800 bg-black">
        AWAITING INPUT...<br/><br/>MAP VARIABLES TO CONSTRUCT PROFILE
       </div>
      </Show>
     
      <For each={mappedVars()}>
       {(v) => (
        <div class="flex items-center justify-between p-4 bg-black border-2 border-zinc-800 hover:border-[#FF7A00] transition-colors group relative overflow-hidden">
         <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#FF7A00] opacity-0 group-hover:opacity-100 transition-opacity"></div>
         <div class="pl-2">
          <div class="text-sm font-black tracking-widest uppercase text-white">{v.name}</div>
          <div class="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">
           ADDR: <span class="text-[#00E5FF]">0x{formatOffset(v.offset)}</span> <span class="text-zinc-700 mx-1">|</span> {v.size} BYTES
          </div>
         </div>
         <button
          onClick={() => handleRemoveMapping(v.offset)}
          class="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer border border-transparent hover:border-red-500 rounded-sm"
         >
          <X size={16} strokeWidth={3} />
         </button>
        </div>
       )}
      </For>
     </div>

     <div class="shrink-0 pt-4 border-t-2 border-zinc-800 relative">
      <button
       onClick={handleSaveProfile}
       class="w-full py-4 border-4 border-zinc-200 bg-zinc-950 text-white hover:bg-[#FF7A00] hover:border-[#FF7A00] hover:text-black font-black tracking-widest uppercase transition-all flex items-center justify-center gap-3 cursor-pointer shadow-[6px_6px_0px_#FF7A00] hover:shadow-[8px_8px_0px_white] hover:-translate-y-1 hover:-translate-x-1"
      >
       <Save size={16} strokeWidth={2.5} /> SAVE TO LOCAL DATABASE
      </button>
     </div>
    </div>
   </div>

{/* Profile Info Modal Overlay */}
   <Modal
    isOpen={isProfileInfoOpen() && !!viewingProfile()}
    onClose={() => { 
     setIsProfileInfoOpen(false); 

     setTimeout(() => setViewingProfile(null), 300); 
    }}
    title={viewingProfile()?.title || "PROFILE INFO"}
    icon={<Save size={18} />}
    width="max-w-lg"
   >
    <Show when={viewingProfile()}>
     <div class="flex flex-col gap-4">
      <div class="overflow-y-auto custom-scrollbar flex flex-col gap-4 max-h-[60vh] pr-2">
       
       <div class="grid grid-cols-2 gap-4">
        <div class="bg-zinc-900/50 p-3 border border-zinc-800">
         <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Developer</span>
         <span class="text-xs font-brains text-zinc-300">{viewingProfile()?.developer || "Unknown"}</span>
        </div>
        <div class="bg-zinc-900/50 p-3 border border-zinc-800">
         <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Engine</span>
         <span class="text-xs font-brains text-zinc-300">{viewingProfile()?.engine || "Unknown"}</span>
        </div>
        <div class="bg-zinc-900/50 p-3 border border-zinc-800">
         <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Author</span>
         <span class="text-xs font-brains text-zinc-300">{viewingProfile()?.author || "Unknown"}</span>
        </div>
        <div class="bg-zinc-900/50 p-3 border border-zinc-800">
         <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Version</span>
         <span class="text-xs font-brains text-zinc-300">{viewingProfile()?.version || "1.0"}</span>
        </div>
       </div>
       
       <div class="bg-zinc-900/50 p-3 border border-zinc-800">
        <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Notes</span>
        <span class="text-xs font-brains text-zinc-300 whitespace-pre-wrap">{viewingProfile()?.notes || "No additional notes provided."}</span>
       </div>

       <div class="bg-zinc-900/50 p-3 border border-zinc-800">
        <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-2">Offset Rules</span>
        <div class="flex flex-col gap-2">
         <For each={viewingProfile()?.rules}>{(rule: any) => (
          <div class="flex justify-between items-center bg-black p-2 border border-zinc-800">
           <span class="text-[10px] font-bold text-zinc-300 tracking-widest uppercase">{rule.keys?.[0] || 'Unknown'}</span>
           <span class="text-[10px] font-mono text-[#00E5FF]">0x{rule.offset?.toString(16).toUpperCase()} <span class="text-zinc-600 mx-1">|</span> {rule.size}B</span>
          </div>
         )}</For>
        </div>
       </div>

      </div>

      <div class="pt-4 border-t border-zinc-800 mt-2">
       <button 
        onClick={() => { setIsProfileInfoOpen(false); confirmApplyProfile(viewingProfile()); }}
        class="w-full py-3 bg-[#00E5FF]/10 hover:bg-[#00E5FF] text-[#00E5FF] hover:text-black border border-[#00E5FF] transition-colors font-black uppercase tracking-widest text-xs cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.15)] hover:shadow-[0_0_20px_rgba(0,229,255,0.4)]"
       >
        APPLY THIS PROFILE
       </button>
      </div>
     </div>
    </Show>
   </Modal>

   <Show when={isInjectConfirmOpen()}>
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4">
     <div class="bg-[#050505] border border-blue-500/50 w-full max-w-md flex flex-col shadow-[0_0_30px_rgba(59,130,246,0.15)]">
      <div class="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
       <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
         <Replace size={16} />
        </div>
        <h2 class="font-bold text-sm tracking-widest uppercase text-zinc-100">Confirm Inject</h2>
       </div>
       <button onClick={() => { setIsInjectConfirmOpen(false); setPendingInject(null); }} class="text-zinc-500 hover:text-white transition-colors cursor-pointer">
        <X size={16} />
       </button>
      </div>
      <div class="p-6">
       <p class="text-zinc-300 text-sm font-fira leading-relaxed mb-4">
        Are you sure you want to inject the new value at this offset? This action will permanently modify the payload in memory.
       </p>
       <div class="flex flex-col gap-2">
        <div class="flex justify-between bg-zinc-900/50 p-2 border border-zinc-800">
         <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">OFFSET</span>
         <span class="text-xs font-mono text-zinc-300">0x{pendingInject()?.offset.toString(16).toUpperCase()}</span>
        </div>
        <div class="flex justify-between bg-zinc-900/50 p-2 border border-zinc-800">
         <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">NEW VALUE</span>
         <span class="text-xs font-mono text-blue-400">{replaceValue()}</span>
        </div>
       </div>
      </div>
      <div class="p-4 border-t border-zinc-800 flex gap-4 bg-zinc-950">
       <button onClick={() => { setIsInjectConfirmOpen(false); setPendingInject(null); }} class="flex-1 py-3 bg-[#0a0a0a] border border-zinc-700 hover:bg-zinc-800 text-white font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer">
        Cancel
       </button>
       <button onClick={() => {
        if(pendingInject()) handleReplace(pendingInject()!.offset, pendingInject()!.length, pendingInject()!.type || searchType());
        setIsInjectConfirmOpen(false);
        setPendingInject(null);
       }} class="flex-1 py-3 bg-blue-500/10 border border-blue-500 hover:bg-blue-500 hover:text-black text-blue-500 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer">
        Yes, Inject
       </button>
      </div>
     </div>
    </div>
   </Show>

   <Modal 
    isOpen={isApplyConfirmOpen()} 
    onClose={() => { setIsApplyConfirmOpen(false); setPendingApplyProfile(null); }}
    title="Apply Profile"
   >
    <div class="flex flex-col gap-4 text-sm text-zinc-300">
     <div class="flex items-center gap-3 bg-black p-4 border border-zinc-800">
      <AlertTriangle size={24} class="text-[#00E5FF] shrink-0" />
      <p class="leading-relaxed text-[13px] font-desc">Are you sure you want to apply <strong class="text-[#00E5FF]">{pendingApplyProfile()?.title || 'Unknown'}</strong>? This will highlight its offsets and replace any currently active profile.</p>
     </div>
     <div class="flex gap-2 mt-4">
      <button onClick={() => { setIsApplyConfirmOpen(false); setPendingApplyProfile(null); }} class="flex-1 py-3 bg-black hover:bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer">
       Cancel
      </button>
      <button onClick={() => { 
       if(pendingApplyProfile()) handleApplyProfile(pendingApplyProfile());
       setIsApplyConfirmOpen(false);
       setPendingApplyProfile(null);
      }} class="flex-1 py-3 bg-[#0a0a0a] border border-[#00E5FF]/50 hover:bg-[#00E5FF]/10 text-[#00E5FF] font-bold text-xs tracking-widest uppercase transition-colors cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.15)]">
       Apply
      </button>
     </div>
    </div>
   </Modal>

   {/* CUSTOM TOOLTIP FOR PROFILE HIGHLIGHT */}
   <Show when={hoveredProfileVar()}>
    <div
     style={{ position: 'fixed', left: `${hoverPos().x + 15}px`, top: `${hoverPos().y + 15}px`, zIndex: 99999 }}
     class="px-3 py-1.5 bg-zinc-950 border border-[#00E5FF]/50 text-white text-xs font-desc shadow-[4px_4px_0px_rgba(0,229,255,0.2)] pointer-events-none whitespace-nowrap"
    >
     <span class="text-[#00E5FF] font-bold">{hoveredProfileVar()?.name}</span>{' '}
     <span class="text-zinc-500">({hoveredProfileVar()?.type})</span>
    </div>
   </Show>
  </div>
 );
};