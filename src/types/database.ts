export interface SaveFile {
  id: string;
  title: string;
  description: string;
  game_engine: string;
  game_version?: string;
  game_cover_url?: string;
  is_nsfw: boolean;
  is_verified: boolean;
  is_visible: boolean;
  file_size_bytes: number;
  created_at: string;
  uploader: string;
  uploader_id: string;
  uploader_avatar_url?: string;
  file_url: string;
  report_count: number;
  scan_status: 'safe' | 'scanning' | 'pending' | 'malicious';
}
