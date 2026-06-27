// === ASTRANOV THEME — dark / bright for globe, city map, and UI ===
const AstranovTheme = {
  mode: 'dark',
  KEY: 'astranov_theme_v1',
  _maps: [],

  init() {
    try {
      const saved = localStorage.getItem(this.KEY);
      if (saved === 'bright' || saved === 'dark') this.mode = saved;
    } catch (_) {}
    this.apply();
    const btn = document.getElementById('aci-theme');
    if (btn) {
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      };
      this._syncBtn();
    }
  },

  registerMap(mapApi) {
    if (mapApi && !this._maps.includes(mapApi)) this._maps.push(mapApi);
  },

  toggle() {
    this.set(this.mode === 'dark' ? 'bright' : 'dark');
  },

  set(mode) {
    const next = mode === 'bright' ? 'bright' : 'dark';
    if (next === this.mode) return this.mode;
    this.mode = next;
    try { localStorage.setItem(this.KEY, next); } catch (_) {}
    this.apply();
    AciCli?.print?.('theme → ' + next, 'ok');
    GlobeDeck?.setPreview?.((next === 'bright' ? '☀️' : '🌙') + ' ' + next + ' theme');
    if (Voice?.maySpeak?.()) speak('Theme ' + next + '.', () => resumeListening?.());
    return this.mode;
  },

  apply() {
    document.documentElement.dataset.theme = this.mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = this.mode === 'bright' ? '#1a6fd4' : '#0a1020';
    if (scene?.background) {
      scene.background = new THREE.Color(this.mode === 'bright' ? 0x040810 : 0x000000);
    }
    if (renderer) renderer.setClearColor(this.mode === 'bright' ? 0x040810 : 0x000000, 1);
    EarthRealism?.onThemeChange?.();
    this._maps.forEach(m => m.onThemeChange?.());
    this._syncBtn();
  },

  _syncBtn() {
    const btn = document.getElementById('aci-theme');
    if (!btn) return;
    btn.textContent = this.mode === 'bright' ? '☀️' : '🌙';
    btn.title = this.mode === 'bright' ? 'Bright theme — tap for dark' : 'Dark theme — tap for bright';
    btn.classList.toggle('deck-btn-active', this.mode === 'bright');
  },
};
window.AstranovTheme = AstranovTheme;