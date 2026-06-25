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
  },

  async openOnLogin() {
    if (!Auth?.user) return;
    this.show();
    if (window.AciConnect && !window._aciConnected) {
      await AciConnect.connect(false);
    }
    if (window.AciCoders) {
      await AciCoders.ensureBridge();
      AciCoders.armed = true;
      AciCoders.teamActive = true;
      AciCoders.updateHud();
    }
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
      ACIControl?.reply('Globe is your UI — sign in with G for full CLI');
      Auth?.signInGoogle();
      return;
    }
    this.open ? this.hide() : this.show();
  },

  show() {
    if (!Auth?.user) return;
    this.open = true;
    if (!this._welcomed) {
      this._welcomed = true;
      this.print('Collective CLI — tasks & conversation (globe stays primary)');
      if (Auth.isOwner) {
        this.print('OWNER — seed · distill · council · evolve · deploy');
      }
      this.print('coders = open Coders team — talk normally, control fallbacks');
      this.print('vendors · order · think <prompt> · help');
    }
    GlobeDeck?.expand('Collective CLI — tasks & conversation');
    document.getElementById('aci-cli-in')?.focus();
    MapDepict?.action('think', { detail: 'CLI open' });
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
    if (Auth?.client) {
      const { data } = await Auth.client.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.Authorization = 'Bearer ' + token;
      else headers.Authorization = 'Bearer ' + SB_KEY;
    } else {
      headers.Authorization = 'Bearer ' + SB_KEY;
    }
    const r = await fetch(SB_URL + '/functions/v1/aci', {
      method: 'POST', headers,
      body: JSON.stringify({ ...body, cli_user: Auth?.user?.id, cli_email: Auth?.user?.email })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !j.error) j.error = 'HTTP ' + r.status;
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

  async run(line) {
    GlobeDeck?.onUserMessage('CLI — ' + line.slice(0, 40));
    this.history.push(line);
    this.histIdx = -1;
    this.saveHistory();
    this.print((document.getElementById('aci-cli-prompt')?.textContent || '$') + ' ' + line, 'cmd');

    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = (parts[0] || '').toLowerCase().replace(/^"|"$/g, '');
    const rest = parts.slice(1).map(p => p.replace(/^"|"$/g, '')).join(' ');

    try {
      if (cmd === 'help' || cmd === '?') {
        this.print('think <prompt>  — ask collective AI');
        this.print('evolve [reason]  — autonomous evolution');
        this.print('teach <text>     — store memory / neuron');
        this.print('stats | owner    — memory / authority status');
        this.print('mode <athenian|spartan|myrmidon>');
        this.print('batch              — install node + launch work-together batch');
        this.print('vendors | order [items] | vendor menu | vendor requests | vhf | drive | news');
        this.print('  order pitogyra mpironia tsigareta — compare vendors on globe');
        if (Auth?.isOwner) {
          this.print('--- OWNER (notisastranov@gmail.com) ---');
          this.print('seed             — founding neurons');
          this.print('distill          — brain distillation');
          this.print('council list     — council cases');
          this.print('council convene <title> | <desc>');
        }
        this.print('coders                     — open conversational Coders team');
        this.print('<any text>                 — control fallbacks, ask status, give tasks');
        this.print('  e.g. why Composer down? · try XAI Grok · skip Anthropic');
        this.print('coders list | poll <id> | exit');
        this.print('connect | open     — link collective AI');
        this.print('deploy <task>      — deployment plan (owner)');
        this.print('roles              — your hats: client+driver+vendor');
        this.print('claim <order_id>   — take delivery (any logged-in driver)');
        if (Auth?.isOwner) this.print('field_stats        — field usage → brain (owner)');
        this.print('clear | exit | logout');
        this.print('…or any free text → think');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
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

      if (cmd === 'think') {
        if (!rest) { this.print('usage: think <prompt>', 'err'); return; }
        this.print('…', 'dim');
        if (!window._aciConnected) await AciConnect.connect(false);
        const r = await ACI.think(rest);
        this.print(r || '(empty)', 'out');
        ACIControl?.reply(r);
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
      if (cmd === 'batch') {
        await AstranovNode?.launchBatch?.();
        this.print('batch panel — install node then work together', 'ok');
        GlobeDeck.activeTask = 'batch';
        return;
      }
      if (cmd === 'vendors') {
        await Commerce.showPicker();
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
      if (cmd === 'locate' || cmd === 'gps' || cmd === 'me') {
        locateMe();
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'vhf') { Comms.startVHF(); this.print('PMR panel open', 'ok'); GlobeDeck.activeTask = 'radio'; return; }
      if (cmd === 'drive') {
        DrivingView?.activate?.();
        this.print('driving view (needs GPS speed)', 'ok');
        GlobeDeck?.finishCliIfOneShot(cmd);
        return;
      }
      if (cmd === 'news') { NewsFeed.flash(); this.print('news', 'ok'); GlobeDeck?.finishCliIfOneShot(cmd); return; }
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

      if (Auth?.user && line.length >= 1 && !/^(think|order|vendors|vendor|batch|help|deploy|connect|logout|clear|exit|close|locate|gps)\b/i.test(line)) {
        if (AciCoders?.teamActive || /^(add|fix|build|implement|create|remove|locate|why|try|skip|use)\b/i.test(line)) {
          GlobeDeck.activeTask = 'coders';
          await AciCoders.chat(line);
          if (AstranovNode?.batchId) AstranovNode.broadcastTask(line);
          return;
        }
      }
      if (!window._aciConnected) await AciConnect.connect(false);
      this.print('…', 'dim');
      const ans = await ACI.think(line);
      this.print(ans || '(empty)', 'out');
      ACIControl?.reply(ans);
      if (voiceSessionActive && Voice.shouldSpeak(ans)) speak(ans.slice(0, 200));
      GlobeDeck?.finishCliIfOneShot('think');
    } catch (err) {
      this.print('error: ' + (err.message || err), 'err');
    }
  }
};
window.AciCli = AciCli;