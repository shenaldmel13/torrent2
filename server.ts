import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import WebTorrent from "webtorrent";
import multer from "multer";
import fs from "fs";
import cron from "node-cron";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");

const upload = multer({ dest: "/tmp/uploads/" });

// Advanced WebTorrent client configuration for seedbox-like performance
const client = new WebTorrent({
  maxConns: 150, // Max number of peers per torrent
  dht: true, // Enable DHT
  tracker: true, // Enable trackers
  lsd: true, // Enable Local Service Discovery
  webSeeds: true, // Enable Web Seeds
});

const DB_FILE = path.join(process.cwd(), "torrents_db.json");

// Robust fallback trackers
const FALLBACK_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.moeking.me:6969/announce",
  "udp://explodie.org:6969/announce",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.openwebtorrent.com",
];

const encodeTrackers = FALLBACK_TRACKERS.map(
  (t) => `&tr=${encodeURIComponent(t)}`,
).join("");

function injectTrackers(magnetURI: string): string {
  if (!magnetURI.startsWith("magnet:")) return magnetURI;
  return magnetURI + encodeTrackers;
}

const torrentsState: Record<string, any> = {};

function saveDatabase() {
  const activeTorrents = client.torrents.map((t) => t.magnetURI);
  fs.writeFileSync(DB_FILE, JSON.stringify(activeTorrents));
}

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((magnetURI) => {
          client.add(magnetURI, { path: "/tmp/torrents" }, (torrent) => {
            torrentsState[torrent.infoHash] = getTorrentState(torrent);
          });
        });
      }
    } catch (e) {
      console.error("Failed to load torrents db", e);
    }
  }
}

// Cleanup job: Remove temporary files if needed. For now, we trust WebTorrent's /tmp/torrents path,
// but we should delete files from destroyed torrents explicitly.
cron.schedule("0 * * * *", () => {
  // Can add periodic cleanup of stray files here
  saveDatabase();
});

function getTorrentState(torrent: any) {
  return {
    infoHash: torrent.infoHash,
    name: torrent.name,
    magnetURI: torrent.magnetURI,
    downloaded: torrent.downloaded,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    progress: torrent.progress,
    ratio: torrent.ratio,
    numPeers: torrent.numPeers,
    timeRemaining: torrent.timeRemaining,
    length: torrent.length,
    paused: torrent.paused,
    done: torrent.done,
    files: torrent.files.map((file: any, index: number) => ({
      name: file.name,
      length: file.length,
      path: file.path,
      index,
      downloaded: file.downloaded,
    })),
  };
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
  });
  const PORT = 3000;

  loadDatabase();

  app.use(express.json());

  // WebSocket for progress updates
  io.on("connection", (socket) => {
    socket.emit("torrents", Object.values(torrentsState));

    const interval = setInterval(() => {
      client.torrents.forEach((t) => {
        torrentsState[t.infoHash] = getTorrentState(t);
      });
      socket.emit("torrents", Object.values(torrentsState));
    }, 1000);

    socket.on("disconnect", () => {
      clearInterval(interval);
    });
  });

  // REST APIs
  app.post("/api/torrents/magnet", (req, res) => {
    const { magnetURI } = req.body;
    if (!magnetURI) return res.status(400).json({ error: "Missing magnetURI" });

    try {
      const injectedURI = injectTrackers(magnetURI);
      const torrent = client.add(injectedURI, { path: "/tmp/torrents" });
      torrent.on("metadata", () => {
        torrentsState[torrent.infoHash] = getTorrentState(torrent);
        io.emit("torrents", Object.values(torrentsState));
        saveDatabase();
      });
      torrent.on("error", (err) => {
        console.error("Torrent error", err);
      });
      res.json({ success: true, infoHash: torrent.infoHash });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/torrents/upload", upload.single("torrent"), (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "Missing torrent file" });

    try {
      const torrentFileBuffer = fs.readFileSync(req.file.path);
      const torrent = client.add(torrentFileBuffer, { path: "/tmp/torrents" });
      torrent.on("metadata", () => {
        torrentsState[torrent.infoHash] = getTorrentState(torrent);
        io.emit("torrents", Object.values(torrentsState));
        saveDatabase();
      });
      res.json({ success: true, infoHash: torrent.infoHash });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    } finally {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
    }
  });

  app.delete("/api/torrents/:infoHash", async (req, res) => {
    const { infoHash } = req.params;
    const torrent = await client.get(infoHash);
    if (!torrent) return res.status(404).json({ error: "Not found" });

    torrent.destroy();
    delete torrentsState[infoHash];
    io.emit("torrents", Object.values(torrentsState));
    saveDatabase();
    res.json({ success: true });
  });

  app.post("/api/torrents/:infoHash/pause", async (req, res) => {
    const { infoHash } = req.params;
    const torrent = await client.get(infoHash);
    if (!torrent) return res.status(404).json({ error: "Not found" });

    torrent.pause();
    torrentsState[infoHash] = getTorrentState(torrent);
    io.emit("torrents", Object.values(torrentsState));
    res.json({ success: true });
  });

  app.post("/api/torrents/:infoHash/resume", async (req, res) => {
    const { infoHash } = req.params;
    const torrent = await client.get(infoHash);
    if (!torrent) return res.status(404).json({ error: "Not found" });

    torrent.resume();
    torrentsState[infoHash] = getTorrentState(torrent);
    io.emit("torrents", Object.values(torrentsState));
    res.json({ success: true });
  });

  app.get("/api/stream/:infoHash/zip", async (req, res) => {
    const { infoHash } = req.params;
    const torrent = await client.get(infoHash);
    if (!torrent) return res.status(404).send("Torrent not found");

    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(torrent.name || infoHash)}.zip"`,
    });

    const archive = archiver("zip", { zlib: { level: 1 } });
    archive.on("error", (err) => {
      console.error("ZIP archiver error:", err);
      // Wait to close response until error
    });

    archive.pipe(res);

    torrent.files.forEach((file) => {
      // Stream each torrent file directly into the ZIP archive.
      // Downloading the ZIP will force the torrent to prioritize downloading these pieces.
      archive.append(file.createReadStream() as any, { name: file.path });
    });

    archive.finalize();
  });

  app.get("/api/stream/:infoHash/:fileIndex", async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    const torrent = await client.get(infoHash);
    if (!torrent) return res.status(404).send("Torrent not found");

    const file = torrent.files[parseInt(fileIndex)];
    if (!file) return res.status(404).send("File not found");

    // Support range requests for video streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${file.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "application/octet-stream",
      });

      const stream = file.createReadStream({ start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": file.length,
        "Content-Type": "application/octet-stream",
      });
      file.createReadStream().pipe(res);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          } else if (filePath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          } else if (filePath.endsWith(".html")) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
          } else if (filePath.endsWith(".svg")) {
            res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
          } else if (filePath.endsWith(".png")) {
            res.setHeader("Content-Type", "image/png");
          } else if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
            res.setHeader("Content-Type", "image/jpeg");
          } else if (filePath.endsWith(".ico")) {
            res.setHeader("Content-Type", "image/x-icon");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
