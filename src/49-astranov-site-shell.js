// === ASTRANOV SITE SHELL — subdomains open over the globe (Earth browser) ===
const AstranovSiteShell = {
  active: null,

  init() {
    document.getElementById('as-shell-close')?.addEventListener('click', () => this.close());
    document.getElementById('as-shell-external')?.addEventListener('click', () => {
      if (this.active?.url) window.open(this.active.url, '_blank', 'noopener');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.active) this.close();
    });
  },

  shellUrl(url) {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('shell', '1');
    u.searchParams.set('embed', '1');
    return u.toString();
  },

  open(url, meta = {}) {
    const shell = document.getElementById('astranov-site-shell');
    const frame = document.getElementById('as-shell-frame');
    const domainEl = document.getElementById('as-shell-domain');
    if (!shell || !frame) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const full = url.startsWith('http') ? url : 'https://' + url;
    this.active = { url: full, ...meta };
    if (domainEl) domainEl.textContent = meta.domain || meta.title || new URL(full).hostname;
    frame.src = this.shellUrl(full);
    shell.classList.add('open');
    document.body.classList.add('site-shell-open');
    if (window.AIGraphics?.setSiteShellMode) AIGraphics.setSiteShellMode(true);
    GlobeDeck?.collapse?.();
    GlobeDeck?.setPreview?.('◎ ' + (meta.domain || full));
    AciCli?.print?.('site shell · ' + (meta.domain || full), 'ok');
    setTimeout(() => Auth?.broadcastToShell?.(), 1200);
  },

  close() {
    const shell = document.getElementById('astranov-site-shell');
    const frame = document.getElementById('as-shell-frame');
    if (shell) shell.classList.remove('open');
    document.body.classList.remove('site-shell-open');
    if (frame) frame.src = 'about:blank';
    this.active = null;
    if (window.AIGraphics?.setSiteShellMode) AIGraphics.setSiteShellMode(false);
    GlobeDeck?.setPreview?.('');
  },

  isOpen() { return !!this.active; }
};
window.AstranovSiteShell = AstranovSiteShell;