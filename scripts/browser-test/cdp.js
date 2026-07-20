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
    this._udd = udd;   // close()에서 지운다 — 안 지우면 실행마다 쌓여 100개를 넘긴다
    this.proc = spawn(findBrowser(), [
      '--remote-debugging-port=0',
      '--user-data-dir=' + udd,
      '--no-first-run', '--no-default-browser-check',
      '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=2',      // 레티나 흉내
      '--autoplay-policy=no-user-gesture-required',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    // stderr는 계속 모아둔다(최근 8KB). 브라우저가 죽었을 때 원인을 보여주기 위해서다.
    this._stderr = '';
    this.proc.stderr.on('data', d => {
      this._stderr = (this._stderr + d.toString()).slice(-8192);
    });

    const wsUrl = await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('브라우저 기동 타임아웃\n' + this._stderr.slice(-800))), 20000);
      const onData = () => {
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(this._stderr);
        if (m) { clearTimeout(to); this.proc.stderr.off('data', onData); res(m[1]); }
      };
      this.proc.stderr.on('data', onData);
      this.proc.once('exit', c => { clearTimeout(to); rej(new Error('브라우저 종료 code=' + c + '\n' + this._stderr.slice(-800))); });
    });

    // ⚠️ 브라우저가 죽거나 소켓이 끊기면 대기 중인 요청을 즉시 실패시킨다.
    // 이게 없으면 크래시가 전부 "타임아웃: Runtime.evaluate"로 보여 원인을 못 찾는다.
    this._dead = null;
    const killPending = (why) => {
      this._dead = why;
      const tail = this._stderr.slice(-600).trim();
      for (const [, { rej }] of this.pending) rej(new Error(why + (tail ? '\n--- 브라우저 stderr ---\n' + tail : '')));
      this.pending.clear();
    };
    this.proc.once('exit', c => killPending('브라우저 프로세스 종료 (code=' + c + ')'));

    this.ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    await new Promise((res, rej) => {
      this.ws.once('open', res);
      this.ws.once('error', e => rej(new Error('CDP 연결 실패: ' + e.message)));
    });
    this.ws.on('close', () => killPending('CDP 소켓이 끊겼다'));
    this.ws.on('error', e => killPending('CDP 소켓 오류: ' + e.message));
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
    if (this._dead) return Promise.reject(new Error(this._dead + ' (' + method + ')'));
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      try { this.ws.send(JSON.stringify(msg)); }
      catch (e) { this.pending.delete(id); return rej(new Error('CDP 전송 실패(' + method + '): ' + e.message)); }
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          const tail = (this._stderr || '').slice(-400).trim();
          rej(new Error('타임아웃: ' + method + (tail ? '\n--- 브라우저 stderr ---\n' + tail : '')));
        }
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
    try { this.proc.kill('SIGKILL'); } catch (e) {}
    // 프로필 디렉토리를 지우지 않으면 실행마다 쌓인다(실측: 114개 누적 → 브라우저 기동 실패)
    try { fs.rmSync(this._udd, { recursive: true, force: true }); } catch (e) {}
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

  /** 페이지를 닫는다. 여러 페이지를 순차로 쓸 땐 반드시 닫을 것 —
   *  안 닫고 새로 열면 세션이 죽어 "Session with given id not found"가 난다. */
  async close() {
    try { await this.cdp.send('Target.closeTarget', { targetId: this.targetId }); } catch (e) {}
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

/**
 * 간헐 실패(메모리 압박·소켓 끊김)에 대비해 재시도하며 브라우저를 띄운다.
 * 이 환경에선 크로미움이 여러 개 떠 있거나 메모리가 부족하면 CDP 소켓이 조용히 끊긴다
 * (stderr에 아무것도 안 남는다). 한 번 더 시도하면 대개 살아난다.
 */
async function launchWithRetry(tries = 3, waitMs = 3000) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await new CDP().launch(); }
    catch (e) {
      last = e;
      if (i < tries) {
        console.error(`  브라우저 기동 실패(${i}/${tries}) — ${e.message.split('\n')[0]} … 재시도`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }
  throw last;
}

module.exports = { CDP, Page, findBrowser, launchWithRetry };
