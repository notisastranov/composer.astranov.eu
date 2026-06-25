// === GLOBE DECK — one scrollable window over the globe ===
const GlobeDeck = {
  expanded: false,
  activeTask: null,
  _touchY: 0,
  _touchT: 0,
  _collapseTimer: null,

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

  log(text, cls) {
    const out = this.logEl();
    if (!out) return;
    const kind = cls || 'out';
    const show = kind !== 'dim' && kind !== 'map';
    if (show) this.expand();
    const line = document.createElement('div');
    line.className = 'deck-line deck-' + kind;
    line.textContent = text;
    out.appendChild(line);
    while (out.children.length > 200) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    if (kind === 'map' || kind === 'reply') this.setPreview(text);
    else if (!this.expanded) this.setPreview(text);
    if (show) this.ping();
  },

  onUserMessage(title) {
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
    if (this.activeTask && keep.includes(this.activeTask)) return;
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
    if (this._collapseTimer) clearTimeout(this._collapseTimer);
    this._collapseTimer = setTimeout(() => {
      this._collapseTimer = null;
      this.completeTask('cli');
    }, 4500);
  },
};
window.GlobeDeck = GlobeDeck;