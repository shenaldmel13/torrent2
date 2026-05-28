import React, { useCallback, useState } from "react";
import { Upload, Link as LinkIcon } from "lucide-react";
import clsx from "clsx";
import { motion } from "motion/react";

interface UploadAreaProps {
  onMagnetSubmit: (magnet: string) => void;
  onFileUpload: (file: File) => void;
}

export function UploadArea({ onMagnetSubmit, onFileUpload }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [magnet, setMagnet] = useState("");

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith(".torrent")) {
          onFileUpload(file);
        } else {
          alert("Please upload a .torrent file.");
        }
      }
    },
    [onFileUpload],
  );

  const handleMagnetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (magnet.trim()) {
      onMagnetSubmit(magnet.trim());
      setMagnet("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        onSubmit={handleMagnetSubmit}
        className="relative flex items-center w-full"
      >
        <input
          type="text"
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-24 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors text-gray-200 placeholder-gray-500"
          placeholder="Paste Magnet Link..."
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
        />
        <button
          type="submit"
          disabled={!magnet.trim()}
          className="absolute right-2 top-2 bottom-2 px-4 bg-cyan-500 text-black text-xs font-bold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          FETCH
        </button>
      </motion.form>

      <motion.label
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={clsx(
          "h-32 w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer",
          isDragging
            ? "border-cyan-500/50 bg-cyan-500/10"
            : "border-white/10 bg-white/[0.02] hover:border-cyan-500/30",
        )}
      >
        <Upload
          className={clsx(
            "w-8 h-8 transition-colors",
            isDragging
              ? "text-cyan-400"
              : "text-gray-500 group-hover:text-cyan-400",
          )}
        />
        <span className="text-xs text-gray-400">
          Drop .torrent file here or click to browse
        </span>
        <input
          type="file"
          accept=".torrent"
          className="hidden"
          onChange={handleFileChange}
        />
      </motion.label>
    </div>
  );
}
