'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const allowedRoots = new Map([
  ['/game/', path.join(root, 'game')],
  ['/public/', path.join(root, 'public')]
]);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function localHost(value) {
  if (typeof value !== 'string' || !value || value.includes(',')) return false;
  try {
    const hostname = new URL(`http://${value}`).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function resolveRequest(requestUrl) {
  const rawPath = String(requestUrl || '').split('?', 1)[0];
  let pathname;
  try { pathname = decodeURIComponent(rawPath); } catch { return {status: 400}; }
  if (pathname === '/') pathname = '/game/index.html';
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0')) return {status: 400};
  const segments = pathname.split('/');
  if (segments.some(segment => segment === '.' || segment === '..' || segment.startsWith('.'))) return {status: 403};
  const entry = [...allowedRoots].find(([prefix]) => pathname.startsWith(prefix));
  if (!entry || !Object.hasOwn(types, path.extname(pathname).toLowerCase())) return {status: 403};
  const [prefix, directory] = entry;
  const file = path.resolve(directory, ...pathname.slice(prefix.length).split('/'));
  if (file !== directory && !file.startsWith(directory + path.sep)) return {status: 403};
  return {status: 200, file, directory};
}

function createServer() {
  return http.createServer((request, response) => {
    if (!localHost(request.headers.host)) {
      response.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'}).end('Invalid Host');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, {'Allow': 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8'}).end('Method not allowed');
      return;
    }
    const resolved = resolveRequest(request.url);
    if (resolved.status !== 200) {
      response.writeHead(resolved.status, {'Content-Type': 'text/plain; charset=utf-8'}).end(resolved.status === 400 ? 'Bad request' : 'Forbidden');
      return;
    }
    fs.realpath(resolved.file, (realError, realFile) => {
      fs.realpath(resolved.directory, (rootError, realRoot) => {
        if (realError || rootError || (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep))) {
          response.writeHead(realError && realError.code === 'ENOENT' ? 404 : 403, {'Content-Type': 'text/plain; charset=utf-8'}).end(realError && realError.code === 'ENOENT' ? 'Not found' : 'Forbidden');
          return;
        }
        fs.stat(realFile, (error, stat) => {
          if (error || !stat.isFile()) {
            response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not found');
            return;
          }
          response.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Type': types[path.extname(realFile).toLowerCase()]
          });
          if (request.method === 'HEAD') response.end();
          else {
            const stream = fs.createReadStream(realFile);
            stream.on('error', () => response.destroy());
            stream.pipe(response);
          }
        });
      });
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Statefall browser server listening on http://127.0.0.1:${port}\n`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}

module.exports = {createServer, localHost, resolveRequest};
