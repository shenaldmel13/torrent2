import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface StreamModalProps {
  infoHash: string;
  fileIndex: number;
  fileName: string;
  onClose: () => void;
}

export function StreamModal({ infoHash, fileIndex, fileName, onClose }: StreamModalProps) {
  const isAudio = fileName.match(/\.(mp3|wav|ogg|flac)$/i);
  const streamUrl = `/api/stream/${infoHash}/${fileIndex}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-sm font-medium text-white truncate pr-4">{fileName}</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative bg-black flex-1 flex items-center justify-center aspect-video sm:aspect-[16/9] lg:aspect-[21/9]">
          {isAudio ? (
            <audio controls src={streamUrl} className="w-full max-w-md mx-6" autoPlay />
          ) : (
            <video
              controls
              autoPlay
              src={streamUrl}
              className="w-full h-full object-contain"
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
