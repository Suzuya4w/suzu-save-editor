import { createSignal, Show, createEffect } from 'solid-js';
import { Upload, Loader2, X, Info, FileArchive } from 'lucide-solid';
import { addToast } from '../../store/toastStore';
import { supabase } from '../../lib/supabase';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { Modal } from '../Modal';
import { SaveFile } from '../../types/database';
import { isSafeFile } from './UploadSaveModal';

interface EditSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  saveData: SaveFile | null;
  onUpdateComplete: () => void;
  requestConfirm: (title: string, message: string, kind: 'warning' | 'info' | 'danger', onConfirm: () => void, onCancel?: () => void) => void;
}

export function EditSaveModal(props: EditSaveModalProps) {
  const [localSave, setLocalSave] = createSignal<SaveFile | null>(props.saveData);
  const [activeTab, setActiveTab] = createSignal<'info' | 'file'>('info');
  const [isUpdating, setIsUpdating] = createSignal(false);
  
  const [infoForm, setInfoForm] = createSignal({
    title: props.saveData?.title || '',
    description: props.saveData?.description || '',
    game_engine: props.saveData?.game_engine || '',
    game_version: props.saveData?.game_version || '',
    is_nsfw: props.saveData?.is_nsfw || false
  });

  createEffect(() => {
    if (props.saveData) {
      setLocalSave(props.saveData);
      setInfoForm({
        title: props.saveData.title,
        description: props.saveData.description,
        game_engine: props.saveData.game_engine,
        game_version: props.saveData.game_version || '',
        is_nsfw: props.saveData.is_nsfw
      });
    }
  });

  const [newFilePath, setNewFilePath] = createSignal<string>('');

  const handleInfoSubmit = async () => {
    if (!localSave()) return;
    props.requestConfirm('UPDATE DETAILS', 'Are you sure you want to update the save details?', 'info', async () => {
      try {
        setIsUpdating(true);
        const { error } = await supabase.from('save_files').update({
          title: infoForm().title,
          description: infoForm().description,
          game_engine: infoForm().game_engine || 'Unknown',
          game_version: infoForm().game_version || null,
          is_nsfw: infoForm().is_nsfw,
        }).eq('id', localSave()!.id);

        if (error) throw error;
        addToast('Save details updated successfully', 'success');
        props.onUpdateComplete();
        props.onClose();
      } catch (e: any) {
        addToast(`Failed to update: ${e.message}`, 'error');
      } finally {
        setIsUpdating(false);
      }
    });
  };

  const handleFileSelect = async () => {
    const selected = await openDialog({ multiple: false, filters: [{ name: 'Zip Archive', extensions: ['zip'] }] });
    if (selected && typeof selected === 'string') {
      setNewFilePath(selected);
    }
  };

  const handleFileSubmit = async () => {
    if (!newFilePath() || !localSave()) return;
    
    props.requestConfirm('REPLACE SAVE FILE', 'Are you sure you want to replace the existing save file? This action cannot be undone.', 'danger', async () => {
      try {
        setIsUpdating(true);
        const bytes = await readFile(newFilePath());
        
        if (!isSafeFile(bytes)) {
          throw new Error(`Upload Rejected: File is an executable or malicious format.`);
        }

        if (bytes.length > 50 * 1024 * 1024) throw new Error('File exceeds 50MB limit');

        const urlParts = localSave()!.file_url.split('/');
        const oldFileName = urlParts[urlParts.length - 1];

        const { error: storageError } = await supabase.storage.from('saves').upload(oldFileName, bytes, { upsert: true, contentType: 'application/zip' });
        if (storageError) throw storageError;

        let detected = localSave()!.detected_engine;
        try {
          const det = await invoke<string>('detect_engine_from_zip', { zipPath: newFilePath() });
          if (det && det !== 'Unknown') detected = det;
        } catch(e) {}

        const { error: dbError } = await supabase.from('save_files').update({
          file_size_bytes: bytes.length,
          detected_engine: detected || null,
        }).eq('id', localSave()!.id);

        if (dbError) throw dbError;

        addToast('Save file replaced successfully', 'success');
        props.onUpdateComplete();
        props.onClose();
      } catch (e: any) {
        addToast(`Failed to replace file: ${e.message}`, 'error');
      } finally {
        setIsUpdating(false);
      }
    });
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="EDIT SAVE DATA" width="max-w-2xl">
      <div class="flex border-b-2 border-zinc-800 mb-6">
        <button 
          onClick={() => setActiveTab('info')}
          class={`flex-1 flex items-center justify-center gap-2 py-3 font-bold uppercase tracking-widest text-xs transition-colors ${activeTab() === 'info' ? 'border-b-2 border-[#FF7A00] text-[#FF7A00]' : 'text-zinc-500 hover:text-white'}`}
        >
          <Info size={16} /> Details
        </button>
        <button 
          onClick={() => setActiveTab('file')}
          class={`flex-1 flex items-center justify-center gap-2 py-3 font-bold uppercase tracking-widest text-xs transition-colors ${activeTab() === 'file' ? 'border-b-2 border-[#FF7A00] text-[#FF7A00]' : 'text-zinc-500 hover:text-white'}`}
        >
          <FileArchive size={16} /> Replace File
        </button>
      </div>

      <Show when={activeTab() === 'info'}>
        <div class="space-y-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-white tracking-widest uppercase">Title</label>
            <input type="text" maxLength={100} value={infoForm().title} onInput={(e) => setInfoForm({...infoForm(), title: e.currentTarget.value})} class="w-full bg-zinc-900 border-2 border-zinc-700 p-3 text-white focus:border-[#FF7A00] outline-none uppercase font-bold" />
          </div>

          <div class="flex gap-4">
            <div class="flex flex-col gap-1 flex-1">
              <label class="text-xs font-bold text-white tracking-widest uppercase">Game Engine / Format</label>
              <input type="text" list="engine-options-edit" maxLength={50} value={infoForm().game_engine} onInput={(e) => setInfoForm({...infoForm(), game_engine: e.currentTarget.value})} class="w-full bg-zinc-900 border-2 border-zinc-700 p-3 text-white focus:border-[#FF7A00] outline-none uppercase font-bold" />
              <datalist id="engine-options-edit">
                <option value="RPG Maker MV/MZ" />
                <option value="RPG Maker VX Ace" />
                <option value="Ren'Py" />
                <option value="KiriKiri" />
                <option value="WOLF RPG Editor" />
                <option value="TyranoBuilder" />
                <option value="Unity" />
              </datalist>
            </div>
            <div class="flex flex-col gap-1 flex-1">
              <label class="text-xs font-bold text-white tracking-widest uppercase">Version</label>
              <input type="text" maxLength={50} value={infoForm().game_version} onInput={(e) => setInfoForm({...infoForm(), game_version: e.currentTarget.value})} class="w-full bg-zinc-900 border-2 border-zinc-700 p-3 text-white focus:border-[#FF7A00] outline-none uppercase font-bold" />
            </div>
          </div>

          <div class="flex items-center gap-4 bg-zinc-900 border-2 border-zinc-800 p-3">
            <div class="flex flex-col gap-1 flex-1">
              <label class="text-[10px] font-bold text-white tracking-widest uppercase">Contains NSFW Content?</label>
              <button onClick={() => setInfoForm({...infoForm(), is_nsfw: !infoForm().is_nsfw})} 
                class={`w-fit px-4 py-2 font-black text-xs uppercase tracking-widest transition-colors border-2 cursor-pointer ${infoForm().is_nsfw ? 'bg-red-500 text-white border-red-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
              >
                {infoForm().is_nsfw ? 'YES (18+)' : 'NO (SAFE FOR WORK)'}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-white tracking-widest uppercase">Description</label>
            <textarea maxLength={500} value={infoForm().description} onInput={(e) => setInfoForm({...infoForm(), description: e.currentTarget.value})} class="w-full bg-zinc-900 border-2 border-zinc-700 p-3 text-white focus:border-[#FF7A00] outline-none uppercase font-bold min-h-[100px] resize-none"></textarea>
          </div>

          <button onClick={handleInfoSubmit} disabled={isUpdating() || !infoForm().title} class="w-full py-4 mt-2 bg-[#FF7A00] hover:bg-white text-black font-black tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[4px_4px_0px_#ffffff] hover:shadow-[4px_4px_0px_#FF7A00] border-2 border-black">
            {isUpdating() ? <Loader2 class="animate-spin" /> : 'SAVE CHANGES'}
          </button>
        </div>
      </Show>

      <Show when={activeTab() === 'file'}>
        <div class="space-y-4">
          <div class="bg-zinc-900/50 border-2 border-dashed border-zinc-700 p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div class="p-4 bg-zinc-900 rounded-full text-zinc-400">
              <Upload size={32} />
            </div>
            <div>
              <p class="text-white font-bold uppercase tracking-widest text-sm mb-1">Upload New .ZIP File</p>
              <p class="text-zinc-500 text-xs uppercase tracking-widest">Replaces the current save file in the cloud</p>
            </div>
            
            <Show when={newFilePath()}>
              <div class="bg-black border border-[#FF7A00] px-4 py-2 flex items-center justify-between w-full max-w-sm mt-4">
                <span class="text-[#FF7A00] font-mono text-xs truncate mr-2">{newFilePath().split(/[\\/]/).pop()}</span>
                <button onClick={() => setNewFilePath('')} class="text-zinc-500 hover:text-white"><X size={14}/></button>
              </div>
            </Show>

            <Show when={!newFilePath()}>
              <button onClick={handleFileSelect} class="px-6 py-2 bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest text-xs transition-colors mt-2 cursor-pointer">
                SELECT .ZIP ARCHIVE
              </button>
            </Show>
          </div>

          <button onClick={handleFileSubmit} disabled={isUpdating() || !newFilePath()} class="w-full py-4 mt-2 bg-red-500 hover:bg-red-400 text-white font-black tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[4px_4px_0px_#ffffff] border-2 border-black cursor-pointer">
            {isUpdating() ? <Loader2 class="animate-spin" /> : 'REPLACE SAVE FILE'}
          </button>
        </div>
      </Show>
    </Modal>
  );
}