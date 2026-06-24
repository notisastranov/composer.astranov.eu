// === ACI CLI — Collective dev terminal (login required) ===
const AciCli = {
  open: false,
  history: [],
  histIdx: -1,
  buffer: '',

  init() {
    const input = document.getElementById('aci-cli-in');
    const toggle = document.getElementById('aci-cli-toggle');
    const close = document.getElementById('aci-cli-close');
    if (toggle) toggle.onclick = () => this.toggle();
    if (close) close.onclick = () => this.hide();
    if (input) {
      input.addEventListener('keydown', e => this.onKey(e));
      input.addEventListener('input', () => { this.buffer = input.value; });
    }
    window.addEventListener('keydown', e => {
      if (!Auth?.user) return;
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && document.activeElement?.id !== 'aci-input') {
        e.preventDefault();
        this.toggle();
      }
    });
    this.onAuthChange();
  },

  onAuthChange() {
    const panel = document.getElementById('aci-cli');
    const toggle = document.getElementById('aci-cli-toggle');
    const logged = !!(Auth && Auth.user);
    if (toggle) toggle.style.display = logged ? 'inline-flex' : 'none';
    if (!logged) {
      this._welcomed = false;
      this.hide();
      if (panel) panel.classList.remove('visible');
      return;
    }
    const name = Auth.user.user_metadata?.full_name || Auth.user.email?.split('@')[0] || 'dev';
    const prompt = document.getElementById('aci-cli-prompt');
    if (prompt) prompt.textContent = name + '@collective $';
    this.loadHistory();
    if (!this._welcomed) {
      this._welcomed = true;
      this.show();
      this.print('Collective CLI unlocked — you + ACI continue development here.');
      this.print('Type help · ` toggles · exit closes');
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
      ACIControl?.reply('Sign in with G to unlock Collective CLI');
      Auth?.signInGoogle();
      return;
    }
    this.open ? this.hide() : this.show();
  },

  show() {
    if (!Auth?.user) return;
    this.open = true;
    if (!document.getElementById('aci-cli-out')?.childElementCount) {
      this.print('Astranov Collective CLI — authenticated dev shell');
    }
    const panel = document.getElementById('aci-cli');
    if (panel) panel.classList.add('visible');
    document.getElementById('aci-cli-in')?.focus();
    MapDepict?.action('think', { detail: 'CLI open' });
  },

  hide() {
    this.open = false;
    document.getElementById('aci-cli')?.classList.remove('visible');
  },

  print(text, cls) {
    const out = document.getElementById('aci-cli-out');
    if (!out) return;
    const line = document.createElement('div');
    line.className = 'cli-line' + (cls ? ' cli-' + cls : '');
    line.textContent = text;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
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
    return r.json().catch(() => ({ error: 'bad response' }));
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
        this.print('stats            — neuron & memory stats');
        this.print('mode <athenian|spartan|myrmidon>');
        this.print('vendors | order | vhf | drive | news');
        this.print('clear | exit | logout');
        this.print('…or any free text → think');
        return;
      }
      if (cmd === 'clear') {
        const out = document.getElementById('aci-cli-out');
        if (out) out.innerHTML = '';
        return;
      }
      if (cmd === 'exit' || cmd === 'close') { this.hide(); return; }
      if (cmd === 'logout') { await Auth.signOut(); this.print('signed out', 'ok'); return; }

      if (cmd === 'think') {
        if (!rest) { this.print('usage: think <prompt>', 'err'); return; }
        this.print('…', 'dim');
        const r = await ACI.think(rest);
        this.print(r || '(empty)', 'out');
        ACIControl?.reply(r);
        return;
      }
      if (cmd === 'evolve') {
        this.print('evolving…', 'dim');
        const r = await ACI.evolve(rest || 'cli');
        this.print(JSON.stringify(r || { ok: true }).slice(0, 400), 'out');
        return;
      }
      if (cmd === 'teach') {
        if (!rest) { this.print('usage: teach <content>', 'err'); return; }
        await ACI.teach(rest);
        this.print('remembered · neuron spawned', 'ok');
        return;
      }
      if (cmd === 'stats') {
        const r = await this.api({ mode: 'stats' });
        this.print(JSON.stringify(r, null, 0).slice(0, 500), 'out');
        return;
      }
      if (cmd === 'mode') {
        ACI.thinkMode = rest || '';
        this.print('mode: ' + (ACI.thinkMode || 'default'), 'ok');
        return;
      }
      if (cmd === 'vendors') { await Commerce.loadVendors(); Commerce.announceVendors(); this.print('vendors on globe', 'ok'); return; }
      if (cmd === 'order') { await Commerce.orderPitogyra(); this.print('order placed', 'ok'); return; }
      if (cmd === 'vhf') { Comms.startVHF(); this.print('PMR panel open', 'ok'); return; }
      if (cmd === 'drive') {
        DrivingView?.activate?.();
        this.print('driving view (needs GPS speed)', 'ok');
        return;
      }
      if (cmd === 'news') { NewsFeed.flash(); this.print('news', 'ok'); return; }

      this.print('…', 'dim');
      const ans = await ACI.think(line);
      this.print(ans || '(empty)', 'out');
      ACIControl?.reply(ans);
    } catch (err) {
      this.print('error: ' + (err.message || err), 'err');
    }
  }
};
window.AciCli = AciCli;