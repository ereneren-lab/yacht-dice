/* === net.js — 온라인 로비/소켓 공용 모듈 (window.NET) ===
 *
 * 왜 있나. v1.236까지 온라인 6종이 **같은 로비 코드를 각자 인라인으로** 갖고 있었다.
 * 카드 3종을 그대로 붙이면 같은 코드가 9벌이 되고, 아래 함정을 고칠 때 9곳을 고쳐야 한다.
 * 그래서 '소켓·자리·재접속·로비 전환'만 여기로 뺐다. **화면 그리기는 각 게임이 한다.**
 *
 * 이 모듈이 대신 지켜주는 함정 (CLAUDE.md):
 *   #8 자리(pid)는 탭 단위다 — sessionStorage 우선 + BroadcastChannel로 중복 탭 방어.
 *      localStorage에만 두면 같은 브라우저의 다른 탭이 남의 자리로 rejoin해 서로 끊는 루프에 빠진다.
 *   #3 "게임 종료 → 로비" 전환 — 판이 끝나면 서버가 room.phase='lobby'로 lobby를 보낸다.
 *      "게임 중이면 lobby 무시" 로직이 이 신호까지 막아버리는 게 4종에서 전부 터졌다.
 *      → 이 모듈이 in-game 여부를 스스로 추적해 **onGameEnd를 onLobby보다 먼저** 부른다.
 *
 * 쓰는 법:
 *   NET.init({ game:'onecard', ns:'oc', on:{ state(s){}, lobby(room){}, gameEnd(){}, error(msg,fatal){},
 *                                            toast(msg){}, chat(pid,name,text){}, reaction(pid,emoji){},
 *                                            rematchAsk(m){}, roomClosed(){}, open(){}, close(){} } });
 *   NET.create({name:'호스트', itemsOn:true});   // game은 init의 것을 자동으로 붙인다
 *   NET.join(code, name);  NET.start();  NET.addAI();  NET.action({type:'draw',idx:2});
 *   NET.bootRejoin();      // 부트에서 1회 — 이 탭의 자리가 있으면 자동 재접속(중복 탭이면 포기)
 *
 * 상태 읽기: NET.pid · NET.code · NET.lobby · NET.isHost() · NET.online · NET.connected()
 */
(function (root) {
  'use strict';

  function wsUrl() {
    // 앱(Capacitor) 번들은 file:// 로 뜨므로 배포 서버를 직접 가리킨다
    if (root.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return 'wss://yacht-dice-jxva.onrender.com';
    return (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const noop = function () {};

  const NET = {
    game: '', ns: '', pid: null, code: null, lobby: null,
    online: false,
    _ws: null, _on: {}, _inGame: false,
    _reconnects: 0, _reconnecting: false, _bootReconnect: false,
    _coldT: null, _failT: null, _prevMembers: null, _seatBC: null,

    init(opts) {
      opts = opts || {};
      this.game = opts.game;
      this.ns = opts.ns || opts.game;
      this._on = opts.on || {};
      const NS = this.ns;
      /* 다른 탭이 이 자리를 쓰는지 물어본다(5종 공용 채널 'alley_seat').
         sessionStorage가 빈 '새 탭'(초대 링크로 방금 연 탭)만 localStorage로 폴백하는데,
         그 자리를 이미 쓰는 탭이 있으면 폴백이 남의 자리를 빼앗는다. */
      try { this._seatBC = new BroadcastChannel('alley_seat'); } catch (e) { this._seatBC = null; }
      if (this._seatBC) this._seatBC.addEventListener('message', ev => {
        const d = ev.data || {};
        if (d.t !== 'seat?' || d.ns !== NS) return;
        let r = null, p = null;
        try { r = sessionStorage.getItem(NS + '_room'); p = sessionStorage.getItem(NS + '_pid'); } catch (e) {}
        if (r && p && r === d.room && p === d.pid) { try { this._seatBC.postMessage({ t: 'seat!', ns: NS, room: r, pid: p }); } catch (e) {} }
      });
      return this;
    },

    // ── 자리(방코드·pid)는 탭 단위 소유물 — 함정 #8 ──────────
    seatGet(k) { const key = this.ns + '_' + k;
      try { const v = sessionStorage.getItem(key); if (v != null) return v; } catch (e) {}
      try { return localStorage.getItem(key); } catch (e) { return null; } },
    seatSet(k, v) { const key = this.ns + '_' + k;
      try { sessionStorage.setItem(key, v); } catch (e) {}
      try { localStorage.setItem(key, v); } catch (e) {} },
    seatDel(k) { const key = this.ns + '_' + k;
      try { sessionStorage.removeItem(key); } catch (e) {}
      try { localStorage.removeItem(key); } catch (e) {} },
    _seatFromThisTab() { try { return sessionStorage.getItem(this.ns + '_room') != null; } catch (e) { return false; } },
    _seatHeldByOtherTab(room, pid) {
      const NS = this.ns, bc = this._seatBC;
      return new Promise(res => {
        if (!bc) return res(false);
        let done = false;
        const fin = v => { if (done) return; done = true; try { bc.removeEventListener('message', on); } catch (e) {} res(v); };
        const on = ev => { const d = ev.data || {}; if (d.t === 'seat!' && d.ns === NS && d.room === room && d.pid === pid) fin(true); };
        bc.addEventListener('message', on);
        try { bc.postMessage({ t: 'seat?', ns: NS, room, pid }); } catch (e) { return fin(false); }
        setTimeout(() => fin(false), 250);   // 응답 없으면 '없음'으로 진행(구형 브라우저·다른 탭 없음)
      });
    },

    /* 부트에서 1회 — 이 탭에 자리가 남아 있으면 자동 재접속한다.
       단, sessionStorage가 비어 localStorage로 폴백하는 '새 탭'이면 다른 탭에 먼저 물어보고
       누가 쓰고 있으면 **자동 재접속을 포기한다**(남의 자리를 빼앗지 않게). */
    async bootRejoin() {
      const room = this.seatGet('room'), pid = this.seatGet('pid');
      if (!room || !pid) return false;
      if (!this._seatFromThisTab()) {
        const held = await this._seatHeldByOtherTab(room, pid);
        if (held) { this.seatDel('room'); this.seatDel('pid'); return false; }
      }
      this.online = true; this._bootReconnect = true;
      this.connect(() => this.send({ t: 'rejoin', code: room, pid }));
      return true;
    },

    // ── 소켓 ──────────────────────────────────────────────
    connected() { return !!(this._ws && this._ws.readyState === 1); },
    send(o) { if (this.connected()) this._ws.send(JSON.stringify(o)); },
    _teardown() { if (this._ws) { try { this._ws.onclose = null; this._ws.close(); } catch (e) {} this._ws = null; } },
    _clearCold() { if (this._coldT) { clearTimeout(this._coldT); this._coldT = null; } if (this._failT) { clearTimeout(this._failT); this._failT = null; } },

    connect(then) {
      const on = this._on;
      if (location.protocol === 'file:') { (on.error || noop)('파일로 열면 온라인을 쓸 수 없어요. 배포된 주소에서 접속하세요.', true); return; }
      this._teardown(); this._clearCold();
      try { this._ws = new WebSocket(wsUrl()); }
      catch (e) { (on.error || noop)('서버 연결 실패', true); return; }
      // Render 무료 인스턴스는 첫 접속에 최대 1분 걸린다 — 논블로킹 안내
      this._coldT = setTimeout(() => { if (!this.connected()) (on.wake || noop)('⏳ 서버를 깨우는 중… 최대 1분 걸릴 수 있어요', null); }, 2500);
      this._failT = setTimeout(() => { if (!this.connected()) (on.wake || noop)('😴 서버가 아직 안 깨어났어요 — 다시 시도해줘', () => this.connect(then)); }, 60000);
      this._ws.onopen = () => { this._clearCold(); (on.wakeHide || noop)(); (on.open || noop)(); if (then) then(); };
      this._ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this._dispatch(m); };
      this._ws.onerror = () => { (on.error || noop)('서버 연결 오류', false); };
      this._ws.onclose = () => {
        this._clearCold(); this._reconnecting = false;
        (on.close || noop)();
        if (this.online && (this._bootReconnect || this._inGame || this.lobby)) {
          if (this._reconnects < 30) {
            this._reconnects++;
            if (this._reconnects === 1 && this._inGame) (on.toast || noop)('서버 연결 끊김 — 재접속 시도 중… (최대 1분)');
            setTimeout(() => this._retry(), 2000);
          } else {
            (on.wake || noop)('🔌 재접속 실패 — 새로고침하거나 다시 시도해줘', () => { this._reconnects = 0; this._retry(); });
          }
        } else (on.wakeHide || noop)();
      };
    },
    _retry() {
      const room = this.seatGet('room'), pid = this.seatGet('pid');
      if (room && pid && !this.connected()) { this._reconnecting = true; this.connect(() => this.send({ t: 'rejoin', code: room, pid })); }
    },

    // ── 메시지 처리 ───────────────────────────────────────
    _dispatch(m) {
      const on = this._on;
      if (m.t === 'me') {
        this.pid = m.pid; this.code = m.code;
        this._reconnects = 0; this._reconnecting = false; this._bootReconnect = false;
        this.seatSet('room', this.code); this.seatSet('pid', this.pid);
        (on.me || noop)(m);

      } else if (m.t === 'lobby') {
        const cur = m.room.members;
        if (this._prevMembers) {
          cur.forEach(x => { if (x.pid !== this.pid && !this._prevMembers.some(p => p.pid === x.pid)) (on.toast || noop)('🚪 ' + x.name + ' 입장'); });
          this._prevMembers.forEach(p => { if (p.pid !== this.pid && !cur.some(x => x.pid === p.pid)) (on.toast || noop)('👋 ' + p.name + ' 나감'); });
        }
        this._prevMembers = cur.map(x => ({ pid: x.pid, name: x.name }));
        this.lobby = m.room;
        /* ⚠️ 함정 #3 — 판 종료 신호. 게임 중에 phase==='lobby' lobby가 오면
           그건 '판이 끝났다'는 뜻이다. 이 분기를 **먼저** 둬야 한다.
           "게임 중이면 lobby 무시" 로직을 앞에 두면 판 종료 신호까지 막혀서
           게임 화면에 그대로 갇힌다(yut/kb/ld/lcr이 전부 이 버그를 겪었다). */
        if (m.room.phase === 'lobby' && this._inGame) {
          this._inGame = false;
          (on.gameEnd || noop)();
          (on.lobby || noop)(m.room);
          (on.toast || noop)('🏁 판이 종료되어 로비로 돌아왔어요');
          return;
        }
        if (this._inGame) return;         // 진행 중 멤버 변동 — 화면은 그대로 두고 알림만
        (on.lobby || noop)(m.room);

      } else if (m.t === 'state') {
        this.online = true; this._inGame = true;
        (on.state || noop)(m.state);

      } else if (m.t === 'error') {
        const msg = m.msg || '오류';
        this._reconnecting = false; this._bootReconnect = false;
        (on.toast || noop)('⚠️ ' + msg);
        /* code가 붙은 치명적 오류(방 없음/가득참/자리없음)만 셋업으로 되돌린다.
           "3명부터 시작할 수 있어요" 같은 경고로 로비에서 튕겨나가면 안 된다. */
        const fatal = !!m.code || !this.lobby;
        if (fatal) { this.lobby = null; this._prevMembers = null; this.seatDel('room'); this.seatDel('pid'); }
        (on.error || noop)(msg, fatal);

      } else if (m.t === 'roomClosed') {
        this.lobby = null; this._prevMembers = null; this._inGame = false;
        this.seatDel('room'); this.seatDel('pid');
        (on.roomClosed || noop)(m);

      } else if (m.t === 'chat') { if (m.pid !== this.pid) (on.chat || noop)(m.pid, m.name, m.text); }
      else if (m.t === 'reaction') { (on.reaction || noop)(m.pid, m.emoji); }
      else if (m.t === 'rematchAsk') { (on.rematchAsk || noop)(m); }
      else if (m.t === 'rematchKicked') { (on.rematchKicked || noop)(m); }
      else if (m.t === 'rematchCancelled') { (on.rematchCancelled || noop)(m); }
      else (on.other || noop)(m);
    },

    // ── 방 조작 ───────────────────────────────────────────
    isHost() { return !!(this.lobby && this.lobby.members && this.lobby.members.some(x => x.host && x.pid === this.pid)); },
    create(payload) {
      this.online = true;
      const p = Object.assign({ t: 'create', game: this.game }, payload || {});
      this.connect(() => this.send(p));
    },
    join(code, name) {
      this.online = true;
      this.connect(() => this.send({ t: 'join', code, name: name || '게스트' }));
    },
    start()          { this.send({ t: 'start' }); },
    addAI()          { this.send({ t: 'addAI' }); },
    removeAI(pid)    { this.send({ t: 'removeAI', pid }); },
    action(a)        { this.send({ t: 'action', a }); },
    chat(text)       { this.send({ t: 'chat', text }); },
    endGame()        { this.send({ t: 'endGame' }); },
    closeRoom()      { this.send({ t: 'closeRoom' }); },
    rename(name)     { this.send({ t: 'rename', name }); },
    setItems(v)      { this.send({ t: 'setItems', v: !!v }); },
    leave() {
      this._inGame = false; this.online = false; this.lobby = null; this._prevMembers = null;
      this.seatDel('room'); this.seatDel('pid');
      this._teardown(); this._clearCold();
    },
    inGame() { return this._inGame; },
    esc,
  };

  /* ── 로비 UI (자체 주입) ─────────────────────────────────
     마크업·CSS를 여기서 만든다 — tutorial.js와 같은 방식. 게임 HTML은 건드리지 않는다.
     게임은 NET.ui.mount({...})만 부르면 '온라인' 버튼 → 방 만들기/참가 → 대기실까지 다 된다. */
  const CSS = `
  .nt-ov{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.66);display:none;align-items:center;justify-content:center;padding:18px}
  .nt-ov.on{display:flex}
  .nt-card{background:linear-gradient(180deg,color-mix(in srgb,var(--panel,#1c2f18) 92%,#fff 8%),var(--panel,#1c2f18));
    border:1px solid var(--line,#2f4a28);border-radius:18px;padding:20px;box-shadow:0 14px 40px rgba(0,0,0,.45);
    max-width:400px;width:100%;max-height:90vh;overflow-y:auto;color:var(--ink,#f2e9d6)}
  .nt-card h2{margin:0 0 4px;font-size:20px;color:var(--gold,#f0c65a);text-align:center}
  .nt-sub{font-size:12.5px;color:var(--muted,#9db089);text-align:center;margin-bottom:12px;line-height:1.5}
  .nt-lbl{font-size:11px;font-weight:900;color:var(--brass,#d9b35a);margin:12px 0 5px;letter-spacing:.07em;text-transform:uppercase}
  .nt-in{background:var(--panel2,#274023);color:var(--ink,#f2e9d6);border:1px solid var(--line,#2f4a28);
    border-radius:9px;padding:10px 12px;font-size:14px;width:100%;font-family:inherit}
  .nt-in.code{text-align:center;letter-spacing:.3em;font-weight:900;font-size:18px;text-transform:uppercase}
  .nt-btn{background:linear-gradient(180deg,color-mix(in srgb,var(--brass,#d9b35a) 82%,#fff 18%),var(--brass,#d9b35a));
    color:#1a1608;border:none;border-radius:12px;padding:13px 16px;font-size:14.5px;font-weight:900;cursor:pointer;width:100%;
    box-shadow:0 4px 12px rgba(0,0,0,.25);margin-top:10px}
  .nt-btn:hover{filter:brightness(1.06)} .nt-btn:active{transform:translateY(1px)}
  .nt-btn:disabled{opacity:.35;cursor:default;filter:grayscale(.4);box-shadow:none}
  .nt-btn.ghost{background:var(--panel2,#274023);color:var(--ink,#f2e9d6);border:1px solid var(--line,#2f4a28);box-shadow:none}
  .nt-err{font-size:12px;color:var(--danger,#e8696b);text-align:center;min-height:16px;margin-top:8px;font-weight:800}
  .nt-code{font-size:30px;font-weight:900;letter-spacing:.28em;color:var(--gold,#f0c65a);text-align:center;
    background:rgba(0,0,0,.28);border-radius:12px;padding:12px;margin:6px 0 4px;cursor:pointer}
  .nt-mem{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,.2);
    border-radius:10px;margin-bottom:6px;font-size:13px;font-weight:800}
  .nt-mem .h{font-size:11px;color:var(--gold,#f0c65a)}
  .nt-mem .rm{margin-left:auto;background:none;border:none;color:var(--danger,#e8696b);cursor:pointer;font-weight:900;font-size:14px}
  .nt-toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:95;background:rgba(0,0,0,.85);
    color:#fff;font-size:12.5px;font-weight:800;padding:9px 15px;border-radius:999px;pointer-events:none;
    box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:90vw;text-align:center}
  .nt-wake{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:96;background:rgba(20,16,10,.94);
    color:#f2e9d6;font-size:12.5px;font-weight:800;padding:9px 14px;border-radius:12px;display:none;
    align-items:center;gap:10px;box-shadow:0 4px 14px rgba(0,0,0,.45)}
  .nt-wake button{background:var(--brass,#d9b35a);color:#1a1608;border:none;border-radius:8px;padding:5px 10px;font-weight:900;cursor:pointer}`;

  function el(id) { return document.getElementById(id); }

  NET.ui = {
    _opts: null,
    /* opts: { title, sub, createPayload():obj, minPlayers, onEnterGame(), onLeaveGame(), extraLobbyHTML():string }
       game 쪽에서 넘긴 createPayload()가 방 옵션(아이템전 등)을 만든다. */
    mount(opts) {
      this._opts = opts = opts || {};
      if (!el('ntStyle')) { const st = document.createElement('style'); st.id = 'ntStyle'; st.textContent = CSS; document.head.appendChild(st); }
      if (!el('ntJoinOv')) {
        const d = document.createElement('div');
        d.innerHTML =
          `<div class="nt-ov" id="ntJoinOv"><div class="nt-card">
             <h2>🌐 온라인</h2>
             <div class="nt-sub">${esc(opts.sub || '친구와 같은 방에서 함께 해요')}</div>
             <div class="nt-lbl">내 이름</div>
             <input class="nt-in" id="ntName" maxlength="12" placeholder="너의 별명">
             <button class="nt-btn" id="ntCreate">방 만들기</button>
             <div class="nt-lbl">또는 방 코드로 참가</div>
             <input class="nt-in code" id="ntCode" maxlength="4" placeholder="ABCD">
             <button class="nt-btn ghost" id="ntJoin">참가하기</button>
             <div class="nt-err" id="ntErr"></div>
             <button class="nt-btn ghost" id="ntJoinClose" style="margin-top:14px">닫기</button>
           </div></div>
           <div class="nt-ov" id="ntLobbyOv"><div class="nt-card">
             <h2>대기실</h2>
             <div class="nt-sub">친구에게 이 코드를 알려주세요 (눌러서 복사)</div>
             <div class="nt-code" id="ntRoomCode">----</div>
             <div class="nt-lbl">참가자 <span id="ntCount"></span></div>
             <div id="ntMembers"></div>
             <div id="ntExtra"></div>
             <button class="nt-btn" id="ntStart">게임 시작</button>
             <button class="nt-btn ghost" id="ntAddAi">🤖 AI 추가</button>
             <button class="nt-btn ghost" id="ntLeave">나가기</button>
             <div class="nt-err" id="ntLobbyErr"></div>
           </div></div>
           <div class="nt-wake" id="ntWake"></div>`;
        while (d.firstChild) document.body.appendChild(d.firstChild);
      }
      el('ntJoinClose').onclick = () => this.closeJoin();
      el('ntCreate').onclick = () => {
        const name = (el('ntName').value || '').trim() || '호스트';
        try { localStorage.setItem('alley_name', name); } catch (e) {}
        el('ntErr').textContent = '';
        NET.create(Object.assign({ name }, (opts.createPayload ? opts.createPayload() : {})));
      };
      el('ntJoin').onclick = () => {
        const name = (el('ntName').value || '').trim() || '게스트';
        const code = (el('ntCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (code.length < 4) { el('ntErr').textContent = '방 코드 4자리를 입력해주세요'; return; }
        try { localStorage.setItem('alley_name', name); } catch (e) {}
        el('ntErr').textContent = '';
        NET.join(code, name);
      };
      el('ntRoomCode').onclick = () => {
        const c = NET.code || '';
        try { navigator.clipboard.writeText(c); NET.ui.toast('📋 방 코드 ' + c + ' 복사됨'); } catch (e) {}
      };
      el('ntStart').onclick = () => NET.start();
      el('ntAddAi').onclick = () => NET.addAI();
      el('ntLeave').onclick = () => { NET.leave(); this.closeLobby(); (opts.onLeaveGame || noop)(); };
      try { const n = localStorage.getItem('alley_name'); if (n) el('ntName').value = n; } catch (e) {}
      return this;
    },
    openJoin()  { el('ntJoinOv').classList.add('on'); },
    closeJoin() { el('ntJoinOv').classList.remove('on'); },
    openLobby() { this.closeJoin(); el('ntLobbyOv').classList.add('on'); },
    closeLobby(){ const e = el('ntLobbyOv'); if (e) e.classList.remove('on'); },

    renderLobby(room) {
      if (!room) return;
      this.openLobby();
      el('ntRoomCode').textContent = NET.code || '----';
      const min = (this._opts && this._opts.minPlayers) || 2;
      const mem = room.members || [];
      el('ntCount').textContent = `${mem.length}명` + (mem.length < min ? ` · ${min}명부터 시작` : '');
      const host = NET.isHost();
      el('ntMembers').innerHTML = mem.map(m =>
        `<div class="nt-mem"><span>${m.ai ? '🤖' : '🧑'}</span><span>${esc(m.name)}</span>` +
        (m.host ? '<span class="h">👑 방장</span>' : '') +
        (!m.connected && !m.ai ? '<span class="h" style="color:#e8696b">⚠️ 끊김</span>' : '') +
        (host && m.ai ? `<button class="rm" data-pid="${esc(m.pid)}">✕</button>` : '') +
        `</div>`).join('');
      if (host) el('ntMembers').querySelectorAll('.rm').forEach(b => b.onclick = () => NET.removeAI(b.dataset.pid));
      el('ntStart').style.display = host ? 'block' : 'none';
      el('ntAddAi').style.display = host ? 'block' : 'none';
      el('ntStart').disabled = mem.length < min;
      el('ntStart').textContent = mem.length < min ? `${min}명부터 시작할 수 있어요` : '게임 시작';
      if (this._opts && this._opts.extraLobbyHTML) el('ntExtra').innerHTML = this._opts.extraLobbyHTML();
    },

    error(msg, fatal) {
      const j = el('ntErr'), l = el('ntLobbyErr');
      if (fatal) { if (l) l.textContent = ''; this.closeLobby(); this.openJoin(); if (j) j.textContent = msg; }
      else if (l) { l.textContent = msg; setTimeout(() => { if (l.textContent === msg) l.textContent = ''; }, 3000); }
    },
    toast(msg) {
      const t = document.createElement('div'); t.className = 'nt-toast'; t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => { try { t.remove(); } catch (e) {} }, 320); }, 1700);
    },
    wake(msg, onRetry) {
      const w = el('ntWake'); if (!w) return;
      w.innerHTML = '<span>' + esc(msg) + '</span>';
      if (onRetry) { const b = document.createElement('button'); b.textContent = '다시 시도'; b.onclick = () => { NET.ui.wakeHide(); onRetry(); }; w.appendChild(b); }
      w.style.display = 'flex';
    },
    wakeHide() { const w = el('ntWake'); if (w) w.style.display = 'none'; },
  };

  root.NET = NET;
})(typeof self !== 'undefined' ? self : this);
