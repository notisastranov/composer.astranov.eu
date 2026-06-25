// === ASTRANOV CODERS TEAM ===
// coders → conversational team (Composer + fallback cycle control)
// Normal text: ask why Composer is down, try XAI Grok, skip Anthropic, build tasks, etc.
const AciCoders = {
  ready: false,
  teamActive: false,
  history: [],
  lastSummonId: null,
  engine: 'composer',
  armed: false,
  fallbackPrefs: { force: null, skip: [] },
  _pollTimer: null,

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('aci-coders-prefs') || '{}');
      if (p.skip) this.fallbackPrefs.skip = p.skip;
      if (p.force) this.fallbackPrefs.force = p.force;
    } catch (_) {}
  },

  savePrefs() {
    try { localStorage.setItem('aci-coders-prefs', JSON.stringify(this.fallbackPrefs)); } catch (_) {}
  },

  loadEngine() {
    this.engine = 'composer';
  },

  saveEngine() {},
  setEngine() { return true; },
  toggleEngine() { return true; },

  updateHud() {
    const hdr = document.querySelector('#aci-cli-header span');
    if (hdr && Auth?.user) {
      hdr.textContent = this.teamActive
        ? 'Collective CLI — coders team'
        : 'Collective CLI — coders';
    }
  },

  async ensureBridge() {
    if (!Auth?.user) return;
    this.loadPrefs();
    if (this.ready) { this.updateHud(); return; }
    this.ready = true;
    window._aciCodersReady = true;
  },

  async openTeam(intro) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required for Coders team');
      Auth?.signInGoogle();
      return;
    }
    await this.ensureBridge();
    this.teamActive = true;
    this.armed = true;
    this.engine = 'composer';
    this.updateHud();
    if (AciCli) {
      AciCli.print('◇ Coders team ONLINE — talk normally', 'ok');
      AciCli.print('  ask: why Composer down? · try XAI Grok · skip Anthropic · credits?', 'dim');
      AciCli.print('  or give a build task in plain language', 'dim');
    }
    const msg = intro && intro.trim().length > 0
      ? intro.trim()
      : 'Coders team online. Report Composer status, fallback roster, and await my instructions.';
    return this.chat(msg);
  },

  stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  startPoll(summonId) {
    this.stopPoll();
    if (!summonId) return;
    let tries = 0;
    this._pollTimer = setInterval(async () => {
      tries++;
      const r = await this.poll(summonId, true);
      if (r?.status === 'answered') this.stopPoll();
      if (tries > 36) this.stopPoll();
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
      if (r.pending) AciCli.print('#' + id + ' pending — Composer…', 'dim');
      else if (r.text) {
        AciCli.print('Composer #' + id + ': ' + r.text.slice(0, 900), 'out');
        this._recordReply(id, r.text);
      }
    }
    if (r.text && !r.pending) ACIControl?.reply('Composer #' + id + ': ' + r.text.slice(0, 160));
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
    this.history.push({ role: 'assistant', content: '[#' + id + '] ' + text });
    if (this.history.length > 20) this.history = this.history.slice(-20);
  },

  _applyResponse(r, userMsg) {
    if (r.fallback_prefs) {
      this.fallbackPrefs = r.fallback_prefs;
      this.savePrefs();
    }
    const text = r.text || r.response || r.error || '';
    if (r.summon_id) this.lastSummonId = r.summon_id;

    this.history.push({ role: 'user', content: userMsg });
    if (text) {
      this.history.push({ role: 'assistant', content: text });
      if (this.history.length > 20) this.history = this.history.slice(-20);
    }

    if (AciCli) {
      if (r.composer_status && !r.composer_status.ok) {
        AciCli.print('Composer: down — ' + (r.composer_status.reason || 'unknown'), 'dim');
      } else if (r.composer_status?.ok) {
        AciCli.print('Composer: up', 'dim');
      }
      if (r.fallback_prefs?.force) AciCli.print('prefs force → ' + r.fallback_prefs.force, 'dim');
      if (r.fallback_prefs?.skip?.length) AciCli.print('prefs skip → ' + r.fallback_prefs.skip.join(', '), 'dim');
      AciCli.print((r.label || 'Coders Team') + ': ' + text.slice(0, 900), r.ok !== false ? 'out' : 'err');
      if (r.pending && r.summon_id) AciCli.print('polling #' + r.summon_id + '…', 'dim');
    }
    ACIControl?.reply((r.label || 'Coders Team') + ': ' + text.slice(0, 150));

    if (r.pending && r.summon_id) this.startPoll(r.summon_id);
    else this.stopPoll();

    if (!r.pending && Voice.maySpeak() && Voice.shouldSpeak(text)) {
      speak(text.slice(0, 120), () => resumeListening());
    }
    return r;
  },

  isBuildTask(m) {
    const s = String(m || '').toLowerCase();
    if (/^(why|what|how|do we|list|status|credits|explain|try|skip|use)\b/.test(s)) return false;
    return /fix|build|implement|add|create|remove|button|locate|globe|vendor|order|mobile|φτιάξε|πρόσθεσε/.test(s) && s.length >= 8;
  },

  async queueComposer(task) {
    if (AciCli) AciCli.print('queuing Composer…', 'dim');
    const q = await AciCli.api({
      mode: 'coders',
      task: task,
      coder_engine: 'composer',
      history: this.history.slice(-6),
      fallback_prefs: this.fallbackPrefs,
    });
    if (q.error && AciCli) AciCli.print('queue error: ' + q.error, 'err');
    if (q.summon_id) {
      this.lastSummonId = q.summon_id;
      if (AciCli) {
        AciCli.print('summon #' + q.summon_id + (q.pending ? ' · Composer queued' : ' · ' + (q.via || 'answered')), q.pending ? 'ok' : 'out');
        if (q.pending) AciCli.print('polling… coders poll ' + q.summon_id, 'dim');
      }
      if (q.pending) this.startPoll(q.summon_id);
    }
    return q;
  },

  async chat(message) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required');
      Auth?.signInGoogle();
      return { error: 'login required' };
    }
    const m = String(message || '').trim();
    if (m.length < 1) return { error: 'empty' };

    this.teamActive = true;
    this.armed = true;
    this.updateHud();
    MapDepict?.action('think', { detail: 'coders: ' + m.slice(0, 40) });

    try {
      if (/locate\s+me|locate\s+button|🎯|📍/i.test(m)) {
        locateMe();
      }

      let q = null;
      if (this.isBuildTask(m)) {
        q = await this.queueComposer(m);
        if (q.text && !q.error) {
          return this._applyResponse({ ...q, label: q.label || 'Astranov Coders · Composer', team: true }, m);
        }
      }

      if (AciCli) AciCli.print('coders team…', 'dim');
      const r = await AciCli.api({
        mode: 'coders_chat',
        message: m,
        history: this.history.slice(-10),
        fallback_prefs: this.fallbackPrefs,
      });

      if (r.error && !q) {
        if (this.isBuildTask(m)) {
          q = await this.queueComposer(m);
          if (q.summon_id) return this._applyResponse({ ...q, text: (q.text || '') + '\n(chat fallback → Composer queue)', team: true }, m);
        }
        if (AciCli) AciCli.print('coders error: ' + r.error, 'err');
        ACIControl?.reply('Coders error: ' + r.error);
        return r;
      }

      if (this.isBuildTask(m) && !r.summon_id && !q) {
        q = await this.queueComposer(m);
        if (q.summon_id) {
          r.summon_id = q.summon_id;
          r.pending = q.pending;
          r.text = (r.text || r.response || '') + '\n\n[Queued Composer #' + q.summon_id + ']';
          r.response = r.text;
        }
      }

      return this._applyResponse(r, m);
    } catch (e) {
      const msg = String(e.message || e);
      if (AciCli) AciCli.print('coders failed: ' + msg, 'err');
      ACIControl?.reply('Coders failed: ' + msg);
      if (this.isBuildTask(m)) return this.queueComposer(m);
      return { error: msg };
    }
  },

  async handleCodersCommand(rest) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required');
      Auth?.signInGoogle();
      return { error: 'login required' };
    }
    await this.ensureBridge();
    const parts = String(rest || '').trim().split(/\s+/);
    const sub = (parts[0] || '').toLowerCase();

    if (sub === 'list') return this.listSummons();
    if (sub === 'poll' || sub === 'status') {
      const id = parts[1] ? parseInt(parts[1], 10) : this.lastSummonId;
      return this.poll(id, false);
    }
    if (sub === 'exit' || sub === 'close' || sub === 'leave') {
      this.teamActive = false;
      if (AciCli) AciCli.print('coders team closed', 'ok');
      this.updateHud();
      return { ok: true };
    }

    if (!rest || !rest.trim()) return this.openTeam();

    const task = sub === 'grok' || sub === 'composer' ? parts.slice(1).join(' ') : rest;
    if ((sub === 'grok' || sub === 'composer') && task.length < 3) {
      this.fallbackPrefs.force = sub === 'grok' ? 'xai' : 'composer';
      this.savePrefs();
      return this.chat('use ' + sub + ' from now on');
    }

    this.teamActive = true;
    return this.chat(rest);
  },

  async summon(task) {
    return this.chat(task);
  },
};
window.AciCoders = AciCoders;