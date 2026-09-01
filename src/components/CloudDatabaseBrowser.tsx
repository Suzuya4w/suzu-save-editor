// @ts-nocheck
import { createSignal, onMount, onCleanup, For, Show, createEffect } from 'solid-js';
import { Search, Download, Upload, X, Cloud, Clock, HardDrive, Gamepad2, FileCheck2, Loader2, LogOut, Flag, BadgeCheck, ShieldAlert, Eye, EyeOff, CheckSquare, Square, Trash2, Shield, LayoutList, ShieldCheck, Copy, Info, Database } from 'lucide-solid';
import { useToastStore, addToast } from '../store/toastStore';
import { useAuthStore, signOut, setCustomSession } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { openUrl } from '@tauri-apps/plugin-opener';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { writeFile, remove, mkdir } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { type as osType } from '@tauri-apps/plugin-os';
import { Modal } from './Modal';
import { UploadSaveModal } from './UploadSaveModal';
import { SaveDetailsModal } from './SaveDetailsModal';
import { EditSaveModal } from './EditSaveModal';
import { SaveCard } from './SaveCard';
import { SaveFile } from '../types/database';

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};



export function Tooltip(props: { text: string, position?: 'top' | 'bottom', align?: 'center' | 'left' | 'right', class?: string, children: any }) {
  const [show, setShow] = createSignal(false);
  let alignmentClass = 'left-1/2 -translate-x-1/2';
  if (props.align === 'left') alignmentClass = 'left-0';
  if (props.align === 'right') alignmentClass = 'right-0';

  return (
    <div
      class={`relative inline-flex items-center justify-center shrink-0 ${props.class || ''}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {props.children}
      <Show when={show()}>
        <div class={`absolute z-[100] whitespace-nowrap px-2 py-1 bg-black text-white text-[10px] font-black tracking-widest uppercase border-2 border-white pointer-events-none shadow-[4px_4px_0px_white] ${alignmentClass} ${props.position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {props.text}
        </div>
      </Show>
    </div>
  );
}

export function CloudDatabaseBrowser(props: { isOpen: boolean; onClose: () => void }) {
  const [shouldRender, setShouldRender] = createSignal(props.isOpen);
  const [isVisible, setIsVisible] = createSignal(props.isOpen);

  let unlistenLocalServer: UnlistenFn | undefined;
  let unlistenDeepLink: UnlistenFn | undefined;
  let rtSubscription: any;

  const [saves, setSaves] = createSignal<SaveFile[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal('');
  
  const [page, setPage] = createSignal(0);
  const [hasMore, setHasMore] = createSignal(true);
  const [isFetchingMore, setIsFetchingMore] = createSignal(false);
  let searchTimeout: any;
  const ITEMS_PER_PAGE = 30;

  const authState = useAuthStore();

  const [isUploadModalOpen, setIsUploadModalOpen] = createSignal(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = createSignal(false);
  const [isReportModalOpen, setIsReportModalOpen] = createSignal(false);

  const [showNSFW, setShowNSFW] = createSignal(localStorage.getItem('cloud_showNSFW') === 'true');
  const [showNSFWDisclaimer, setShowNSFWDisclaimer] = createSignal(localStorage.getItem('hide_nsfw_disclaimer') !== 'true');
  const [isAdminMode, setIsAdminMode] = createSignal(false);
  const [filterMode, setFilterMode] = createSignal<'all' | 'my_uploads'>((localStorage.getItem('cloud_filterMode') as any) || 'all');
  const [sortOrder, setSortOrder] = createSignal<'newest' | 'oldest'>((localStorage.getItem('cloud_sortOrder') as any) || 'newest');
  const [engineFilter, setEngineFilter] = createSignal<string>((localStorage.getItem('cloud_engineFilter') as any) || 'all');
  
  createEffect(() => localStorage.setItem('cloud_showNSFW', showNSFW().toString()));
  createEffect(() => localStorage.setItem('cloud_filterMode', filterMode()));
  createEffect(() => localStorage.setItem('cloud_sortOrder', sortOrder()));
  createEffect(() => localStorage.setItem('cloud_engineFilter', engineFilter()));

  const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
  const [selectedSaves, setSelectedSaves] = createSignal<string[]>([]);
  const [isNsfwLocked, setIsNsfwLocked] = createSignal(false);

  const [isMaintenance, setIsMaintenance] = createSignal(false);
  const [maintenanceMsg, setMaintenanceMsg] = createSignal('');

  const [confirmModal, setConfirmModal] = createSignal<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel?: () => void; kind: 'warning' | 'info' | 'danger'; }>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, kind: 'info'
  });

  const [isUploading, setIsUploading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal(0);
  const [downloadStatus, setDownloadStatus] = createSignal('');
  
  const [reportTarget, setReportTarget] = createSignal<{id: string, title: string} | null>(null);
  const [reportForm, setReportForm] = createSignal({ reason: 'Outdated Version', description: '' });
  const [saveDetailsModal, setSaveDetailsModal] = createSignal<any | null>(null);
  const [editSaveModal, setEditSaveModal] = createSignal<any | null>(null);
  const [adminReportsModal, setAdminReportsModal] = createSignal<{saveId: string, title: string, reports: any[]} | null>(null);
  const [isLoadingReports, setIsLoadingReports] = createSignal(false);

  const toggleDisclaimer = () => setShowNSFWDisclaimer(!showNSFWDisclaimer());
  const handleCloseDisclaimer = () => { localStorage.setItem('hide_nsfw_disclaimer', 'true'); setShowNSFWDisclaimer(false); };

  const requestConfirm = (title: string, message: string, kind: 'warning' | 'info' | 'danger', onConfirm: () => void, onCancel?: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, onCancel, kind });
  };
  const closeConfirm = (isCancel: boolean | Event = true) => {
    if (isCancel === true || typeof isCancel !== 'boolean') {
      if (confirmModal().onCancel) confirmModal().onCancel!();
    }
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const fetchSaves = async (loadMore = false, overrideQuery?: string) => {
    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    }
    try {
      let query = supabase.from('save_files').select('*');
      
      const q = overrideQuery !== undefined ? overrideQuery : searchQuery();
      if (q.trim()) {
        query = query.ilike('title', `%${q.trim()}%`);
      }

      if (engineFilter() !== 'all') {
        if (engineFilter() === 'unknown') {
          query = query.is('game_engine', null).is('detected_engine', null);
        } else {
          // Check if either user string matches or system string matches
          query = query.or(`game_engine.ilike.%${engineFilter()}%,detected_engine.ilike.%${engineFilter()}%`);
        }
      }

      if (filterMode() === 'my_uploads' && authState.user?.id) {
        query = query.eq('uploader_id', authState.user.id).order('created_at', { ascending: sortOrder() === 'oldest' });
      } else if (isAdminMode()) {
        query = query.order('report_count', { ascending: false }).order('created_at', { ascending: sortOrder() === 'oldest' });
      } else {
        query = query.eq('is_visible', true).order('created_at', { ascending: sortOrder() === 'oldest' });
      }
      
      const currentPage = loadMore ? page() + 1 : 0;
      const from = currentPage * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      
      if (data) {
        if (data.length < ITEMS_PER_PAGE) {
          setHasMore(false);
        }
        if (loadMore) {
          setSaves(prev => {
            const newSaves = data.filter(d => !prev.find(p => p.id === d.id));
            return [...prev, ...newSaves];
          });
          setPage(currentPage);
        } else {
          setSaves(data);
        }
      }
    } catch (e: any) {
      addToast('Network error or connection failed', 'error');
      if (!loadMore) setSaves([]);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase.from('app_config').select('*').eq('id', 'global').single();
      if (data) {
        setIsMaintenance(data.is_maintenance);
        setMaintenanceMsg(data.maintenance_message || 'Server is currently undergoing maintenance.');
      }
    } catch (e) {
      console.error('Failed to fetch config', e);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      fetchConfig().then(() => {
        if (!isMaintenance() || authState.isAdmin) {
          fetchSaves();
        } else {
          setLoading(false);
        }
      });
      onCleanup(() => clearTimeout(timer));
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      onCleanup(() => clearTimeout(timer));
    }
  });

  let configSubscription: any;

  const processAuthToken = async (hashOrUrl: string) => {
    try {
      const hash = hashOrUrl.includes('#') ? hashOrUrl.split('#')[1] : (hashOrUrl.startsWith('#') ? hashOrUrl.substring(1) : hashOrUrl);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        await setCustomSession(accessToken, refreshToken);
        addToast('Login successful!', 'success');
        setIsLoginModalOpen(false);
      }
    } catch (e) {
      addToast('Login failed', 'error');
    }
  };

  onMount(() => {
    listen<string>('auth-success', async (event) => {
      await processAuthToken(event.payload);
    }).then(unlisten => { unlistenLocalServer = unlisten; }).catch(() => {});

    onOpenUrl(async (urls) => {
      for (const url of urls) {
        if (url.includes('access_token=') && url.includes('refresh_token=')) {
          await processAuthToken(url);
        }
      }
    }).then(unlisten => { unlistenDeepLink = unlisten; }).catch(() => {});

    rtSubscription = supabase
      .channel('save_files_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'save_files' }, (payload) => {
        setSaves(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        if (saveDetailsModal()?.id === payload.new.id) setSaveDetailsModal(prev => ({ ...prev!, ...payload.new }));
      }).subscribe();

    configSubscription = supabase
      .channel('app_config_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_config' }, (payload) => {
        if (payload.new.id === 'global') {
          setIsMaintenance(payload.new.is_maintenance);
          setMaintenanceMsg(payload.new.maintenance_message);
          if (!payload.new.is_maintenance || authState.isAdmin) fetchSaves();
        }
      }).subscribe();
  });

  onCleanup(() => {
    if (unlistenLocalServer) unlistenLocalServer();
    if (unlistenDeepLink) unlistenDeepLink();
    if (rtSubscription) supabase.removeChannel(rtSubscription);
    if (configSubscription) supabase.removeChannel(configSubscription);
  });

  const handleLogin = async (provider: 'discord' | 'github' | 'google') => {
    try {
      const currentOs = osType();
      const isMobile = currentOs === 'android' || currentOs === 'ios';
      const redirectUrl = isMobile ? 'suzu://auth/callback' : 'http://127.0.0.1:14225/callback';
      
      const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl, skipBrowserRedirect: true } });
      if (error) throw error;
      if (data?.url) { await openUrl(data.url); }
    } catch (e: any) {
      addToast(e.message || 'Login failed', 'error');
    }
  };

  const handleReport = (saveId: string, saveTitle: string) => {
    if (!authState.session) return addToast('Login required to report', 'info');
    setReportTarget({ id: saveId, title: saveTitle });
    setIsReportModalOpen(true);
  };

  const submitReport = async () => {
    if (!reportTarget()) return;
    try {
      const { error } = await supabase.rpc('report_save_file', {
        target_id: reportTarget()!.id,
        p_reason: reportForm().reason,
        p_description: reportForm().description
      });
      if (error && (error.message.includes('duplicate key') || error.message.includes('already'))) {
        addToast('You have already reported this file!', 'error');
      } else if (error) {
        throw error;
      } else {
        addToast('Save flagged for review', 'success');
        setIsReportModalOpen(false);
        setReportForm({ reason: 'Outdated Version', description: '' });
      }
    } catch (e: any) {
      addToast(e.message || 'Report failed', 'error');
    }
  };

  const handleDownload = (url: string, saveTitle: string) => {
    requestConfirm('Download & Extract', `Download and extract "${saveTitle}" to your local folder?`, 'danger', async () => {
      closeConfirm(false);
      try {
        const extractDir = await openDialog({ directory: true, title: 'Select folder to extract the save to' });
        if (!extractDir) return;

        setDownloadStatus('Connecting...');
        setDownloadProgress(1); // Show modal
        setIsUploading(true);

        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const contentLength = +(response.headers.get('Content-Length') || 0);
        let receivedLength = 0;
        
        const tempZipName = `temp_${Date.now()}.zip`;
        const tempZipPath = await join(extractDir as string, tempZipName);
        
        if (response.body) {
          const reader = response.body.getReader();
          const chunks = [];
          
          while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            if (contentLength > 0) {
              setDownloadProgress((receivedLength / contentLength) * 100);
              setDownloadStatus(`Downloading: ${formatBytes(receivedLength)} / ${formatBytes(contentLength)}`);
            } else {
              setDownloadProgress(50);
              setDownloadStatus(`Downloading: ${formatBytes(receivedLength)}`);
            }
          }
          
          const buffer = new Uint8Array(receivedLength);
          let position = 0;
          for(let chunk of chunks) {
            buffer.set(chunk, position);
            position += chunk.length;
          }
          await writeFile(tempZipPath, buffer);
        } else {
          const buffer = await response.arrayBuffer();
          await writeFile(tempZipPath, new Uint8Array(buffer));
        }

        setDownloadStatus('Checking for file collisions...');
        const collisions = await invoke<string[]>('check_zip_collisions', { zipPath: tempZipPath, destDir: extractDir as string });
        
        if (collisions.length > 0) {
          setDownloadProgress(0); // Hide progress bar for a moment
          setIsUploading(false);
          const proceed = await new Promise<boolean>(resolve => {
            const collisionText = collisions.slice(0,5).join('\n') + (collisions.length > 5 ? `\n...and ${collisions.length - 5} more` : '');
            requestConfirm(
              'FILES WILL BE OVERWRITTEN', 
              `The following files already exist in the destination:\n\n${collisionText}\n\nDo you want to BACKUP the existing files before overwriting?`, 
              'warning', 
              async () => {
                closeConfirm(false);
                setDownloadProgress(99);
                setDownloadStatus('Backing up existing files...');
                setIsUploading(true);
                await invoke('backup_colliding_files', { destDir: extractDir as string, files: collisions });
                resolve(true);
              },
              () => {
                resolve(false);
              }
            );
          });
          
          if (!proceed) {
            await remove(tempZipPath);
            return;
          }
        }

        setDownloadProgress(100);
        setDownloadStatus('Extracting save data...');
        setIsUploading(true);
        try {
          await invoke('extract_save_zip', { zipPath: tempZipPath, destDir: extractDir as string });
          addToast('Save extracted successfully!', 'success');
        } finally {
          try { await remove(tempZipPath); } catch(e) {}
        }
      } catch (e: any) {
        addToast(`Failed: ${e.message}`, 'error');
      } finally {
        setDownloadProgress(0);
        setIsUploading(false);
      }
    });
  };

  const toggleSaveSelection = (saveId: string) => setSelectedSaves(prev => prev.includes(saveId) ? prev.filter(id => id !== saveId) : [...prev, saveId]);

  const handleAdminDelete = (saveId: string, fileUrl: string) => {
    requestConfirm('Delete Save', 'Permanently delete?', 'danger', async () => {
      closeConfirm(false);
      try {
        const fileName = fileUrl.split('/').pop();
        if (fileName) await supabase.storage.from('saves').remove([fileName]);
        await supabase.from('save_files').delete().eq('id', saveId);
        addToast('Deleted permanently', 'success');
        setSelectedSaves(prev => prev.filter(id => id !== saveId));
        fetchSaves();
      } catch (e: any) { addToast('Delete failed: ' + e.message, 'error'); }
    });
  };

  const handleAdminToggleVisibility = async (saveId: string, status: boolean) => { await supabase.from('save_files').update({ is_visible: !status }).eq('id', saveId); fetchSaves(); };
  const handleAdminVerify = async (saveId: string, status: boolean) => { await supabase.from('save_files').update({ is_verified: !status }).eq('id', saveId); fetchSaves(); };
  const handleAdminClearReports = async (saveId: string) => {
    await supabase.from('save_files').update({ report_count: 0 }).eq('id', saveId);
    await supabase.from('user_reports').delete().eq('save_id', saveId);
    fetchSaves();
    addToast('Reports cleared', 'success');
    if (adminReportsModal()?.saveId === saveId) setAdminReportsModal(null);
  };

  const handleViewReports = async (saveId: string, title: string) => {
    setIsLoadingReports(true);
    try {
      const { data, error } = await supabase.from('user_reports').select('*').eq('save_id', saveId).order('created_at', { ascending: false });
      if (error) throw error;
      setAdminReportsModal({ saveId, title, reports: data || [] });
    } catch (e: any) { addToast('Failed: ' + e.message, 'error'); } finally { setIsLoadingReports(false); }
  };

  const handleToggleMaintenance = () => {
    requestConfirm(
      isMaintenance() ? 'Disable Lockdown' : 'Enable Lockdown',
      isMaintenance() ? 'Are you sure you want to reopen the database to the public?' : 'Are you sure you want to lockdown the database? Normal users will be completely blocked.',
      'warning',
      async () => {
        closeConfirm(false);
        try {
          const newState = !isMaintenance();
          const { error } = await supabase.from('app_config').update({ is_maintenance: newState }).eq('id', 'global');
          if (error) throw error;
          setIsMaintenance(newState);
          addToast(`System ${newState ? 'LOCKED' : 'UNLOCKED'}`, 'success');
        } catch (e: any) {
          addToast('Failed: ' + e.message, 'error');
        }
      }
    );
  };

  const handleBulkAdminAction = (action: 'verify' | 'unverify' | 'hide' | 'unhide' | 'clear_reports' | 'safe') => {
    if (selectedSaves().length === 0) return;
    const actionsMap = {
      'verify': { text: 'VERIFY', update: { is_verified: true } },
      'unverify': { text: 'UNVERIFY', update: { is_verified: false } },
      'hide': { text: 'HIDE', update: { is_visible: false } },
      'unhide': { text: 'UNHIDE', update: { is_visible: true } },
      'clear_reports': { text: 'CLEAR REPORTS', update: { report_count: 0 } },
      'safe': { text: 'MARK SAFE', update: { is_nsfw: false } }
    };
    const config = actionsMap[action];
    requestConfirm(`Bulk ${config.text}`, `Apply to ${selectedSaves().length} items?`, 'warning', async () => {
      closeConfirm(false);
      setLoading(true);
      try {
        const promises = selectedSaves().map(async (id) => {
          if (action === 'clear_reports') await supabase.from('user_reports').delete().eq('save_id', id);
          await supabase.from('save_files').update(config.update).eq('id', id);
        });
        await Promise.all(promises);
        addToast(`Success!`, 'success');
        setSelectedSaves([]); setIsBulkSelectMode(false); fetchSaves();
      } catch (e: any) { addToast(`Failed: ${e.message}`, 'error'); } finally { setLoading(false); }
    });
  };

  const handleBulkDownload = async () => {
    if (selectedSaves().length === 0) return;
    requestConfirm('Bulk Download', `Download ${selectedSaves().length} files?`, 'danger', async () => {
      closeConfirm(false);
      const folderPath = await openDialog({ directory: true });
      if (!folderPath) return;

      setDownloadProgress(1);
      setIsUploading(true);
      let successCount = 0;
      let failedCount = 0;
      try {
        for (let i = 0; i < selectedSaves().length; i++) {
          const id = selectedSaves()[i];
          const saveFile = saves().find(s => s.id === id);
          if (!saveFile?.file_url) {
            failedCount++;
            continue;
          }

          setDownloadStatus(`Downloading ${i + 1}/${selectedSaves().length}: ${saveFile.title}`);
          const safeTitle = (saveFile.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Save') + `_${id.substring(0, 8)}`;
          const subDir = await join(folderPath as string, safeTitle);
          try { await mkdir(subDir, { recursive: true }); } catch(e) {}
          
          const tempZipPath = await join(folderPath as string, `temp_bulk_${id}.zip`);
        
          const response = await fetch(saveFile.file_url, { method: 'GET' });
          if (!response.ok) {
            failedCount++;
            continue;
          }

          const contentLength = +(response.headers.get('Content-Length') || 0);
          let receivedLength = 0;

          if (response.body) {
            const reader = response.body.getReader();
            const chunks = [];
            while(true) {
              const {done, value} = await reader.read();
              if (done) break;
              chunks.push(value);
              receivedLength += value.length;
              if (contentLength > 0) {
                setDownloadProgress((receivedLength / contentLength) * 100);
              }
            }
            const buffer = new Uint8Array(receivedLength);
            let position = 0;
            for(let chunk of chunks) {
              buffer.set(chunk, position);
              position += chunk.length;
            }
            await writeFile(tempZipPath, buffer);
          } else {
            const buffer = await response.arrayBuffer();
            await writeFile(tempZipPath, new Uint8Array(buffer));
          }

          setDownloadStatus(`Extracting ${i + 1}/${selectedSaves().length}: ${saveFile.title}`);
          const collisions = await invoke<string[]>('check_zip_collisions', { zipPath: tempZipPath, destDir: subDir });
          if (collisions.length > 0) {
            setDownloadStatus(`Backing up ${collisions.length} existing files...`);
            await invoke('backup_colliding_files', { destDir: subDir, files: collisions });
          }

          try {
            await invoke('extract_save_zip', { zipPath: tempZipPath, destDir: subDir });
            successCount++;
          } catch (e) {
            failedCount++;
          } finally {
            try { await remove(tempZipPath); } catch(e) {}
          }
        }
        
        if (failedCount > 0) {
          addToast(`Downloaded ${successCount}/${selectedSaves().length} files (${failedCount} failed)`, 'warning');
        } else {
          addToast(`Successfully downloaded all ${successCount} files!`, 'success');
        }
        setSelectedSaves([]); setIsBulkSelectMode(false);
      } catch (e: any) { 
        addToast(`Error: ${e.message}`, 'error'); 
      } finally { 
        setIsUploading(false); 
        setDownloadProgress(0);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedSaves().length === 0) return;
    requestConfirm('Bulk Delete', `Delete ${selectedSaves().length} saves?`, 'danger', async () => {
      closeConfirm(false);
      for (const id of selectedSaves()) {
        const save = saves().find(s => s.id === id);
        if (save?.file_url) {
          const fileName = save.file_url.split('/').pop();
          if (fileName) await supabase.storage.from('saves').remove([fileName]);
          await supabase.from('save_files').delete().eq('id', id);
        }
      }
      setSelectedSaves([]); setIsBulkSelectMode(false); fetchSaves();
      addToast('Bulk delete complete', 'success');
    });
  };

  const handleLogout = () => requestConfirm('Confirm Logout', 'Are you sure?', 'warning', () => { closeConfirm(false); signOut(); });

  return (
<Show when={shouldRender()}>
   <div
    class={`fixed inset-0 z-40 flex items-center justify-center p-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] font-mono ${isVisible() ? "opacity-100 bg-black/95" : "opacity-0 bg-transparent"}`}
    onClick={props.onClose}
   >
    <div 
      class={`w-full max-w-6xl h-[85vh] bg-black border-4 border-zinc-200 flex flex-col overflow-hidden shadow-[8px_8px_0px_#FF7A00] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible() ? "scale-100 translate-y-0" : "scale-95 translate-y-8"}`} 
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-6 py-4 border-b-4 border-zinc-200 bg-zinc-900 relative">
      <div class="flex items-center gap-3">
       <div class="text-[#FF7A00]">
       <Database size={28} strokeWidth={2.5} />
      </div>
      <div class="flex items-center gap-4">
       <div>
        <h2 class="text-2xl font-black text-white tracking-widest uppercase">CLOUD_DB_ACCESS</h2>
        <p class="text-xs text-zinc-400 font-bold uppercase tracking-widest">Connect to global save repository</p>
       </div>
<div class="">
 <button
  onClick={toggleDisclaimer}
  class={`p-1.5 transition-all cursor-pointer border-2 flex items-center justify-center ${showNSFWDisclaimer() ? 'relative z-[101] bg-[#FF7A00] text-black border-black shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)] translate-y-0.5 translate-x-0.5' : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-[#FF7A00] hover:border-[#FF7A00] shadow-[2px_2px_0px_#FF7A00]'}`}
 >
  <Tooltip text="NSFW Detection Info" position="bottom" align="center">
   <Info size={18} strokeWidth={2.5} />
  </Tooltip>
 </button>

 <div
  class={`absolute top-full left-4 sm:left-6 mt-4 z-[100] w-[calc(100%-2rem)] sm:w-[350px] origin-top-left transition-all duration-200 ease-out ${
   showNSFWDisclaimer()
    ? 'opacity-100 scale-100 visible translate-y-0'
    : 'opacity-0 scale-95 invisible -translate-y-2 pointer-events-none'
  }`}
 >
  <div class="w-full bg-zinc-950 border-4 border-white shadow-[8px_8px_0px_#ea580c] flex flex-col p-4">
   <div class="flex items-start gap-3 mb-3 border-b-2 border-zinc-800 pb-3 text-[#FF7A00]">
    <Info size={24} class="shrink-0" />
    <h3 class="font-black text-base uppercase tracking-widest leading-tight">NSFW Auto-Detection Disclaimer</h3>
   </div>
  
   <p class="text-xs text-zinc-300 font-desc leading-relaxed mb-4">
    Automated content filter tries to blur NSFW images automatically. But, because game covers can be unpredictable, this system is <strong class="text-white bg-red-900/50 px-1">NOT 100% accurate</strong>.<br/><br/>
    Some safe covers might get blurred by mistake, and some NSFW ones might slip through. Sorry, please browse with caution.
   </p>
  
   <button
    onClick={handleCloseDisclaimer}
    class="w-full py-2 hover:bg-[#FF7A00] border-2 border-[#FF7A00] text-[#FF7A00] hover:text-black font-black uppercase tracking-widest text-xs transition-colors cursor-pointer"
   >
    Understood
   </button>
  </div>
 </div>
</div>
      </div>
     </div>
     <button
      onClick={props.onClose}
      class="p-2 hover:bg-[#FF7A00] text-zinc-400 hover:text-black transition-colors border-2 border-transparent hover:border-black cursor-pointer"
     >
      <X size={24} />
     </button>
    </div>

    {/* Toolbar */}
  <div class="px-6 py-4 flex flex-wrap gap-4 items-center justify-between border-b-4 border-zinc-200 bg-black">
     <div class="flex flex-wrap flex-1 gap-4 items-center max-w-2xl">
      <div class="flex-1 flex min-w-[200px] flex-wrap items-center gap-2">
       <div class="flex-1 flex min-w-[150px] items-center bg-zinc-900 border-2 border-zinc-700 transition-colors duration-200 focus-within:border-[#FF7A00] px-3 group py-2">
        <div class="flex items-center pr-2 text-zinc-500 transition-colors duration-200 focus-within:text-[#FF7A00] group-focus-within:text-[#FF7A00]">
         <Search size={18} />
        </div>
        <input 
         type="text" 
         placeholder="SEARCH QUERY..." 
         class="bg-transparent border-none outline-none text-zinc-400 font-mono text-xs w-full uppercase tracking-widest placeholder:text-zinc-700"
         value={searchQuery()}
         onInput={(e) => {
           setSearchQuery(e.currentTarget.value);
           clearTimeout(searchTimeout);
           searchTimeout = setTimeout(() => fetchSaves(false, e.currentTarget.value), 500);
         }}
        />
       </div>
       <select
        value={sortOrder()}
        onChange={(e) => { setSortOrder(e.currentTarget.value as any); fetchSaves(); }}
        class="bg-zinc-900 border-2 border-zinc-700 text-zinc-300 font-black uppercase tracking-widest text-[10px] p-2 outline-none cursor-pointer focus:border-[#FF7A00] hover:border-zinc-500 transition-colors shrink-0"
       >
        <option value="newest">NEWEST FIRST</option>
        <option value="oldest">OLDEST FIRST</option>
       </select>
       <select
        value={engineFilter()}
        onChange={(e) => { setEngineFilter(e.currentTarget.value); fetchSaves(); }}
        class="bg-zinc-900 border-2 border-zinc-700 text-zinc-300 font-black uppercase tracking-widest text-[10px] p-2 outline-none cursor-pointer focus:border-[#FF7A00] hover:border-zinc-500 transition-colors shrink-0"
       >
        <option value="all">ALL ENGINES</option>
        <option value="RPG Maker MV/MZ">RPG MAKER MV/MZ</option>
        <option value="RPG Maker VX Ace">RPG MAKER VX ACE</option>
        <option value="Ren'Py">REN'PY</option>
        <option value="KiriKiri">KIRIKIRI</option>
        <option value="WOLF RPG Editor">WOLF RPG</option>
        <option value="TyranoBuilder">TYRANOBUILDER</option>
        <option value="Unity">UNITY</option>
        <option value="unknown">UNKNOWN ENGINES</option>
       </select>
      </div>
      <Tooltip text="SHOW/HIDE ADULT CONTENT">
      <button onClick={() => setShowNSFW(!showNSFW())} class={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-center border-2 font-black uppercase tracking-widest text-xs gap-2 ${showNSFW() ? 'bg-red-500 text-black border-black shadow-[4px_4px_0px_#ffffff]' : 'bg-zinc-950 text-white border-white hover:border-red-500 hover:text-red-500 shadow-[4px_4px_0px_#FF7A00] hover:shadow-[4px_4px_0px_red]'}`}>
       {showNSFW() ? <Eye size={16} /> : <EyeOff size={16} />}
       {showNSFW() ? 'NSFW: ON' : 'NSFW: OFF'}
      </button>
      </Tooltip>
      <Show when={authState.session}>
       <Tooltip text="SHOW ONLY MY UPLOADS">
       <button onClick={() => { setFilterMode(filterMode() === 'my_uploads' ? 'all' : 'my_uploads'); fetchSaves(); }} class={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-center border-2 font-black uppercase tracking-widest text-xs gap-2 ${filterMode() === 'my_uploads' ? 'bg-[#FF7A00] text-black border-black shadow-[4px_4px_0px_#ffffff]' : 'bg-zinc-950 text-white border-white hover:border-[#FF7A00] hover:text-[#FF7A00] shadow-[4px_4px_0px_#FF7A00] hover:shadow-[4px_4px_0px_#FF7A00]'}`}>
        <Cloud size={16} />
        {filterMode() === 'my_uploads' ? 'MY UPLOADS' : 'ALL UPLOADS'}
       </button>
       </Tooltip>
      </Show>
     </div>
     <Show when={authState.session}>
      <div class="flex flex-wrap items-center gap-4 xl:gap-8 justify-end">
       <Show when={authState.isAdmin}>
        <div class="flex flex-wrap items-center gap-2">
         <button onClick={() => { setIsAdminMode(!isAdminMode()); fetchSaves(); }} class={`px-4 py-2 border-2 font-black tracking-widest text-[10px] uppercase transition-all flex items-center gap-2 cursor-pointer shrink-0 ${isAdminMode() ? 'bg-red-500 text-black border-red-500 shadow-[4px_4px_0px_white]' : 'bg-zinc-900 text-red-500 border-red-900 hover:bg-red-950 shadow-[4px_4px_0px_rgba(239,68,68,0)] hover:shadow-[4px_4px_0px_rgba(239,68,68,0.5)]'}`}>
          <Shield size={14} /> ADMIN MODE
         </button>
         <button onClick={handleToggleMaintenance} class={`px-4 py-2 border-2 font-black tracking-widest text-[10px] uppercase transition-all flex items-center gap-2 cursor-pointer shrink-0 ${isMaintenance() ? 'bg-red-900 text-white border-red-500 animate-pulse shadow-[4px_4px_0px_red]' : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-red-500 hover:border-red-500 hover:shadow-[4px_4px_0px_rgba(239,68,68,0.5)]'}`}>
          <ShieldAlert size={14} /> {isMaintenance() ? 'SYS LOCKED' : 'LOCKDOWN'}
         </button>
        </div>
       </Show>
       <Tooltip text="SELECT MULTIPLE ITEMS">
       <button onClick={() => { setIsBulkSelectMode(!isBulkSelectMode()); setSelectedSaves([]); }} class={`px-4 py-2 border-2 font-black tracking-widest text-[10px] uppercase transition-all flex items-center gap-2 cursor-pointer shrink-0 ${isBulkSelectMode() ? 'bg-[#FF7A00] text-black border-[#FF7A00] shadow-[4px_4px_0px_white]' : 'bg-zinc-900 text-[#FF7A00] border-orange-900 hover:bg-orange-950 shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_rgba(255,122,0,0.5)]'}`}>
        <LayoutList size={14} /> BULK SELECT
       </button>
       </Tooltip>
       <div class="flex items-center gap-3 border-2 border-zinc-700 p-1.5 transition-colors hover:border-[#FF7A00] shrink-0">
        <Show when={authState.user?.user_metadata?.avatar_url}>
          <img src={authState.user?.user_metadata?.avatar_url} class="w-10 h-10 rounded-full object-cover border-2 border-zinc-700" />
        </Show>
        <div class="flex items-center pr-4 py-1 border-r-2 border-zinc-800">
         <span class="text-xs font-bold text-zinc-400 uppercase tracking-widest max-w-[150px] truncate">
          USER: <span class="text-[#FF7A00] ml-1">{authState.user?.user_metadata?.full_name || authState.user?.email || 'ANONYMOUS'}</span>
         </span>
        </div>
        <Tooltip text="Logout">
         <button onClick={handleLogout} class="px-2 hover:text-red-500 transition-colors text-zinc-400 cursor-pointer">
          <LogOut size={20} strokeWidth={2.5} />
         </button>
        </Tooltip>
       </div>
       <div class="flex items-center shrink-0">
        <button onClick={() => setIsUploadModalOpen(true)} class="px-6 py-3 bg-[#FF7A00] hover:bg-white text-black font-black tracking-widest uppercase transition-colors flex items-center gap-2 cursor-pointer border-2 border-black hover:border-black shadow-[4px_4px_0px_#FF7A00] hover:shadow-[4px_4px_0px_white]">
         <Upload size={18} strokeWidth={3} />
         UPLOAD SAVE
        </button>
       </div>
      </div>
     </Show>
     <Show when={!authState.session && !authState.loading}>
      <div class="flex items-center gap-3 shrink-0">
       <button onClick={() => setIsLoginModalOpen(true)} class="px-6 py-3 bg-zinc-900 border-2 border-zinc-700 hover:border-[#FF7A00] text-zinc-300 hover:text-[#FF7A00] font-black tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer shadow-[4px_4px_0px_rgba(255,122,0,0)] hover:shadow-[4px_4px_0px_#FF7A00] hover:-translate-y-0.5 hover:-translate-x-0.5">
        <span class="mr-2">{">>"}</span> <span>CONTRIBUTE SAVE</span>
       </button>
      </div>
     </Show>
    </div>

    {/* Content */}
    <div class="flex-1 overflow-y-auto p-6 bg-black relative">
     <Show when={isMaintenance() && !authState.isAdmin}>
      <div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-red-500 font-black tracking-widest uppercase p-8 text-center m-4 border-2 border-red-900 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
       <ShieldAlert size={64} class="mb-6 animate-pulse" />
       <h2 class="text-4xl mb-4 tracking-widest">SYSTEM LOCKDOWN</h2>
       <div class="h-1 w-24 bg-red-900 mb-6"></div>
       <p class="text-zinc-400 font-bold text-sm max-w-md leading-relaxed">{maintenanceMsg()}</p>
      </div>
     </Show>

     <Show when={loading() && (!isMaintenance() || authState.isAdmin)}>
      <div class="w-full h-full flex flex-col items-center justify-center text-[#FF7A00] font-bold uppercase tracking-widest">
       <Loader2 class="animate-spin mb-4" size={40} />
       <p>Establishing secure connection...</p>
      </div>
     </Show>
    
     <Show when={!loading()}>
      <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
       <Show when={saves().length === 0 && !loading()}>
        <div class="col-span-full min-h-[400px] flex flex-col items-center justify-center text-zinc-600 font-bold uppercase tracking-widest self-center">
         <Search size={48} class="mb-4 opacity-50" />
         <p>NO SAVE FILES FOUND MATCHING YOUR QUERY</p>
        </div>
       </Show>
       <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
       <For each={saves()}>
        {(save) => (
          <SaveCard 
            save={save}
            isAdminMode={isAdminMode()}
            isBulkSelectMode={isBulkSelectMode()}
            selectedSaves={selectedSaves()}
            showNSFW={showNSFW()}
            onToggleSelection={toggleSaveSelection}
            onClick={setSaveDetailsModal}
            onAdminVerify={handleAdminVerify}
            onAdminToggleVisibility={handleAdminToggleVisibility}
            onViewReports={handleViewReports}
            onAdminDelete={handleAdminDelete}
            onReport={handleReport}
            onEdit={(s) => setEditSaveModal(s)}
            onDownload={handleDownload}
          />
        )}
       </For>
       </div>
       
       <Show when={hasMore() && saves().length > 0}>
        <div class="flex justify-center mt-4 mb-20">
         <button 
           onClick={(e) => { e.preventDefault(); fetchSaves(true); }}
           disabled={isFetchingMore()}
           class="px-8 py-4 bg-zinc-950 text-[#FF7A00] border-2 border-[#FF7A00] hover:bg-[#FF7A00] hover:text-black font-black uppercase tracking-widest text-sm transition-all shadow-[4px_4px_0px_#FF7A00] hover:shadow-[0px_0px_0px_#FF7A00] hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
         >
          <Show when={isFetchingMore()} fallback={<Database size={20} />}>
           <Loader2 size={20} class="animate-spin" />
          </Show>
          {isFetchingMore() ? 'FETCHING...' : '>> LOAD MORE'}
         </button>
        </div>
       </Show>
       
      </div>
      <Show when={isBulkSelectMode() && selectedSaves().length > 0}>
       <div class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 border-2 border-[#FF7A00] p-4 flex flex-wrap justify-center items-center gap-2 md:gap-6 shadow-[8px_8px_0px_#FF7A00] z-50 animate-in slide-in-from-bottom-10 w-[95vw] md:w-auto md:max-w-[90vw] max-h-[40vh] overflow-y-auto">
        <div class="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2 shrink-0">
         <CheckSquare size={18} class="text-[#FF7A00]" />
         {selectedSaves().length} SELECTED
        </div>
        <div class="h-6 w-0.5 bg-zinc-800 self-center"></div>

        <button onClick={handleBulkDownload} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-blue-400 border-2 border-blue-900 hover:bg-blue-500 hover:text-black hover:border-blue-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
         <Download size={14} /> BULK DOWNLOAD
        </button>

        <Show when={isAdminMode()}>
         <div class="flex flex-wrap justify-center items-center gap-2 md:border-r-2 border-zinc-800 md:pr-4">
          <button onClick={() => handleBulkAdminAction('safe')} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-blue-400 border-2 border-blue-900 hover:bg-blue-500 hover:text-black hover:border-blue-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
           MARK SAFE
          </button>
          <button onClick={() => handleBulkAdminAction('verify')} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-green-500 border-2 border-green-900 hover:bg-green-500 hover:text-black hover:border-green-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
           VERIFY
          </button>
          <button onClick={() => handleBulkAdminAction('unverify')} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-zinc-500 border-2 border-zinc-800 hover:bg-zinc-500 hover:text-black hover:border-zinc-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
           UNVERIFY
          </button>
          <button onClick={() => handleBulkAdminAction('hide')} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-purple-400 border-2 border-purple-900 hover:bg-purple-500 hover:text-black hover:border-purple-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
           HIDE
          </button>
          <button onClick={() => handleBulkAdminAction('unhide')} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-purple-400 border-2 border-purple-900 hover:bg-purple-500 hover:text-black hover:border-purple-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
           UNHIDE
          </button>
          <button onClick={() => handleBulkAdminAction('clear_reports')} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
           CLEAR REPORTS
          </button>
         </div>
         <button onClick={handleBulkDelete} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-black hover:border-red-500 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
          <Trash2 size={14} /> BULK DELETE
         </button>
        </Show>

        <button onClick={() => setSelectedSaves([])} class="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-zinc-400 border-2 border-zinc-800 hover:bg-zinc-200 hover:text-black hover:border-zinc-200 hover:shadow-[4px_4px_0px_white] transition-all uppercase font-black tracking-widest text-[10px] cursor-pointer">
         <X size={14} /> CANCEL
        </button>
       </div>
      </Show>
     </Show>
    </div>
   
    {/* Download Progress Modal */}
    <Modal
      isOpen={downloadProgress() > 0}
      onClose={() => {}}
      title="DOWNLOADING..."
      width="max-w-md"
    >
      <div class="flex flex-col items-center">
        <Loader2 size={32} class="animate-spin text-[#FF7A00] mb-4" />
        <h3 class="text-sm font-black text-white tracking-widest uppercase mb-2">{downloadStatus()}</h3>
        <div class="w-full bg-zinc-900 border-2 border-zinc-700 h-6 relative mt-4">
          <div 
            class="bg-[#FF7A00] h-full transition-all duration-300"
            style={{ width: `${downloadProgress()}%` }}
          ></div>
          <div class="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white mix-blend-difference">
            {Math.round(downloadProgress())}%
          </div>
        </div>
      </div>
    </Modal>

    {/* Upload Modal */}
    <UploadSaveModal
      isOpen={isUploadModalOpen()}
      onClose={() => setIsUploadModalOpen(false)}
      onUploadComplete={() => fetchSaves()}
      showNSFW={showNSFW()}
    />

    {/* Login Modal */}
    <Modal
     isOpen={isLoginModalOpen()}
     onClose={() => setIsLoginModalOpen(false)}
     title="AUTHENTICATION REQUIRED"
     width="max-w-md"
    >
     <div class="flex flex-col items-center">
        <div class="w-16 h-16 bg-black border-2 border-[#FF7A00] flex items-center justify-center mb-6 shadow-[4px_4px_0px_#FF7A00]">
         <Cloud size={32} class="text-[#FF7A00]" />
        </div>
        <h3 class="text-2xl font-black text-white tracking-widest uppercase mb-4">ACCESS REQUIRED</h3>
        <p class="text-xs text-zinc-400 font-bold text-center mb-6 uppercase tracking-widest leading-relaxed">
         To prevent spam and ensure repository quality, you must link your identity before contributing a save file.
        </p>
       
        <div class="bg-black border-2 border-zinc-800 p-4 mb-8 text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-left w-full">
         <span class="text-[#FF7A00]">PRIVACY_PROTOCOL:</span> This is to prevent bots and credit you as the uploader. We DO NOT have access to your personal data, messages, friends list, etc. Using official and authorized API integration.
        </div>
       
        <div class="w-full flex flex-col gap-4 font-black uppercase tracking-widest">
         <button onClick={() => handleLogin('discord')} class="w-full py-4 border-2 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-3 text-sm shadow-[4px_4px_0px_rgba(88,101,242,0.3)] hover:shadow-[4px_4px_0px_rgba(88,101,242,1)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          INITIALIZE DISCORD
         </button>
         <button onClick={() => handleLogin('github')} class="w-full py-4 border-2 border-zinc-500 text-zinc-300 hover:bg-zinc-300 hover:text-black transition-colors cursor-pointer flex items-center justify-center gap-3 text-sm shadow-[4px_4px_0px_rgba(113,113,122,0.3)] hover:shadow-[4px_4px_0px_rgba(113,113,122,1)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
          INITIALIZE GITHUB
         </button>
         <button onClick={() => handleLogin('google')} class="w-full py-4 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-3 text-sm shadow-[4px_4px_0px_rgba(239,68,68,0.3)] hover:shadow-[4px_4px_0px_rgba(239,68,68,1)]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          INITIALIZE GOOGLE
         </button>
       </div>
     </div>
    </Modal>

    {/* Report Modal */}
    <Modal
     isOpen={isReportModalOpen()}
     onClose={() => setIsReportModalOpen(false)}
     title="REPORT_SAVE"
     width="max-w-md"
    >
     <div class="flex flex-col items-center">
        <div class="w-16 h-16 bg-black border-2 border-red-500 flex items-center justify-center mb-6 shadow-[4px_4px_0px_#ef4444]">
         <ShieldAlert size={32} class="text-red-500" />
        </div>
        <h3 class="text-lg font-black text-white tracking-widest uppercase mb-4 text-center">{reportTarget()?.title}</h3>
       
         <div class="w-full flex flex-col gap-4">
          <div class="flex flex-col gap-1">
           <label class="text-xs font-bold text-zinc-400 tracking-widest uppercase">Reason</label>
           <select value={reportForm().reason} onChange={(e) => setReportForm({...reportForm(), reason: e.currentTarget.value})} class="w-full bg-black border-2 border-zinc-700 p-2 text-white outline-none focus:border-red-500 font-bold uppercase tracking-widest text-xs cursor-pointer">
            <option value="Outdated Version">Outdated Version</option>
            <option value="Wrong Game File">Wrong Game File</option>
            <option value="Corrupted File">Corrupted File</option>
            <option value="NSFW / Inappropriate Cover">NSFW / Inappropriate Cover</option>
            <option value="Spam">Spam</option>
            <option value="Other">Other</option>
           </select>
          </div>
        
         <div class="flex flex-col gap-1">
          <label class="text-xs font-bold text-zinc-400 tracking-widest uppercase">Description (Optional)</label>
          <textarea rows={3} maxLength={300} value={reportForm().description} onInput={(e) => setReportForm({...reportForm(), description: e.currentTarget.value})} class="w-full bg-black border-2 border-zinc-700 p-2 text-white outline-none focus:border-red-500 resize-none placeholder-zinc-700 font-mono text-sm" placeholder="Additional details..."></textarea>
         </div>
        
         <button onClick={submitReport} class="mt-2 w-full py-4 bg-red-950 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest">
          <Flag size={18} /> SUBMIT REPORT
         </button>
        </div>
     </div>
    </Modal>
   
    {/* Custom Confirm Modal */}
    <Modal
     isOpen={confirmModal().isOpen}
     onClose={closeConfirm}
     title={confirmModal().title}
     width="max-w-sm"
    >
     <div class="flex flex-col">
       <p class="text-sm text-zinc-400 font-serif mb-8">{confirmModal().message}</p>
      
       <div class="flex gap-4">
        <button onClick={closeConfirm} class="flex-1 py-2 bg-zinc-900 border-2 border-zinc-700 hover:border-zinc-500 text-zinc-300 font-bold tracking-widest uppercase transition-colors cursor-pointer">
         CANCEL
        </button>
        <button
         onClick={confirmModal().onConfirm}
         class={`flex-1 py-2 border-2 text-black font-black tracking-widest uppercase transition-colors cursor-pointer ${
          confirmModal().kind === 'danger' ? 'bg-red-500 border-red-500 hover:bg-white hover:border-white' :
          confirmModal().kind === 'warning' ? 'bg-[#FF7A00] border-[#FF7A00] hover:bg-white hover:border-white' :
          'bg-blue-500 border-blue-500 hover:bg-white hover:border-white'
         }`}
        >
         CONFIRM
        </button>
       </div>
     </div>
    </Modal>
    {/* Admin Reports Modal */}
    <Modal
     isOpen={!!adminReportsModal()}
     onClose={() => setAdminReportsModal(null)}
     title={`REPORTS: ${adminReportsModal()?.title}`}
     icon={<ShieldAlert size={18} />}
     width="max-w-2xl"
    >
     <div class="-m-6 flex flex-col max-h-[80vh]">
      <div class="p-6 overflow-y-auto bg-[#0a0a0a] flex-1">
        <Show when={isLoadingReports()}>
         <div class="text-center text-zinc-500 font-bold uppercase tracking-widest p-8 flex items-center justify-center gap-2"><Loader2 class="animate-spin" size={18}/> FETCHING REPORTS...</div>
        </Show>
        <Show when={!isLoadingReports() && adminReportsModal()?.reports?.length === 0}>
         <div class="text-center text-zinc-500 font-bold uppercase tracking-widest p-8">No reports found.</div>
        </Show>
        <Show when={!isLoadingReports() && (adminReportsModal()?.reports?.length || 0) > 0}>
         <div class="flex flex-col gap-4">
          <For each={adminReportsModal()?.reports}>
           {(report: any) => (
            <div class="bg-black border border-zinc-800 p-4 rounded-sm flex flex-col gap-2 relative">
             <div class="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span class="text-xs font-black text-[#FF7A00] tracking-widest uppercase">{report.reason}</span>
              <span class="text-[10px] font-mono text-zinc-500">{new Date(report.created_at).toLocaleString()}</span>
             </div>
             <p class="text-sm text-zinc-300 mt-2 font-desc whitespace-pre-wrap">{report.description || 'No description provided.'}</p>
             <div class="text-[10px] text-zinc-600 uppercase mt-2 flex items-center gap-2">
              <span>Reporter ID: <span class="font-bold text-zinc-400">{report.user_id}</span></span>
              <Tooltip text="Copy Reporter ID" position="top">
              <button onClick={() => { navigator.clipboard.writeText(report.user_id); addToast('Copied to clipboard!', 'success'); }} class="p-1 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer rounded-sm">
               <Copy size={12} />
              </button>
              </Tooltip>
             </div>
            </div>
           )}
          </For>
         </div>
        </Show>
       </div>
       <div class="p-4 bg-black border-t-2 border-zinc-800 flex justify-end gap-4">
        <button onClick={() => setAdminReportsModal(null)} class="px-6 py-2 border-2 border-zinc-700 text-zinc-400 hover:text-white transition-colors uppercase font-bold tracking-widest text-xs cursor-pointer">CLOSE</button>
        <button onClick={() => handleAdminClearReports(adminReportsModal()!.saveId)} class="px-6 py-2 bg-red-950 text-red-500 border-2 border-red-900 hover:bg-red-500 hover:text-black hover:border-red-500 transition-colors uppercase font-black tracking-widest text-xs shadow-[4px_4px_0px_white] cursor-pointer">
         CLEAR ALL REPORTS
        </button>
       </div>
     </div>
    </Modal>

    {/* Save Details Modal */}
    <SaveDetailsModal
      save={saveDetailsModal()}
      onClose={() => setSaveDetailsModal(null)}
      showNSFW={showNSFW()}
      isAdminMode={isAdminMode()}
      isOwner={authState.user?.id === saveDetailsModal()?.uploader_id}
      onReport={handleReport}
      onEdit={(s) => setEditSaveModal(s)}
      onDownload={handleDownload}
    />

    <EditSaveModal
      isOpen={!!editSaveModal()}
      onClose={() => setEditSaveModal(null)}
      saveData={editSaveModal()}
      onUpdateComplete={() => fetchSaves(false)}
      requestConfirm={requestConfirm}
    />

   </div>
  </div>
  </Show>
 );
}