const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DOCS_DIR = path.resolve(__dirname, 'docs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.appcache': 'text/cache-manifest'
};

function resolveFilePath(reqPath) {
  // Normalize path and remove query parameters/hashes
  let pathname = decodeURIComponent(reqPath.split('?')[0].split('#')[0]);
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  // First check exact file
  let fullPath = path.join(DOCS_DIR, pathname);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  // Check clean URLs (e.g. /edit -> /edit.html)
  let htmlPath = fullPath + '.html';
  if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
    return htmlPath;
  }

  // Check directory index (e.g. /v1 -> /v1/index.html)
  let dirIndexPath = path.join(fullPath, 'index.html');
  if (fs.existsSync(dirIndexPath) && fs.statSync(dirIndexPath).isFile()) {
    return dirIndexPath;
  }

  // SPA fallback for pathnames that look like itty.bitty routes or titles
  let indexPath = path.join(DOCS_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  return null;
}

const server = http.createServer((req, res) => {
  // Add CORS headers matching netlify.toml
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = resolveFilePath(req.url);

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`itty.bitty local server running at http://0.0.0.0:${PORT}/`);
});
