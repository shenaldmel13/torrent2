import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Torrent, TorrentHistoryItem } from "./types";
import { UploadArea } from "./components/UploadArea";
import { TorrentCard } from "./components/TorrentCard";
import { motion, AnimatePresence } from "motion/react";
import { CloudLightning, Clock, Play, Server, Wifi, WifiOff, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

let socket: Socket;

export default function App() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"transfers" | "library">("transfers");
  const [history, setHistory] = useState<TorrentHistoryItem[]>([]);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline" | "static" | "cookie-restricted">("checking");

  useEffect(() => {
    socket = io({ path: "/socket.io" });

    socket.on("torrents", (data: Torrent[]) => {
      setTorrents(data);
    });

    const saved = localStorage.getItem("torrent_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }

    const checkServer = async () => {
      try {
        const res = await fetch("/api/health");
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data && data.status === "ok") {
            setServerStatus("online");
            return;
          }
        }
        
        const text = await res.text();
        const normalized = text.toLowerCase();
        if (normalized.includes("aistudio_auth_flow") || normalized.includes("authflowtestcookie") || normalized.includes("redirecttoreturnurl")) {
          setServerStatus("cookie-restricted");
        } else if (text.trim().startsWith("<!DOCTYPE") || normalized.includes("<html") || normalized.includes("<body")) {
          setServerStatus("static");
        } else {
          setServerStatus("offline");
        }
      } catch (err) {
        setServerStatus("offline");
      }
    };

    checkServer();
    const intervalId = setInterval(checkServer, 8000);

    return () => {
      socket.disconnect();
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (torrents.length > 0) {
      setHistory((prev) => {
        let changed = false;
        const newHistory = [...prev];

        torrents.forEach((t) => {
          if (t.name) {
            const existing = newHistory.find((h) => h.infoHash === t.infoHash);
            if (existing) {
              if (
                existing.name !== t.name ||
                existing.magnetURI !== t.magnetURI
              ) {
                existing.name = t.name;
                existing.magnetURI = t.magnetURI || existing.magnetURI;
                changed = true;
              }
            } else {
              newHistory.unshift({
                infoHash: t.infoHash,
                name: t.name,
                magnetURI: t.magnetURI,
                addedAt: Date.now(),
              });
              changed = true;
            }
          }
        });

        if (changed) {
          localStorage.setItem("torrent_history", JSON.stringify(newHistory));
          return newHistory;
        }
        return prev;
      });
    }
  }, [torrents]);

  const safeParseJson = async (response: Response, defaultError: string) => {
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    if (!response.ok) {
      if (isJson) {
        try {
          const body = await response.json();
          throw new Error(body.error || defaultError);
        } catch (e: any) {
          throw new Error(e.message || defaultError);
        }
      } else {
        const text = await response.text();
        if (text.trim().startsWith("<!DOCTYPE")) {
          throw new Error(
            "The backend returned an HTML page instead of JSON. This usually indicates that the backend Express server is not running or accessible (e.g., if hosted on static-only hosting like Netlify) or route is missing."
          );
        }
        throw new Error(text || `Request failed with status ${response.status}`);
      }
    }

    if (!isJson) {
      const text = await response.text();
      if (text.trim().startsWith("<!DOCTYPE")) {
        throw new Error(
          "Received an HTML page instead of the API JSON response. A running Node/Express backend is required for torrent downloads; this app cannot run on static-only providers like Netlify without full-stack container support."
        );
      }
      throw new Error(`Expected JSON but received: ${text.slice(0, 100)}`);
    }

    return response.json();
  };

  const handleMagnetSubmit = async (magnetURI: string) => {
    setError(null);
    try {
      const res = await fetch("/api/torrents/magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magnetURI }),
      });
      await safeParseJson(res, "Failed to add magnet link");
      setView("transfers");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    const formData = new FormData();
    formData.append("torrent", file);
    try {
      const res = await fetch("/api/torrents/upload", {
        method: "POST",
        body: formData,
      });
      await safeParseJson(res, "Failed to upload torrent file");
      setView("transfers");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePause = async (infoHash: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/torrents/${infoHash}/pause`, { method: "POST" });
      await safeParseJson(res, "Failed to pause torrent");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResume = async (infoHash: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/torrents/${infoHash}/resume`, { method: "POST" });
      await safeParseJson(res, "Failed to resume torrent");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemove = async (infoHash: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/torrents/${infoHash}`, { method: "DELETE" });
      await safeParseJson(res, "Failed to remove torrent");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeFromHistory = (infoHash: string) => {
    const newHistory = history.filter((h) => h.infoHash !== infoHash);
    setHistory(newHistory);
    localStorage.setItem("torrent_history", JSON.stringify(newHistory));
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#0a0a0a] text-gray-100 font-sans flex flex-col">
      <header className="h-16 flex items-center justify-between px-8 border-b border-white/10 bg-[#0d0d0d] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center">
            <CloudLightning className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Torrent<span className="text-cyan-400">2Direct</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
            {serverStatus === "checking" && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[10px] font-bold text-yellow-400 font-mono tracking-tight uppercase">Checking Server</span>
              </>
            )}
            {serverStatus === "online" && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-tight uppercase">Server Online</span>
              </>
            )}
            {serverStatus === "cookie-restricted" && (
              <>
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-tight uppercase">Iframe Shield Active</span>
              </>
            )}
            {serverStatus === "offline" && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-400 font-mono tracking-tight uppercase">Server Offline</span>
              </>
            )}
            {serverStatus === "static" && (
              <>
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-bold text-rose-400 font-mono tracking-tight uppercase">Static Mode (Netlify)</span>
              </>
            )}
          </div>

          <nav className="flex items-center gap-6">
            <button
              onClick={() => setView("transfers")}
              className={`text-sm font-medium border-b-2 pb-1 transition-colors ${view === "transfers" ? "text-cyan-400 border-cyan-400" : "text-gray-400 border-transparent hover:text-white"}`}
            >
              Transfers
            </button>
            <button
              onClick={() => setView("library")}
              className={`text-sm font-medium border-b-2 pb-1 transition-colors ${view === "library" ? "text-cyan-400 border-cyan-400" : "text-gray-400 border-transparent hover:text-white"}`}
            >
              Library
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full">
        <AnimatePresence>
          {serverStatus === "static" && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/20 text-rose-200 flex flex-col md:flex-row gap-5 items-start shadow-2xl"
            >
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-bold text-rose-300">Netlify Static Hosting Detected</h3>
                <p className="text-sm text-rose-200/80 leading-relaxed">
                  This seedbox application performs torrent downloading, raw streaming, and real-time updates which require a running Node.js backend. Netlify is a <strong>static-only host</strong> and cannot execute persistent backend servers.
                </p>
                <div className="pt-2 flex flex-wrap gap-4 items-center">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-rose-400/10 text-rose-400 border border-rose-500/20 rounded-md">
                    Action Required: Please run or deploy this application as a full-stack container (e.g. on Cloud Run).
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {serverStatus === "cookie-restricted" && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="p-6 rounded-2xl bg-[#111322] border border-indigo-500/20 text-indigo-200 flex flex-col md:flex-row gap-5 items-start shadow-2xl"
            >
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
                <Server className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-bold text-indigo-300">Iframe Cookie Restriction Deflected (Authorization Loop)</h3>
                <p className="text-sm text-indigo-200/80 leading-relaxed">
                  The Node.js backend is fully operational on port 3000, but your browser is blocking required sandbox authentication cookies inside the embedded iframe. This is common cross-site privacy protection behavior.
                </p>
                <div className="pt-2 flex flex-wrap gap-4 items-center">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-colors duration-200 rounded-xl shadow-lg shadow-indigo-600/30"
                  >
                    Open App in New Tab
                  </a>
                  <span className="text-xs text-indigo-300/60 font-mono">
                    Once opened in a new window, session cookies authorize immediately to unlock the full Seedbox client features.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {serverStatus === "offline" && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="p-6 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-amber-200 flex flex-col md:flex-row gap-5 items-start shadow-2xl"
            >
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
                <WifiOff className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-bold text-amber-300">Backend Server Connection Offline</h3>
                <p className="text-sm text-amber-200/80 leading-relaxed">
                  The frontend is unable to reach the Node/Express backend on <code>/api</code>. Ensure your backend server is loaded and running on port 3000, or verify that your local development hosting proxy is active.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {view === "transfers" ? (
          <section className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 max-w-md w-full shrink-0">
              <div className="bg-[#0d0d0d]/80 p-6 border border-white/10 rounded-2xl flex flex-col gap-6 shadow-xl">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                    Add New Content
                  </h2>
                  <p className="text-xs text-gray-400">
                    Paste a magnet link or upload a torrent file to start.
                  </p>
                </div>
                <UploadArea
                  onMagnetSubmit={handleMagnetSubmit}
                  onFileUpload={handleFileUpload}
                />

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      className="mt-2"
                    >
                      <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium shadow-lg">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col min-w-0"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-2">
                Active Torrents
              </h2>
              {torrents.length > 0 ? (
                <div className="flex flex-col gap-6">
                  <AnimatePresence mode="popLayout">
                    {torrents.map((torrent) => (
                      <TorrentCard
                        key={torrent.infoHash}
                        torrent={torrent}
                        onPause={handlePause}
                        onResume={handleResume}
                        onRemove={handleRemove}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/10 rounded-2xl p-10 mt-2 min-h-[300px]">
                  <CloudLightning className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-sm">No active torrents.</p>
                </div>
              )}
            </motion.div>
          </section>
        ) : (
          <section className="flex flex-col">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-6">
              Past Downloads & Library
            </h2>
            <div className="bg-[#0d0d0d]/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              {history.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {history.map((item) => {
                    const isActive = torrents.some(
                      (t) => t.infoHash === item.infoHash,
                    );
                    return (
                      <div
                        key={item.infoHash}
                        className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-200 truncate">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />{" "}
                              {item.addedAt ? format(item.addedAt, "MMM d, yyyy h:mm a") : "Unknown Date"}
                            </span>
                            <span className="font-mono text-[10px] uppercase">
                              {item.infoHash.slice(0, 12)}...
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {isActive ? (
                            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 rounded text-[10px] font-black uppercase">
                              Active
                            </span>
                          ) : item.magnetURI ? (
                            <button
                              onClick={() =>
                                handleMagnetSubmit(item.magnetURI!)
                              }
                              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" /> Re-Download
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 italic">
                              No magnet link saved
                            </span>
                          )}
                          <button
                            onClick={() => removeFromHistory(item.infoHash)}
                            className="text-xs text-red-400 hover:text-red-300 px-3 py-2"
                          >
                            Remove Record
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <Clock className="w-10 h-10 mx-auto mb-4 opacity-50" />
                  <p>Your download history is empty.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
