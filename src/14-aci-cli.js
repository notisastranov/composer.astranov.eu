// === ACI CLI — Collective dev terminal (login required) ===
const AciCli = {
  open: false,
  history: [],
  histIdx: -1,
  buffer: '',

  init() {
    const input = document.getElementById('aci-cli-in');
    const toggle = document.getElementById('aci-cli-toggle');
    if (toggle) toggle.onclick = () => this.toggle();
    SuperCli?.bindInputBar?.();
    if (input) {
      input.addEventListener('keydown', e => this.onKey(e));
      input.addEventListener('input', () => { this.buffer = input.value; });
    }
    window.addEventListener('keydown', e => {
      if (!Auth?.user) return;
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !/aci-cli-in|aci-input/.test(document.activeElement?.id || '')) {
        e.preventDefault();
        this.toggle();
      }
    });
    this.onAuthChange();
  },

  onAuthChange() {
    const toggle = document.getElementById('aci-cli-toggle');
    const logged = !!(Auth && Auth.user);
    if (toggle) toggle.style.display = 'inline-flex';
    if (!logged) {
      this._welcomed = false;
      this._sessionOpened = false;
      this.hide();
      GlobeDeck?.collapse();
      return;
    }
    const name = Auth.user.user_metadata?.full_name || Auth.user.email?.split('@')[0] || 'dev';
    const prompt = document.getElementById('aci-cli-prompt');
    if (prompt) prompt.textContent = name + '@collective $';
    this.loadHistory();
    if (!this._sessionOpened) {
      this._sessionOpened = true;
      setTimeout(() => this.openOnLogin(), 500);
    }
    if (window.AciCoders) AciCoders.autoStart();
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  },

  async openOnLogin() {
    if (!Auth?.user) return;
    this.show();
    if (window.AciCoders) await AciCoders.autoStart();
  },

  loadHistory() {
    try {
      const key = 'aci-cli-' + (Auth.user?.id || 'anon');
      this.history = JSON.parse(localStorage.getItem(key) || '[]');
    } catch { this.history = []; }
  },

  saveHistory() {
    try {
      const key = 'aci-cli-' + (Auth.user?.id || 'anon');
      localStorage.setItem(key, JSON.stringify(this.history.slice(-80)));
    } catch (_) {}
  },

  toggle() {
    if (!Auth?.user) {
      GlobeDeck?.onUserMessage('Guest — Astranov Command Line');
      this.showGuest();
      return;
    }
    GlobeDeck?.toggle();
    this.open = !!GlobeDeck?.expanded;
  },

  showGuest() {
    this.open = true;
    AciCoders?.autoStart?.();
    GlobeDeck?.expand('Coders online — Justice → Truth → Freedom · G to sign in');
    if (!this._guestWelcomed) {
      this._guestWelcomed = true;
      this.print('Coders always on — dev on · ui status · brain status · G for sync', 'dim');
    }
    document.getElementById('aci-cli-in')?.focus();
  },

  show() {
    if (!Auth?.user) return;
    this.open = true;
    AciCoders?.autoStart?.();
    if (!this._welcomed) {
      this._welcomed = true;
      this.print('Coders always on — dev on for full brain+UI · help', 'dim');
    }
    GlobeDeck?.expand('Collective Coders — talk here');
    document.getElementById('aci-cli-in')?.focus();
  },

  hide() {
    this.open = false;
    GlobeDeck?.collapse();
  },

  print(text, cls) {
    GlobeDeck?.log(text, cls || 'out');
  },

  async api(body) {
    const headers = { 'Content-Type': 'application/json', apikey: SB_KEY };
    if (Auth?.ensureSession) {
      const session = await Auth.ensureSession();
      headers.Authorization = session?.access_token ? 'Bearer ' + session.access_token : 'Bearer ' + SB_KEY;
    } else if (Auth?.client) {
      const { data } = await Auth.client.auth.getSession();
      const token = data?.session?.access_token;
      headers.Authorization = token ? 'Bearer ' + token : 'Bearer ' + SB_KEY;
    } else {
      headers.Authorization = 'Bearer ' + SB_KEY;
    }
    const j = await fetchJson(SB_URL + '/functions/v1/aci', {
      method: 'POST', headers,
      body: JSON.stringify({ ...body, cli_user: Auth?.user?.id, cli_email: Auth?.user?.email })
    }, 55000);
    if (j._httpStatus === 401) j.error = j.error || 'login required — tap G to sign in';
    return j;
  },

  onKey(e) {
    const input = document.getElementById('aci-cli-in');
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = (input?.value || '').trim();
      if (!line) return;
      input.value = '';
      this.buffer = '';
      this.run(line);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.history.length) {
        this.histIdx = Math.max(0, this.histIdx < 0 ? this.history.length - 1 : this.histIdx - 1);
        input.value = this.history[this.histIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.histIdx >= 0) {
        this.histIdx++;
        input.value = this.histIdx < this.history.length ? this.history[this.histIdx] : '';
      }
    } else if (e.key === 'Escape') {
      this.hide();
    }
  },

  async run(line, opts = {}) {
    GlobeDeck?.onUserMessage('CLI — ' + line.slice(0, 40));
    this.history.push(line);
    this.histIdx = -1;
    this.saveHistory();
    this.print((document.getElementById('aci-cli-prompt')?.textContent || '$') + ' ' + line, 'cmd');

    const routed = await SuperCli?.exec?.(line, opts);
    if (routed?.handled) return;

    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = (parts[0] || '').toLowerCase().replace(/^"|"$/g, '');
    const rest = parts.slice(1).map(p => p.replace(/^"|"$/g, '')).join(' ');

    try {
      if (cmd === 'coders' || cmd === 'composer' || cmd === 'cursor' ||
          (cmd === 'summon' && /^coders?$/i.test(parts[1] || ''))) {
        const task = cmd === 'summon' ? parts.slice(2).join(' ')
          : (cmd === 'coders' ? rest : rest || '');
        GlobeDeck.activeTask = 'coders';
        await AciCoders?.handleCodersCommand(cmd === 'composer' || cmd === 'cursor' ? ('composer ' + task).trim() : task);
        return;
      }
      if (cmd === 'grok') {
        GlobeDeck.activeTask = 'coders';
        await AciCoders?.handleCodersCommand(rest ? ('grok ' + rest) : 'grok');
        return;
      }
      if (cmd === 'connect' || cmd === 'open') {
        await AciConnect.connect(cmd === 'open');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'deploy') {
        await AciConnect.deploy(rest || 'continue deployment');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'clear') {
        GlobeDeck?.clearLog();
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'exit' || cmd === 'close') { GlobeDeck?.completeTask('cli'); return; }
      if (cmd === 'logout') { await Auth.signOut(); this.print('signed out', 'ok'); return; }

      if (cmd === 'theme' || cmd === 'dark' || cmd === 'bright' || cmd === 'light') {
        const mode = cmd === 'theme' ? (parts[1] || '').toLowerCase() : (cmd === 'light' ? 'bright' : cmd);
        if (mode === 'dark' || mode === 'bright') AstranovTheme?.set?.(mode);
        else AstranovTheme?.toggle?.();
        this.print('theme → ' + (AstranovTheme?.mode || 'dark'), 'ok');
        return;
      }
      if (cmd === 'think') {
        if (!rest) { ACIControl?.reply('usage: think <prompt>'); return; }
        const r = await ACI.think(rest);
        ACIControl?.reply(r || '(empty)');
        if (voiceSessionActive && Voice.shouldSpeak(r)) speak(r.slice(0, 200));
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'evolve') {
        this.print('evolving…', 'dim');
        const r = await ACI.evolve(rest || 'cli');
        this.print(JSON.stringify(r || { ok: true }).slice(0, 400), 'out');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'teach') {
        if (!rest) { this.print('usage: teach <content>', 'err'); return; }
        await ACI.teach(rest);
        this.print('remembered · neuron spawned', 'ok');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'stats' || cmd === 'owner') {
        const r = await this.api({ mode: cmd === 'owner' ? 'owner_sync' : 'stats' });
        this.print(JSON.stringify(r, null, 0).slice(0, 600), 'out');
        if (r.is_owner) Auth.isOwner = true;
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'seed') {
        if (!Auth?.isOwner) { this.print('owner only — login as notisastranov@gmail.com', 'err'); return; }
        const r = await this.api({ mode: 'seed' });
        this.print(JSON.stringify(r).slice(0, 400), 'out');
        await ACI.init();
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'distill') {
        if (!Auth?.isOwner) { this.print('owner only', 'err'); return; }
        this.print('distilling…', 'dim');
        const r = await this.api({ mode: 'distill' });
        this.print(JSON.stringify(r).slice(0, 500), 'out');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'council') {
        if (!Auth?.isOwner) { this.print('owner only', 'err'); return; }
        const sub = (parts[1] || 'list').toLowerCase();
        const title = parts[2] || '';
        const desc = parts.slice(3).join(' ') || rest.replace(/^convene\s*/i, '');
        const body = { mode: 'council', council_mode: sub };
        if (sub === 'convene') { body.title = title || 'CLI case'; body.description = desc || title; }
        const r = await this.api(body);
        this.print(JSON.stringify(r).slice(0, 600), 'out');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'mode') {
        ACI.thinkMode = rest || '';
        this.print('mode: ' + (ACI.thinkMode || 'default'), 'ok');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'batch') { await SuperCli?.run('batch'); return; }
      if (cmd === 'vendors' || cmd === 'shops') {
        await SuperCli?.run('order');
        this.print('vendor picker open — tap globe or list', 'ok');
        GlobeDeck.activeTask = 'commerce';
        return;
      }
      if (cmd === 'order') {
        await Commerce.openOrderFlow(rest);
        this.print(rest ? 'order · ' + rest : 'pick vendor — real menu only', 'ok');
        GlobeDeck.activeTask = 'commerce';
        return;
      }
      if (cmd === 'book' || cmd === 'booker' || cmd === 'site' || cmd === 'sites') {
        try {
          const prov = window.AstranovSitesProvision || window.SuperBookingProvision;
          const r = await prov?.cli?.(parts);
          if (r?.error) { this.print(r.error, 'err'); GlobeDeck?.finishCliIfOneShot(cmd); return; }
          if (r?.sites) {
            if (!r.sites.length) { this.print('no Astranov Sites yet — site create my-name', 'dim'); }
            else r.sites.forEach(s => this.print((s.domain || s.id) + ' · ' + s.business_type + ' · ' + s.mode, 'ok'));
            GlobeDeck?.finishCliIfOneShot(cmd);
            return;
          }
          if (r?.url) this.print('live → ' + r.url, 'ok');
          GlobeDeck?.finishCliIfOneShot(cmd);
        } catch (e) {
          this.print(e.message || String(e), 'err');
          GlobeDeck?.finishCliIfOneShot(cmd);
        }
        return;
      }
      if (cmd === 'vendor') {
        const sub = (parts[1] || '').toLowerCase();
        if (sub === 'menu') {
          const r = await Commerce.cliVendorMenu(parts.slice(2));
          if (r.error) { this.print(r.error, 'err'); GlobeDeck?.finishCliIfOneShot('vendor'); return; }
          if (r.vendors) {
            r.vendors.forEach(v => this.print(v.name + ' · ' + v.items + ' items · ' + v.id, 'ok'));
            GlobeDeck?.finishCliIfOneShot('vendor');
            return;
          }
          if (r.menu) {
            this.print(r.vendor + ' menu:', 'ok');
            r.menu.forEach(i => this.print('  ' + i.name + ' · ' + i.price + ' AVC', 'dim'));
            GlobeDeck?.finishCliIfOneShot('vendor');
            return;
          }
          this.print(r.message || JSON.stringify(r), 'ok');
          GlobeDeck?.finishCliIfOneShot('vendor');
          return;
        }
        if (sub === 'requests') {
          const r = await Commerce.listMenuRequests();
          if (r.error) { this.print(r.error, 'err'); GlobeDeck?.finishCliIfOneShot('vendor'); return; }
          if (!r.requests?.length) { this.print('no pending menu requests', 'dim'); GlobeDeck?.finishCliIfOneShot('vendor'); return; }
          r.requests.forEach(req => this.print((req.vendor_name || req.vendor_id) + ' · ' + (req.notes || 'menu needed') + ' · ' + req.id.slice(0, 8), 'ok'));
          GlobeDeck?.finishCliIfOneShot('vendor');
          return;
        }
        this.print('usage: vendor menu list|add|show|clear | vendor requests', 'err');
        GlobeDeck?.finishCliIfOneShot('vendor');
        return;
      }
      if (cmd === 'ping') {
        const r = await ACI.think('ping');
        ACIControl?.reply(r || 'pong');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'locate' || cmd === 'gps' || cmd === 'me') {
        await SuperCli?.run('locate');
        return;
      }
      if (cmd === 'vhf') { await SuperCli?.run('vhf'); return; }
      if (cmd === 'call' || cmd === 'phone') {
        const num = rest || parts.slice(1).join(' ');
        if (num && /^\+?\d/.test(num)) {
          MapDepict?.action('phone', { detail: num });
          window.location.href = 'tel:' + num.replace(/\s/g, '');
          this.print('calling ' + num, 'ok');
        } else {
          await SuperCli?.run('phone');
        }
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'drive') {
        DrivingView?.activate?.();
        this.print('driving view (needs GPS speed)', 'ok');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'news') { NewsFeed.flash(); this.print('news', 'ok'); GlobeDeck?.finishCliIfOneShot(cmd); return; }
      if (cmd === 'youtube' || cmd === 'yt') {
        await GlobeVideo?.find?.(rest);
        GlobeDeck.activeTask = 'video';
        return;
      }
      if (cmd === 'watch' || cmd === 'play') {
        if (/^\d+$/.test(rest)) { await GlobeVideo?.playIndex?.(rest); return; }
        const id = GlobeVideo?.parseId?.(rest);
        if (id) { await GlobeVideo?.play?.(id, { title: rest }); return; }
      }
      if (cmd === 'space' || cmd === 'superspace') {
        const sub = (parts[1] || 'status').toLowerCase();
        if (sub === 'status') {
          this.print(JSON.stringify(SuperSpace?.status?.(), null, 0), 'out');
          GlobeDeck?.finishCliIfOneShot('space');
          return;
        }
        const topic = parts.slice(/^(locate|find|place)$/.test(sub) ? 2 : 1).join(' ') || rest;
        if (topic) await SuperSpace?.locateText?.(topic);
        else this.print(JSON.stringify(SuperSpace?.status?.(), null, 0), 'out');
        return;
      }
      if (cmd === 'roles') {
        await FieldBrain?.onAuth();
        this.print('roles: ' + (FieldBrain?.roles || []).join(' + '), 'ok');
        if (FieldBrain?.vendorIds?.length) this.print('vendors: ' + FieldBrain.vendorIds.join(', '), 'dim');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'claim') {
        if (!rest) { this.print('usage: claim <order_id>', 'err'); return; }
        const r = await FieldBrain?.claimDelivery(rest);
        this.print(r?.ok ? 'claimed ' + (r.short_id || rest) : (r?.error || 'failed'), r?.ok ? 'ok' : 'err');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'field_stats') {
        if (!Auth?.isOwner) { this.print('owner only', 'err'); return; }
        const r = await this.api({ mode: 'field_stats' });
        this.print(JSON.stringify(r).slice(0, 700), 'out');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }

      GlobeDeck.activeTask = 'coders';
      await AciCoders?.handleMessage(line);
      if (AstranovNode?.batchId) AstranovNode.broadcastTask(line);
      if (!AciCoders?.alwaysOn) GlobeDeck?.finishCliIfOneShot('coders');
    } catch (err) {
      GlobeDeck?.setThinking(false);
      const msg = 'error: ' + (err.message || err);
      this.print(msg, 'err');
      GlobeDeck?.showError(msg);
    }
  }
};
window.AciCli = AciCli;