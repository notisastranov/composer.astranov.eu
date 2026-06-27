// === SUPER CLI — one window: toolbar + log + stage + input ===
const ACL_TITLE = 'Astranov Command Line';

const SuperCli = {
  _bound: false,
  _context: 'idle',
  title: ACL_TITLE,

  // Top bar: login + Super Add only — everything else via CLI (locate, order, batch, vhf, theme, hold, stop…)
  TOOLBAR_VISIBLE: ['aci-login', 'super-add-fab'],
  INPUT_BTNS: ['aci-handsfree', 'globe-deck-send'],

  init() {
    if (this._bound) return;
    this._bound = true;
    this.bindToolbar();
    this.bindInputBar();
    this.setContext(this.inferContext());
    GlobeDeck?.setTitle(ACL_TITLE);
  },

  inferContext() {
    if (DrivingView?.active) return 'drive';
    const task = GlobeDeck?.activeTask;
    if (task === 'commerce') return 'commerce';
    if (task === 'batch') return 'batch';
    if (task === 'radio') return 'radio';
    if (task === 'phone') return 'phone';
    if (task === 'add') return 'add';
    if (!Auth?.user) return 'guest';
    return 'idle';
  },

  setContext(ctx) {
    this._context = ctx || 'idle';
    const bar = document.getElementById('super-cli-bar');
    if (!bar) return;
    bar.dataset.ctx = this._context;
    const allowed = new Set(this.TOOLBAR_VISIBLE);
    bar.querySelectorAll('button').forEach(btn => {
      btn.hidden = !allowed.has(btn.id);
    });
    this.INPUT_BTNS.forEach(id => {
      const b = document.getElementById(id);
      if (b) b.hidden = false;
    });
  },

  bindInputBar() {
    const hf = document.getElementById('aci-handsfree');
    const send = document.getElementById('globe-deck-send');
    if (hf && !hf._superBound) {
      hf._superBound = true;
      hf.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        GlobeDeck?.expand?.(ACL_TITLE);
        document.getElementById('aci-cli-in')?.focus();
        if (SessionHold?.isHeld?.()) { SessionHold.resume(); return; }
        if (Voice?.speaking || isListening || voiceSessionActive || window._handsFreeVoice) {
          userIntervene?.();
          return;
        }
        startVoiceOptions?.();
      };
    }
    if (send && !send._superBound) {
      send._superBound = true;
      send.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        const input = document.getElementById('aci-cli-in');
        const line = (input?.value || '').trim();
        GlobeDeck?.expand?.(ACL_TITLE);
        if (!line) { input?.focus(); return; }
        if (input) input.value = '';
        if (AciCli) { AciCli.buffer = ''; AciCli.run(line); }
      };
    }
  },

  bindToolbar() {
    const actions = {
      'aci-login': () => Auth?.user ? Auth.signOut() : Auth?.signInGoogle(),
      'aci-cli-toggle': () => GlobeDeck?.toggle(),
      'aci-stop': () => userIntervene?.(),
      'aci-hold': () => SessionHold?.toggle?.(),
      'aci-theme': () => AstranovTheme?.toggle?.(),
      'aci-locate': () => this.run('locate'),
      'aci-order': () => this.run('order'),
      'aci-batch': () => this.run('batch'),
      'aci-vhf': () => this.run('vhf'),
      'aci-call': () => this.run('phone'),
    };
    Object.entries(actions).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.onclick = e => { e.preventDefault(); e.stopPropagation(); fn(); };
    });
  },

  flyForTask(act, opts) {
    if (!GlobeControl?.isEarthView?.()) return;
    const u = window._lastPos || { lat: 36.22, lng: 28.12 };
    if (act === 'news' && opts?.worldLat != null) {
      GlobeControl.flyToLatLng(opts.worldLat, opts.worldLng, 'news', 1.52);
      return;
    }
    if (act === 'order' || act === 'commerce') {
      const v = Commerce?.vendors?.[0] || Commerce?.selected;
      if (v?.lat != null) GlobeControl.flyToLatLng(v.lat, v.lng, 'order', 1.48);
      else GlobeControl.flyToLatLng(u.lat, u.lng, 'order', 1.42);
      return;
    }
    if (act === 'batch') GlobeControl.flyToLatLng(u.lat, u.lng, 'batch', 1.44);
    if (act === 'vhf' || act === 'radio') GlobeControl.flyToLatLng(u.lat, u.lng, 'comms', 1.4);
  },

  async run(action, opts) {
    const act = String(action || '').toLowerCase();
    GlobeDeck?.superAction(act, opts);
    this.setContext(this.inferContext());
    AciCli?.print('▸ ' + act, 'cmd');

    switch (act) {
      case 'locate':
        if (GlobeControl?.followMode === 'locate' && !GlobeControl?.userExploring) {
          GlobeControl.userTookGlobe('locate-off');
          AciCli?.print('Locate released — globe is yours', 'ok');
          break;
        }
        GlobeDeck?.expand?.(ACL_TITLE);
        locateMe?.();
        GlobeDeck?.finishCliIfOneShot('locate');
        break;
      case 'order':
        this.flyForTask('order');
        await Commerce?.showPicker?.(opts?.filter);
        this.setContext('commerce');
        break;
      case 'batch':
        this.flyForTask('batch');
        await AstranovNode?.launchBatch?.();
        this.setContext('batch');
        break;
      case 'vhf':
      case 'radio':
      case 'pmr':
        this.flyForTask('vhf');
        Comms?.startVHF?.();
        this.setContext('radio');
        break;
      case 'phone':
      case 'call':
        GlobeDeck?.hideStage();
        GlobeDeck?.expand(ACL_TITLE + ' — phone');
        this.setContext('phone');
        AciCli?.print('Type: call +30… (e.g. call +306912345678)', 'ok');
        ACIControl?.reply('Type call +number in Astranov Command Line');
        document.getElementById('aci-cli-in')?.focus();
        break;
      case 'news':
        this.flyForTask('news', opts);
        NewsFeed?.flash?.();
        this.setContext('news');
        GlobeDeck?.finishCliIfOneShot('news');
        break;
      case 'drive':
        DrivingView?.activate?.();
        this.setContext('drive');
        break;
      case 'add':
      case 'post':
      case 'superadd':
        SuperAdd?.open?.();
        this.setContext('add');
        break;
      case 'cli':
        GlobeDeck?.expand(ACL_TITLE);
        document.getElementById('aci-cli-in')?.focus();
        break;
      default:
        if (AciCli && act) await AciCli.run(act + (opts?.rest ? ' ' + opts.rest : ''));
    }
  },
};
window.SuperCli = SuperCli;