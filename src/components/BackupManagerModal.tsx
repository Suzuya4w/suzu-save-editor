import { createSignal, Show, For, createEffect } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { Modal } from './Modal';
import { DatabaseBackup, Trash2, RotateCcw, Clock, HardDrive, FileText, CheckCircle2, Search, Filter, Download, FolderOpen, Info, SplitSquareHorizontal } from 'lucide-solid';
import { addToast } from '../store/toastStore';
import { useEditorStore, loadSaveData } from '../store/editorStore';

interface DiffResult {
    path: string;
    oldVal: any;
    newVal: any;
}

function getJsonDiff(obj1: any, obj2: any, path = ""): DiffResult[] {
    let diffs: DiffResult[] = [];
    if (obj1 === obj2) return diffs;

    if (typeof obj1 !== "object" || obj1 === null || typeof obj2 !== "object" || obj2 === null) {
        diffs.push({ path, oldVal: obj1, newVal: obj2 });
        return diffs;
    }

    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of keys) {
        const val1 = obj1[key];
        const val2 = obj2[key];
        const newPath = path ? `${path}.${key}` : key;
        
        if (typeof val1 === "object" && val1 !== null && typeof val2 === "object" && val2 !== null) {
            diffs = diffs.concat(getJsonDiff(val1, val2, newPath));
        } else if (val1 !== val2) {
            diffs.push({ path: newPath, oldVal: val1, newVal: val2 });
        }
    }
    return diffs;
}

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
    
    // Backup Dir Info
    const [osType, setOsType] = createSignal<string>('unknown');
    const [backupDirPath, setBackupDirPath] = createSignal<string | null>(null);

    // Diff States
    const [diffModalOpen, setDiffModalOpen] = createSignal(false);
    const [diffResults, setDiffResults] = createSignal<DiffResult[]>([]);
    const [diffBackupName, setDiffBackupName] = createSignal('');
    const [isDiffing, setIsDiffing] = createSignal(false);

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

    createEffect(async () => {
        if (props.isOpen) {
            fetchBackups();
            try {
                const { type } = await import('@tauri-apps/plugin-os');
                const currentOs = await type();
                setOsType(currentOs);
                const path = await invoke<string>('get_backup_dir_path');
                setBackupDirPath(path);
            } catch (e) {
                console.error('Failed to get OS or backup dir path', e);
            }
        }
    });

    const handleOpenBackupDir = async () => {
        const path = backupDirPath();
        if (!path) return;
        try {
            await invoke('open_in_explorer', { path });
        } catch (e: any) {
            console.error('Failed to open backup dir', e);
            addToast(`Failed: ${e.message || String(e)}`, 'error');
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const handleCompare = async (backup: BackupMetadata) => {
        if (!store.saveData || !store.filePath) {
            addToast("No active save file to compare.", "warning");
            return;
        }

        const isBinary = Object.keys(store.saveData.parsed_variables || {}).length === 0 && store.saveData.raw_payload;
        if (isBinary) {
            addToast("This is a binary/raw file. Please use the Hex Diff tool inside the Hex Viewer instead.", "warning");
            return;
        }

        setIsDiffing(true);
        try {
            const backupPath = await join(backupDirPath()!, backup.backup_filename);
            const backupSaveData = await invoke<any>('open_save_file', { 
                path: backupPath,
                activeProfileRules: null
            });

            const backupVars = backupSaveData?.parsed_variables || {};
            const currentVars = store.saveData.parsed_variables || {};

            const diffs = getJsonDiff(backupVars, currentVars);
            
            setDiffResults(diffs);
            setDiffBackupName(backup.timestamp);
            setDiffModalOpen(true);
            
            if (diffs.length === 0) {
                addToast("No differences found between the backup and current file.", "info");
            }
        } catch (err: any) {
            console.error(err);
            addToast(`Failed to compare backup: ${err.message || String(err)}`, "error");
        } finally {
            setIsDiffing(false);
        }
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
        <>
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

                <Show when={backupDirPath()}>
                    <div class="flex items-center justify-between p-2 bg-[#00F0FF]/5 border border-[#00F0FF]/20 text-[#00F0FF] text-xs">
                        <div class="flex items-center gap-2 truncate">
                            <Info size={14} class="shrink-0" />
                            <span class="truncate" title={backupDirPath()!}>
                                {osType() === 'android' || osType() === 'ios' ? 
                                    "Backups are stored safely in internal app storage." : 
                                    `Location: ${backupDirPath()}`
                                }
                            </span>
                        </div>
                        <Show when={osType() !== 'android' && osType() !== 'ios'}>
                            <button 
                                onClick={handleOpenBackupDir}
                                class="shrink-0 ml-2 px-2 py-1 bg-[#00F0FF]/10 hover:bg-[#00F0FF] hover:text-black border border-[#00F0FF]/30 transition-colors uppercase font-bold tracking-wider text-[10px] flex items-center gap-1 cursor-pointer"
                                title="Open in File Explorer"
                            >
                                <FolderOpen size={12} /> Open
                            </button>
                        </Show>
                    </div>
                </Show>

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
                                                onClick={() => handleCompare(b)}
                                                disabled={isDiffing()}
                                                class={`p-2.5 md:p-2 flex cursor-pointer items-center justify-center bg-zinc-900 ${isDiffing() ? 'text-zinc-600' : 'text-zinc-400 hover:bg-[#00F0FF] hover:text-black'} transition-colors`}
                                                title="Compare with Current"
                                            >
                                                <SplitSquareHorizontal size={18} />
                                            </button>
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
        
        <Modal isOpen={diffModalOpen()} onClose={() => setDiffModalOpen(false)} title="SEMANTIC VISUAL DIFF" icon={<SplitSquareHorizontal size={18} />}>
            <div class="flex flex-col gap-4 font-mono max-h-[70vh] overflow-hidden">
                <div class="p-3 bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-300">
                    <div class="flex items-center gap-4 mb-2">
                        <div class="flex-1">
                            <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Backup (Before)</div>
                            <div class="font-bold text-red-400">{diffBackupName()}</div>
                        </div>
                        <div class="text-zinc-600"><SplitSquareHorizontal size={16} /></div>
                        <div class="flex-1 text-right">
                            <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Current (After)</div>
                            <div class="font-bold text-green-400">Active Editor</div>
                        </div>
                    </div>
                    <div class="text-center pt-2 border-t border-zinc-800/50 text-[10px] uppercase font-bold tracking-widest">
                        Found {diffResults().length} difference(s)
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto custom-scrollbar border border-zinc-800 bg-black">
                    <For each={diffResults()}>
                        {(diff) => (
                            <div class="flex flex-col p-2 border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                                <div class="text-[10px] text-zinc-500 mb-1 truncate" title={diff.path}>{diff.path}</div>
                                <div class="flex items-center gap-2 text-xs">
                                    <div class="flex-1 bg-red-500/10 text-red-400 p-1 rounded-sm border border-red-500/20 truncate" title={String(diff.oldVal)}>
                                        <del>{String(diff.oldVal)}</del>
                                    </div>
                                    <div class="text-zinc-600">➔</div>
                                    <div class="flex-1 bg-green-500/10 text-green-400 p-1 rounded-sm border border-green-500/20 truncate" title={String(diff.newVal)}>
                                        {String(diff.newVal)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </For>
                    <Show when={diffResults().length === 0}>
                        <div class="p-8 text-center text-zinc-500 font-desc text-sm">
                            No semantic differences found.
                        </div>
                    </Show>
                </div>
            </div>
        </Modal>
        </>
    );
}
