import React, { useState } from "react";
import { Torrent } from "../types";
import {
  Play,
  Pause,
  X,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Download,
  Users,
  Clock,
  Video,
  Copy,
  Archive,
} from "lucide-react";
import bytes from "bytes";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import { StreamModal } from "./StreamModal";

interface TorrentCardProps {
  torrent: Torrent;
  onPause: (infoHash: string) => void;
  onResume: (infoHash: string) => void;
  onRemove: (infoHash: string) => void;
}

export const TorrentCard: React.FC<TorrentCardProps> = ({
  torrent,
  onPause,
  onResume,
  onRemove,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [streamFile, setStreamFile] = useState<{
    index: number;
    name: string;
  } | null>(null);

  const getStatusText = () => {
    if (torrent.done) return "Completed";
    if (torrent.paused) return "Paused";
    return "Downloading";
  };

  const getStatusColor = () => {
    if (torrent.done)
      return "text-green-400 bg-green-500/20 border-green-400/30";
    if (torrent.paused)
      return "text-purple-400 bg-purple-500/20 border-purple-400/30";
    return "text-cyan-400 bg-cyan-500/20 border-cyan-400/30";
  };

  const formatTime = (ms: number) => {
    if (!ms || ms === Infinity) return "---";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const isVideo = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    return ["mp4", "webm", "ogg", "mkv", "avi"].includes(ext || "");
  };

  const handleCopyMagnet = () => {
    if (torrent.magnetURI) {
      navigator.clipboard.writeText(torrent.magnetURI);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0d0d0d]/80 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h3
                  className="text-xl md:text-2xl font-bold text-white truncate max-w-full"
                  title={
                    torrent.name ||
                    (torrent.infoHash
                      ? `Magnet: ${torrent.infoHash.slice(0, 10)}...`
                      : "Loading metadata...")
                  }
                >
                  {torrent.name || "Loading metadata..."}
                </h3>
                <span
                  className={clsx(
                    "text-[10px] font-black px-2 py-0.5 rounded border uppercase",
                    getStatusColor(),
                  )}
                >
                  {getStatusText()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  {bytes(torrent.downloaded)} / {bytes(torrent.length)}
                </span>
                {!torrent.done && !torrent.paused && (
                  <>
                    <span className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                      <Download className="w-3.5 h-3.5" />
                      {bytes(torrent.downloadSpeed)}/s
                    </span>
                    <span className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(torrent.timeRemaining)}
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                  <Users className="w-3.5 h-3.5" />
                  {torrent.numPeers} Peers
                </span>
              </div>
            </div>

            <div className="flex flex-row items-center gap-2 shrink-0">
              {torrent.magnetURI && (
                <button
                  onClick={handleCopyMagnet}
                  className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-cyan-400 transition-colors"
                  title="Copy Magnet"
                >
                  <Copy className="w-5 h-5" />
                </button>
              )}
              {torrent.files?.length > 0 && (
                <a
                  href={`/api/stream/${torrent.infoHash}/zip`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300 transition-colors"
                  title="Download ZIP"
                >
                  <Archive className="w-5 h-5" />
                </a>
              )}
              {torrent.paused ? (
                <button
                  onClick={() => onResume(torrent.infoHash)}
                  className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300 transition-colors"
                  title="Resume"
                >
                  <Play className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => onPause(torrent.infoHash)}
                  className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300 transition-colors"
                  title="Pause"
                >
                  <Pause className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onRemove(torrent.infoHash)}
                className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-red-400 transition-colors"
                title="Remove"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mb-8">
            <motion.div
              className={clsx(
                "h-full",
                torrent.done
                  ? "bg-green-500 shrink-0"
                  : "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${torrent.progress * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {torrent.files && torrent.files.length > 0 && (
            <div className="flex-1 flex flex-col bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 hover:bg-white/[0.02] text-xs font-bold uppercase tracking-wider text-gray-500 focus:outline-none focus:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <span>File Browser</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                    {torrent.files.length}
                  </span>
                </div>
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                      {torrent.files.map((file, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center p-3 sm:px-6 sm:py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                            <div className="w-8 h-8 shrink-0 bg-white/5 text-gray-400 rounded-lg flex items-center justify-center font-mono text-xs font-bold">
                              {file.name.split(".").pop()?.toUpperCase() ||
                                "FILE"}
                            </div>
                            <span className="text-sm text-gray-200 truncate">
                              {file.name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:w-auto">
                            <span className="text-sm text-gray-400 font-mono hidden md:block">
                              {bytes(file.length)}
                            </span>

                            <div className="flex flex-col gap-1 w-24">
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                                  style={{
                                    width: `${file.length > 0 ? (file.downloaded / file.length) * 100 : 0}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-[9px] text-gray-500 font-bold uppercase">
                                {(file.length > 0
                                  ? (file.downloaded / file.length) * 100
                                  : 0
                                ).toFixed(1)}
                                %
                              </span>
                            </div>

                            <div className="flex justify-end gap-1.5 shrink-0">
                              {isVideo(file.name) && (
                                <button
                                  onClick={() =>
                                    setStreamFile({
                                      index: file.index,
                                      name: file.name,
                                    })
                                  }
                                  className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-400 transition-colors"
                                  title="Stream Video"
                                >
                                  <Video className="w-4 h-4" />
                                </button>
                              )}
                              <a
                                href={`/api/stream/${torrent.infoHash}/${file.index}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-white/10 rounded text-gray-400 transition-colors"
                                title="Download File"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {streamFile && (
          <StreamModal
            infoHash={torrent.infoHash}
            fileIndex={streamFile.index}
            fileName={streamFile.name}
            onClose={() => setStreamFile(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
