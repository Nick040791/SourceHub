import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { handleApiAndGit } from './vitePluginGitApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const PORT = parseInt(process.env.PORT || '5173', 10);
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function getNetworkAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const urlPath = (req.url || '/').split('?')[0];
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  let targetFile = path.join(distDir, safePath);

  // Path traversal guard
  if (!targetFile.startsWith(distDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fsp.stat(targetFile);
    if (stat.isDirectory()) {
      targetFile = path.join(targetFile, 'index.html');
      await fsp.stat(targetFile);
    }
  } catch {
    // SPA Fallback: serve index.html for client-side routing
    targetFile = path.join(distDir, 'index.html');
    try {
      await fsp.stat(targetFile);
    } catch {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h1>404 Not Found</h1><p>SourceHub frontend build not found. Please run <code>npm run build</code>.</p>');
      return;
    }
  }

  const ext = path.extname(targetFile).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);

  if (targetFile.includes('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  const stream = fs.createReadStream(targetFile);
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SourceHub-Event, X-SourceHub-Delivery');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    // 1. Try handling via API and Git protocol router
    const handled = await handleApiAndGit(req, res);
    if (handled) return;

    // 2. Serve static assets & SPA fallback
    await serveStatic(req, res);
  } catch (err: any) {
    console.error('Server Unhandled Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
    }
  }
});

server.listen(PORT, HOST, () => {
  const networks = getNetworkAddresses();
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              SourceHub Production Daemon                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`► Local:    http://localhost:${PORT}/`);
  for (const addr of networks) {
    console.log(`► Network:  http://${addr}:${PORT}/`);
  }
  console.log(`► Repos:    ${process.env.SOURCEHUB_REPOS_DIR || '/home/mrnicholas/Dev'}`);
  console.log(`► Static:   ${distDir}`);
  console.log('────────────────────────────────────────────────────────────\n');
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('SourceHub server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forcefully exiting after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
