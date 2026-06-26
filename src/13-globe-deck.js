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

  init() {
    const hdr = document.getElementById('globe-deck-header');
    const handle = document.getElementById('globe-deck-handle');
    if (handle) handle.onclick = e => { e.stopPropagation(); this.toggle(); };
    if (hdr) {
      hdr.onclick = () => this.toggle();
      hdr.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        this._touchY = e.touches[0].clientY;
        this._touchT = Date.now();
      }, { passive: true });
      hdr.addEventListener('touchend', e => {
        if (e.changedTouches.length !== 1) return;
        const dy = e.changedTouches[0].clientY - this._touchY;
        const dt = Date.now() - this._touchT;
        if (dt > 600) return;
        if (dy < -28) this.expand();
        else if (dy > 28) this.collapse();
      }, { passive: true });
    }
    ['sat-radio', 'node-batch', 'vendor-menu'].forEach(id => {
      const el = document.getElementById(id);
      const stage = document.getElementById('globe-deck-stage');
      if (el && stage && el.parentElement !== stage) stage.appendChild(el);
    });
    this.setTitle('Collective — globe deck');
  },

  deck() { return document.getElementById('globe-deck'); },
  logEl() { return document.getElementById('globe-deck-log'); },

  setTitle(text) {
    const el = document.getElementById('globe-deck-title');
    if (el) el.textContent = text || 'Collective — globe deck';
  },

  setPreview(text) {
    const el = document.getElementById('globe-deck-preview');
    if (el) el.textContent = (text || '').slice(0, 120);
    if (!this.expanded && text) this.deck()?.classList.add('has-preview');
    else if (!text) this.deck()?.classList.remove('has-preview');
  },

  setMapStatus(text) {
    this.setPreview(text || '');
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
    if (this._userEngaged || kind === 'err' || kind === 'cmd') this.expand();
    const line = document.createElement('div');
    line.className = 'deck-line deck-' + kind;
    line.textContent = text;
    out.appendChild(line);
    while (out.children.length > 48) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    if (kind === 'reply' || kind === 'out' || kind === 'ok') this.setPreview(text);
    if (this._userEngaged && (kind === 'reply' || kind === 'out' || kind === 'err')) this.ping();
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
    if (title) this.setTitle(title);
    this.expanded = true;
    const d = this.deck();
    if (d) {
      d.classList.add('expanded');
      d.classList.remove('collapsed');
    }
    const handle = document.getElementById('globe-deck-handle');
    if (handle) handle.textContent = '▁';
    if (window.AciCli) AciCli.open = true;
  },

  collapse() {
    this.expanded = false;
    this._userEngaged = false;
    const d = this.deck();
    if (d) {
      d.classList.remove('expanded');
      d.classList.add('collapsed');
    }
    const handle = document.getElementById('globe-deck-handle');
    if (handle) handle.textContent = '▔';
    if (window.AciCli) AciCli.open = false;
  },

  toggle() {
    this.expanded ? this.collapse() : this.expand();
  },

  showStage(panelId, task, title) {
    this.activeTask = task || panelId;
    const stage = document.getElementById('globe-deck-stage');
    if (!stage) return;
    stage.querySelectorAll('.deck-active').forEach(el => el.classList.remove('deck-active', 'open'));
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('deck-active', 'open');
    }
    this.expand(title || this.stageTitle(panelId));
  },

  hideStage() {
    const stage = document.getElementById('globe-deck-stage');
    if (stage) {
      stage.querySelectorAll('.deck-active').forEach(el => {
        el.classList.remove('deck-active', 'open');
      });
    }
    if (window.PmrRadio) PmrRadio.open = false;
    if (window.AstranovNode) AstranovNode._open = false;
  },

  stageTitle(panelId) {
    const titles = {
      'vendor-menu': 'Καταστήματα · παραγγελία',
      'node-batch': 'Work together · Astranov node',
      'sat-radio': 'EU PMR Ch 11 · comms',
    };
    return titles[panelId] || 'Collective — globe deck';
  },

  completeTask(task) {
    const keep = ['coders', 'radio', 'batch', 'commerce'];
    if (task === 'cli' && this.activeTask && keep.includes(this.activeTask)) return;
    if (this.activeTask && this.activeTask !== task && task !== 'cli') return;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    this.hideStage();
    this.collapse();
    this.activeTask = null;
    this.setTitle('Collective — globe deck');
  },

  isOneShotCmd(cmd) {
    const one = new Set([
      'think', 'evolve', 'teach', 'stats', 'owner', 'seed', 'distill', 'council',
      'mode', 'locate', 'gps', 'me', 'drive', 'news', 'roles', 'claim', 'field_stats',
      'deploy', 'help', '?', 'clear', 'logout', 'connect', 'open', 'vendor',
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