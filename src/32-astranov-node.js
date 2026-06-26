// === ASTRANOV NODE — PWA/native install + decentralized batch work together ===
const AstranovNode = {
  batchId: null,
  shortId: null,
  nodeId: null,
  channel: null,
  rtChannel: null,
  peerCount: 0,
  deferredPrompt: null,
  _hb: null,
  _open: false,

  platform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'desktop';
  },

  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || localStorage.getItem('astranov_installed') === '1';
  },

  installMode() {
    if (this.isInstalled()) return this.platform() === 'ios' ? 'pwa-ios' : 'pwa';
    return 'browser';
  },

  async api(body) {
    const headers = Auth?.authHeaders ? await Auth.authHeaders() : sbHeaders();
    const r = await fetch(SB_URL + '/functions/v1/node-batch', {
      method: 'POST', headers,
      body: JSON.stringify(body),
    });
    return r.json().catch(() => ({}));
  },

  pos() {
    return window._lastPos || { lat: 36.4239, lng: 28.2245 };
  },

  init() {
    try { this.nodeId = localStorage.getItem('astranov_node_id'); } catch { /* */ }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.updateInstallUI();
    });
    window.addEventListener('appinstalled', () => {
      localStorage.setItem('astranov_installed', '1');
      this.setStep(2, 'done', 'Εγκατεστημένο — Astranov node ενεργό');
      this.updateInstallUI();
      FieldBrain?.pulse('batch', 'pwa installed', { props: { visual_truth: true } });
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    this.bindUI();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange((_e, session) => {
        if (session?.user) setTimeout(() => this.maybePromptInstall(), 4000);
      });
    }
    if (location.hash === '#install-android' || location.hash === '#install-ios') this.showPanel();
  },

  bindUI() {
    document.getElementById('nb-close')?.addEventListener('click', () => this.hidePanel());
    document.getElementById('nb-launch')?.addEventListener('click', () => this.launchBatch());
    document.getElementById('nb-install-android')?.addEventListener('click', () => this.installAndroid());
    document.getElementById('nb-install-ios')?.addEventListener('click', () => this.showIosHelp());
    document.getElementById('nb-join-comms')?.addEventListener('click', () => Comms?.startVHF?.());
  },

  showPanel() {
    this._open = true;
    GlobeDeck?.showStage('node-batch', 'batch');
    this.renderPlatform();
    this.updateInstallUI();
    MapDepict?.action('batch', { detail: 'work together · install node' });
  },

  hidePanel() {
    this._open = false;
    document.getElementById('node-batch')?.classList.remove('open', 'deck-active');
    if (GlobeDeck?.activeTask === 'batch') GlobeDeck?.completeTask('batch');
  },

  renderPlatform() {
    const el = document.getElementById('nb-platform');
    if (!el) return;
    const p = this.platform();
    const labels = { android: '🤖 Android', ios: '🍎 Apple iOS', desktop: '💻 Desktop' };
    el.textContent = labels[p] || p;
    const iosBox = document.getElementById('nb-ios-steps');
    const andBtn = document.getElementById('nb-install-android');
    const iosBtn = document.getElementById('nb-install-ios');
    if (iosBox) iosBox.style.display = p === 'ios' ? 'block' : 'none';
    if (iosBtn) iosBtn.style.display = p === 'ios' ? 'block' : 'none';
    if (andBtn) andBtn.style.display = p === 'ios' ? 'none' : 'block';
  },

  setStep(n, state, msg) {
    const el = document.getElementById('nb-step-' + n);
    if (!el) return;
    el.className = 'nb-step nb-' + state;
    const m = el.querySelector('.nb-step-msg');
    if (m) m.textContent = msg;
  },

  updateInstallUI() {
    const installed = this.isInstalled();
    const canPwa = !!this.deferredPrompt;
    const p = this.platform();
    if (installed) {
      this.setStep(2, 'done', 'Native/PWA node εγκατεστημένο — relay + comms ενεργά');
    } else if (p === 'ios') {
      this.setStep(2, 'active', 'Safari → Share → Add to Home Screen');
    } else if (canPwa) {
      this.setStep(2, 'active', 'Πάτα Εγκατάσταση Android — PWA node');
    } else {
      this.setStep(2, 'active', 'Εγκατάσταση native app (σύντομα) ή PWA από Chrome');
    }
    const st = document.getElementById('nb-status');
    if (st) {
      st.textContent = installed
        ? 'Node installed · batch channel: ' + (this.shortId || '—')
        : 'Εγκατάστησε Astranov node για δουλειά μαζί χωρίς browser tabs';
    }
  },

  maybePromptInstall() {
    if (this.isInstalled() || this._open) return;
    if (sessionStorage.getItem('astranov_install_nudge') === '1') return;
    sessionStorage.setItem('astranov_install_nudge', '1');
    this.showPanel();
    ACIControl?.reply('Εγκατάστησε Astranov node — δουλεύουμε μαζί από την εφαρμογή');
  },

  async installAndroid() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      this.deferredPrompt = null;
      if (outcome === 'accepted') {
        localStorage.setItem('astranov_installed', '1');
        this.setStep(2, 'done', 'Εγκατάσταση ξεκίνησε — άνοιξε από home screen');
        AciCli?.print('Astranov PWA install accepted', 'ok');
        return;
      }
    }
    ACIControl?.reply('Chrome: Menu ⋮ → Install app · ή Add to Home Screen');
    AciCli?.print('No install prompt — use Chrome menu → Install Astranov', 'dim');
  },

  showIosHelp() {
    this.setStep(2, 'active', 'Safari Share ⬆️ → Add to Home Screen ➕ → open Astranov');
    ACIControl?.reply('iOS: Share → Add to Home Screen — μετά άνοιξε το Astranov icon');
    const box = document.getElementById('nb-ios-steps');
    if (box) box.style.display = 'block';
  },

  async launchBatch() {
    if (!Auth?.user) {
      this.showPanel();
      this.setStep(1, 'active', 'Σύνδεση απαιτείται — πάτα G');
      Auth?.signInGoogle();
      ACIControl?.reply('Sign in with G — then launch batch again');
      return;
    }

    this.showPanel();
    this.setStep(1, 'done', 'Συνδεδεμένος · ' + (Auth.user.email?.split('@')[0] || 'user'));
    this.setStep(3, 'active', 'Εκκίνηση batch…');

    const pos = this.pos();
    const r = await this.api({
      action: 'launch',
      node_id: this.nodeId || undefined,
      platform: this.platform(),
      install_mode: this.installMode(),
      lat: pos.lat,
      lng: pos.lng,
      props: { ua: navigator.userAgent?.slice(0, 120) },
    });

    if (!r.ok) {
      this.setStep(3, 'blocked', r.error || 'batch failed');
      ACIControl?.reply('Batch failed: ' + (r.error || 'server'));
      return;
    }

    this.batchId = r.batch_id;
    this.shortId = r.short_id;
    this.nodeId = r.node_id;
    try { localStorage.setItem('astranov_node_id', this.nodeId); } catch { /* */ }
    this.peerCount = r.peers || 1;

    await this.joinBatchChannel(r.channel || ('astranov-batch-' + r.short_id));
    this.startHeartbeat();

    const peerEl = document.getElementById('nb-peers');
    if (peerEl) peerEl.textContent = String(this.peerCount);
    const idEl = document.getElementById('nb-batch-id');
    if (idEl) idEl.textContent = r.short_id;

    this.setStep(3, 'done', 'Batch ' + r.short_id + ' · channel live');
    if (!this.isInstalled()) this.setStep(2, 'active', 'Εγκατάστασε node για πλήρη native relay');
    else this.setStep(2, 'done', 'Node ενεργό — decentralized server applet');

    const msg = 'Batch ' + r.short_id + ' live · ' + this.peerCount + ' node(s) · δουλεύουμε μαζί';
    ACIControl?.reply(msg);
    MapDepict?.action('batch', { lat: pos.lat, lng: pos.lng, detail: r.short_id + ' · ' + this.peerCount + ' nodes' });
    FieldBrain?.pulse('batch', r.short_id + ' · peers ' + this.peerCount, { role: 'client', props: { batch_id: r.batch_id, node_id: r.node_id } });

    if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
  },

  async joinBatchChannel(name) {
    if (!Auth?.client || !name) return;
    if (this.rtChannel) {
      try { await Auth.client.removeChannel(this.rtChannel); } catch { /* */ }
      this.rtChannel = null;
    }
    this.channel = name;
    this.rtChannel = Auth.client.channel(name, { config: { broadcast: { ack: true, self: true }, presence: { key: this.nodeId || Auth.user.id } } });
    this.rtChannel.on('broadcast', { event: 'collab' }, ({ payload }) => this.onCollab(payload));
    this.rtChannel.on('presence', { event: 'sync' }, () => {
      const state = this.rtChannel.presenceState();
      const n = Object.keys(state).length;
      this.peerCount = Math.max(n, this.peerCount);
      const peerEl = document.getElementById('nb-peers');
      if (peerEl) peerEl.textContent = String(this.peerCount);
    });
    await this.rtChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.rtChannel.track({
          node_id: this.nodeId,
          user: Auth.user?.email?.split('@')[0],
          platform: this.platform(),
          install: this.installMode(),
        });
        this.rtChannel.send({
          type: 'broadcast',
          event: 'collab',
          payload: { type: 'hello', from: this.nodeId, batch: this.shortId },
        });
      }
    });
  },

  onCollab(payload) {
    if (!payload || payload.from === this.nodeId) return;
    if (payload.type === 'hello') {
      this.peerCount++;
      const peerEl = document.getElementById('nb-peers');
      if (peerEl) peerEl.textContent = String(this.peerCount);
      MapDepict?.pulse(this.pos().lat, this.pos().lng, 0x88aaff, 'peer joined batch', 8000);
    }
    if (payload.type === 'task' && payload.text) {
      AciCli?.print('batch task · ' + payload.text.slice(0, 100), 'dim');
    }
  },

  broadcastTask(text) {
    this.rtChannel?.send({
      type: 'broadcast',
      event: 'collab',
      payload: { type: 'task', from: this.nodeId, text: String(text || '').slice(0, 300) },
    });
  },

  startHeartbeat() {
    if (this._hb) clearInterval(this._hb);
    this._hb = setInterval(async () => {
      if (!this.nodeId || !this.batchId) return;
      const pos = this.pos();
      const r = await this.api({
        action: 'heartbeat',
        node_id: this.nodeId,
        batch_id: this.batchId,
        lat: pos.lat,
        lng: pos.lng,
      });
      if (r.peers != null) {
        this.peerCount = r.peers;
        const peerEl = document.getElementById('nb-peers');
        if (peerEl) peerEl.textContent = String(r.peers);
      }
    }, 90000);
  },
};

window.AstranovNode = AstranovNode;