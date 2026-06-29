// === GLOBE DECK — one scrollable window over the globe ===
const GlobeDeck = {
  expanded: false,
  activeTask: null,
  thinking: false,
  _touchY: 0,
  _touchT: 0,
  _collapseTimer: null,
  _thinkLine: null,
  _lastSay: '',
  _lastSayT: 0,
  _userEngaged: false,
  _expandAt: 0,

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
    const toggle = e => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    };
    document.querySelectorAll('#cli-deck-handle, #globe-deck-handle').forEach(handle => {
      if (handle._deckBound) return;
      handle._deckBound = true;
      handle.addEventListener('click', toggle);
      handle.addEventListener('touchend', e => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        toggle(e);
      }, { passive: false });
    });
  },

  bindDeckGestures() {
    const deck = this.deck();
    if (!deck || this._gesturesBound) return;
    this._gesturesBound = true;
    let sy = 0, st = 0, sx = 0, moved = false;
    const scrollable = t => t?.closest?.('#globe-deck-log, #globe-deck-stage, #globe-deck-input-row');
    const interactive = t => t?.closest?.('button, input, a, #super-cli-bar button, #globe-deck-input-row button, #globe-deck-input-row input');

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

  log(text, cls) {
    const kind = cls || 'out';
    if (kind === 'map') {
      this.setMapStatus(text);
      return;
    }
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
    this.expanded = true;
    const d = this.deck();
    if (d) {
      d.classList.add('expanded');
      d.classList.remove('collapsed');
    }
    CliRibbon?.render?.();
    if (window.AciCli) AciCli.open = true;
  },

  superAction(action) {
    this._userEngaged = true;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    this.expand((window.SuperCli?.title || 'Astranov Command Line') + ' — ' + (action || 'collective'));
  },

  collapse() {
    this.expanded = false;
    this._userEngaged = false;
    const d = this.deck();
    if (d) {
      d.classList.remove('expanded');
      d.classList.add('collapsed');
    }
    CliRibbon?.render?.();
    if (window.AciCli) AciCli.open = false;
  },

  toggle() {
    this.expanded ? this.collapse() : this.expand();
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