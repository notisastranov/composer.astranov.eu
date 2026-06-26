// === ASTRANOV SESSION — one user (ASTRANOV), one session, all devices ===
const COLLECTIVE_SESSION_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE';
const COLLECTIVE_BATCH_SHORT_ID = 'ACI';

const AstranovSession = {
  DEVICE_KEY: 'astranov_device_id',
  LOCAL_KEY: 'astranov_globe_session_v1',
  SESSION_NAME: COLLECTIVE_SESSION_NAME,
  BATCH_SHORT_ID: COLLECTIVE_BATCH_SHORT_ID,
  _deviceId: null,
  _syncTimer: null,
  _lastPull: 0,
  _lastRemote: null,

  init() {
    this._deviceId = this._loadDeviceId();
    this._applyIdentity();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange(() => this.onAuth());
    }
    setTimeout(() => this.onAuth(), 600);
    this._syncTimer = setInterval(() => this.push(), 45000);
    window.addEventListener('beforeunload', () => this.push(true));
  },

  _loadDeviceId() {
    try {
      let id = localStorage.getItem(this.DEVICE_KEY);
      if (!id) {
        id = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem(this.DEVICE_KEY, id);
      }
      return id;
    } catch {
      return 'dev-anon';
    }
  },

  deviceId() {
    return this._deviceId || this._loadDeviceId();
  },

  isAstranov() {
    if (!Auth?.user) return false;
    const email = (Auth.user.email || '').toLowerCase();
    const owner = (Auth.OWNER_EMAIL || 'notisastranov@gmail.com').toLowerCase();
    return email === owner || !!Auth.isOwner || !!Auth.isArchitect;
  },

  sessionLabel() {
    return this.SESSION_NAME;
  },

  identity() {
    if (Auth?.user?.id) {
      const isAstranov = this.isAstranov();
      const name = isAstranov ? 'ASTRANOV' : (
        Auth.user.user_metadata?.full_name
        || Auth.user.user_metadata?.name
        || (Auth.user.email || '').split('@')[0]
        || 'User'
      );
      return {
        userId: Auth.user.id,
        name,
        deviceId: this.deviceId(),
        isGuest: false,
        isAstranov,
        isOwner: isAstranov,
        email: Auth.user.email,
        sessionName: this.SESSION_NAME,
        batchShortId: this.BATCH_SHORT_ID,
      };
    }
    return {
      userId: 'guest-' + this.deviceId(),
      name: 'Guest',
      deviceId: this.deviceId(),
      isGuest: true,
      sessionName: this.SESSION_NAME,
      batchShortId: this.BATCH_SHORT_ID,
    };
  },

  purgeLocalForeignState() {
    if (!Auth?.user) return;
    try {
      const drop = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith(this.LOCAL_KEY + '_guest')) drop.push(k);
        if (k.startsWith('astranov_session-hold-v1_guest')) drop.push(k);
        if (k === 'astranov_node_id') drop.push(k);
      }
      drop.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  },

  async unifyCollective() {
    this._applyIdentity();
    this.purgeLocalForeignState();
    SessionHold?.clearForeignHold?.();
    if (AstranovNode?.api) {
      try {
        const r = await AstranovNode.api({ action: 'session_purge' });
        if (r.ok && r.closed > 0) {
          AciCli?.print?.('◎ Closed ' + r.closed + ' old session(s) — one collective only', 'dim');
        }
      } catch (_) {}
    }
    showOtherUsers?.();
    await this.pull();
    await AstranovNode?.resumeSession?.();
    await this.push(true);
    GlobeDeck?.setTitle?.(this.SESSION_NAME);
    const chip = document.getElementById('user-chip');
    if (chip && this.isAstranov()) chip.textContent = 'ASTRANOV · OWNER';
  },

  nodeStorageKey() {
    const uid = Auth?.user?.id || 'guest';
    return 'astranov_node_' + uid.slice(0, 8) + '_' + this.deviceId();
  },

  getDeviceNodeId() {
    try {
      const key = this.nodeStorageKey();
      let id = localStorage.getItem(key);
      if (!id && Auth?.user?.id) {
        id = 'node-' + Auth.user.id.slice(0, 8) + '-' + this.deviceId().slice(0, 10);
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return null;
    }
  },

  _applyIdentity() {
    const id = this.identity();
    if (typeof me !== 'undefined') {
      if (!me) window.me = me = {};
      me.id = id.userId;
      me.name = id.name;
      me.deviceId = id.deviceId;
      me.isGuest = id.isGuest;
      me.isAstranov = !!id.isAstranov;
      if (id.email) me.email = id.email;
      if (id.isAstranov) me.sessionName = this.SESSION_NAME;
    }
    window._astranovIdentity = id;
  },

  capture() {
    return {
      userId: Auth?.user?.id || null,
      deviceId: this.deviceId(),
      sessionName: this.SESSION_NAME,
      updatedAt: Date.now(),
      lastPos: window._lastPos || null,
      batchId: AstranovNode?.batchId || null,
      shortId: this.BATCH_SHORT_ID,
      batchLabel: this.SESSION_NAME,
      nodeId: AstranovNode?.nodeId || this.getDeviceNodeId(),
      theme: AstranovTheme?.mode || 'dark',
      followMode: GlobeControl?.followMode || 'free',
      deckExpanded: !!GlobeDeck?.expanded,
      activeTask: GlobeDeck?.activeTask || null,
      context: SuperCli?._context || 'idle',
      handsFree: !!window._handsFreeVoice,
      wishlist: AstranovWishlist?.snapshot?.() || [],
      cliHistory: AciCli?.history?.slice?.(-40) || [],
    };
  },

  applyRemote(session) {
    if (!session || typeof session !== 'object') return;
    session.shortId = this.BATCH_SHORT_ID;
    session.sessionName = this.SESSION_NAME;
    session.batchLabel = this.SESSION_NAME;
    this._lastRemote = session;
    if (session.lastPos?.lat != null) {
      window._lastPos = session.lastPos;
      placeMe?.(session.lastPos.lat, session.lastPos.lng, { quiet: true, markerOnly: true });
    }
    if (session.theme && AstranovTheme?.set) AstranovTheme.set(session.theme);
    if (session.shortId && AstranovNode?.resumeFromServer) {
      AstranovNode.resumeFromServer(session);
    }
    if (session.wishlist?.length && AstranovWishlist?.applyRemote) {
      AstranovWishlist.applyRemote(session.wishlist);
    }
    if (session.cliHistory?.length && AciCli?.mergeHistory) {
      AciCli.mergeHistory(session.cliHistory);
    }
    if (session.handsFree && !SessionHold?.isHeld?.()) {
      window._handsFreeVoice = true;
      voiceSessionActive = true;
      voiceEnabled = true;
      setTimeout(() => scheduleVoiceResume?.(), 1200);
    }
    window.dispatchEvent(new CustomEvent('astranov-session-pulled', { detail: session }));
  },

  async onAuth() {
    this._applyIdentity();
    if (Auth?.user) {
      if (this.isAstranov()) {
        await this.unifyCollective();
      } else {
        SessionHold?.clearForeignHold?.();
        await this.pull();
        await AstranovNode?.resumeSession?.();
      }
      setTimeout(() => AstranovWishlist?.announceRecovered?.(), 900);
      if (this.isAstranov()) {
        GlobeDeck?.setTitle?.(this.SESSION_NAME);
        const chip = document.getElementById('user-chip');
        if (chip) {
          chip.textContent = 'ASTRANOV · OWNER';
          chip.style.color = '#8f8';
        }
      }
    } else {
      this._applyLocal();
    }
    if (window._lastPos && GlobeEntity?.syncMe) {
      GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');
    }
    showOtherUsers?.();
  },

  _localKey() {
    const uid = Auth?.user?.id || 'guest-' + this.deviceId();
    return this.LOCAL_KEY + '_' + uid;
  },

  _applyLocal() {
    try {
      const raw = localStorage.getItem(this._localKey());
      if (raw) this.applyRemote(JSON.parse(raw));
    } catch (_) {}
  },

  async pull() {
    if (!Auth?.user || !AstranovNode?.api) return;
    if (Date.now() - this._lastPull < 8000) return;
    this._lastPull = Date.now();
    try {
      const r = await AstranovNode.api({ action: 'session_get' });
      if (r.ok && r.session) {
        this.applyRemote(r.session);
        try { localStorage.setItem(this._localKey(), JSON.stringify(r.session)); } catch (_) {}
      }
    } catch (e) {
      console.warn('[AstranovSession] pull failed', e.message || e);
    }
  },

  async push(force) {
    const snap = this.capture();
    try { localStorage.setItem(this._localKey(), JSON.stringify(snap)); } catch (_) {}
    if (!Auth?.user || !AstranovNode?.api) return;
    if (!force && document.hidden) return;
    try {
      await AstranovNode.api({ action: 'session_save', session: snap });
    } catch (_) {}
  },
};
window.AstranovSession = AstranovSession;