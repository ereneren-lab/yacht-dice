#!/usr/bin/env node
/**
 * `dist-static/`를 **웹소켓 없이** 그냥 파일만 주는 서버로 띄운다 — CDN 흉내다.
 *
 * 왜: 정적 번들이 진짜로 서버 없이 도는지 확인하려면, 웹소켓이 붙어 있는 개발 서버로는 알 수 없다.
 *     여기로 띄우고 감사(audit-play 등)를 그대로 돌리면 "서버 없이 13종이 도나"가 바로 나온다.
 *
 * 사용: node scripts/serve-static.js [포트]     (기본 3000 — 기존 감사 도구가 그 포트를 본다)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist-static');
const PORT = parseInt(process.argv[2], 10) || 3000;
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.json':'application/json', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2' };

if (!fs.existsSync(ROOT)) { console.error('❌ dist-static/이 없다 — node scripts/build-static.js 먼저'); process.exit(1); }

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const fp = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`정적 전용 서버 ${PORT} — dist-static/ (웹소켓 없음)`));
