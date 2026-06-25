// === ASTRANOV CODERS BRIDGE ===
// grok     → xAI Grok (sync reply in CLI)
// composer → Cursor Composer queue (async — poll for answer)
const AciCoders = {
  ready: false,
  history: [],
  lastSummonId: null,
  engine: 'grok',
  _pollTimer: null,

  loadEngine() {
    try {
      const e = localStorage.getItem('aci-coders-engine');
      if (e === 'composer' || e === 'grok') this.engine = e;
    } catch (_) {}
  },

  saveEngine() {
    try { localStorage.setItem('aci-coders-engine', this.engine); } catch (_) {}
  },

  setEngine(name) {
    const e = String(name || '').toLowerCase();
    if (e !== 'grok' && e !== 'composer') return false;
    this.engine = e;
    this.saveEngine();
    this.updateHud();
    return true;
  },

  toggleEngine() {
    return this.setEngine(this.engine === 'grok' ? 'composer' : 'grok');
  },

  updateHud() {
    const hdr = document.querySelector('#aci-cli-header span');
    if (hdr && Auth?.user) {
      const tag = this.engine === 'composer' ? 'Cursor Composer' : 'Grok';
      hdr.textContent = 'Collective CLI — coders · ' + tag;
    }
  },

  async ensureBridge() {
    if (!Auth?.user) return;
    this.loadEngine();
    if (this.ready) {
      this.updateHud();
      return;
    }
    this.ready = true;
    if (AciCli) {
      AciCli.print('◇ Astranov Coders bridge ONLINE', 'ok');
      AciCli.print('  grok → xAI (instant)  ·  composer → Cursor queue (poll)', 'dim');
      AciCli.print('  coders use grok|composer  ·  coders switch  ·  coders list', 'dim');
    }
    this.updateHud();
    window._aciCodersReady = true;
  },

  stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  startPoll(summonId) {
    this.stopPoll();
    if (!summonId) return;
    let tries = 0;
    this._pollTimer = setInterval(async () => {
      tries++;
      const r = await this.poll(summonId, true);
      if (r?.status === 'answered' || tries > 36) this.stopPoll();
    }, 5000);
  },

  async poll(summonId, quiet) {
    const id = summonId || this.lastSummonId;
    if (!id) {
      if (!quiet && AciCli) AciCli.print('usage: coders poll <summon_id>', 'err');
      return { error: 'no id' };
    }
    const r = await AciCli.api({ mode: 'coders_poll', summon_id: id });
    if (!quiet && AciCli) {
      if (r.pending) {
        AciCli.print('#' + id + ' pending — Cursor Composer working…', 'dim');
      } else if (r.text) {
        AciCli.print('Composer #' + id + ': ' + r.text.slice(0, 900), 'out');
        this._recordReply(id, r.text);
      } else {
        AciCli.print('#' + id + ' status: ' + (r.status || 'unknown'), 'dim');
      }
    }
    if (r.text && !r.pending) {
      ACIControl?.reply('Composer #' + id + ': ' + r.text.slice(0, 160));
    }
    return r;
  },

  async listSummons() {
    const r = await AciCli.api({ mode: 'coders_list' });
    if (!r.summons?.length) {
      if (AciCli) AciCli.print('no coders summons yet', 'dim');
      return r;
    }
    if (AciCli) {
      AciCli.print('── coders summons ──', 'dim');
      r.summons.forEach(s => {
        AciCli.print('#' + s.id + ' [' + s.status + '] ' + s.engine + ' — ' + s.question, s.status === 'open' ? 'dim' : 'ok');
      });
    }
    return r;
  },

  _recordReply(id, text) {
    this.history.push({ role: 'assistant', content: '[composer #' + id + '] ' + text });
    if (this.history.length > 16) this.history = this.history.slice(-16);
  },

  async handleCodersCommand(rest) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required to summon Astranov Coders');
      Auth?.signInGoogle();
      return { error: 'login required' };
    }
    await this.ensureBridge();
    const parts = String(rest || '').trim().split(/\s+/);
    const sub = (parts[0] || '').toLowerCase();

    if (sub === 'use' && parts[1]) {
      if (this.setEngine(parts[1])) {
        const tag = this.engine === 'composer' ? 'Cursor Composer' : 'Grok/xAI';
        if (AciCli) AciCli.print('Coders → ' + tag, 'ok');
        ACIControl?.reply('Coders: ' + tag);
        return { ok: true, coder_engine: this.engine };
      }
      if (AciCli) AciCli.print('usage: coders use grok|composer', 'err');
      return { error: 'bad engine' };
    }
    if (sub === 'engine') {
      const tag = this.engine === 'composer' ? 'Cursor Composer (async)' : 'Grok (sync)';
      if (AciCli) AciCli.print('active: ' + tag, 'ok');
      ACIControl?.reply('Coders: ' + tag);
      return { ok: true, coder_engine: this.engine };
    }
    if (sub === 'switch' || sub === 'toggle') {
      this.toggleEngine();
      const tag = this.engine === 'composer' ? 'Cursor Composer' : 'Grok';
      if (AciCli) AciCli.print('switched → ' + tag, 'ok');
      ACIControl?.reply('Coders: ' + tag);
      return { ok: true, coder_engine: this.engine };
    }
    if (sub === 'list') return this.listSummons();
    if (sub === 'poll' || sub === 'status') {
      const id = parts[1] ? parseInt(parts[1], 10) : this.lastSummonId;
      return this.poll(id, false);
    }
    if (sub === 'grok' || sub === 'composer') {
      const task = parts.slice(1).join(' ');
      if (task.length < 3) {
        this.setEngine(sub);
        const tag = sub === 'composer' ? 'Cursor Composer' : 'Grok';
        if (AciCli) AciCli.print('engine → ' + tag + '. Now: coders <task>', 'ok');
        return { ok: true, coder_engine: this.engine };
      }
      const prev = this.engine;
      this.setEngine(sub);
      const r = await this.summon(task);
      if (r?.error) this.engine = prev;
      return r;
    }
    if (!rest || rest.length < 3) {
      if (AciCli) AciCli.print('usage: coders <task> | coders poll <id> | coders list', 'err');
      return { error: 'usage' };
    }
    return this.summon(rest);
  },

  async summon(task) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required to summon Astranov Coders');
      Auth?.signInGoogle();
      return { error: 'login required' };
    }
    this.loadEngine();
    const t = String(task || '').trim();
    if (t.length < 3) {
      if (AciCli) AciCli.print('usage: coders <what to build or fix>', 'err');
      return { error: 'task required' };
    }

    if (!window._aciConnected && window.AciConnect) await AciConnect.connect(false);
    const tag = this.engine === 'composer' ? 'Cursor Composer' : 'Grok';
    if (AciCli) AciCli.print('summoning ' + tag + '…', 'dim');
    MapDepict?.action('think', { detail: tag + ': ' + t.slice(0, 48) });

    const r = await AciCli.api({
      mode: 'coders',
      task: t,
      coder_engine: this.engine,
      history: this.history.slice(-6),
    });

    const text = r.text || r.response || r.error || '';
    const label = r.label || ('Astranov Coders · ' + tag);
    if (r.summon_id) this.lastSummonId = r.summon_id;
    if (r.coder_engine) this.setEngine(r.coder_engine);

    this.history.push({ role: 'user', content: '[' + this.engine + '] ' + t });
    if (text && !r.error) {
      this.history.push({ role: 'assistant', content: text });
      if (this.history.length > 16) this.history = this.history.slice(-16);
    }

    if (AciCli) {
      if (r.summon_id) {
        AciCli.print('summon #' + r.summon_id + ' · ' + tag + (r.via ? ' · ' + r.via : ''), r.pending ? 'dim' : 'ok');
      }
      AciCli.print(label + ': ' + text.slice(0, 880), r.ok !== false ? 'out' : 'err');
      if (r.pending) AciCli.print('polling… type: coders poll ' + r.summon_id, 'dim');
    }
    ACIControl?.reply(label + (r.summon_id ? ' #' + r.summon_id : '') + ': ' + text.slice(0, 150));

    if (r.pending && r.summon_id) this.startPoll(r.summon_id);
    else this.stopPoll();

    if (!r.pending && Voice.maySpeak() && Voice.shouldSpeak(text)) {
      speak(text.slice(0, 120), () => resumeListening());
    }

    return r;
  }
};
window.AciCoders = AciCoders;