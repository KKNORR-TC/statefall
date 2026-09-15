'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const {createServer, localHost, resolveRequest} = require('../tools/browser-server.js');

assert.equal(localHost('127.0.0.1:4173'), true);
assert.equal(localHost('localhost:4173'), true);
assert.equal(localHost('[::1]:4173'), true);
assert.equal(localHost('example.com'), false);
assert.equal(resolveRequest('/package.json').status, 403);
assert.equal(resolveRequest('/game/%2e%2e/package.json').status, 403);
assert.equal(resolveRequest('/game/%2eenv').status, 403);
assert.equal(resolveRequest('/game/index.html?cache=no').status, 200);

const server = createServer();
const request = (port, pathname, options = {}) => new Promise((resolve, reject) => {
  const req = http.request({hostname: '127.0.0.1', port, path: pathname, method: options.method || 'GET', headers: {Host: options.host || `127.0.0.1:${port}`}}, response => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve({status: response.statusCode, body}));
  });
  req.on('error', reject);
  req.end();
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  try {
    const game = await request(port, '/game/index.html');
    assert.equal(game.status, 200);
    assert.match(game.body, /Statefall RTS/);
    assert.equal((await request(port, '/')).status, 200);
    assert.equal((await request(port, '/package.json')).status, 403);
    assert.equal((await request(port, '/game/%252e%252e/package.json')).status, 404);
    assert.equal((await request(port, '/game/%2e%2e/package.json')).status, 403);
    assert.equal((await request(port, '/game/index.html', {host: 'example.com'})).status, 400);
    assert.equal((await request(port, '/game/index.html', {method: 'POST'})).status, 405);
    const head = await request(port, '/game/index.html', {method: 'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    console.log('Browser server path and Host hardening PASS');
  } finally {
    server.close();
  }
});
