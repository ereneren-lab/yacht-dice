#!/usr/bin/env node
/* backup.js — 바탕화면 백업 zip 생성 + **오래된 것 자동 정리** (의존성 0)
 *
 * 왜 있나. 버전마다 zip을 만들었더니 하루 만에 바탕화면에 8개(24MB)가 쌓였다.
 * 그런데 이 zip들은 **전부 git 태그에서 재생성된다** — 태그가 원격에 있으면 사실상 중복이다
 * (v1.237로 대조 검증: 267개 파일 목록·크기 완전 일치).
 * 그래서 '만들되 최신 N개만 남긴다'로 바꿨다.
 *
 * 사용:
 *   npm run backup            최신 2개만 남기고 정리
 *   npm run backup -- --keep 5
 *   npm run backup -- --list  현재 백업 목록만 보기(만들지 않음)
 *
 * 잃어버렸을 때 되살리는 법 (zip은 없어도 된다):
 *   git archive --format=zip -o ~/Desktop/dice-alley-v1.240.zip v1.240
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DESK = path.join(os.homedir(), 'Desktop');
const PREFIX = 'dice-alley-backup-';
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const KEEP = Math.max(1, parseInt(arg('--keep', '2'), 10) || 2);
const LIST_ONLY = argv.includes('--list');

function backups() {
  let f = [];
  try { f = fs.readdirSync(DESK).filter(n => n.startsWith(PREFIX) && n.endsWith('.zip')); } catch (e) { return []; }
  return f
    .map(n => { const p = path.join(DESK, n); return { name: n, path: p, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }; })
    .sort((a, b) => b.mtime - a.mtime);   // 최신순
}
const mb = b => (b / 1048576).toFixed(1) + 'M';

if (LIST_ONLY) {
  const list = backups();
  if (!list.length) { console.log('바탕화면에 백업 zip이 없습니다. (태그에서 언제든 만들 수 있습니다)'); process.exit(0); }
  list.forEach((f, i) => console.log(`${i === 0 ? '최신 ' : '     '}${mb(f.size).padStart(6)}  ${f.name}`));
  console.log(`\n총 ${list.length}개 · ${mb(list.reduce((a, f) => a + f.size, 0))}`);
  process.exit(0);
}

// ── 백업 생성 ──────────────────────────────────────────
const version = require(path.join(__dirname, '..', 'package.json')).version;
const d = new Date();
const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const out = path.join(DESK, `${PREFIX}v${version}-${stamp}.zip`);

/* ⚠️ 커밋되지 않은 변경은 zip에 안 들어간다 — git archive는 HEAD를 뜬다.
   백업을 믿고 있다가 놓치는 일이 없게 미리 알린다. */
let dirty = '';
try { dirty = execFileSync('git', ['status', '--porcelain'], { cwd: path.join(__dirname, '..') }).toString().trim(); } catch (e) {}
const tracked = dirty.split('\n').filter(l => l && !l.startsWith('??'));
if (tracked.length) {
  console.log(`⚠️  커밋 안 된 변경 ${tracked.length}건이 있습니다 — 백업(HEAD 기준)에 안 들어갑니다:`);
  tracked.slice(0, 5).forEach(l => console.log('    ' + l));
  if (tracked.length > 5) console.log(`    … 외 ${tracked.length - 5}건`);
}

execFileSync('git', ['archive', '--format=zip', '-o', out, 'HEAD'], { cwd: path.join(__dirname, '..') });
console.log(`✓ 백업 생성 — ${path.basename(out)} (${mb(fs.statSync(out).size)})`);

// ── 오래된 것 정리 ─────────────────────────────────────
const list = backups();
const old = list.slice(KEEP);
if (!old.length) {
  console.log(`  바탕화면 백업 ${list.length}개 (최대 ${KEEP}개 유지)`);
} else {
  old.forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
  console.log(`✓ 오래된 백업 ${old.length}개 정리 — ${mb(old.reduce((a, f) => a + f.size, 0))} 확보`);
  old.forEach(f => console.log(`    지움: ${f.name}`));
  console.log(`  (전부 git 태그에서 재생성됩니다: git archive --format=zip -o out.zip <태그>)`);
}
