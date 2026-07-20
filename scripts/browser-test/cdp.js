/**
 * 의존성 0(ws만) CDP 드라이버 — 실제 크로미움을 헤드리스로 몰아 화면을 검증한다.
 * jsdom과 달리 레이아웃·CSS 애니메이션·SVG 렌더가 전부 진짜로 돈다.
 *
 * 브라우저는 Playwright가 받아둔 캐시를 재사용한다(별도 설치 불필요).
 * 없으면 시스템 Chrome으로 폴백.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

/** 크로미움 실행파일 찾기 — 버전 폴더명이 바뀌어도 견디게 탐색한다 */
function findBrowser() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter(d => d.startsWith('chromium'));
    // headless shell 우선(가볍다), 없으면 일반 chromium
    dirs.sort((a, b) => (b.includes('headless_shell') ? 1 : 0) - (a.includes('headless_shell') ? 1 : 0));
    for (const d of dirs) {
      for (const rel of [
        'chrome-headless-shell-mac-arm64/chrome-headless-shell',
        'chrome-headless-shell-mac-x64/chrome-headless-shell',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      ]) {
        const p = path.join(cache, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chrome)) return chrome;
  throw new Error('크로미움을 못 찾았다. `npx playwright install chromium` 또는 Chrome 설치 필요.');
}

class CDP {
  constructor() { this.id = 0; this.pending = new Map(); this.handlers = new Map(); }

  async launch() {
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-profile-'));
    this.proc = spawn(findBrowser(), [
      '--remote-debugging-port=0',
      '--user-data-dir=' + udd,
      '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=2',      // 레티나 흉내
      '--autoplay-policy=no-user-gesture-required',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const wsUrl = await new Promise((res, rej) => {
      let buf = '';
      const to = setTimeout(() => rej(new Error('브라우저 기동 타임아웃')), 20000);
      this.proc.stderr.on('data', d => {
        buf += d.toString();
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
        if (m) { clearTimeout(to); res(m[1]); }
      });
      this.proc.on('exit', c => { clearTimeout(to); rej(new Error('브라우저 종료 code=' + c + '\n' + buf)); });
    });

    this.ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    await new Promise(r => this.ws.once('open', r));
    this.ws.on('message', raw => {
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.method + ' ' + JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) {
        (this.handlers.get(msg.method) || []).forEach(fn => fn(msg.params, msg.sessionId));
      }
    });
    return this;
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify(msg));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('타임아웃: ' + method)); }
      }, 30000);
    });
  }

  async newPage(width = 1440, height = 900) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, sessionId, targetId);
    await page.init(width, height);
    return page;
  }

  async close() {
    try { this.ws.close(); } catch (e) {}
    try { this.proc.kill(); } catch (e) {}
  }
}

class Page {
  constructor(cdp, sessionId, targetId) {
    this.cdp = cdp; this.sessionId = sessionId; this.targetId = targetId;
    this.errors = []; this.logs = [];
  }

  s(method, params) { return this.cdp.send(method, params, this.sessionId); }

  async init(width, height) {
    await this.s('Page.enable');
    await this.s('Runtime.enable');
    await this.s('Log.enable');
    await this.s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
    await this.setMotion(true);   // ⚠️ 아래 setMotion 주석 참고 — 반드시 필요하다
    this.cdp.on('Runtime.exceptionThrown', (p, sid) => {
      if (sid !== this.sessionId) return;
      const d = p.exceptionDetails;
      this.errors.push('예외: ' + (d.exception && d.exception.description || d.text));
    });
    this.cdp.on('Runtime.consoleAPICalled', (p, sid) => {
      if (sid !== this.sessionId) return;
      const text = p.args.map(a => a.description || a.value || '').join(' ');
      this.logs.push(p.type + ': ' + text);
      if (p.type === 'error') this.errors.push('console.error: ' + text);
    });
    this.cdp.on('Log.entryAdded', (p, sid) => {
      if (sid !== this.sessionId) return;
      if (p.entry.level === 'error' && !/vibrate/.test(p.entry.text)) this.errors.push('log: ' + p.entry.text);
    });
  }

  /**
   * ⚠️ 헤드리스 크로미움은 prefers-reduced-motion 기본값이 'reduce'다.
   * 이걸 켜주지 않으면 FX_REDUCED() 가드에 걸려 모든 연출이 생략된 화면을 보게 되고,
   * "연출이 안 보인다"를 코드 버그로 오진하게 된다. (실제로 한 번 겪음)
   * on=false 로 두면 접근성(reduce) 경로 자체를 검증할 수 있다.
   */
  setMotion(on) {
    return this.s('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: on ? 'no-preference' : 'reduce' }],
    });
  }

  async goto(url) {
    const loaded = new Promise(res => {
      this.cdp.on('Page.loadEventFired', (p, sid) => { if (sid === this.sessionId) res(); });
    });
    await this.s('Page.navigate', { url });
    await loaded;
    await this.wait(300);
  }

  async eval(expr) {
    const r = await this.s('Runtime.evaluate', {
      expression: `(function(){ ${expr} })()`,
      returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error('eval 실패: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }

  click(sel) {
    return this.eval(`var e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('없음: ${sel}'); e.click(); return true;`);
  }

  wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  /** 연속 프레임 수집 — 실제 재생 속도의 애니메이션을 프레임 단위로 본다 */
  async record(ms, everyNthFrame = 1) {
    const frames = [];
    this.cdp.on('Page.screencastFrame', (p, sid) => {
      if (sid !== this.sessionId) return;
      frames.push(Buffer.from(p.data, 'base64'));
      this.s('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
    });
    await this.s('Page.startScreencast', { format: 'png', everyNthFrame });
    await this.wait(ms);
    await this.s('Page.stopScreencast');
    return frames;
  }

  /** clipSel 주면 그 요소 영역만 잘라 저장 */
  async shot(file, clipSel) {
    const params = { format: 'png' };
    if (clipSel) {
      const r = await this.eval(`var e=document.querySelector(${JSON.stringify(clipSel)}); if(!e) return null; var b=e.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height};`);
      if (r) params.clip = { ...r, scale: 1 };
    }
    const { data } = await this.s('Page.captureScreenshot', params);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  }
}

module.exports = { CDP, Page, findBrowser };
