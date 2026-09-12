import { createSignal } from 'solid-js';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeFile, remove, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { addToast } from '../../store/toastStore';
import { formatBytes } from './CloudDatabaseBrowser';

export function useCloudDownloader(props: {
  requestConfirm: (title: string, message: string, kind: 'warning' | 'info' | 'danger', onConfirm: () => void, onCancel?: () => void) => void,
  closeConfirm: (isCancel?: boolean | Event) => void,
  saves: () => any[],
  selectedSaves: () => string[],
  setSelectedSaves: (saves: string[] | ((prev: string[]) => string[])) => void,
  setIsBulkSelectMode: (mode: boolean) => void
}) {
  const [isUploading, setIsUploading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal(0);
  const [downloadStatus, setDownloadStatus] = createSignal('');
  const [bulkDownloadQueue, setBulkDownloadQueue] = createSignal<any[]>([]);

  const handleDownload = async (saveFile: any) => {
    const { type: osType } = await import('@tauri-apps/plugin-os');
    const os = osType();
    const isMobile = os === 'android' || os === 'ios';

    props.requestConfirm('Download & Extract', `Download and extract "${saveFile.title}" to your local folder?`, 'danger', async () => {
      props.closeConfirm(false);
      try {
        let extractDir: string;
        
        if (isMobile) {
          const { downloadDir } = await import('@tauri-apps/api/path');
          const baseDir = await downloadDir();
          const safeTitle = (saveFile.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Save') + `_${saveFile.id.substring(0, 8)}`;
          extractDir = await join(baseDir, 'SuzuCloudSaves', safeTitle);
          await mkdir(extractDir, { recursive: true }).catch(() => {});
        } else {
          const picked = await openDialog({ directory: true, title: 'Select folder to extract the save to' });
          if (!picked) return;
          extractDir = picked as string;
        }

        setDownloadStatus('Connecting...');
        setDownloadProgress(1); // Show modal
        setIsUploading(true);

        const tempZipName = `temp_${Date.now()}.zip`;
        const tempZipPath = await join(extractDir as string, tempZipName);

        if (isMobile) {
          const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
          const response = await tauriFetch(saveFile.file_url, { method: 'GET' });
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          setDownloadStatus(`Downloading via native client...`);
          const buffer = await response.arrayBuffer();
          await writeFile(tempZipPath, new Uint8Array(buffer));
        } else {
          const response = await fetch(saveFile.file_url, { method: 'GET' });
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          
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
        }

        setDownloadStatus('Checking for file collisions...');
        const collisions = await invoke<string[]>('check_zip_collisions', { zipPath: tempZipPath, destDir: extractDir as string });
        
        if (collisions.length > 0) {
          setDownloadProgress(0); // Hide progress bar for a moment
          setIsUploading(false);
          const proceed = await new Promise<boolean>(resolve => {
            const collisionText = collisions.slice(0,5).join('\n') + (collisions.length > 5 ? `\n...and ${collisions.length - 5} more` : '');
            props.requestConfirm(
              'FILES WILL BE OVERWRITTEN', 
              `The following files already exist in the destination:\n\n${collisionText}\n\nDo you want to BACKUP the existing files before overwriting?`, 
              'warning', 
              async () => {
                props.closeConfirm(false);
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
          
          if (isMobile) {
             addToast(`Saved to Download/SuzuCloudSaves`, 'success');
          } else {
             addToast('Save extracted successfully!', 'success');
          }
        } finally {
          try { await remove(tempZipPath); } catch(e) {}
        }
      } catch (e: any) {
        addToast(`Failed: ${e.message || e}`, 'error');
      } finally {
        setDownloadProgress(0);
        setIsUploading(false);
      }
    });
  };

  const handleBulkDownload = async () => {
    if (props.selectedSaves().length === 0) return;
    const { type: osType } = await import('@tauri-apps/plugin-os');
    const os = osType();
    const isMobile = os === 'android' || os === 'ios';

    props.requestConfirm('Bulk Download', `Download ${props.selectedSaves().length} files?`, 'danger', async () => {
      props.closeConfirm(false);
      
      let folderPath: string;
      if (isMobile) {
        const { downloadDir } = await import('@tauri-apps/api/path');
        const baseDir = await downloadDir();
        folderPath = await join(baseDir, 'SuzuCloudSaves', 'BulkDownload_' + Date.now());
        await mkdir(folderPath, { recursive: true }).catch(() => {});
      } else {
        const picked = await openDialog({ directory: true });
        if (!picked) return;
        folderPath = picked as string;
      }

      setDownloadProgress(1);
      setIsUploading(true);
      let successCount = 0;
      let failedCount = 0;

      const initialQueue = props.selectedSaves().map(id => ({
        id,
        title: props.saves().find(s => s.id === id)?.title || 'Unknown',
        status: 'pending',
        progress: 0
      }));
      setBulkDownloadQueue(initialQueue);

      const updateItem = (id: string, status: string, progress: number) => {
        setBulkDownloadQueue(prev => prev.map(item => item.id === id ? { ...item, status, progress } : item));
      };

      try {
        for (let i = 0; i < props.selectedSaves().length; i++) {
          const id = props.selectedSaves()[i];
          const saveFile = props.saves().find(s => s.id === id);
          if (!saveFile?.file_url) {
            updateItem(id, 'error', 0);
            failedCount++;
            continue;
          }

          updateItem(id, 'downloading', 0);
          setDownloadStatus(`Downloading ${i + 1}/${props.selectedSaves().length}: ${saveFile.title}`);
          const safeTitle = (saveFile.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Save') + `_${id.substring(0, 8)}`;
          const subDir = await join(folderPath as string, safeTitle);
          try { await mkdir(subDir, { recursive: true }); } catch(e) {}
          
          const tempZipPath = await join(folderPath as string, `temp_bulk_${id}.zip`);
        
          if (isMobile) {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            const response = await tauriFetch(saveFile.file_url, { method: 'GET' });
            if (!response.ok) {
              updateItem(id, 'error', 0);
              failedCount++;
              continue;
            }
            const buffer = await response.arrayBuffer();
            await writeFile(tempZipPath, new Uint8Array(buffer));
            updateItem(id, 'downloading', 100);
          } else {
            const response = await fetch(saveFile.file_url, { method: 'GET' });
            if (!response.ok) {
              updateItem(id, 'error', 0);
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
                  const prog = (receivedLength / contentLength) * 100;
                  setDownloadProgress(prog);
                  updateItem(id, 'downloading', prog);
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
          }

          updateItem(id, 'extracting', 100);
          setDownloadStatus(`Extracting ${i + 1}/${props.selectedSaves().length}: ${saveFile.title}`);
          const collisions = await invoke<string[]>('check_zip_collisions', { zipPath: tempZipPath, destDir: subDir });
          if (collisions.length > 0) {
            setDownloadStatus(`Backing up ${collisions.length} existing files...`);
            await invoke('backup_colliding_files', { destDir: subDir, files: collisions });
          }

          try {
            await invoke('extract_save_zip', { zipPath: tempZipPath, destDir: subDir });
            updateItem(id, 'done', 100);
            successCount++;
          } catch (e) {
            updateItem(id, 'error', 0);
            failedCount++;
          } finally {
            try { await remove(tempZipPath); } catch(e) {}
          }
        }
        
        if (failedCount > 0) {
          addToast(`Downloaded ${successCount}/${props.selectedSaves().length} files (${failedCount} failed)`, 'warning');
        } else {
          addToast(`Successfully downloaded all ${successCount} files!`, 'success');
        }
        props.setSelectedSaves([]); 
        props.setIsBulkSelectMode(false);
      } catch (e: any) { 
        addToast(`Error: ${e.message || e}`, 'error'); 
      } finally { 
        setIsUploading(false); 
        setDownloadProgress(0);
        setTimeout(() => setBulkDownloadQueue([]), 2000); // Clear after 2 seconds
      }
    });
  };

  return {
    isUploading,
    downloadProgress,
    downloadStatus,
    bulkDownloadQueue,
    handleDownload,
    handleBulkDownload
  };
}
