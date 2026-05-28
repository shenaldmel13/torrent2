# Torrent2Direct

Torrent2Direct is a modern web application that allows users to directly download and stream torrent content without requiring a separate BitTorrent client. This app proxies BitTorrent traffic through a Node.js backend.

## Features

- **Direct Downloads**: Download files via standard HTTP instead of installing a torrent client locally.
- **In-Browser Video Streaming**: Stream `mp4`, `webm`, and `mkv` files directly in your browser.
- **Magnet & `.torrent` Support**: Easily paste magnet URLs or drag-and-drop torrent files.
- **Real-Time Progress**: View live download speeds, upload speeds, peers, and ETA powered by WebSockets.
- **File Selection**: Only download the specific files you want from a larger torrent.
- **Clean UI**: Beautiful minimal dashboard built with React, Tailwind CSS, and Framer Motion.

## Technical Stack

- **Frontend**: React 19, Tailwind CSS v4, Motion (Animations), Socket.io Client
- **Backend**: Node.js, Express, WebTorrent, Socket.io
- **Build System**: Vite, esbuild

## Installation Instructions

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/torrent2direct.git
    cd torrent2direct
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Environment Setup

By default, the application runs on port `3000`. You can configure environment variables by creating a `.env` file (see `.env.example`):

```bash
# Optional: Set a specific port
PORT=3000
```

## Running the App

### Development

To start the development server (which includes live-reloading for the frontend and automatic restarts for the backend):

```bash
npm run dev
```

### Production

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

## Docker Support

You can easily deploy Torrent2Direct using Docker.

1.  **Build the Docker image**:
    ```bash
    docker build -t torrent2direct .
    ```

2.  **Run the Docker container**:
    ```bash
    docker run -p 3000:3000 -v /tmp/torrents:/tmp/torrents torrent2direct
    ```
    *Note: We mount a volume to `/tmp/torrents` to ensure the downloaded data persists across container restarts, though it can be omitted if you only want in-memory/ephemeral storage.*

## Production Deployment Steps

1.  **Compile the App**: Ensure you run `npm run build` so that `dist/server.cjs` and the static frontend files are generated.
2.  **Reverse Proxy**: Set up an NGINX or Caddy reverse proxy to expose port `3000`.
3.  **Process Manager**: Use PM2 or systemd to keep the Node.js server running:
    ```bash
    pm2 start dist/server.cjs --name "torrent2direct"
    ```
4.  **SSL/TLS**: Secure your application with Let's Encrypt / Certbot to ensure that streaming works correctly in modern browsers.
