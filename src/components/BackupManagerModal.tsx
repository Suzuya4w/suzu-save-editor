import { createSignal, onMount, For, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { Modal } from './Modal';
import { DatabaseBackup, Trash2, RotateCcw, Clock, HardDrive, FileText, CheckCircle2, Search, Filter, Download } from 'lucide-solid';
import { addToast } from '../store/toastStore';
import { useEditorStore, loadSaveData } from '../store/editorStore';

interface BackupMetadata {
    id: string;
    original_filename: string;
    original_path_or_uri: string;
    backup_filename: string;
    timestamp: string;
    size: number;
    notes?: string | null;
}

export function BackupManagerModal(props: { isOpen: boolean, onClose: () => void }) {
    const store = useEditorStore();
    const [backups, setBackups] = createSignal<BackupMetadata[]>([]);
    const [isLoading, setIsLoading] = createSignal(false);
    
    // Search and Filter States
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showMilestonesOnly, setShowMilestonesOnly] = createSignal(false);

    const filteredBackups = () => {
        return backups().filter(b => {
            if (showMilestonesOnly() && !b.notes) return false;
            
            const query = searchQuery().trim().toLowerCase();
            if (query !== '') {
                const matchName = b.original_filename.toLowerCase().includes(query);
                const matchNotes = b.notes?.toLowerCase().includes(query) || false;
                if (!matchName && !matchNotes) return false;
            }
            return true;
        });
    };
    
    const fetchBackups = async () => {
        setIsLoading(true);
        try {
            const data: BackupMetadata[] = await invoke('list_backups');
            // Sort by latest first
            data.sort((a, b) => b.backup_filename.localeCompare(a.backup_filename));
            setBackups(data);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load backups', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        if (props.isOpen) fetchBackups();
    });

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const handleRestore = async (backup: BackupMetadata) => {
        if (!confirm(`Are you sure you want to restore this backup?\n\nOriginal File: ${backup.original_filename}\nDate: ${backup.timestamp}\n\nWARNING: This will overwrite the current target file! (If you currently have this file opened, we will reload it)`)) return;
        
        try {
            await invoke('restore_backup_by_id', { id: backup.id });
            addToast('Backup restored successfully!', 'success');
            
            // If the restored file is currently open, reload it
            if (store.saveData && store.filePath === backup.original_path_or_uri) {
                 const saveResult = await invoke<any>('open_save_file', { 
                  path: backup.original_path_or_uri,
                  activeProfileRules: null
                 });
                 loadSaveData(saveResult, backup.original_path_or_uri, null);
                 addToast('Reloaded restored file into editor', 'info');
            }
        } catch (err: any) {
            console.error(err);
            addToast(`Failed to restore backup: ${err.message || String(err)}`, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this backup?')) return;
        try {
            await invoke('delete_backup', { id });
            addToast('Backup deleted', 'success');
            fetchBackups();
        } catch (err: any) {
            console.error(err);
            addToast('Failed to delete backup', 'error');
        }
    };

    const handleExport = async (backup: BackupMetadata) => {
        try {
            const exportPath = await save({
                defaultPath: backup.original_filename,
                title: 'Export Backup As'
            });
            if (exportPath) {
                await invoke('export_backup_by_id', {
                    id: backup.id,
                    exportPath: exportPath
                });
                addToast('Backup exported successfully!', 'success');
            }
        } catch (err: any) {
            console.error(err);
            addToast(`Failed to export: ${err.message || String(err)}`, 'error');
        }
    };

    const handleCreateMilestone = async () => {
        if (!store.saveData || !store.filePath) {
            addToast('No active save file to backup!', 'warning');
            return;
        }
        const note = prompt('Enter a short note for this milestone (e.g., "Before Final Boss"):');
        if (!note || note.trim() === '') return;

        try {
            if (store.filePath.startsWith('content://')) {
                const bytes = await readFile(store.filePath);
                await invoke('create_named_backup_from_bytes', { 
                    path: store.filePath, 
                    bytes: Array.from(bytes),
                    notes: note.trim() 
                });
            } else {
                await invoke('create_named_backup', { 
                    path: store.filePath, 
                    notes: note.trim() 
                });
            }
            addToast('Milestone backup created!', 'success');
            fetchBackups();
        } catch (err: any) {
            console.error(err);
            addToast(`Failed to create milestone: ${err.message || String(err)}`, 'error');
        }
    };

    return (
        <Modal isOpen={props.isOpen} onClose={props.onClose} title="BACKUP MANAGER" icon={<DatabaseBackup size={18} />}>
            <div class="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-2 font-mono pb-4">
                <div class="flex justify-between items-center bg-zinc-900/50 p-2 border border-zinc-800">
                    <Show when={store.saveData && store.filePath} fallback={
                        <div class="text-[10px] text-zinc-500 font-desc italic">
                            * Open a save file to create milestones.
                        </div>
                    }>
                        <button 
                            onClick={handleCreateMilestone}
                            class="px-3 py-1.5 cursor-pointer bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF] hover:text-black uppercase tracking-widest font-bold text-xs transition-colors flex items-center gap-2"
                        >
                            <CheckCircle2 size={14} /> Create Milestone
                        </button>
                    </Show>
                    <button 
                        onClick={fetchBackups} 
                        class="px-3 py-1.5 cursor-pointer bg-zinc-800 text-xs text-white hover:bg-[#FF7A00] hover:text-black uppercase tracking-widest font-bold transition-colors"
                    >
                        Refresh List
                    </button>
                </div>

                <div class="flex flex-col md:flex-row gap-2 items-stretch">
                    <div class="relative flex-1 flex flex-col justify-center">
                        <div class="absolute inset-y-0 left-1 pl-3 flex items-center pointer-events-none">
                            <Search class="text-zinc-500" size={14} />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Search by filename or notes..." 
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs pl-[20px] pr-3 py-[5px] focus:outline-none focus:border-[#FF7A00] transition-colors"
                        />
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 px-3 py-[5px] transition-colors select-none">
                        <input 
                            type="checkbox" 
                            checked={showMilestonesOnly()}
                            onChange={(e) => setShowMilestonesOnly(e.currentTarget.checked)}
                            class="accent-[#00F0FF] cursor-pointer"
                        />
                        <span class="text-xs font-bold uppercase tracking-widest text-zinc-400">Milestones Only</span>
                    </label>
                </div>

                <Show when={isLoading()}>
                    <div class="text-center text-zinc-500 py-8 text-xs font-bold uppercase tracking-widest animate-pulse">Loading backups...</div>
                </Show>

                <Show when={!isLoading() && backups().length === 0}>
                    <div class="text-center text-zinc-500 py-8 text-xs font-desc tracking-widest border-2 border-dashed border-zinc-800 bg-zinc-900/50">
                        No internal backups found.
                    </div>
                </Show>

                <Show when={!isLoading() && backups().length > 0 && filteredBackups().length === 0}>
                    <div class="text-center text-zinc-500 py-8 text-xs font-desc tracking-widest border-2 border-dashed border-zinc-800 bg-zinc-900/50 flex flex-col items-center gap-2">
                        <Filter size={24} class="opacity-50" />
                        No backups match your search filters.
                    </div>
                </Show>

                <div class="flex flex-col gap-3">
                    <For each={filteredBackups()}>
                        {(b) => (
                            <div class="flex flex-col border-2 border-zinc-800 bg-black hover:border-zinc-500 transition-colors group">
                                <div class="flex justify-between items-start p-3 border-b border-zinc-800/50">
                                    <div class="flex flex-col gap-1">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-[#FF7A00] tracking-wider uppercase text-sm">{b.original_filename}</span>
                                            <Show when={b.notes}>
                                                <span class="px-2 py-0.5 bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-[9px] uppercase tracking-widest font-bold rounded-sm flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> Milestone
                                                </span>
                                            </Show>
                                        </div>
                                        <div class="text-[10px] text-zinc-500 font-serif flex items-center gap-3">
                                            <span class="flex items-center gap-1"><Clock size={10} /> {b.timestamp}</span>
                                            <span class="flex items-center gap-1"><HardDrive size={10} /> {formatSize(b.size)}</span>
                                        </div>
                                    </div>
                                    <div class="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                                            <button 
                                                onClick={() => handleRestore(b)}
                                                class="p-2.5 md:p-2 flex cursor-pointer items-center justify-center bg-zinc-900 text-zinc-400 hover:bg-[#FF7A00] hover:text-black transition-colors"
                                                title="Restore Backup"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleExport(b)}
                                                class="p-2.5 md:p-2 flex cursor-pointer items-center justify-center bg-zinc-900 text-zinc-400 hover:bg-[#00F0FF] hover:text-black transition-colors"
                                                title="Export Backup"
                                            >
                                                <Download size={18} class="md:hidden" />
                                                <Download size={14} class="hidden md:block" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(b.id)}
                                                class="p-2.5 md:p-2 flex cursor-pointer items-center justify-center bg-zinc-900 text-zinc-400 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Delete Backup"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                <Show when={b.notes}>
                                    <div class="p-2 bg-zinc-950 text-zinc-300 text-[10px] font-desc flex items-start gap-2 border-t border-zinc-800/50">
                                        <FileText size={12} class="mt-0.5 text-zinc-500 shrink-0" />
                                        <span>"{b.notes}"</span>
                                    </div>
                                </Show>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </Modal>
    );
}
