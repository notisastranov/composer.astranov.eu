// === GLOBE DECK — one scrollable window over the globe ===
const GlobeDeck = {
  expanded: false,
  activeTask: null,
  thinking: false,
  _size: 'collapsed',
  _touchY: 0,
  _touchT: 0,
  _collapseTimer: null,
  _thinkLine: null,
  _composeLine: null,
  _lastSay: '',
  _lastSayT: 0,
  _userEngaged: false,
  _expandAt: 0,
  _handleDrag: 0,
  _NOISE_RE: /^(thinking|warming|owner-sync|heartbeat|field_pulse|subscribe|channel joined|token refresh|postgres_changes|Map live|Ghost route|hands-free on|Coders always|session held|pull failed)/i,

  init() {
    CliRibbon?.init?.();
    AppShortcuts?.init?.();
    this.bindHandle();
    this.bindDeckGestures();
    ['sat-radio', 'node-batch', 'vendor-menu', 'globe-youtube', 'globe-super-add', 'globe-site-browser', 'cli-hub-panel'].forEach(id => {
      const el = document.getElementById(id);
      const stage = document.getElementById('globe-deck-stage');
      if (el && stage && el.parentElement !== stage) stage.appendChild(el);
    });
    CliRibbon?.setActive?.('CLI');
  },

  bindHandle() {
    const handle = document.getElementById('cli-deck-handle');
    if (!handle || handle._deckBound) return;
    handle._deckBound = true;
    let sy = 0, sh = 0, moved = 0;
    const onTap = (e) => {
      if (moved > 14) return;
      e.preventDefault();
      e.stopPropagation();
      this.cycleSize();
    };
    handle.addEventListener('click', onTap);
    handle.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      sy = e.touches[0].clientY;
      sh = this.deck()?.getBoundingClientRect().height || 0;
      moved = 0;
      this._handleDrag = sy;
    }, { passive: true });
    handle.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const dy = sy - e.touches[0].clientY;
      moved = Math.max(moved, Math.abs(dy));
      const d = this.deck();
      if (!d || moved < 6) return;
      const minH = 118;
      const maxH = Math.min(window.innerHeight * 0.94, window.innerHeight - 36);
      const nh = Math.min(maxH, Math.max(minH, sh + dy));
      d.style.maxHeight = nh + 'px';
      d.style.minHeight = nh + 'px';
      d.classList.remove('collapsed');
      d.classList.add('expanded');
      d.classList.remove('size-third', 'size-full');
      this.expanded = true;
      this._size = nh > window.innerHeight * 0.62 ? 'full' : 'third';
    }, { passive: true });
    handle.addEventListener('touchend', (e) => {
      if (moved > 14) {
        const d = this.deck();
        const h = d?.getBoundingClientRect().height || 0;
        const third = window.innerHeight * 0.33;
        const full = window.innerHeight * 0.88;
        if (h < 160) this._size = 'collapsed';
        else if (h < (third + full) / 2) this._size = 'third';
        else this._size = 'full';
        this.applySize();
        return;
      }
      if (e.cancelable) e.preventDefault();
      onTap(e);
    }, { passive: false });
  },

  cycleSize() {
    const order = ['collapsed', 'third', 'full'];
    const i = order.indexOf(this._size);
    this._size = order[(i + 1) % order.length];
    this.applySize();
  },

  applySize() {
    const d = this.deck();
    if (!d) return;
    d.style.maxHeight = '';
    d.style.minHeight = '';
    d.classList.remove('collapsed', 'expanded', 'size-third', 'size-full');
    if (this._size === 'collapsed') {
      d.classList.add('collapsed');
      this.expanded = false;
      if (window.AciCli) AciCli.open = false;
    } else {
      d.classList.add('expanded', this._size === 'full' ? 'size-full' : 'size-third');
      this.expanded = true;
      if (window.AciCli) AciCli.open = true;
    }
    CliRibbon?.render?.();
  },

  bindDeckGestures() {
    const deck = this.deck();
    if (!deck || this._gesturesBound) return;
    this._gesturesBound = true;
    let sy = 0, st = 0, sx = 0, moved = false;
    const scrollable = t => t?.closest?.('#globe-deck-log, #globe-deck-stage, #globe-deck-input-row');
    const interactive = t => t?.closest?.('button, input, textarea, form, a, #super-cli-bar button, #globe-deck-input-row button, #globe-deck-input-row textarea, #aci-cli-form, #cli-deck-handle');

    deck.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || interactive(e.target)) return;
      sy = e.touches[0].clientY;
      sx = e.touches[0].clientX;
      st = Date.now();
      moved = false;
      this._touchY = sy;
      this._touchT = st;
    }, { passive: true });

    deck.addEventListener('touchmove', e => {
      if (e.touches.length !== 1) return;
      const dy = Math.abs(e.touches[0].clientY - sy);
      const dx = Math.abs(e.touches[0].clientX - sx);
      if (dy > 10 || dx > 10) moved = true;
      if (this.expanded && scrollable(e.target) && dy > dx) return;
    }, { passive: true });

    deck.addEventListener('touchend', e => {
      if (e.changedTouches.length !== 1 || interactive(e.target)) return;
      const dy = e.changedTouches[0].clientY - sy;
      const dt = Date.now() - st;
      if (dt > 750) return;
      if (this.expanded && scrollable(e.target) && moved) return;
      if (Math.abs(dy) < 28) return;
      if (dy < -28) this.expand();
      else if (dy > 28) this.collapse();
    }, { passive: true });
  },

  deck() { return document.getElementById('globe-deck'); },
  logEl() { return document.getElementById('globe-deck-log'); },

  setTitle(text) {
    CliRibbon?.setActive?.(text || CliRibbon?.TASK_LABEL?.[this.activeTask] || 'CLI');
  },

  setPreview(text) {
    const s = (text || '').slice(0, 120);
    if (s && CliRibbon?.isGlobeHint?.(s)) return;
    if (s) CliRibbon?.setNotice?.(s);
    else CliRibbon?.clearNotice?.();
    if (!this.expanded && s) this.deck()?.classList.add('has-preview');
    else if (!s) this.deck()?.classList.remove('has-preview');
  },

  setMapStatus(text) {
    const s = String(text || '');
    if (!s || CliRibbon?.isGlobeHint?.(s)) return;
    this.setPreview(s);
  },

  shouldLog(text, kind) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (CliRibbon?.isGlobeHint?.(t)) return false;
    if (CliRibbon?.MOTTO_RE?.test(t)) return false;
    if (this._NOISE_RE.test(t)) return false;
    if (kind === 'dim' && /^(◎|…|\.{2,})\s/.test(t) && t.length < 90) return false;
    if (/^\{.*\}$/.test(t) || /^HTTP \d/.test(t)) return false;
    return true;
  },

  setCompose(text) {
    const t = String(text || '');
    if (!t) {
      if (this._composeLine?.parentNode) this._composeLine.remove();
      this._composeLine = null;
      return;
    }
    if (!this.expanded) return;
    const out = this.logEl();
    if (!out) return;
    if (!this._composeLine) {
      this._composeLine = document.createElement('div');
      this._composeLine.id = 'deck-compose-line';
      this._composeLine.className = 'deck-line deck-compose';
      out.appendChild(this._composeLine);
    }
    this._composeLine.textContent = '› ' + t;
    out.scrollTop = out.scrollHeight;
  },

  clearCompose() {
    this.setCompose('');
    const input = document.getElementById('aci-cli-in');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    if (window.AciCli) AciCli.buffer = '';
  },

  log(text, cls) {
    const kind = cls || 'out';
    if (kind === 'map') {
      this.setMapStatus(text);
      return;
    }
    if (!this.shouldLog(text, kind)) return;
    const out = this.logEl();
    if (!out) return;
    if (kind === 'dim') {
      if (this._thinkLine?.parentNode) {
        this._thinkLine.textContent = text;
        return;
      }
      const line = document.createElement('div');
      line.className = 'deck-line deck-dim';
      line.textContent = text;
      out.appendChild(line);
      while (out.children.length > 48) out.removeChild(out.firstChild);
      out.scrollTop = out.scrollHeight;
      return;
    }
    const key = kind + ':' + (text || '').slice(0, 100);
    const now = Date.now();
    if (this._lastSay === key && now - this._lastSayT < 5000) return;
    this._lastSay = key;
    this._lastSayT = now;
    if (kind === 'cmd' || kind === 'err') this.expand();
    else if (this._userEngaged && this.expanded && (kind === 'reply' || kind === 'out' || kind === 'ok')) { /* stay open */ }
    const line = document.createElement('div');
    line.className = 'deck-line deck-' + kind;
    line.textContent = text;
    out.appendChild(line);
    while (out.children.length > 48) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    if (kind === 'reply' || kind === 'out' || kind === 'ok') this.setPreview(text);
    if (kind === 'err') CliRibbon?.setNotice?.(text, 'err');
    if (this._userEngaged && (kind === 'reply' || kind === 'out' || kind === 'err')) this.ping();
    if (kind !== 'dim' && kind !== 'map') CliHub?.queueLine?.(text, kind);
  },

  say(text, cls) {
    this.log(text, cls || 'out');
  },

  onUserMessage(title) {
    this._userEngaged = true;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    this.expand(title || 'Collective — listening');
    this.ping();
  },

  ping() {
    const d = this.deck();
    if (!d) return;
    d.classList.remove('deck-ping');
    void d.offsetWidth;
    d.classList.add('deck-ping');
    setTimeout(() => d.classList.remove('deck-ping'), 1200);
  },

  setThinking(on, hint) {
    this.thinking = !!on;
    const d = this.deck();
    if (d) d.classList.toggle('deck-thinking', this.thinking);
    if (on && hint) CliRibbon?.setNotice?.(hint);
    else if (!on) CliRibbon?.clearNotice?.();
    CliRibbon?.render?.();
    if (on) {
      this.expand(hint || 'Collective — thinking…');
      const out = this.logEl();
      if (out) {
        if (this._thinkLine?.parentNode) this._thinkLine.remove();
        this._thinkLine = document.createElement('div');
        this._thinkLine.className = 'deck-line deck-dim deck-thinking-line';
        this._thinkLine.textContent = hint || '… thinking';
        out.appendChild(this._thinkLine);
        out.scrollTop = out.scrollHeight;
      }
    } else if (this._thinkLine?.parentNode) {
      this._thinkLine.remove();
      this._thinkLine = null;
    }
  },

  showError(msg) {
    this._userEngaged = true;
    this.expand('Error');
    this.log(msg, 'err');
    this.setPreview(msg);
    this.ping();
  },

  clearLog() {
    const out = this.logEl();
    if (out) out.innerHTML = '';
    this.setPreview('');
  },

  expand(title) {
    const now = Date.now();
    if (title && (!this.expanded || now - this._expandAt > 400)) this.setTitle(title);
    this._expandAt = now;
    if (this._size === 'collapsed') this._size = 'third';
    this.applySize();
    if (window.AciCli) AciCli.open = true;
  },

  superAction(action) {
    this._userEngaged = true;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    this.expand((window.SuperCli?.title || 'Astranov Command Line') + ' — ' + (action || 'collective'));
  },

  collapse() {
    this._size = 'collapsed';
    this._userEngaged = false;
    this.applySize();
  },

  toggle() {
    this.cycleSize();
  },

  showStage(panelId, task, title) {
    this.hideStage();
    this.activeTask = task || panelId;
    const stage = document.getElementById('globe-deck-stage');
    const d = this.deck();
    if (!stage) return;
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('deck-active', 'open');
      if (d) d.classList.add('has-stage');
    } else if (d) {
      d.classList.remove('has-stage');
    }
    this.expand(title || this.stageTitle(panelId));
    AppShortcuts?.track?.(task || panelId, title || this.stageTitle(panelId));
    SuperCli?.setContext?.(SuperCli.inferContext?.());
    ContextTruth?.sync?.();
    AppShortcuts?.render?.();
  },

  hideStage() {
    const stage = document.getElementById('globe-deck-stage');
    if (stage) {
      stage.querySelectorAll('.deck-active').forEach(el => {
        el.classList.remove('deck-active', 'open');
      });
    }
    this.deck()?.classList.remove('has-stage');
    if (window.PmrRadio) PmrRadio.open = false;
    if (window.AstranovNode) AstranovNode._open = false;
  },

  stageTitle(panelId) {
    const titles = {
      'vendor-menu': 'Καταστήματα · παραγγελία',
      'node-batch': 'Work together · Astranov node',
      'sat-radio': 'EU PMR Ch 11 · comms',
      'globe-youtube': 'YouTube on globe',
      'globe-super-add': 'Super Add · post video',
      'cli-hub-panel': 'CLI · search & chats',
    };
    return titles[panelId] || 'Collective — globe deck';
  },

  completeTask(task) {
    const keep = ['coders', 'radio', 'batch', 'commerce'];
    if (task === 'cli' && this.activeTask && keep.includes(this.activeTask)) return;
    if (this.activeTask && this.activeTask !== task && task !== 'cli') return;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    const done = task === 'cli' ? this.activeTask : task;
    this.hideStage();
    this.collapse();
    this.activeTask = null;
    if (done) AppShortcuts?.untrack?.(done);
    CliRibbon?.setActive?.('CLI');
    CliRibbon?.clearNotice?.();
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
    AppShortcuts?.render?.();
  },

  isOneShotCmd(cmd) {
    const one = new Set([
      'think', 'evolve', 'teach', 'stats', 'owner', 'seed', 'distill', 'council',
      'mode', 'locate', 'gps', 'me', 'drive', 'news', 'roles', 'claim', 'field_stats',
      'deploy', 'help', '?', 'clear', 'logout', 'connect', 'open', 'vendor',
      'dev', 'ui', 'brain', 'status', 'space', 'superspace', 'scenario',
    ]);
    return one.has((cmd || '').toLowerCase());
  },

  finishCliIfOneShot(cmd) {
    if (!this.isOneShotCmd(cmd)) return;
    if (this.activeTask && ['coders', 'radio', 'batch', 'commerce'].includes(this.activeTask)) return;
    if (this._collapseTimer) clearTimeout(this._collapseTimer);
    this._collapseTimer = setTimeout(() => {
      this._collapseTimer = null;
      if (!this.thinking) this.completeTask('cli');
    }, 8000);
  },
};
window.GlobeDeck = GlobeDeck;