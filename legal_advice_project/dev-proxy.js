#!/usr/bin/env node
// Simple dev proxy that forwards requests to the remote Cloud Run API.
// Usage: node dev-proxy.js
// For development only. Does not perform auth. Forwards headers and streams response.

import http from 'http';
import https from 'https';
import url from 'url';

const PORT = process.env.DEV_PROXY_PORT ? Number(process.env.DEV_PROXY_PORT) : 3000;
const TARGET = process.env.DEV_PROXY_TARGET || 'https://api-452141441389.europe-west1.run.app';

const server = http.createServer((req, res) => {
  try {
    const parsedTarget = url.parse(TARGET);
    const options = {
      protocol: parsedTarget.protocol,
      hostname: parsedTarget.hostname,
      port: parsedTarget.port,
      path: req.url, // preserve path
      method: req.method,
      headers: Object.assign({}, req.headers)
    };

    // Remove host header to avoid host mismatch
    delete options.headers.host;

    const proxyReq = (parsedTarget.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
      // copy status and headers
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      // pipe response
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err && err.message);
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway (proxy)');
    });

    // pipe request body
    req.pipe(proxyReq, { end: true });
  } catch (e) {
    console.error('Proxy internal error', e && e.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal proxy error');
  }
});

// Bind to 0.0.0.0 so the server is reachable from Codespaces / container forwarded ports
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dev proxy listening on http://0.0.0.0:${PORT} -> ${TARGET}`);
});
