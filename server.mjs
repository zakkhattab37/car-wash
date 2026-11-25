import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

createServer((request, response) => {
  let file;
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const allowed = path === '/' || path === '/index.html' || /^\/(css|js|assets)\/[\w.-]+$/.test(path);
    file = allowed && resolve(root, '.' + (path === '/' ? '/index.html' : path));
  } catch {}
  if (!file || !file.startsWith(root + sep) || !types[extname(file)] || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
}).listen(port, host, () => console.log('http://' + host + ':' + port));

