/**
 * 실기기(Galaxy A16) 앱 웹뷰에 CDP로 붙는 최소 드라이버.
 *
 * scripts/browser-test/cdp.js는 크로미움을 '띄우는' 쪽이라 폰에는 못 쓴다.
 * 여기선 이미 떠 있는 웹뷰에 adb forward된 포트로 '붙는다'.
 *
 * 준비:
 *   adb forward tcp:9223 localabstract:$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
 *
 * 사용:
 *   const { attach } = require('./phone-cdp');
 *   const p = await attach(); await p.eval('location.href'); await p.shot('out/a.png');
 */
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

function listTargets(port) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: '/json/list' }, r => {
      let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

class Phone {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiting = new Map(); this.logs = []; }

  _hook() {
    this.ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.id && this.waiting.has(m.id)) {
        const { ok, bad } = this.waiting.get(m.id); this.waiting.delete(m.id);
        m.error ? bad(new Error(JSON.stringify(m.error))) : ok(m.result);
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        this.logs.push((m.params.args || []).map(a => a.value ?? a.description ?? '').join(' '));
      }
      if (m.method === 'Log.entryAdded') this.logs.push('[log] ' + m.params.entry.text);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((ok, bad) => {
      this.waiting.set(id, { ok, bad });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.waiting.has(id)) { this.waiting.delete(id); bad(new Error('timeout ' + method)); } }, 20000);
    });
  }

  async init() {
    this._hook();
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Log.enable');
  }

  /** 페이지에서 식을 평가한다. 최상위 let/const는 window에 없다(함정 #18) → 맨 이름 참조. */
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      // 여러 줄 본문이면 그대로, 한 줄 식이면 return을 붙인다.
      // (trim().startsWith('return')만 보면 'var x=..; return x'가 식으로 취급돼 SyntaxError가 난다)
      expression: `(function(){ ${/\breturn\b/.test(expr) ? expr : 'return (' + expr + ')'} })()`,
      returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 60; i++) {
      await this.wait(200);
      try { if (await this.eval("document.readyState") === 'complete') return; } catch (e) {}
    }
  }

  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }

  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function attach(port = 9223, urlMatch = null) {
  const targets = await listTargets(port);
  const pages = targets.filter(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!pages.length) throw new Error('웹뷰 page 타깃이 없다 — 앱이 떠 있나 확인');
  const t = (urlMatch ? pages.find(p => p.url.includes(urlMatch)) : null) || pages[0];
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((ok, bad) => { ws.once('open', ok); ws.once('error', bad); });
  const p = new Phone(ws);
  await p.init();
  return p;
}

module.exports = { attach, listTargets };
