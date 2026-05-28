export interface TorrentFile {
  name: string;
  length: number;
  path: string;
  index: number;
  downloaded: number;
}

export interface Torrent {
  infoHash: string;
  name: string;
  magnetURI?: string;
  downloaded: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  ratio: number;
  numPeers: number;
  timeRemaining: number;
  length: number;
  paused: boolean;
  done: boolean;
  files: TorrentFile[];
}

export interface TorrentHistoryItem {
  infoHash: string;
  name: string;
  magnetURI?: string;
  addedAt: number;
}
