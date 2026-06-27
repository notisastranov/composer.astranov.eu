// === ASTRANOV CODERS — always online for all users ===
// Justice → Truth → Freedom (exact order) is the immutable boundary.
const AciCoders = {
  ready: false,
  alwaysOn: true,
  teamActive: true,
  history: [],
  lastSummonId: null,
  engine: 'grok',
  armed: false,
  fallbackPrefs: { force: null, skip: [] },
  _pollTimer: null,
  _listenTimer: null,
  _evolveTimer: null,
  _started: false,
  _listening: false,
  _listenBusy: false,
  _activityBuffer: [],
  _activityCount: 0,
  _listenTicks: 0,
  _lastListenAt: 0,

  CAUSE: 'Justice → Truth → Freedom',
  LISTEN_MS: 120000,
  _cliBusy: false,
  EVOLVE_MS: 180000,

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('aci-coders-prefs') || '{}');
      if (p.skip) this.fallbackPrefs.skip = p.skip;
      if (p.force) this.fallbackPrefs.force = p.force;
      if (p.causeJudge) this.fallbackPrefs.causeJudge = p.causeJudge;
    } catch (_) {}
  },

  savePrefs() {
    try { localStorage.setItem('aci-coders-prefs', JSON.stringify(this.fallbackPrefs)); } catch (_) {}
  },

  isPowerUser() {
    return !!(Auth?.isOwner || Auth?.isArchitect);
  },

  isExplicitRef(raw) {
    const s = String(raw || '').trim();
    return /^(coders|composer|cursor|summon\s+coders?)\b/i.test(s) || /^@coders\b/i.test(s);
  },

  parseCauseJudge(text) {
    if (!this.isPowerUser()) return null;
    const s = String(text || '');
    if (!/priorit|judge|cause|justice|truth|freedom|δικαιοσύνη|αλήθεια|ελευθερία|κριτ|σειρά/i.test(s)) return null;
    return { ruling: s.slice(0, 500) };
  },

  loadEngine() {
    this.engine = this.fallbackPrefs.force === 'composer' ? 'composer' : 'grok';
  },

  setEngine(eng) {
    this.engine = eng === 'composer' ? 'composer' : 'grok';
    this.fallbackPrefs.force = eng === 'composer' ? 'composer' : 'xai';
    this.savePrefs();
    return true;
  },
  toggleEngine() {
    return this.setEngine(this.engine === 'composer' ? 'grok' : 'composer');
  },

  updateHud() {
    const listen = this._listening ? ' · listening' : '';
    const evo = this._activityCount > 0 ? ' · evolving' : '';
    const judge = this.isPowerUser() ? ' · JUDGE' : '';
    const title = (this.isPowerUser() ? 'Architect · ' : 'Collective ') + 'Coders · ' + this.CAUSE + judge + listen + (Auth?.user ? '' : ' · guest');
    GlobeDeck?.setTitle(title);
    GlobeDeck?.setMapStatus?.('Coders ' + (this._listening ? 'listening · evolving' : 'online') + (this.isPowerUser() ? ' · orders execute' : ''));
  },

  observeActivity(source, detail, props) {
    const d = String(detail || source || '').slice(0, 120);
    if (!d) return;
    this._activityBuffer.push({ source: String(source || 'field'), detail: d, ts: Date.now(), props: props || {} });
    if (this._activityBuffer.length > 48) this._activityBuffer = this._activityBuffer.slice(-48);
    this._activityCount++;
    this.updateHud();
  },

  _buildDigest() {
    const recent = this._activityBuffer.slice(-14);
    if (!recent.length) return '';
    return recent.map(e => e.source + ':' + e.detail).join(' · ').slice(0, 1200);
  },

  startListening() {
    if (this._listenTimer) return;
    this._listening = true;
    this.updateHud();
    this._listenTimer = setInterval(() => this.listenTick(), this.LISTEN_MS);
    this._evolveTimer = setInterval(() => this.evolveTick(), this.EVOLVE_MS);
    setTimeout(() => this.listenTick(), 20000);
  },

  stopListening() {
    if (this._listenTimer) { clearInterval(this._listenTimer); this._listenTimer = null; }
    if (this._evolveTimer) { clearInterval(this._evolveTimer); this._evolveTimer = null; }
    this._listening = false;
  },

  async listenTick() {
    if (this._cliBusy || this._listenBusy) return;
    this._listenBusy = true;
    this._listenTicks++;
    try {
      const digest = this._buildDigest();
      const eventCount = this._activityBuffer.length;
      const evolve = eventCount >= 3 || this._listenTicks % 3 === 0;
      const r = await AciCli.api({
        mode: 'coders_listen',
        activity: digest || 'heartbeat · coders online',
        event_count: eventCount,
        evolve,
      });
      this._lastListenAt = Date.now();
      if (r.ok) this._applyListenResult(r);
    } catch (_) {
      /* retry next tick */
    } finally {
      this._listenBusy = false;
    }
  },

  _applyListenResult(r) {
    if (r.principles?.length) ACI?.syncNeuronsFromPrinciples?.(r.principles);
    if (r.evolved) {
      MapDepict?.action('evolve', { detail: 'coders listen · brain evolved' });
      ACI?.pulse?.(1.35);
      for (let i = 0; i < 2; i++) {
        ACI?.spawnNeuron?.(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 120,
          1.1 + Math.random() * 0.3,
          r.improvement?.slice(0, 80) || 'collective neuron'
        );
      }
    }
    if (r.improvement && !document.hidden) {
      GlobeDeck?.log?.('Coders · ' + r.improvement.slice(0, 160), 'dim');
    }
    this._activityBuffer = this._activityBuffer.slice(-6);
    this._activityCount = Math.max(0, this._activityCount - 2);
    this.updateHud();
  },

  async evolveTick() {
    if (this._activityCount < 2) return;
    try {
      await ACI?.evolve?.('coders-active-listen');
      this._activityCount = Math.max(0, this._activityCount - 3);
      this.updateHud();
    } catch (_) {}
  },

  async ensureSession() {
    if (!Auth?.user) return true;
    const session = await Auth.ensureSession?.();
    if (!session?.access_token) {
      GlobeDeck?.showError('Session expired — tap G to sign in again');
      return false;
    }
    return true;
  },

  async ensureBridge() {
    this.loadPrefs();
    this.loadEngine();
    if (this.ready) { this.updateHud(); return; }
    this.ready = true;
    window._aciCodersReady = true;
    this.updateHud();
  },

  async autoStart() {
    this.alwaysOn = true;
    this.teamActive = true;
    this.armed = true;
    await this.ensureBridge();
    if (GlobeDeck) GlobeDeck.activeTask = 'coders';
    this.updateHud();
    if (this._started) {
      this.startListening();
      return;
    }
    this._started = true;
    window._aciCodersAlwaysOn = true;
    this.startListening();
  },

  /** Strip optional legacy "coders" prefix — coders listen to all messages. */
  normalizeMessage(message) {
    return String(message || '').trim()
      .replace(/^summon\s+coders?\s*/i, '')
      .replace(/^coders\s+/i, '')
      .trim();
  },

  async handleMessage(message) {
    const raw = String(message || '').trim();
    if (!raw) return { error: 'empty' };

    const parts = raw.split(/\s+/);
    const sub = (parts[0] || '').toLowerCase();

    if (/^coders\b/i.test(raw)) {
      if (sub === 'list') return this.listSummons();
      if (sub === 'poll' || sub === 'status') {
        const id = parts[1] ? parseInt(parts[1], 10) : this.lastSummonId;
        return this.poll(id, false);
      }
      if (sub === 'exit' || sub === 'close' || sub === 'leave') {
        AciCli?.print('Coders stay always on — Justice → Truth → Freedom', 'ok');
        ACIControl?.reply('Coders always active — building the collective brain');
        return { ok: true, always_on: true };
      }
      if (sub === 'grok' || sub === 'composer') {
        const task = parts.slice(1).join(' ');
        if (task.length < 3) {
          this.setEngine(sub);
          return this.chat('use ' + sub + ' from now on');
        }
      }
    }

    if (this.isPowerUser() && this.isExplicitRef(raw)) {
      const task = this.normalizeMessage(raw) || raw;
      if (/^deploy\b/i.test(task)) {
        return this.executeOrder(task, raw, { deploy: true });
      }
      return this.executeOrder(task, raw);
    }

    const text = this.normalizeMessage(raw) || raw;
    return this.chat(text);
  },

  async executeOrder(task, raw, opts) {
    await this.autoStart();
    if (!(await this.ensureSession())) return { error: 'session expired' };

    const judge = this.parseCauseJudge(raw);
    if (judge) {
      this.fallbackPrefs.causeJudge = judge.ruling;
      this.savePrefs();
      AciCli?.print('Cause judge ruling — architect authority', 'ok');
      try {
        await ACI?.teach?.('Architect cause judge: ' + judge.ruling);
      } catch (_) {}
    }

    const m = String(task || '').trim();
    if (!m) return { error: 'empty order' };

    AciCli?.print('OWNER ORDER — executing: ' + m.slice(0, 100), 'cmd');
    GlobeDeck?.onUserMessage('ORDER — ' + m.slice(0, 40));
    MapDepict?.action('think', { detail: 'ORDER: ' + m.slice(0, 40) });

    try {
      GlobeDeck?.setThinking(true, 'Executing owner order…');

      const r = await AciCli.api({
        mode: 'coders_chat',
        message: m,
        explicit_order: true,
        owner_judge: !!judge,
        cause_ruling: judge?.ruling || this.fallbackPrefs.causeJudge || '',
        history: this.history.slice(-10),
        fallback_prefs: this.fallbackPrefs,
      });

      const eng = this.wantsComposer(m) ? 'composer' : 'grok';
      const build = await this.queueCoder(m, eng);
      let merged = { ...r, order_executed: true };
      if (build.text && !build.error) {
        merged.text = (r.text || r.response || '') + '\n\n[ORDER #' + (build.summon_id || '?') + ']\n' + build.text;
        merged.response = merged.text;
        merged.summon_id = build.summon_id;
        merged.composer_queued = build.composer_queued;
      }

      if (opts?.deploy || /^deploy\b/i.test(m)) {
        await AciConnect?.deploy?.(m.replace(/^deploy\s*/i, ''));
      }

      GlobeDeck?.setThinking(false);
      ACIControl?.reply('Order executing — #' + (merged.summon_id || 'queued'));
      return this._applyResponse(merged, raw);
    } catch (e) {
      GlobeDeck?.setThinking(false);
      const msg = String(e.message || e);
      GlobeDeck?.showError('Order failed: ' + msg);
      return { error: msg };
    }
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
      if (tries > 36) {
        this.stopPoll();
        if (r?.status !== 'answered') this._pollTimeoutFallback(summonId);
      }
    }, 5000);
  },

  async _pollTimeoutFallback(summonId) {
    if (!Auth?.user) return;
    if (AciCli) AciCli.print('Composer poll timeout — asking Grok…', 'dim');
    const last = this.history.filter(h => h.role === 'user').pop();
    const task = last?.content || 'summon follow-up';
    const q = await this.queueCoder(task, 'grok');
    if (q.text && AciCli) AciCli.print('Grok fallback #' + (summonId || '?') + ': ' + q.text.slice(0, 500), 'out');
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
    if (r.text && !r.pending) {
      GlobeDeck?.expand('Coders — Composer reply');
      ACIControl?.reply('Composer #' + id + ': ' + r.text.slice(0, 160));
    }
    return r;
  },

  async listSummons() {
    if (!Auth?.user) {
      AciCli?.print('sign in with G to list your summons', 'dim');
      return { error: 'login required' };
    }
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
      this.loadEngine();
    }
    const text = r.text || r.response || r.error || '';
    if (r.summon_id) this.lastSummonId = r.summon_id;

    this.history.push({ role: 'user', content: userMsg });
    if (text) {
      this.history.push({ role: 'assistant', content: text });
      if (this.history.length > 20) this.history = this.history.slice(-20);
    }

    const reply = text.slice(0, 900);
    if (reply) {
      const prefix = r.explicit_order || r.order_executed ? 'ORDER: ' : '';
      ACIControl?.reply(prefix + reply.slice(0, 260));
    }

    const composerQueued = r.composer_queued || (r.pending && r.summon_id);
    if (composerQueued && AciCli) AciCli.print('Composer also queued #' + composerQueued, 'dim');
    if (composerQueued) this.startPoll(composerQueued);
    else this.stopPoll();

    if (!r.pending && Voice.maySpeak() && Voice.shouldSpeak(text)) {
      speak(text.slice(0, 120), () => resumeListening());
    }

    this.observeActivity('chat', userMsg, { coders: true, guest: !!r.guest });
    FieldBrain?.pulse?.('think', 'coders: ' + userMsg.slice(0, 48), {
      role: Auth?.user ? 'client' : 'anon',
      props: { coders: true, guest: !!r.guest, always_on: true },
    });
    return r;
  },

  isBuildTask(m) {
    const s = String(m || '').toLowerCase();
    if (/^(why|what|how|do we|list|status|credits|explain|try|skip|use)\b/.test(s)) return false;
    return /fix|build|implement|add|create|remove|button|locate|globe|vendor|order|mobile|φτιάξε|πρόσθεσε/.test(s) && s.length >= 8;
  },

  wantsComposer(m) {
    return this.fallbackPrefs.force === 'composer'
      || /^use\s+composer|queue\s+composer|back\s+to\s+composer/i.test(String(m || ''));
  },

  async queueCoder(task, engine) {
    if (!Auth?.user) return { error: 'sign in with G for build queue' };
    const eng = engine || (this.wantsComposer(task) ? 'composer' : 'grok');
    const q = await AciCli.api({
      mode: 'coders',
      task: task,
      coder_engine: eng,
      history: this.history.slice(-6),
      fallback_prefs: this.fallbackPrefs,
    });
    if (q.error && AciCli) AciCli.print('coders error: ' + q.error, 'err');
    if (q.summon_id) {
      this.lastSummonId = q.summon_id;
      if (q.composer_queued) this.startPoll(q.composer_queued);
    }
    return q;
  },

  async chat(message) {
    await this.autoStart();

    const m = String(message || '').trim();
    if (m.length < 1) return { error: 'empty' };

    if (Auth?.user && !(await this.ensureSession())) return { error: 'session expired' };

    const build = this.isBuildTask(m);
    const fast = !build && !this.wantsComposer(m);

    GlobeDeck?.onUserMessage(Auth?.user ? 'Coders' : 'Coders · guest');
    if (GlobeDeck) GlobeDeck.activeTask = 'coders';
    if (!fast) MapDepict?.action('think', { detail: 'coders: ' + m.slice(0, 40) });

    this._cliBusy = true;
    try {
      GlobeDeck?.setThinking(true, fast ? 'Coders…' : ('Coders — ' + this.CAUSE + '…'));
      if (/^locate\s*(me|button)?$/i.test(m.trim()) || /^🎯|📍$/.test(m.trim())) {
        locateMe();
        GlobeDeck?.setThinking(false);
        return { ok: true, located: true };
      }

      if (Auth?.user && this.wantsComposer(m) && build) {
        const q = await this.queueCoder(m, 'composer');
        GlobeDeck?.setThinking(false);
        if (q.text && !q.error) {
          return this._applyResponse({ ...q, label: q.label || 'Astranov Coders', team: true }, m);
        }
      }

      const r = await AciCli.api({
        mode: 'coders_chat',
        message: m,
        fast,
        history: this.history.slice(fast ? -4 : -8),
        fallback_prefs: this.fallbackPrefs,
      }, { timeoutMs: fast ? 28000 : 55000 });

      if (r.error) {
        if (Auth?.user && build) {
          const q = await this.queueCoder(m, 'grok');
          if (q.text && !q.error) {
            GlobeDeck?.setThinking(false);
            return this._applyResponse({ ...q, text: q.text, team: true }, m);
          }
        }
        GlobeDeck?.setThinking(false);
        GlobeDeck?.showError('Coders: ' + r.error);
        return r;
      }

      if (Auth?.user && build && !r.text && !r.response && !r.summon_id) {
        const q = await this.queueCoder(m, 'grok');
        if (q.text) {
          r.text = q.text;
          r.response = q.text;
          r.summon_id = q.summon_id;
          r.composer_queued = q.composer_queued;
        }
      }

      GlobeDeck?.setThinking(false);
      return this._applyResponse(r, m);
    } catch (e) {
      GlobeDeck?.setThinking(false);
      const msg = String(e.message || e);
      GlobeDeck?.showError('Coders failed: ' + msg);
      if (Auth?.user && build) {
        const q = await this.queueCoder(m, 'grok');
        if (q.text) return this._applyResponse({ ...q, team: true }, m);
      }
      return { error: msg };
    } finally {
      this._cliBusy = false;
    }
  },

  async handleCodersCommand(rest) {
    return this.handleMessage(rest ? ('coders ' + rest) : 'coders');
  },

  async openTeam(intro) {
    await this.autoStart();
    const msg = intro && intro.trim().length > 0 ? intro.trim() : 'online';
    return this.chat(msg);
  },

  async summon(task) {
    return this.chat(task);
  },
};
window.AciCoders = AciCoders;